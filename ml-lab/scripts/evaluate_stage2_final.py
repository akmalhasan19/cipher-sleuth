from __future__ import annotations

import argparse
import copy
import json
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import joblib
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from ml_lab.config import load_config, resolve_paths
from ml_lab.eval.error_analysis import build_error_analysis_table
from ml_lab.eval.metrics import compute_binary_metrics
from ml_lab.eval.robustness import run_robustness_suite
from ml_lab.eval.statistics import run_method_comparison_stats
from ml_lab.models.trainer import train_method
from ml_lab.utils.io import write_json
from ml_lab.utils.logging_utils import setup_logging
from ml_lab.utils.repro import set_global_seed


@dataclass
class EvaluatedMethod:
    method: str
    threshold: float
    feature_columns: list[str]
    model_pipeline: Any
    split_metrics: dict[str, dict[str, float]]
    predictions: dict[str, pd.DataFrame]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Final stage-2 evaluation pack for thesis (Bab 4)")
    parser.add_argument("--config", type=str, default="configs/casia2_primary.yaml")
    parser.add_argument("--feature-table", type=str, default="artifacts/metrics/feature_table.csv")
    parser.add_argument("--split-csv", type=str, default="data/splits/casia2_split.csv")
    parser.add_argument("--stage2-artifact", type=str, default="artifacts/models/final_primary_artifact_stage2.joblib")
    return parser.parse_args()


def _to_evaluated_from_payload(
    method_name: str,
    payload: dict[str, Any],
    feature_table: pd.DataFrame,
) -> EvaluatedMethod:
    feature_cols = payload["feature_columns"]
    pipeline = payload["pipeline"]
    threshold = float(payload["threshold"])

    split_metrics: dict[str, dict[str, float]] = {}
    predictions: dict[str, pd.DataFrame] = {}
    for split_name in ["train", "val", "test"]:
        split_df = feature_table[feature_table["split"] == split_name].reset_index(drop=True)
        x = split_df[feature_cols].to_numpy(dtype="float32")
        y_true = split_df["label"].to_numpy(dtype="int32")
        y_prob = pipeline.predict_proba(x)[:, 1]
        metrics = compute_binary_metrics(y_true=y_true, y_prob=y_prob, threshold=threshold)
        split_metrics[split_name] = metrics
        predictions[split_name] = pd.DataFrame(
            {
                "image_path": split_df["image_path"],
                "label": y_true,
                "probability": y_prob,
                "prediction": (y_prob >= threshold).astype(int),
            }
        )

    return EvaluatedMethod(
        method=method_name,
        threshold=threshold,
        feature_columns=feature_cols,
        model_pipeline=pipeline,
        split_metrics=split_metrics,
        predictions=predictions,
    )


def _main_metrics_table(results: dict[str, EvaluatedMethod]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for method, result in results.items():
        m = result.split_metrics["test"]
        rows.append(
            {
                "method": method,
                "threshold": result.threshold,
                "accuracy": m["accuracy"],
                "precision": m["precision"],
                "recall": m["recall"],
                "f1": m["f1"],
                "roc_auc": m["roc_auc"],
                "tn": m["tn"],
                "fp": m["fp"],
                "fn": m["fn"],
                "tp": m["tp"],
            }
        )
    return pd.DataFrame(rows).sort_values("f1", ascending=False).reset_index(drop=True)


def _robustness_summary_table(robustness_df: pd.DataFrame, results: dict[str, EvaluatedMethod]) -> pd.DataFrame:
    methods = list(results.keys())
    rows: list[dict[str, Any]] = []
    for method in methods:
        method_df = robustness_df[robustness_df["method"] == method]
        clean_f1 = results[method].split_metrics["test"]["f1"]
        row = {
            "method": method,
            "clean_f1": clean_f1,
            "avg_robust_f1": float(method_df["f1"].mean()) if not method_df.empty else float("nan"),
            "avg_relative_drop_f1_pct": float(method_df["relative_drop_f1_pct"].mean()) if not method_df.empty else float("nan"),
            "worst_scenario": None,
            "worst_f1": None,
        }
        if not method_df.empty:
            worst = method_df.sort_values("f1", ascending=True).iloc[0]
            row["worst_scenario"] = worst["scenario"]
            row["worst_f1"] = float(worst["f1"])
        rows.append(row)
    return pd.DataFrame(rows).sort_values("clean_f1", ascending=False).reset_index(drop=True)


def _write_bab4_markdown(
    output_path: Path,
    metadata: dict[str, Any],
    main_df: pd.DataFrame,
    stats_df: pd.DataFrame,
    robustness_df: pd.DataFrame,
    robustness_summary_df: pd.DataFrame,
    error_df: pd.DataFrame,
) -> None:
    def _md(df: pd.DataFrame) -> str:
        if df.empty:
            return "_No data_"
        return df.to_markdown(index=False)

    lines: list[str] = []
    lines.append("# Bab 4 - Hasil Eksperimen Final (Stage-2)")
    lines.append("")
    lines.append(f"- Generated at: {metadata['generated_at']}")
    lines.append(f"- Config: `{metadata['config_path']}`")
    lines.append(f"- Feature table: `{metadata['feature_table_path']}`")
    lines.append(f"- Stage-2 artifact: `{metadata['stage2_artifact_path']}`")
    lines.append("")
    lines.append("## Tabel 4.1 Perbandingan Utama (Test Split)")
    lines.append(_md(main_df))
    lines.append("")
    lines.append("## Tabel 4.2 Uji Statistik Primary vs Baseline/Baseline Lain")
    lines.append(_md(stats_df))
    lines.append("")
    lines.append("## Tabel 4.3 Ringkasan Robustness")
    lines.append(_md(robustness_summary_df))
    lines.append("")
    lines.append("## Tabel 4.4 Detail Robustness per Skenario")
    lines.append(_md(robustness_df))
    lines.append("")
    lines.append("## Tabel 4.5 Error Analysis (Top FP/FN Metode Utama)")
    lines.append(_md(error_df.head(50)))
    lines.append("")
    lines.append("## Narasi Ringkas")
    lines.append(
        "- Metode utama tetap `ELA+DWT-SVD` (stage-2) dengan `ELA+DWT` diposisikan sebagai baseline."
    )
    lines.append(
        "- Interpretasi hasil tetap konservatif: keunggulan dinyatakan untuk setting dataset/split/skenario uji saat ini."
    )
    lines.append(
        "- Tidak mengklaim novelty absolut; kontribusi difokuskan pada konfigurasi fusion + protokol robustness + integrasi sistem."
    )
    lines.append("")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = PROJECT_ROOT / config_path
    feature_table_path = Path(args.feature_table)
    if not feature_table_path.is_absolute():
        feature_table_path = PROJECT_ROOT / feature_table_path
    split_csv_path = Path(args.split_csv)
    if not split_csv_path.is_absolute():
        split_csv_path = PROJECT_ROOT / split_csv_path
    artifact_path = Path(args.stage2_artifact)
    if not artifact_path.is_absolute():
        artifact_path = PROJECT_ROOT / artifact_path

    config = resolve_paths(load_config(config_path), PROJECT_ROOT)
    set_global_seed(int(config["experiment"]["seed"]), deterministic=True)
    run_name = f"final_stage2_eval_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    setup_logging(config["paths"]["logs_dir"], run_name=run_name)

    feature_table = pd.read_csv(feature_table_path)
    split_manifest = pd.read_csv(split_csv_path)
    test_manifest = split_manifest[split_manifest["split"] == "test"].reset_index(drop=True)

    # Train supporting baselines quickly on existing feature table.
    support_config = copy.deepcopy(config)
    support_methods = ["ela_only", "dwt_svd_only", "ela_dwt"]
    method_results: dict[str, EvaluatedMethod] = {}
    for method in support_methods:
        trained = train_method(method=method, feature_table=feature_table, config=support_config)
        method_results[method] = EvaluatedMethod(
            method=method,
            threshold=trained.threshold,
            feature_columns=trained.feature_columns,
            model_pipeline=trained.model_pipeline,
            split_metrics=trained.split_metrics,
            predictions=trained.predictions,
        )

    stage2_bundle = joblib.load(artifact_path)
    primary_payload = stage2_bundle["methods"][stage2_bundle["primary_method"]]
    primary_method_name = "ela_dwt_svd_stage2"
    primary_eval = _to_evaluated_from_payload(
        method_name=primary_method_name,
        payload=primary_payload,
        feature_table=feature_table,
    )
    method_results[primary_method_name] = primary_eval

    main_df = _main_metrics_table(method_results)
    main_path = Path(config["paths"]["metrics_dir"]) / "final_stage2_main_metrics.csv"
    main_df.to_csv(main_path, index=False)

    stats_df = run_method_comparison_stats(
        predictions_by_method={k: v.predictions["test"] for k, v in method_results.items()},
        primary_method=primary_method_name,
    )
    stats_path = Path(config["paths"]["metrics_dir"]) / "final_stage2_stats.csv"
    stats_df.to_csv(stats_path, index=False)

    robust_results = {
        method: SimpleNamespace(
            feature_columns=result.feature_columns,
            model_pipeline=result.model_pipeline,
            threshold=result.threshold,
            split_metrics=result.split_metrics,
        )
        for method, result in method_results.items()
    }
    robustness_df, _ = run_robustness_suite(
        test_manifest=test_manifest,
        method_results=robust_results,
        config=config,
    )
    robustness_path = Path(config["paths"]["metrics_dir"]) / "final_stage2_robustness_metrics.csv"
    robustness_df.to_csv(robustness_path, index=False)

    robustness_summary_df = _robustness_summary_table(robustness_df, method_results)
    robustness_summary_path = Path(config["paths"]["metrics_dir"]) / "final_stage2_robustness_summary.csv"
    robustness_summary_df.to_csv(robustness_summary_path, index=False)

    error_df = build_error_analysis_table(primary_eval.predictions["test"], top_k=80)
    error_path = Path(config["paths"]["reports_dir"]) / "final_stage2_error_analysis.csv"
    error_df.to_csv(error_path, index=False)

    bab4_md_path = Path(config["paths"]["reports_dir"]) / "BAB4-TABEL-FINAL-STAGE2.md"
    metadata = {
        "generated_at": datetime.now().astimezone().isoformat(),
        "config_path": str(config_path),
        "feature_table_path": str(feature_table_path),
        "stage2_artifact_path": str(artifact_path),
    }
    _write_bab4_markdown(
        output_path=bab4_md_path,
        metadata=metadata,
        main_df=main_df,
        stats_df=stats_df,
        robustness_df=robustness_df,
        robustness_summary_df=robustness_summary_df,
        error_df=error_df,
    )

    summary = {
        "run_name": run_name,
        "primary_method": primary_method_name,
        "main_metrics_path": str(main_path),
        "stats_path": str(stats_path),
        "robustness_path": str(robustness_path),
        "robustness_summary_path": str(robustness_summary_path),
        "error_analysis_path": str(error_path),
        "bab4_markdown_path": str(bab4_md_path),
    }
    summary_path = Path(config["paths"]["reports_dir"]) / "final_stage2_eval_summary.json"
    write_json(summary_path, summary)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
