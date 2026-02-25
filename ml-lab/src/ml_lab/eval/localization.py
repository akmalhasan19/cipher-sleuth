from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pandas as pd

from ml_lab.eval.metrics import compute_localization_metrics
from ml_lab.features.cfa import compute_cfa_features
from ml_lab.features.image_ops import load_rgb_image
from ml_lab.features.mantra import compute_mantra_features
from ml_lab.features.prnu import compute_prnu_features

LOGGER = logging.getLogger(__name__)


def _load_mask(mask_path: str, image_size: tuple[int, int]) -> np.ndarray | None:
    path = Path(mask_path)
    if not path.exists():
        return None
    raw = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if raw is None:
        return None
    resized = cv2.resize(raw, (image_size[1], image_size[0]), interpolation=cv2.INTER_NEAREST)
    return (resized.astype(np.float32) / 255.0).clip(0.0, 1.0)


def run_localization_suite(test_manifest: pd.DataFrame, config: dict[str, Any]) -> pd.DataFrame:
    if "mask_path" not in test_manifest.columns:
        return pd.DataFrame()

    has_mask = test_manifest["mask_path"].fillna("").astype(str).str.len() > 0
    eval_manifest = test_manifest[has_mask].reset_index(drop=True)
    if eval_manifest.empty:
        return pd.DataFrame()

    image_size = tuple(config["experiment"]["image_size"])
    cfa_cfg = config["features"].get("cfa", {})
    prnu_cfg = config["features"].get("prnu", {})
    mantra_cfg = config["features"].get("mantra", {})

    per_method_rows: list[dict[str, Any]] = []
    for row in eval_manifest.itertuples(index=False):
        try:
            mask_gt = _load_mask(str(row.mask_path), image_size=image_size)
            if mask_gt is None:
                continue

            image_rgb = load_rgb_image(row.image_path, image_size=image_size)
            _, cfa_map, _ = compute_cfa_features(
                image_rgb=image_rgb,
                window_size=int(cfa_cfg.get("window_size", 7)),
                variance_threshold=float(cfa_cfg.get("variance_threshold", 0.6)),
                smooth_sigma=float(cfa_cfg.get("smooth_sigma", 1.0)),
                with_map=False,
            )
            _, prnu_residual, _ = compute_prnu_features(
                image_rgb=image_rgb,
                wavelet=str(prnu_cfg.get("wavelet", "db4")),
                level=int(prnu_cfg.get("level", 2)),
                with_map=False,
            )
            _, mantra_mask, _ = compute_mantra_features(
                image_rgb=image_rgb,
                config=mantra_cfg,
                with_mask=False,
            )

            for method, pred_map in [
                ("cfa_map", cfa_map),
                ("prnu_residual_abs", np.abs(prnu_residual)),
                ("mantra_mask", mantra_mask),
            ]:
                pred_map = pred_map.astype(np.float32)
                pred_map = (pred_map - float(pred_map.min())) / (float(pred_map.max() - pred_map.min()) + 1e-6)
                metrics = compute_localization_metrics(pred_map=pred_map, gt_mask=mask_gt, threshold=0.5)
                per_method_rows.append(
                    {
                        "image_path": row.image_path,
                        "method": method,
                        **metrics,
                    }
                )
        except Exception as exc:
            LOGGER.warning("Localization eval failed for %s: %s", row.image_path, exc)

    if not per_method_rows:
        return pd.DataFrame()

    df = pd.DataFrame(per_method_rows)
    grouped = (
        df.groupby("method", as_index=False)[["iou", "dice", "pixel_f1", "pixel_precision", "pixel_recall"]]
        .mean()
        .sort_values("method")
        .reset_index(drop=True)
    )
    return grouped
