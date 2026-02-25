from __future__ import annotations

import base64
from pathlib import Path

import cv2
import numpy as np
import pywt


def _to_gray(image_rgb: np.ndarray) -> np.ndarray:
    return (
        0.299 * image_rgb[:, :, 0].astype(np.float32)
        + 0.587 * image_rgb[:, :, 1].astype(np.float32)
        + 0.114 * image_rgb[:, :, 2].astype(np.float32)
    )


def _wavelet_wiener_denoise(gray: np.ndarray, wavelet: str, level: int) -> np.ndarray:
    coeffs = pywt.wavedec2(gray, wavelet=wavelet, level=level)
    approx = coeffs[0]
    details = coeffs[1:]
    if not details:
        return gray.copy()

    hh_fine = details[-1][2]
    noise_sigma = float(np.median(np.abs(hh_fine)) / 0.6745) if hh_fine.size else 0.0
    noise_var = max(noise_sigma * noise_sigma, 1e-8)

    filtered_details: list[tuple[np.ndarray, np.ndarray, np.ndarray]] = []
    for lh, hl, hh in details:
        band_out: list[np.ndarray] = []
        for band in (lh, hl, hh):
            local_var = float(np.var(band))
            gain = max(local_var - noise_var, 0.0) / (local_var + 1e-8)
            band_out.append((band * gain).astype(np.float32))
        filtered_details.append((band_out[0], band_out[1], band_out[2]))

    denoised = pywt.waverec2([approx] + filtered_details, wavelet=wavelet)
    return denoised[: gray.shape[0], : gray.shape[1]].astype(np.float32)


def _normalize_map(x: np.ndarray) -> np.ndarray:
    x = np.abs(x)
    max_v = float(np.percentile(x, 99.0))
    if max_v <= 1e-8:
        return np.zeros_like(x, dtype=np.float32)
    return np.clip(x / max_v, 0.0, 1.0).astype(np.float32)


def _png_base64_from_map(x: np.ndarray) -> str:
    norm = _normalize_map(x)
    colored = cv2.applyColorMap((norm * 255.0).astype(np.uint8), cv2.COLORMAP_INFERNO)
    ok, encoded = cv2.imencode(".png", colored)
    if not ok:
        return ""
    return base64.b64encode(encoded.tobytes()).decode("ascii")


def save_prnu_map(residual: np.ndarray, output_path: str | Path) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    norm = _normalize_map(residual)
    colored = cv2.applyColorMap((norm * 255.0).astype(np.uint8), cv2.COLORMAP_INFERNO)
    cv2.imwrite(str(path), colored)


def build_prnu_reference(residual_maps: list[np.ndarray]) -> np.ndarray:
    if not residual_maps:
        raise ValueError("residual_maps must not be empty")
    stacked = np.stack([x.astype(np.float32) for x in residual_maps], axis=0)
    ref = stacked.mean(axis=0)
    ref = ref - float(ref.mean())
    norm = float(np.linalg.norm(ref))
    if norm <= 1e-8:
        return ref
    return ref / norm


def correlate_prnu_with_reference(residual: np.ndarray, reference: np.ndarray) -> float:
    if residual.shape != reference.shape:
        raise ValueError("residual and reference must have the same shape")
    a = residual.astype(np.float32).ravel()
    b = reference.astype(np.float32).ravel()
    a = a - float(a.mean())
    b = b - float(b.mean())
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom <= 1e-8:
        return 0.0
    return float(np.clip(np.dot(a, b) / denom, -1.0, 1.0))


def compute_prnu_features(
    image_rgb: np.ndarray,
    wavelet: str,
    level: int,
    with_map: bool = False,
) -> tuple[dict[str, float], np.ndarray, str | None]:
    gray = _to_gray(image_rgb)
    denoised = _wavelet_wiener_denoise(gray, wavelet=wavelet, level=level)
    residual = gray - denoised
    residual = residual - float(residual.mean())

    abs_res = np.abs(residual)
    row_mean = residual.mean(axis=1, keepdims=True)
    col_mean = residual.mean(axis=0, keepdims=True)
    pseudo_pattern = row_mean @ col_mean
    denom = float(np.linalg.norm(residual) * np.linalg.norm(pseudo_pattern))
    pseudo_corr = float(np.dot(residual.ravel(), pseudo_pattern.ravel()) / denom) if denom > 1e-8 else 0.0

    residual_energy = float(np.mean(residual * residual))
    gray_energy = float(np.mean(gray * gray)) + 1e-8
    high_ratio = float(np.mean(abs_res >= np.percentile(abs_res, 90)))

    features = {
        "prnu_residual_std": float(residual.std()),
        "prnu_residual_energy": residual_energy,
        "prnu_snr_estimate": float(residual_energy / gray_energy),
        "prnu_row_col_corr": float(np.clip(pseudo_corr, -1.0, 1.0)),
        "prnu_high_residual_ratio": high_ratio,
        "prnu_p95_abs_residual": float(np.percentile(abs_res, 95)),
    }
    map_b64 = _png_base64_from_map(residual) if with_map else None
    return features, residual, map_b64


def compute_simple_prnu_score(prnu_features: dict[str, float]) -> float:
    corr_penalty = 1.0 - (prnu_features["prnu_row_col_corr"] + 1.0) / 2.0
    score = (
        0.35 * min(1.0, prnu_features["prnu_snr_estimate"] * 40.0)
        + 0.30 * min(1.0, prnu_features["prnu_p95_abs_residual"] / 35.0)
        + 0.20 * prnu_features["prnu_high_residual_ratio"]
        + 0.15 * corr_penalty
    )
    return float(np.clip(score, 0.0, 1.0))
