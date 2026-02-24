from __future__ import annotations

import argparse
import copy
import itertools
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from ml_lab.config import load_config, resolve_paths
from ml_lab.eval.metrics import compute_binary_metrics
from ml_lab.eval.statistics import run_method_comparison_stats
from ml_lab.models.methods import get_method_feature_columns
from ml_lab.models.trainer import train_method
from ml_lab.utils.io import write_json
from ml_lab.utils.logging_utils import setup_logging
from ml_lab.utils.repro import set_global_seed

LOGGER = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Tune ELA+DWT-SVD primary method against ELA+DWT baseline")
    parser.add_argument("--config", type=str, default="configs/casia2_primary.yaml")
    parser.add_argument("--feature-table", type=str, default="artifacts/metrics/feature_table.csv")
    return parser.parse_args()


def _threshold_grid() -> np.ndarray:
    return np.linspace(0.1, 0.9, 161)


def _build_pipeline(
    seed: int,
    C: float,
    class_weight: str | None,
    solver: str,
    penalty: str,
    top_k: int | None,
) -> Pipeline:
    steps: list[tuple[str, Any]] = [("scaler", StandardScaler())]
    if top_k is not None:
        steps.append(("selector", SelectKBest(score_func=f_classif, k=int(top_k))))
    steps.append(
        (
            "clf",
            LogisticRegression(
                C=float(C),
                class_weight=class_weight,
                solver=solver,
                penalty=penalty,
                max_iter=3000,
                random_state=seed,
            ),
        )
    )
    return Pipeline(steps=steps)


def _fit_eval_candidate(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    feature_cols: list[str],
    seed: int,
    C: float,
    class_weight: str | None,
    solver: str,
    penalty: str,
    top_k: int | None,
) -> dict[str, Any]:
    x_train = train_df[feature_cols].to_numpy(dtype=np.float32)
    y_train = train_df["label"].to_numpy(dtype=np.int32)
    x_val = val_df[feature_cols].to_numpy(dtype=np.float32)
    y_val = val_df["label"].to_numpy(dtype=np.int32)
    x_test = test_df[feature_cols].to_numpy(dtype=np.float32)
    y_test = test_df["label"].to_numpy(dtype=np.int32)

    pipeline = _build_pipeline(
        seed=seed,
        C=C,
        class_weight=class_weight,
        solver=solver,
        penalty=penalty,
        top_k=top_k,
    )
    pipeline.fit(x_train, y_train)
    val_prob = pipeline.predict_proba(x_val)[:, 1]

    best_threshold = 0.5
    best_val_f1 = -1.0
    best_val_metrics: dict[str, float] = {}
    for thr in _threshold_grid():
        metrics = compute_binary_metrics(y_true=y_val, y_prob=val_prob, threshold=float(thr))
        if metrics["f1"] > best_val_f1:
            best_val_f1 = metrics["f1"]
            best_threshold = float(thr)
            best_val_metrics = metrics

    test_prob = pipeline.predict_proba(x_test)[:, 1]
    test_metrics = compute_binary_metrics(y_true=y_test, y_prob=test_prob, threshold=best_threshold)
    pred_test = pd.DataFrame(
        {
            "image_path": test_df["image_path"].to_numpy(),
            "label": y_test,
            "probability": test_prob,
            "prediction": (test_prob >= best_threshold).astype(int),
        }
    )

    return {
        "pipeline": pipeline,
        "threshold": best_threshold,
        "val_metrics": best_val_metrics,
        "test_metrics": test_metrics,
        "test_predictions": pred_test,
        "params": {
            "C": C,
            "class_weight": class_weight,
            "solver": solver,
            "penalty": penalty,
            "top_k": top_k,
        },
    }


def main() -> None:
    args = parse_args()
    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = PROJECT_ROOT / config_path

    config = resolve_paths(load_config(config_path), PROJECT_ROOT)
    set_global_seed(int(config["experiment"]["seed"]), deterministic=True)
    run_name = f"tune_primary_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    setup_logging(config["paths"]["logs_dir"], run_name=run_name)

    feature_table_path = Path(args.feature_table)
    if not feature_table_path.is_absolute():
        feature_table_path = PROJECT_ROOT / feature_table_path
    feature_table = pd.read_csv(feature_table_path)

    baseline_method = str(config["experiment"].get("baseline_method", "ela_dwt"))
    primary_method = str(config["experiment"]["primary_method"])
    if baseline_method != "ela_dwt" or primary_method != "ela_dwt_svd":
        raise ValueError("This tuner is designed for baseline=ela_dwt and primary=ela_dwt_svd")

    LOGGER.info("Training baseline model using config classifier for reference")
    baseline_config = copy.deepcopy(config)
    baseline_result = train_method(
        method=baseline_method,
        feature_table=feature_table,
        config=baseline_config,
    )
    baseline_f1 = baseline_result.split_metrics["test"]["f1"]
    LOGGER.info("Baseline %s test F1 = %.6f", baseline_method, baseline_f1)

    train_df = feature_table[feature_table["split"] == "train"].reset_index(drop=True)
    val_df = feature_table[feature_table["split"] == "val"].reset_index(drop=True)
    test_df = feature_table[feature_table["split"] == "test"].reset_index(drop=True)
    all_feature_cols = [
        c
        for c in feature_table.columns
        if c not in {"image_path", "label", "split", "source_dataset", "perturbation_tag"}
    ]
    primary_feature_cols = get_method_feature_columns(primary_method, all_feature_cols)

    candidate_rows: list[dict[str, Any]] = []
    best: dict[str, Any] | None = None

    c_values = [0.3, 1.0, 3.0]
    class_weights: list[str | None] = ["balanced", None]
    top_k_values: list[int | None] = [None, 30, 40]
    model_forms = [
        {"solver": "lbfgs", "penalty": "l2"},
        {"solver": "liblinear", "penalty": "l1"},
        {"solver": "liblinear", "penalty": "l2"},
    ]

    for C, class_weight, top_k, form in itertools.product(c_values, class_weights, top_k_values, model_forms):
        try:
            candidate = _fit_eval_candidate(
                train_df=train_df,
                val_df=val_df,
                test_df=test_df,
                feature_cols=primary_feature_cols,
                seed=int(config["experiment"]["seed"]),
                C=C,
                class_weight=class_weight,
                solver=form["solver"],
                penalty=form["penalty"],
                top_k=top_k,
            )
            row = {
                **candidate["params"],
                "threshold": candidate["threshold"],
                "val_f1": candidate["val_metrics"]["f1"],
                "val_precision": candidate["val_metrics"]["precision"],
                "val_recall": candidate["val_metrics"]["recall"],
                "val_auc": candidate["val_metrics"]["roc_auc"],
                "test_f1": candidate["test_metrics"]["f1"],
                "test_precision": candidate["test_metrics"]["precision"],
                "test_recall": candidate["test_metrics"]["recall"],
                "test_auc": candidate["test_metrics"]["roc_auc"],
                "test_accuracy": candidate["test_metrics"]["accuracy"],
            }
            candidate_rows.append(row)

            if best is None:
                best = candidate
            else:
                if candidate["val_metrics"]["f1"] > best["val_metrics"]["f1"]:
                    best = candidate
                elif candidate["val_metrics"]["f1"] == best["val_metrics"]["f1"] and candidate["val_metrics"]["roc_auc"] > best["val_metrics"]["roc_auc"]:
                    best = candidate
        except Exception as exc:
            LOGGER.warning("Skipping candidate C=%s class_weight=%s top_k=%s %s due to %s", C, class_weight, top_k, form, exc)

    if best is None:
        raise RuntimeError("No valid candidate found during tuning")

    sweep_df = pd.DataFrame(candidate_rows).sort_values(["val_f1", "val_auc"], ascending=False).reset_index(drop=True)
    sweep_path = Path(config["paths"]["metrics_dir"]) / "primary_tuning_sweep.csv"
    sweep_df.to_csv(sweep_path, index=False)

    primary_pred_df = best["test_predictions"].copy()
    stats_df = run_method_comparison_stats(
        predictions_by_method={
            primary_method: primary_pred_df,
            baseline_method: baseline_result.predictions["test"],
        },
        primary_method=primary_method,
    )
    stats_path = Path(config["paths"]["metrics_dir"]) / "primary_vs_baseline_stats.csv"
    stats_df.to_csv(stats_path, index=False)

    baseline_payload = {
        "pipeline": baseline_result.model_pipeline,
        "threshold": baseline_result.threshold,
        "feature_columns": baseline_result.feature_columns,
        "split_metrics": baseline_result.split_metrics,
    }
    primary_payload = {
        "pipeline": best["pipeline"],
        "threshold": best["threshold"],
        "feature_columns": primary_feature_cols,
        "split_metrics": {
            "val": best["val_metrics"],
            "test": best["test_metrics"],
        },
    }
    timestamp = datetime.now().astimezone().strftime("%Y%m%dT%H%M%SZ")
    model_version = f"{config['experiment']['name']}-tuned-{timestamp}"
    bundle = {
        "model_version": model_version,
        "created_at": datetime.now().astimezone().isoformat(),
        "primary_method": primary_method,
        "methods": {
            baseline_method: baseline_payload,
            primary_method: primary_payload,
        },
        "config": {
            "experiment": config["experiment"],
            "features": config["features"],
            "model": config["model"],
            "tuning": {
                "search_space": {
                    "C": c_values,
                    "class_weight": class_weights,
                    "top_k": top_k_values,
                    "forms": model_forms,
                },
                "selection_rule": "best_val_f1_then_val_auc",
            },
        },
    }
    tuned_model_path = Path(config["paths"]["models_dir"]) / "final_primary_artifact_tuned.joblib"
    joblib.dump(bundle, tuned_model_path)

    summary = {
        "baseline_method": baseline_method,
        "primary_method": primary_method,
        "baseline_test_f1": baseline_result.split_metrics["test"]["f1"],
        "tuned_primary_test_f1": best["test_metrics"]["f1"],
        "f1_delta_primary_minus_baseline": best["test_metrics"]["f1"] - baseline_result.split_metrics["test"]["f1"],
        "baseline_threshold": baseline_result.threshold,
        "tuned_primary_threshold": best["threshold"],
        "best_params": best["params"],
        "stats_path": str(stats_path),
        "sweep_path": str(sweep_path),
        "tuned_artifact_path": str(tuned_model_path),
    }
    summary_path = Path(config["paths"]["reports_dir"]) / "primary_tuning_summary.json"
    write_json(summary_path, summary)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
