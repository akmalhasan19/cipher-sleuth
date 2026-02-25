from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ml_lab.eval.metrics import compute_binary_metrics
from ml_lab.models.methods import get_method_feature_columns


@dataclass
class MethodTrainingResult:
    method: str
    threshold: float
    feature_columns: list[str]
    model_pipeline: Pipeline
    split_metrics: dict[str, dict[str, float]]
    predictions: dict[str, pd.DataFrame]


def _threshold_grid(threshold_cfg: dict[str, Any]) -> np.ndarray:
    return np.linspace(
        float(threshold_cfg["min_threshold"]),
        float(threshold_cfg["max_threshold"]),
        int(threshold_cfg["steps"]),
    )


def _build_classifier(classifier_cfg: dict[str, Any], random_state: int) -> LogisticRegression:
    if classifier_cfg.get("type") != "logistic_regression":
        raise ValueError("Only logistic_regression classifier is implemented in this lab")

    return LogisticRegression(
        max_iter=int(classifier_cfg["max_iter"]),
        class_weight=classifier_cfg.get("class_weight"),
        C=float(classifier_cfg["C"]),
        solver=classifier_cfg.get("solver", "lbfgs"),
        random_state=random_state,
    )


def _subset_by_split(df: pd.DataFrame, split: str) -> pd.DataFrame:
    out = df[df["split"] == split].reset_index(drop=True)
    if out.empty:
        raise ValueError(f"Feature table split '{split}' is empty")
    return out


def train_method(
    method: str,
    feature_table: pd.DataFrame,
    config: dict[str, Any],
) -> MethodTrainingResult:
    all_feature_columns = [
        col
        for col in feature_table.columns
        if col
        not in {
            "image_path",
            "label",
            "split",
            "mask_path",
            "source_dataset",
            "perturbation_tag",
        }
    ]
    method_feature_columns = get_method_feature_columns(method, all_feature_columns)
    if not method_feature_columns:
        raise RuntimeError(f"No feature columns selected for method {method}")

    train_df = _subset_by_split(feature_table, "train")
    val_df = _subset_by_split(feature_table, "val")
    test_df = _subset_by_split(feature_table, "test")

    x_train = train_df[method_feature_columns].to_numpy(dtype=np.float32)
    y_train = train_df["label"].to_numpy(dtype=np.int32)
    x_val = val_df[method_feature_columns].to_numpy(dtype=np.float32)
    y_val = val_df["label"].to_numpy(dtype=np.int32)

    classifier_cfg = config["model"]["classifier"]
    model_pipeline = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("clf", _build_classifier(classifier_cfg, random_state=int(config["experiment"]["seed"]))),
        ]
    )
    model_pipeline.fit(x_train, y_train)

    val_probs = model_pipeline.predict_proba(x_val)[:, 1]
    threshold_cfg = config["model"]["threshold_tuning"]
    metric_name = str(threshold_cfg["metric"])
    best_threshold = 0.5
    best_metric = -1.0
    for candidate in _threshold_grid(threshold_cfg):
        val_metrics = compute_binary_metrics(y_true=y_val, y_prob=val_probs, threshold=float(candidate))
        candidate_metric = val_metrics.get(metric_name, -1.0)
        if candidate_metric > best_metric:
            best_metric = candidate_metric
            best_threshold = float(candidate)

    split_metrics: dict[str, dict[str, float]] = {}
    predictions: dict[str, pd.DataFrame] = {}
    for split_name, split_df in [("train", train_df), ("val", val_df), ("test", test_df)]:
        x = split_df[method_feature_columns].to_numpy(dtype=np.float32)
        y_true = split_df["label"].to_numpy(dtype=np.int32)
        y_prob = model_pipeline.predict_proba(x)[:, 1]
        metrics = compute_binary_metrics(y_true=y_true, y_prob=y_prob, threshold=best_threshold)
        split_metrics[split_name] = metrics
        predictions[split_name] = pd.DataFrame(
            {
                "image_path": split_df["image_path"],
                "label": y_true,
                "probability": y_prob,
                "prediction": (y_prob >= best_threshold).astype(int),
            }
        )

    return MethodTrainingResult(
        method=method,
        threshold=best_threshold,
        feature_columns=method_feature_columns,
        model_pipeline=model_pipeline,
        split_metrics=split_metrics,
        predictions=predictions,
    )
