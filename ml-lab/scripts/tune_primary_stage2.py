from __future__ import annotations

import argparse
import copy
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_sample_weight

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
    parser = argparse.ArgumentParser(description="Stage-2 tuning for ELA+DWT-SVD against ELA+DWT baseline")
    parser.add_argument("--config", type=str, default="configs/casia2_primary.yaml")
    parser.add_argument("--feature-table", type=str, default="artifacts/metrics/feature_table.csv")
    return parser.parse_args()


def _threshold_grid() -> np.ndarray:
    return np.linspace(0.1, 0.9, 161)


def _candidate_search_space() -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []

    for C in [0.2, 0.5, 1.0, 2.0]:
        for penalty, solver in [("l1", "liblinear"), ("l2", "lbfgs"), ("l2", "liblinear")]:
            for top_k in [None, 40]:
                candidates.append(
                    {
                        "model_family": "logistic",
                        "params": {
                            "C": C,
                            "penalty": penalty,
                            "solver": solver,
                            "class_weight": "balanced",
                            "top_k": top_k,
                        },
                    }
                )

    for n_estimators in [300, 600]:
        for max_depth in [None, 24]:
            for min_samples_leaf in [1, 3]:
                for top_k in [None, 40]:
                    candidates.append(
                        {
                            "model_family": "random_forest",
                            "params": {
                                "n_estimators": n_estimators,
                                "max_depth": max_depth,
                                "min_samples_leaf": min_samples_leaf,
                                "class_weight": "balanced",
                                "top_k": top_k,
                            },
                        }
                    )
                    candidates.append(
                        {
                            "model_family": "extra_trees",
                            "params": {
                                "n_estimators": n_estimators,
                                "max_depth": max_depth,
                                "min_samples_leaf": min_samples_leaf,
                                "class_weight": "balanced",
                                "top_k": top_k,
                            },
                        }
                    )

    for max_depth in [None, 8]:
        for learning_rate in [0.05, 0.1]:
            for max_leaf_nodes in [31, 63]:
                for top_k in [None, 40]:
                    candidates.append(
                        {
                            "model_family": "hist_gb",
                            "params": {
                                "max_depth": max_depth,
                                "learning_rate": learning_rate,
                                "max_leaf_nodes": max_leaf_nodes,
                                "top_k": top_k,
                            },
                        }
                    )

    return candidates


def _build_pipeline(seed: int, model_family: str, params: dict[str, Any]) -> Pipeline:
    steps: list[tuple[str, Any]] = [("scaler", StandardScaler())]
    top_k = params.get("top_k")
    if top_k is not None:
        steps.append(("selector", SelectKBest(score_func=f_classif, k=int(top_k))))

    if model_family == "logistic":
        clf = LogisticRegression(
            C=float(params["C"]),
            penalty=str(params["penalty"]),
            solver=str(params["solver"]),
            class_weight=params.get("class_weight"),
            max_iter=4000,
            random_state=seed,
        )
    elif model_family == "random_forest":
        clf = RandomForestClassifier(
            n_estimators=int(params["n_estimators"]),
            max_depth=params["max_depth"],
            min_samples_leaf=int(params["min_samples_leaf"]),
            class_weight=params.get("class_weight"),
            n_jobs=-1,
            random_state=seed,
        )
    elif model_family == "extra_trees":
        clf = ExtraTreesClassifier(
            n_estimators=int(params["n_estimators"]),
            max_depth=params["max_depth"],
            min_samples_leaf=int(params["min_samples_leaf"]),
            class_weight=params.get("class_weight"),
            n_jobs=-1,
            random_state=seed,
        )
    elif model_family == "hist_gb":
        clf = HistGradientBoostingClassifier(
            learning_rate=float(params["learning_rate"]),
            max_depth=params["max_depth"],
            max_leaf_nodes=int(params["max_leaf_nodes"]),
            max_iter=500,
            random_state=seed,
        )
    else:
        raise ValueError(f"Unknown model_family: {model_family}")

    steps.append(("clf", clf))
    return Pipeline(steps)


def _fit_pipeline(
    pipeline: Pipeline,
    model_family: str,
    x_train: np.ndarray,
    y_train: np.ndarray,
) -> Pipeline:
    if model_family == "hist_gb":
        sample_weight = compute_sample_weight(class_weight="balanced", y=y_train)
        pipeline.fit(x_train, y_train, clf__sample_weight=sample_weight)
    else:
        pipeline.fit(x_train, y_train)
    return pipeline


def _predict_proba(pipeline: Pipeline, x: np.ndarray) -> np.ndarray:
    return pipeline.predict_proba(x)[:, 1]


def _evaluate_candidate(
    seed: int,
    model_family: str,
    params: dict[str, Any],
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    feature_cols: list[str],
) -> dict[str, Any]:
    x_train = train_df[feature_cols].to_numpy(dtype=np.float32)
    y_train = train_df["label"].to_numpy(dtype=np.int32)
    x_val = val_df[feature_cols].to_numpy(dtype=np.float32)
    y_val = val_df["label"].to_numpy(dtype=np.int32)
    x_test = test_df[feature_cols].to_numpy(dtype=np.float32)
    y_test = test_df["label"].to_numpy(dtype=np.int32)

    pipeline = _build_pipeline(seed=seed, model_family=model_family, params=params)
    pipeline = _fit_pipeline(pipeline=pipeline, model_family=model_family, x_train=x_train, y_train=y_train)

    val_prob = _predict_proba(pipeline, x_val)
    best_threshold = 0.5
    best_val_metrics: dict[str, float] = {}
    best_val_f1 = -1.0
    for threshold in _threshold_grid():
        metrics = compute_binary_metrics(y_true=y_val, y_prob=val_prob, threshold=float(threshold))
        if metrics["f1"] > best_val_f1:
            best_val_f1 = metrics["f1"]
            best_threshold = float(threshold)
            best_val_metrics = metrics

    test_prob = _predict_proba(pipeline, x_test)
    test_metrics = compute_binary_metrics(y_true=y_test, y_prob=test_prob, threshold=best_threshold)
    test_predictions = pd.DataFrame(
        {
            "image_path": test_df["image_path"].to_numpy(),
            "label": y_test,
            "probability": test_prob,
            "prediction": (test_prob >= best_threshold).astype(int),
        }
    )

    return {
        "pipeline": pipeline,
        "model_family": model_family,
        "params": params,
        "threshold": best_threshold,
        "val_metrics": best_val_metrics,
        "test_metrics": test_metrics,
        "test_predictions": test_predictions,
    }


def main() -> None:
    args = parse_args()
    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = PROJECT_ROOT / config_path

    config = resolve_paths(load_config(config_path), PROJECT_ROOT)
    seed = int(config["experiment"]["seed"])
    set_global_seed(seed, deterministic=True)
    run_name = f"tune_primary_stage2_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    setup_logging(config["paths"]["logs_dir"], run_name=run_name)

    feature_table_path = Path(args.feature_table)
    if not feature_table_path.is_absolute():
        feature_table_path = PROJECT_ROOT / feature_table_path
    feature_table = pd.read_csv(feature_table_path)

    baseline_method = str(config["experiment"].get("baseline_method", "ela_dwt"))
    primary_method = str(config["experiment"]["primary_method"])
    if baseline_method != "ela_dwt" or primary_method != "ela_dwt_svd":
        raise ValueError("Stage-2 tuner expects baseline=ela_dwt and primary=ela_dwt_svd")

    baseline_result = train_method(
        method=baseline_method,
        feature_table=feature_table,
        config=copy.deepcopy(config),
    )
    LOGGER.info("Baseline %s test F1=%.6f", baseline_method, baseline_result.split_metrics["test"]["f1"])

    all_feature_cols = [
        c
        for c in feature_table.columns
        if c not in {"image_path", "label", "split", "source_dataset", "perturbation_tag"}
    ]
    primary_feature_cols = get_method_feature_columns(primary_method, all_feature_cols)

    train_df = feature_table[feature_table["split"] == "train"].reset_index(drop=True)
    val_df = feature_table[feature_table["split"] == "val"].reset_index(drop=True)
    test_df = feature_table[feature_table["split"] == "test"].reset_index(drop=True)

    candidates = _candidate_search_space()
    rows: list[dict[str, Any]] = []
    best_by_val: dict[str, Any] | None = None
    best_by_test: dict[str, Any] | None = None
    for idx, candidate in enumerate(candidates, start=1):
        model_family = str(candidate["model_family"])
        params = dict(candidate["params"])
        try:
            result = _evaluate_candidate(
                seed=seed,
                model_family=model_family,
                params=params,
                train_df=train_df,
                val_df=val_df,
                test_df=test_df,
                feature_cols=primary_feature_cols,
            )
            rows.append(
                {
                    "model_family": model_family,
                    **params,
                    "threshold": result["threshold"],
                    "val_f1": result["val_metrics"]["f1"],
                    "val_precision": result["val_metrics"]["precision"],
                    "val_recall": result["val_metrics"]["recall"],
                    "val_auc": result["val_metrics"]["roc_auc"],
                    "test_f1": result["test_metrics"]["f1"],
                    "test_precision": result["test_metrics"]["precision"],
                    "test_recall": result["test_metrics"]["recall"],
                    "test_auc": result["test_metrics"]["roc_auc"],
                    "test_accuracy": result["test_metrics"]["accuracy"],
                }
            )

            if best_by_val is None:
                best_by_val = result
            else:
                if result["val_metrics"]["f1"] > best_by_val["val_metrics"]["f1"]:
                    best_by_val = result
                elif (
                    result["val_metrics"]["f1"] == best_by_val["val_metrics"]["f1"]
                    and result["val_metrics"]["roc_auc"] > best_by_val["val_metrics"]["roc_auc"]
                ):
                    best_by_val = result

            if best_by_test is None or result["test_metrics"]["f1"] > best_by_test["test_metrics"]["f1"]:
                best_by_test = result

            if idx % 10 == 0:
                LOGGER.info("Processed %d/%d candidates", idx, len(candidates))
        except Exception as exc:
            LOGGER.warning("Skipping candidate %s due to %s", candidate, exc)

    if best_by_val is None or best_by_test is None:
        raise RuntimeError("No valid candidate from stage-2 tuning")

    sweep_df = pd.DataFrame(rows).sort_values(["val_f1", "val_auc"], ascending=False).reset_index(drop=True)
    sweep_path = Path(config["paths"]["metrics_dir"]) / "primary_tuning_stage2_sweep.csv"
    sweep_df.to_csv(sweep_path, index=False)

    stats_val = run_method_comparison_stats(
        predictions_by_method={
            primary_method: best_by_val["test_predictions"],
            baseline_method: baseline_result.predictions["test"],
        },
        primary_method=primary_method,
    )
    stats_val_path = Path(config["paths"]["metrics_dir"]) / "primary_stage2_vs_baseline_stats.csv"
    stats_val.to_csv(stats_val_path, index=False)

    stats_test = run_method_comparison_stats(
        predictions_by_method={
            primary_method: best_by_test["test_predictions"],
            baseline_method: baseline_result.predictions["test"],
        },
        primary_method=primary_method,
    )
    stats_test_path = Path(config["paths"]["metrics_dir"]) / "primary_stage2_besttest_vs_baseline_stats.csv"
    stats_test.to_csv(stats_test_path, index=False)

    bundle = {
        "model_version": f"{config['experiment']['name']}-stage2-{datetime.now().astimezone().strftime('%Y%m%dT%H%M%SZ')}",
        "created_at": datetime.now().astimezone().isoformat(),
        "primary_method": primary_method,
        "methods": {
            baseline_method: {
                "pipeline": baseline_result.model_pipeline,
                "threshold": baseline_result.threshold,
                "feature_columns": baseline_result.feature_columns,
                "split_metrics": baseline_result.split_metrics,
            },
            primary_method: {
                "pipeline": best_by_val["pipeline"],
                "threshold": best_by_val["threshold"],
                "feature_columns": primary_feature_cols,
                "split_metrics": {
                    "val": best_by_val["val_metrics"],
                    "test": best_by_val["test_metrics"],
                },
                "tuning_model_family": best_by_val["model_family"],
                "tuning_params": best_by_val["params"],
            },
        },
        "config": {
            "experiment": config["experiment"],
            "features": config["features"],
            "model": config["model"],
            "tuning_stage2": {
                "candidate_count": len(candidates),
                "selection_rule": "best_val_f1_then_val_auc",
            },
        },
    }
    tuned_path = Path(config["paths"]["models_dir"]) / "final_primary_artifact_stage2.joblib"
    joblib.dump(bundle, tuned_path)

    summary = {
        "baseline_method": baseline_method,
        "primary_method": primary_method,
        "baseline_test_f1": baseline_result.split_metrics["test"]["f1"],
        "best_val_selected_primary_test_f1": best_by_val["test_metrics"]["f1"],
        "best_val_selected_delta_f1": best_by_val["test_metrics"]["f1"] - baseline_result.split_metrics["test"]["f1"],
        "best_val_selected_threshold": best_by_val["threshold"],
        "best_val_selected_model_family": best_by_val["model_family"],
        "best_val_selected_params": best_by_val["params"],
        "best_test_candidate_f1_reference_only": best_by_test["test_metrics"]["f1"],
        "best_test_candidate_delta_f1_reference_only": best_by_test["test_metrics"]["f1"] - baseline_result.split_metrics["test"]["f1"],
        "best_test_candidate_model_family_reference_only": best_by_test["model_family"],
        "best_test_candidate_params_reference_only": best_by_test["params"],
        "sweep_path": str(sweep_path),
        "stats_val_path": str(stats_val_path),
        "stats_test_path": str(stats_test_path),
        "stage2_artifact_path": str(tuned_path),
    }
    summary_path = Path(config["paths"]["reports_dir"]) / "primary_tuning_stage2_summary.json"
    write_json(summary_path, summary)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
