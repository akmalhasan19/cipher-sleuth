from __future__ import annotations

import base64
from pathlib import Path

import cv2
import numpy as np


def _to_gray(image_rgb: np.ndarray) -> np.ndarray:
    return (
        0.299 * image_rgb[:, :, 0].astype(np.float32)
        + 0.587 * image_rgb[:, :, 1].astype(np.float32)
        + 0.114 * image_rgb[:, :, 2].astype(np.float32)
    )


def _local_variance(x: np.ndarray, window_size: int) -> np.ndarray:
    k = window_size if window_size % 2 == 1 else window_size + 1
    mean = cv2.GaussianBlur(x, (k, k), sigmaX=0)
    mean_sq = cv2.GaussianBlur(x * x, (k, k), sigmaX=0)
    return np.maximum(mean_sq - (mean * mean), 0.0)


def _largest_component_ratio(mask: np.ndarray) -> float:
    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    if num_labels <= 1:
        return 0.0
    max_area = stats[1:, cv2.CC_STAT_AREA].max()
    return float(max_area / mask.size)


def _normalize_map(x: np.ndarray) -> np.ndarray:
    x = np.maximum(x, 0.0)
    max_v = float(np.percentile(x, 99.0))
    if max_v <= 1e-8:
        return np.zeros_like(x, dtype=np.float32)
    return np.clip(x / max_v, 0.0, 1.0).astype(np.float32)


def _map_png_base64(x: np.ndarray) -> str:
    norm = _normalize_map(x)
    colored = cv2.applyColorMap((norm * 255.0).astype(np.uint8), cv2.COLORMAP_TURBO)
    ok, encoded = cv2.imencode(".png", colored)
    if not ok:
        return ""
    return base64.b64encode(encoded.tobytes()).decode("ascii")


def save_cfa_map(cfa_map: np.ndarray, output_path: str | Path) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    norm = _normalize_map(cfa_map)
    colored = cv2.applyColorMap((norm * 255.0).astype(np.uint8), cv2.COLORMAP_TURBO)
    cv2.imwrite(str(path), colored)


def compute_cfa_features(
    image_rgb: np.ndarray,
    window_size: int,
    variance_threshold: float,
    smooth_sigma: float,
    with_map: bool = False,
) -> tuple[dict[str, float], np.ndarray, str | None]:
    gray = _to_gray(image_rgb)

    interp_h = 0.5 * (np.roll(gray, 1, axis=1) + np.roll(gray, -1, axis=1))
    interp_v = 0.5 * (np.roll(gray, 1, axis=0) + np.roll(gray, -1, axis=0))
    demosaic_err = np.abs(interp_h - interp_v)

    local_var = _local_variance(demosaic_err, window_size=window_size)

    phase_means = np.array(
        [
            float(local_var[0::2, 0::2].mean()),
            float(local_var[0::2, 1::2].mean()),
            float(local_var[1::2, 0::2].mean()),
            float(local_var[1::2, 1::2].mean()),
        ],
        dtype=np.float32,
    )

    expected = np.empty_like(local_var, dtype=np.float32)
    expected[0::2, 0::2] = phase_means[0]
    expected[0::2, 1::2] = phase_means[1]
    expected[1::2, 0::2] = phase_means[2]
    expected[1::2, 1::2] = phase_means[3]

    inconsistency = np.abs(local_var - expected) / (expected + 1e-6)
    cfa_map = cv2.GaussianBlur(inconsistency, (0, 0), sigmaX=max(0.1, float(smooth_sigma)))

    high_mask = cfa_map >= float(variance_threshold)
    phase_dispersion = float(np.std(phase_means) / (np.mean(phase_means) + 1e-6))

    features = {
        "cfa_var_mean": float(cfa_map.mean()),
        "cfa_var_std": float(cfa_map.std()),
        "cfa_p95_inconsistency": float(np.percentile(cfa_map, 95)),
        "cfa_high_inconsistency_ratio": float(high_mask.mean()),
        "cfa_largest_hotspot_ratio": float(_largest_component_ratio(high_mask)),
        "cfa_phase_dispersion": phase_dispersion,
    }

    map_b64 = _map_png_base64(cfa_map) if with_map else None
    return features, cfa_map, map_b64


def compute_simple_cfa_score(cfa_features: dict[str, float]) -> float:
    score = (
        0.30 * cfa_features["cfa_high_inconsistency_ratio"]
        + 0.20 * cfa_features["cfa_largest_hotspot_ratio"]
        + 0.25 * min(1.0, cfa_features["cfa_p95_inconsistency"] / 3.0)
        + 0.25 * min(1.0, cfa_features["cfa_phase_dispersion"] / 1.5)
    )
    return float(np.clip(score, 0.0, 1.0))
