from __future__ import annotations

import base64
import logging
from pathlib import Path
from typing import Any

import cv2
import numpy as np

LOGGER = logging.getLogger(__name__)


def _to_gray(image_rgb: np.ndarray) -> np.ndarray:
    return (
        0.299 * image_rgb[:, :, 0].astype(np.float32)
        + 0.587 * image_rgb[:, :, 1].astype(np.float32)
        + 0.114 * image_rgb[:, :, 2].astype(np.float32)
    )


def _normalize_map(x: np.ndarray) -> np.ndarray:
    x = np.maximum(x, 0.0)
    max_v = float(np.percentile(x, 99.0))
    if max_v <= 1e-8:
        return np.zeros_like(x, dtype=np.float32)
    return np.clip(x / max_v, 0.0, 1.0).astype(np.float32)


def _map_png_base64(mask: np.ndarray) -> str:
    norm = _normalize_map(mask)
    colored = cv2.applyColorMap((norm * 255.0).astype(np.uint8), cv2.COLORMAP_PLASMA)
    ok, encoded = cv2.imencode(".png", colored)
    if not ok:
        return ""
    return base64.b64encode(encoded.tobytes()).decode("ascii")


def save_mantra_mask(mask: np.ndarray, output_path: str | Path) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    norm = _normalize_map(mask)
    colored = cv2.applyColorMap((norm * 255.0).astype(np.uint8), cv2.COLORMAP_PLASMA)
    cv2.imwrite(str(path), colored)


def _heuristic_mask(image_rgb: np.ndarray, blur_sigma: float = 1.2) -> np.ndarray:
    gray = _to_gray(image_rgb)
    blur = cv2.GaussianBlur(gray, (0, 0), sigmaX=max(0.1, float(blur_sigma)))
    highpass = np.abs(gray - blur)
    lap = np.abs(cv2.Laplacian(gray, cv2.CV_32F, ksize=3))
    block = np.abs(highpass - cv2.blur(highpass, (8, 8)))
    mask = 0.45 * _normalize_map(highpass) + 0.35 * _normalize_map(lap) + 0.20 * _normalize_map(block)
    return cv2.GaussianBlur(mask.astype(np.float32), (0, 0), sigmaX=0.8)


def _infer_torchscript(image_rgb: np.ndarray, checkpoint_path: Path) -> tuple[np.ndarray, str]:
    import torch  # lazy import for optional dependency

    model = torch.jit.load(str(checkpoint_path), map_location="cpu")
    model.eval()

    x = torch.from_numpy(image_rgb.astype(np.float32) / 255.0).permute(2, 0, 1).unsqueeze(0)
    with torch.no_grad():
        out = model(x)
    if isinstance(out, (tuple, list)):
        out = out[0]
    mask = out.squeeze().detach().cpu().numpy().astype(np.float32)
    if mask.ndim != 2:
        raise ValueError(f"TorchScript output shape is unsupported: {mask.shape}")
    if float(mask.min()) < 0.0 or float(mask.max()) > 1.0:
        mask = 1.0 / (1.0 + np.exp(-mask))
    return mask, "torchscript"


def compute_mantra_features(
    image_rgb: np.ndarray,
    config: dict[str, Any],
    with_mask: bool = False,
) -> tuple[dict[str, float], np.ndarray, str | None]:
    checkpoint = str(config.get("checkpoint_path", "")).strip()
    backend = "heuristic"
    mask: np.ndarray

    if checkpoint:
        checkpoint_path = Path(checkpoint)
        if checkpoint_path.exists():
            try:
                mask, backend = _infer_torchscript(image_rgb=image_rgb, checkpoint_path=checkpoint_path)
            except Exception as exc:
                LOGGER.warning("ManTra torchscript load failed (%s), fallback to heuristic.", exc)
                mask = _heuristic_mask(image_rgb=image_rgb, blur_sigma=float(config.get("heuristic_sigma", 1.2)))
        else:
            mask = _heuristic_mask(image_rgb=image_rgb, blur_sigma=float(config.get("heuristic_sigma", 1.2)))
    else:
        mask = _heuristic_mask(image_rgb=image_rgb, blur_sigma=float(config.get("heuristic_sigma", 1.2)))

    high_threshold = float(config.get("high_threshold", 0.65))
    high_ratio = float(np.mean(mask >= high_threshold))
    top_k_pct = float(config.get("top_k_percentile", 93.0))
    top_vals = mask[mask >= np.percentile(mask, top_k_pct)]
    top_mean = float(top_vals.mean()) if top_vals.size else float(mask.mean())

    features = {
        "mantra_score": float(np.clip(top_mean, 0.0, 1.0)),
        "mantra_mask_mean": float(mask.mean()),
        "mantra_mask_std": float(mask.std()),
        "mantra_mask_p95": float(np.percentile(mask, 95)),
        "mantra_high_ratio": high_ratio,
        "mantra_backend_torchscript": 1.0 if backend == "torchscript" else 0.0,
    }
    mask_b64 = _map_png_base64(mask) if with_mask else None
    return features, mask, mask_b64


def compute_simple_mantra_score(mantra_features: dict[str, float]) -> float:
    score = (
        0.45 * mantra_features["mantra_score"]
        + 0.25 * mantra_features["mantra_mask_p95"]
        + 0.20 * mantra_features["mantra_high_ratio"]
        + 0.10 * mantra_features["mantra_mask_std"]
    )
    return float(np.clip(score, 0.0, 1.0))
