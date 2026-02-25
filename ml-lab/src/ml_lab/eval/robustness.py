from __future__ import annotations

import io
import logging
from typing import Any

import cv2
import numpy as np
import pandas as pd
from PIL import Image

from ml_lab.eval.metrics import compute_binary_metrics
from ml_lab.features.cfa import compute_cfa_features
from ml_lab.features.dwt_svd import compute_dwt_svd_features
from ml_lab.features.ela import compute_ela_features
from ml_lab.features.image_ops import load_rgb_image
from ml_lab.features.mantra import compute_mantra_features
from ml_lab.features.prnu import compute_prnu_features

LOGGER = logging.getLogger(__name__)


def _jpeg_recompress(image_rgb: np.ndarray, quality: int) -> np.ndarray:
    pil = Image.fromarray(image_rgb)
    buffer = io.BytesIO()
    pil.save(buffer, format="JPEG", quality=int(quality))
    buffer.seek(0)
    with Image.open(buffer) as reloaded:
        return np.array(reloaded.convert("RGB"), dtype=np.uint8)


def _resize_scale(image_rgb: np.ndarray, scale: float) -> np.ndarray:
    h, w = image_rgb.shape[:2]
    nw = max(16, int(w * scale))
    nh = max(16, int(h * scale))
    resized = cv2.resize(image_rgb, (nw, nh), interpolation=cv2.INTER_LINEAR)
    return cv2.resize(resized, (w, h), interpolation=cv2.INTER_LINEAR)


def _gaussian_blur(image_rgb: np.ndarray, sigma: float) -> np.ndarray:
    return cv2.GaussianBlur(image_rgb, (0, 0), sigmaX=float(sigma))


def _gaussian_noise(image_rgb: np.ndarray, std: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    noise = rng.normal(0, std, size=image_rgb.shape).astype(np.float32)
    noisy = np.clip(image_rgb.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    return noisy


def _salt_pepper(image_rgb: np.ndarray, amount: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    out = image_rgb.copy()
    total = image_rgb.shape[0] * image_rgb.shape[1]
    n_salt = int(total * amount / 2.0)
    n_pepper = int(total * amount / 2.0)

    ys = rng.integers(0, image_rgb.shape[0], size=n_salt)
    xs = rng.integers(0, image_rgb.shape[1], size=n_salt)
    out[ys, xs] = 255

    ys = rng.integers(0, image_rgb.shape[0], size=n_pepper)
    xs = rng.integers(0, image_rgb.shape[1], size=n_pepper)
    out[ys, xs] = 0
    return out


def _apply_single_perturbation(image_rgb: np.ndarray, scenario: dict[str, Any], seed: int) -> np.ndarray:
    scenario_type = scenario["type"]
    if scenario_type == "jpeg":
        return _jpeg_recompress(image_rgb, quality=int(scenario["quality"]))
    if scenario_type == "resize":
        return _resize_scale(image_rgb, scale=float(scenario["scale"]))
    if scenario_type == "blur":
        return _gaussian_blur(image_rgb, sigma=float(scenario["sigma"]))
    if scenario_type == "gaussian_noise":
        return _gaussian_noise(image_rgb, std=float(scenario["std"]), seed=seed)
    if scenario_type == "salt_pepper":
        return _salt_pepper(image_rgb, amount=float(scenario["amount"]), seed=seed)
    raise ValueError(f"Unsupported perturbation type: {scenario_type}")


def _apply_perturbation(image_rgb: np.ndarray, scenario: dict[str, Any], seed: int) -> np.ndarray:
    if scenario["type"] != "chained":
        return _apply_single_perturbation(image_rgb, scenario, seed)

    result = image_rgb
    for i, step in enumerate(scenario.get("pipeline", [])):
        result = _apply_single_perturbation(result, step, seed + i + 1)
    return result


def run_robustness_suite(
    test_manifest: pd.DataFrame,
    method_results: dict[str, Any],
    config: dict[str, Any],
) -> tuple[pd.DataFrame, dict[str, pd.DataFrame]]:
    if not bool(config["robustness"].get("enabled", False)):
        return pd.DataFrame(), {}

    image_size = tuple(config["experiment"]["image_size"])
    ela_cfg = config["features"]["ela"]
    dwt_cfg = config["features"]["dwt"]
    cfa_cfg = config["features"].get("cfa", {})
    prnu_cfg = config["features"].get("prnu", {})
    mantra_cfg = config["features"].get("mantra", {})
    scenarios = config["robustness"]["scenarios"]

    rows: list[dict[str, Any]] = []
    prediction_dump: dict[str, pd.DataFrame] = {}

    for scenario in scenarios:
        scenario_name = str(scenario["name"])
        LOGGER.info("Running robustness scenario: %s", scenario_name)
        scenario_method_predictions: dict[str, list[dict[str, Any]]] = {method: [] for method in method_results}

        for image_idx, row in enumerate(test_manifest.itertuples(index=False)):
            base_img = load_rgb_image(row.image_path, image_size=image_size)
            perturbed = _apply_perturbation(base_img, scenario=scenario, seed=int(config["experiment"]["seed"]) + image_idx)

            ela_features, _, _ = compute_ela_features(
                image_rgb=perturbed,
                jpeg_quality=int(ela_cfg["jpeg_quality"]),
                high_threshold=float(ela_cfg["high_threshold"]),
                smooth_blur_kernel=int(ela_cfg["smooth_blur_kernel"]),
                with_heatmap=False,
            )
            dwt_features = compute_dwt_svd_features(
                image_rgb=perturbed,
                wavelet=str(dwt_cfg["wavelet"]),
                level=int(dwt_cfg["level"]),
                top_k_singular=int(dwt_cfg["top_k_singular"]),
            )
            cfa_features, _, _ = compute_cfa_features(
                image_rgb=perturbed,
                window_size=int(cfa_cfg.get("window_size", 7)),
                variance_threshold=float(cfa_cfg.get("variance_threshold", 0.6)),
                smooth_sigma=float(cfa_cfg.get("smooth_sigma", 1.0)),
                with_map=False,
            )
            prnu_features, _, _ = compute_prnu_features(
                image_rgb=perturbed,
                wavelet=str(prnu_cfg.get("wavelet", "db4")),
                level=int(prnu_cfg.get("level", 2)),
                with_map=False,
            )
            mantra_features, _, _ = compute_mantra_features(
                image_rgb=perturbed,
                config=mantra_cfg,
                with_mask=False,
            )
            full_row = {
                **ela_features,
                **dwt_features,
                **cfa_features,
                **prnu_features,
                **mantra_features,
            }

            for method, result in method_results.items():
                cols = result.feature_columns
                x = np.array([full_row[c] for c in cols], dtype=np.float32).reshape(1, -1)
                prob = float(result.model_pipeline.predict_proba(x)[0, 1])
                pred = int(prob >= result.threshold)
                scenario_method_predictions[method].append(
                    {
                        "image_path": row.image_path,
                        "label": int(row.label),
                        "probability": prob,
                        "prediction": pred,
                        "scenario": scenario_name,
                        "method": method,
                    }
                )

        for method, preds in scenario_method_predictions.items():
            pred_df = pd.DataFrame(preds)
            y_true = pred_df["label"].to_numpy(dtype=np.int32)
            y_prob = pred_df["probability"].to_numpy(dtype=np.float32)
            threshold = float(method_results[method].threshold)
            metrics = compute_binary_metrics(y_true=y_true, y_prob=y_prob, threshold=threshold)

            clean_f1 = method_results[method].split_metrics["test"]["f1"]
            if clean_f1 <= 1e-12:
                relative_drop = 0.0
            else:
                relative_drop = ((clean_f1 - metrics["f1"]) / clean_f1) * 100.0

            rows.append(
                {
                    "scenario": scenario_name,
                    "method": method,
                    **metrics,
                    "clean_f1": clean_f1,
                    "relative_drop_f1_pct": float(relative_drop),
                }
            )
            prediction_dump[f"{scenario_name}::{method}"] = pred_df

    return pd.DataFrame(rows), prediction_dump
