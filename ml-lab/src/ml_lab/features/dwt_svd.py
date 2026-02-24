from __future__ import annotations

import numpy as np
import pywt


def _svd_top_k(matrix: np.ndarray, top_k: int) -> np.ndarray:
    singular_values = np.linalg.svd(matrix, compute_uv=False)
    if singular_values.size >= top_k:
        return singular_values[:top_k]
    padded = np.zeros(top_k, dtype=np.float32)
    padded[: singular_values.size] = singular_values.astype(np.float32)
    return padded


def compute_dwt_svd_features(
    image_rgb: np.ndarray,
    wavelet: str,
    level: int,
    top_k_singular: int,
) -> dict[str, float]:
    gray = (
        0.299 * image_rgb[:, :, 0].astype(np.float32)
        + 0.587 * image_rgb[:, :, 1].astype(np.float32)
        + 0.114 * image_rgb[:, :, 2].astype(np.float32)
    )
    coeffs = pywt.wavedec2(gray, wavelet=wavelet, level=level)
    approx = coeffs[0]
    details = coeffs[1:]

    features: dict[str, float] = {}
    detail_energies: list[float] = []
    all_singular: list[np.ndarray] = []

    for i, (lh, hl, hh) in enumerate(details, start=1):
        for band_name, band in [("lh", lh), ("hl", hl), ("hh", hh)]:
            energy = float(np.sum(np.square(band)))
            detail_energies.append(energy)
            sv = _svd_top_k(band, top_k_singular)
            all_singular.append(sv)
            band_prefix = f"dwt_l{i}_{band_name}"
            features[f"{band_prefix}_energy"] = energy
            features[f"{band_prefix}_sv_mean"] = float(np.mean(sv))
            features[f"{band_prefix}_sv_std"] = float(np.std(sv))
            features[f"{band_prefix}_sv_dispersion"] = float(np.std(sv) / (np.mean(sv) + 1e-8))
            features[f"{band_prefix}_sv_top1"] = float(sv[0])
            features[f"{band_prefix}_sv_topk_sum"] = float(np.sum(sv))

    total_detail_energy = float(np.sum(detail_energies)) + 1e-8
    for i, energy in enumerate(detail_energies):
        features[f"dwt_detail_energy_ratio_{i}"] = float(energy / total_detail_energy)

    approx_sv = _svd_top_k(approx, top_k_singular)
    features["dwt_approx_energy"] = float(np.sum(np.square(approx)))
    features["dwt_approx_sv_mean"] = float(np.mean(approx_sv))
    features["dwt_approx_sv_std"] = float(np.std(approx_sv))

    singular_concat = np.concatenate(all_singular, axis=0)
    features["dwt_singular_global_mean"] = float(np.mean(singular_concat))
    features["dwt_singular_global_std"] = float(np.std(singular_concat))
    features["dwt_singular_global_dispersion"] = float(
        np.std(singular_concat) / (np.mean(singular_concat) + 1e-8)
    )
    features["dwt_singular_topk_dynamic"] = float(
        np.mean(singular_concat[:top_k_singular]) / (np.mean(singular_concat[-top_k_singular:]) + 1e-8)
    )
    return features


def compute_simple_dwt_svd_score(dwt_features: dict[str, float]) -> float:
    dispersion = min(1.0, dwt_features.get("dwt_singular_global_dispersion", 0.0))
    dynamics = min(2.0, dwt_features.get("dwt_singular_topk_dynamic", 0.0)) / 2.0
    ratio0 = min(1.0, dwt_features.get("dwt_detail_energy_ratio_0", 0.0) * 3.0)
    score = 0.45 * dispersion + 0.35 * dynamics + 0.20 * ratio0
    return float(np.clip(score, 0.0, 1.0))
