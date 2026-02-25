from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd
from tqdm import tqdm

from .cfa import compute_cfa_features, save_cfa_map
from .dwt_svd import compute_dwt_svd_features
from .ela import compute_ela_features, save_heatmap
from .image_ops import load_rgb_image
from .mantra import compute_mantra_features, save_mantra_mask
from .prnu import compute_prnu_features, save_prnu_map

LOGGER = logging.getLogger(__name__)


def extract_feature_table(
    manifest_split: pd.DataFrame,
    config: dict[str, Any],
) -> pd.DataFrame:
    image_size = tuple(config["experiment"]["image_size"])
    ela_cfg = config["features"]["ela"]
    dwt_cfg = config["features"]["dwt"]
    cfa_cfg = config["features"].get("cfa", {})
    prnu_cfg = config["features"].get("prnu", {})
    mantra_cfg = config["features"].get("mantra", {})

    heatmap_dir = Path(config["paths"]["heatmap_dir"])
    save_heatmaps = bool(ela_cfg.get("save_heatmaps", False))
    max_heatmaps_per_split = int(ela_cfg.get("max_heatmaps_per_split", 0))
    heatmap_counter: dict[str, int] = {}

    cfa_map_dir = Path(config["paths"]["figures_dir"]) / "cfa_maps"
    prnu_map_dir = Path(config["paths"]["figures_dir"]) / "prnu_maps"
    mantra_map_dir = Path(config["paths"]["figures_dir"]) / "mantra_masks"
    save_cfa_maps = bool(cfa_cfg.get("save_maps", False))
    save_prnu_maps = bool(prnu_cfg.get("save_maps", False))
    save_mantra_masks = bool(mantra_cfg.get("save_masks", False))

    records: list[dict[str, Any]] = []
    iterator = tqdm(manifest_split.itertuples(index=False), total=len(manifest_split), desc="Extracting features")
    for row in iterator:
        image_path = Path(row.image_path)
        split = str(row.split)

        try:
            image = load_rgb_image(image_path, image_size)
            ela_features, residual_gray, _ = compute_ela_features(
                image_rgb=image,
                jpeg_quality=int(ela_cfg["jpeg_quality"]),
                high_threshold=float(ela_cfg["high_threshold"]),
                smooth_blur_kernel=int(ela_cfg["smooth_blur_kernel"]),
                with_heatmap=False,
            )
            dwt_features = compute_dwt_svd_features(
                image_rgb=image,
                wavelet=str(dwt_cfg["wavelet"]),
                level=int(dwt_cfg["level"]),
                top_k_singular=int(dwt_cfg["top_k_singular"]),
            )
            cfa_features, cfa_map, _ = compute_cfa_features(
                image_rgb=image,
                window_size=int(cfa_cfg.get("window_size", 7)),
                variance_threshold=float(cfa_cfg.get("variance_threshold", 0.6)),
                smooth_sigma=float(cfa_cfg.get("smooth_sigma", 1.0)),
                with_map=False,
            )
            prnu_features, prnu_residual, _ = compute_prnu_features(
                image_rgb=image,
                wavelet=str(prnu_cfg.get("wavelet", "db4")),
                level=int(prnu_cfg.get("level", 2)),
                with_map=False,
            )
            mantra_features, mantra_mask, _ = compute_mantra_features(
                image_rgb=image,
                config=mantra_cfg,
                with_mask=False,
            )

            if save_heatmaps:
                split_count = heatmap_counter.get(split, 0)
                if split_count < max_heatmaps_per_split:
                    safe_name = image_path.stem.replace(" ", "_")
                    heatmap_path = heatmap_dir / split / f"{safe_name}.png"
                    save_heatmap(residual_gray, heatmap_path)
                    heatmap_counter[split] = split_count + 1

            if save_cfa_maps:
                safe_name = image_path.stem.replace(" ", "_")
                save_cfa_map(cfa_map, cfa_map_dir / split / f"{safe_name}.png")
            if save_prnu_maps:
                safe_name = image_path.stem.replace(" ", "_")
                save_prnu_map(prnu_residual, prnu_map_dir / split / f"{safe_name}.png")
            if save_mantra_masks:
                safe_name = image_path.stem.replace(" ", "_")
                save_mantra_mask(mantra_mask, mantra_map_dir / split / f"{safe_name}.png")

            records.append(
                {
                    "image_path": str(image_path),
                    "label": int(row.label),
                    "split": split,
                    "source_dataset": row.source_dataset,
                    "perturbation_tag": row.perturbation_tag,
                    "mask_path": getattr(row, "mask_path", None),
                    **ela_features,
                    **dwt_features,
                    **cfa_features,
                    **prnu_features,
                    **mantra_features,
                }
            )
        except Exception as exc:
            LOGGER.warning("Failed feature extraction for %s: %s", image_path, exc)

    if not records:
        raise RuntimeError("No features extracted; check dataset and decoding pipeline")

    return pd.DataFrame(records)
