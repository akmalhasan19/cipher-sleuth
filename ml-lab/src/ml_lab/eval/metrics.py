from __future__ import annotations

from typing import Callable

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


def compute_binary_metrics(y_true: np.ndarray, y_prob: np.ndarray, threshold: float) -> dict[str, float]:
    y_pred = (y_prob >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()

    try:
        auc = float(roc_auc_score(y_true, y_prob))
    except ValueError:
        auc = float("nan")

    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": auc,
        "tn": float(tn),
        "fp": float(fp),
        "fn": float(fn),
        "tp": float(tp),
        "threshold": float(threshold),
    }


def bootstrap_metric_ci(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    threshold: float,
    metric_name: str,
    n_bootstrap: int,
    confidence_level: float,
    seed: int,
) -> dict[str, float]:
    metric_lookup: dict[str, Callable[[np.ndarray, np.ndarray], float]] = {
        "accuracy": lambda yt, yp: float(accuracy_score(yt, yp)),
        "precision": lambda yt, yp: float(precision_score(yt, yp, zero_division=0)),
        "recall": lambda yt, yp: float(recall_score(yt, yp, zero_division=0)),
        "f1": lambda yt, yp: float(f1_score(yt, yp, zero_division=0)),
    }
    if metric_name not in metric_lookup:
        raise ValueError(f"Unsupported metric for bootstrap: {metric_name}")

    rng = np.random.default_rng(seed)
    y_pred = (y_prob >= threshold).astype(int)
    indices = np.arange(len(y_true))
    scores: list[float] = []
    metric_fn = metric_lookup[metric_name]

    for _ in range(n_bootstrap):
        sample_idx = rng.choice(indices, size=len(indices), replace=True)
        yt = y_true[sample_idx]
        yp = y_pred[sample_idx]
        scores.append(metric_fn(yt, yp))

    alpha = (1.0 - confidence_level) / 2.0
    lower = float(np.quantile(scores, alpha))
    upper = float(np.quantile(scores, 1.0 - alpha))
    return {
        "metric": metric_name,
        "mean": float(np.mean(scores)),
        "std": float(np.std(scores)),
        "ci_lower": lower,
        "ci_upper": upper,
    }
