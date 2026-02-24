from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy import stats


def _paired_accuracy_vector(pred_df: pd.DataFrame) -> np.ndarray:
    return (pred_df["prediction"].to_numpy(dtype=np.int32) == pred_df["label"].to_numpy(dtype=np.int32)).astype(float)


def _cohen_d_paired(diff: np.ndarray) -> float:
    denom = float(np.std(diff, ddof=1))
    if denom < 1e-12:
        return 0.0
    return float(np.mean(diff) / denom)


def _rank_biserial_from_diff(diff: np.ndarray) -> float:
    non_zero = diff[diff != 0]
    if non_zero.size == 0:
        return 0.0
    positive = float(np.sum(non_zero > 0))
    negative = float(np.sum(non_zero < 0))
    return float((positive - negative) / (positive + negative))


def run_method_comparison_stats(
    predictions_by_method: dict[str, pd.DataFrame],
    primary_method: str,
) -> pd.DataFrame:
    if primary_method not in predictions_by_method:
        raise ValueError(f"Primary method '{primary_method}' not found in predictions")

    rows: list[dict[str, Any]] = []
    primary_df = predictions_by_method[primary_method].sort_values("image_path").reset_index(drop=True)
    primary_acc = _paired_accuracy_vector(primary_df)

    for method, baseline_df in predictions_by_method.items():
        if method == primary_method:
            continue
        baseline_df = baseline_df.sort_values("image_path").reset_index(drop=True)
        if not np.array_equal(primary_df["image_path"].to_numpy(), baseline_df["image_path"].to_numpy()):
            raise ValueError(f"Prediction rows do not align for statistical test: {method}")

        baseline_acc = _paired_accuracy_vector(baseline_df)
        diff = primary_acc - baseline_acc

        shapiro_p = np.nan
        if len(diff) >= 3:
            _, shapiro_p = stats.shapiro(diff)

        if np.isnan(shapiro_p) or shapiro_p < 0.05:
            test_name = "wilcoxon_signed_rank"
            try:
                stat, p_value = stats.wilcoxon(primary_acc, baseline_acc, zero_method="wilcox")
            except ValueError:
                stat, p_value = 0.0, 1.0
            effect_size = _rank_biserial_from_diff(diff)
            effect_name = "rank_biserial"
        else:
            test_name = "paired_t_test"
            stat, p_value = stats.ttest_rel(primary_acc, baseline_acc)
            effect_size = _cohen_d_paired(diff)
            effect_name = "cohen_d_paired"

        rows.append(
            {
                "primary_method": primary_method,
                "baseline_method": method,
                "normality_shapiro_p": float(shapiro_p) if not np.isnan(shapiro_p) else float("nan"),
                "test_name": test_name,
                "test_statistic": float(stat),
                "p_value": float(p_value),
                "effect_size_name": effect_name,
                "effect_size": float(effect_size),
                "mean_primary_acc": float(np.mean(primary_acc)),
                "mean_baseline_acc": float(np.mean(baseline_acc)),
            }
        )

    return pd.DataFrame(rows)
