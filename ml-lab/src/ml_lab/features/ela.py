from __future__ import annotations

import base64
import io
import logging
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image

LOGGER = logging.getLogger(__name__)


def _recompress_jpeg_cv2(image_rgb: np.ndarray, quality: int) -> np.ndarray:
    image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
    success, encoded = cv2.imencode(".jpg", image_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not success:
        raise ValueError("OpenCV JPEG encoding failed")
    decoded = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if decoded is None:
        raise ValueError("OpenCV JPEG decoding failed")
    return cv2.cvtColor(decoded, cv2.COLOR_BGR2RGB)


def _recompress_jpeg_pil(image_rgb: np.ndarray, quality: int) -> np.ndarray:
    pil = Image.fromarray(image_rgb)
    buffer = io.BytesIO()
    pil.save(buffer, format="JPEG", quality=int(quality))
    buffer.seek(0)
    with Image.open(buffer) as reread:
        reread = reread.convert("RGB")
        return np.array(reread, dtype=np.uint8)


def _largest_component_ratio(mask: np.ndarray) -> float:
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    if num_labels <= 1:
        return 0.0
    max_area = stats[1:, cv2.CC_STAT_AREA].max()
    return float(max_area / mask.size)


def _heatmap_png_base64(residual_gray: np.ndarray) -> str:
    scaled = np.clip(residual_gray * 4.0, 0, 255).astype(np.uint8)
    colored = cv2.applyColorMap(scaled, cv2.COLORMAP_JET)
    success, encoded = cv2.imencode(".png", colored)
    if not success:
        return ""
    return base64.b64encode(encoded.tobytes()).decode("ascii")


def save_heatmap(residual_gray: np.ndarray, output_path: str | Path) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    scaled = np.clip(residual_gray * 4.0, 0, 255).astype(np.uint8)
    colored = cv2.applyColorMap(scaled, cv2.COLORMAP_JET)
    cv2.imwrite(str(path), colored)


def compute_ela_features(
    image_rgb: np.ndarray,
    jpeg_quality: int,
    high_threshold: float,
    smooth_blur_kernel: int,
    with_heatmap: bool = False,
) -> tuple[dict[str, float], np.ndarray, str | None]:
    try:
        recompressed = _recompress_jpeg_cv2(image_rgb, jpeg_quality)
    except Exception as first_error:
        LOGGER.debug("OpenCV recompress failed, fallback to PIL: %s", first_error)
        recompressed = _recompress_jpeg_pil(image_rgb, jpeg_quality)

    residual = np.abs(image_rgb.astype(np.float32) - recompressed.astype(np.float32))
    residual_gray = residual.mean(axis=2)

    high_mask = residual_gray >= float(high_threshold)
    kernel = smooth_blur_kernel if smooth_blur_kernel % 2 == 1 else smooth_blur_kernel + 1
    smoothed = cv2.GaussianBlur(residual_gray, (kernel, kernel), sigmaX=1.2)
    smooth_high_mask = smoothed >= float(high_threshold)

    features = {
        "ela_mean_residual": float(residual_gray.mean()),
        "ela_std_residual": float(residual_gray.std()),
        "ela_p95_residual": float(np.percentile(residual_gray, 95)),
        "ela_high_residual_ratio": float(high_mask.mean()),
        "ela_smooth_high_residual_ratio": float(smooth_high_mask.mean()),
        "ela_largest_hotspot_ratio": float(_largest_component_ratio(high_mask)),
    }

    heatmap_b64 = _heatmap_png_base64(residual_gray) if with_heatmap else None
    return features, residual_gray, heatmap_b64


def compute_simple_ela_score(ela_features: dict[str, float]) -> float:
    score = (
        0.35 * ela_features["ela_high_residual_ratio"]
        + 0.25 * ela_features["ela_smooth_high_residual_ratio"]
        + 0.20 * ela_features["ela_largest_hotspot_ratio"]
        + 0.20 * min(1.0, ela_features["ela_p95_residual"] / 80.0)
    )
    return float(np.clip(score, 0.0, 1.0))


def get_ela_top_signals(ela_features: dict[str, float]) -> list[str]:
    ranked = sorted(
        ela_features.items(),
        key=lambda item: abs(float(item[1])),
        reverse=True,
    )
    return [name for name, _ in ranked[:3]]
