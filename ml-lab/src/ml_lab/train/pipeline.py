from __future__ import annotations

import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from ml_lab.config import load_config, resolve_paths
from ml_lab.data import (
    build_manifest,
    build_split_table,
    generate_synthetic_dataset,
    generate_synthetic_splicing_dataset,
    get_data_card_summary,
    load_manifest,
    save_manifest,
    save_split_table,
    validate_no_split_leakage,
)
from ml_lab.eval import (
    bootstrap_metric_ci,
    build_error_analysis_table,
    run_localization_suite,
    run_method_comparison_stats,
    run_robustness_suite,
    write_markdown_report,
)
from ml_lab.features import extract_feature_table
from ml_lab.models import MethodTrainingResult, train_method
from ml_lab.utils.io import ensure_dir, write_json
from ml_lab.utils.logging_utils import setup_logging
from ml_lab.utils.repro import set_global_seed

LOGGER = logging.getLogger(__name__)


def _ensure_artifact_dirs(config: dict[str, Any]) -> None:
    for key in [
        "artifacts_dir",
        "models_dir",
        "metrics_dir",
        "reports_dir",
        "figures_dir",
        "logs_dir",
        "heatmap_dir",
    ]:
        ensure_dir(config["paths"][key])


def _prepare_manifest(config: dict[str, Any], force_rebuild: bool) -> pd.DataFrame:
    manifest_path = Path(config["paths"]["manifest_csv"])
    dataset_root = Path(config["paths"]["dataset_root"])
    source_dataset = str(config["experiment"]["source_dataset"])

    if source_dataset == "synthetic_demo" and not dataset_root.exists():
        LOGGER.info("Synthetic demo dataset not found. Generating dataset at %s", dataset_root)
        generate_synthetic_dataset(
            output_root=dataset_root,
            num_authentic=120,
            num_tampered=120,
            image_size=tuple(config["experiment"]["image_size"]),
            seed=int(config["experiment"]["seed"]),
        )
    if source_dataset == "synthetic_splicing_demo" and not dataset_root.exists():
        LOGGER.info("Synthetic splicing dataset not found. Generating dataset at %s", dataset_root)
        generate_synthetic_splicing_dataset(
            output_root=dataset_root,
            num_authentic=240,
            num_tampered=240,
            image_size=tuple(config["experiment"]["image_size"]),
            seed=int(config["experiment"]["seed"]),
        )

    if force_rebuild or not manifest_path.exists():
        LOGGER.info("Building manifest from dataset root: %s", dataset_root)
        manifest = build_manifest(dataset_root=dataset_root, source_dataset=source_dataset)
        save_manifest(manifest, manifest_path)
    else:
        LOGGER.info("Loading existing manifest: %s", manifest_path)
        manifest = load_manifest(manifest_path)
    return manifest


def _train_methods(feature_table: pd.DataFrame, config: dict[str, Any]) -> dict[str, MethodTrainingResult]:
    out: dict[str, MethodTrainingResult] = {}
    for method in config["experiment"]["methods"]:
        LOGGER.info("Training method: %s", method)
        out[method] = train_method(method=method, feature_table=feature_table, config=config)
    return out


def _build_main_summary(method_results: dict[str, MethodTrainingResult]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for method, result in method_results.items():
        metrics = result.split_metrics["test"]
        rows.append(
            {
                "method": method,
                "threshold": result.threshold,
                "accuracy": metrics["accuracy"],
                "precision": metrics["precision"],
                "recall": metrics["recall"],
                "f1": metrics["f1"],
                "roc_auc": metrics["roc_auc"],
                "tn": metrics["tn"],
                "fp": metrics["fp"],
                "fn": metrics["fn"],
                "tp": metrics["tp"],
            }
        )
    return pd.DataFrame(rows).sort_values("method").reset_index(drop=True)


def _build_bootstrap_summary(method_results: dict[str, MethodTrainingResult], config: dict[str, Any]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for method, result in method_results.items():
        pred_df = result.predictions["test"]
        y_true = pred_df["label"].to_numpy()
        y_prob = pred_df["probability"].to_numpy()
        for metric in ["accuracy", "precision", "recall", "f1"]:
            ci = bootstrap_metric_ci(
                y_true=y_true,
                y_prob=y_prob,
                threshold=float(result.threshold),
                metric_name=metric,
                n_bootstrap=int(config["evaluation"]["bootstrap_samples"]),
                confidence_level=float(config["evaluation"]["confidence_level"]),
                seed=int(config["experiment"]["seed"]),
            )
            rows.append({"method": method, **ci})
    return pd.DataFrame(rows)


def _export_artifacts(
    config: dict[str, Any],
    method_results: dict[str, MethodTrainingResult],
    summary_df: pd.DataFrame,
) -> dict[str, str]:
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    model_version = f"{config['experiment']['name']}-{now}"
    primary_method = str(config["experiment"]["primary_method"])

    bundle_methods: dict[str, dict[str, Any]] = {}
    for method, result in method_results.items():
        bundle_methods[method] = {
            "pipeline": result.model_pipeline,
            "threshold": result.threshold,
            "feature_columns": result.feature_columns,
            "split_metrics": result.split_metrics,
        }

    bundle = {
        "model_version": model_version,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "primary_method": primary_method,
        "methods": bundle_methods,
        "config": {
            "experiment": config["experiment"],
            "features": config["features"],
            "model": config["model"],
        },
        "summary_metrics": summary_df.to_dict(orient="records"),
    }

    models_dir = Path(config["paths"]["models_dir"])
    full_bundle_path = models_dir / "model_bundle.joblib"
    final_primary_path = models_dir / "final_primary_artifact.joblib"
    joblib.dump(bundle, full_bundle_path)
    joblib.dump(bundle, final_primary_path)
    return {"bundle": str(full_bundle_path), "primary": str(final_primary_path), "model_version": model_version}


def run_pipeline(
    config_path: str | Path,
    project_root: str | Path,
    force_rebuild_manifest: bool = False,
) -> dict[str, Any]:
    config = resolve_paths(load_config(config_path), base_dir=project_root)
    _ensure_artifact_dirs(config)

    run_name = f"{config['experiment']['name']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    log_path = setup_logging(config["paths"]["logs_dir"], run_name=run_name)
    LOGGER.info("Starting pipeline with config=%s", config_path)

    set_global_seed(int(config["experiment"]["seed"]), deterministic=True)

    manifest = _prepare_manifest(config=config, force_rebuild=force_rebuild_manifest)
    data_card = get_data_card_summary(manifest)
    write_json(Path(config["paths"]["reports_dir"]) / "data_card_summary.json", data_card)

    split_manifest = build_split_table(
        manifest=manifest,
        test_size=float(config["experiment"]["test_size"]),
        val_size=float(config["experiment"]["val_size"]),
        seed=int(config["experiment"]["seed"]),
    )
    save_split_table(split_manifest, config["paths"]["split_csv"])
    LOGGER.info("Split distribution:\n%s", split_manifest["split"].value_counts().to_string())
    leakage_report = validate_no_split_leakage(split_manifest)
    write_json(Path(config["paths"]["reports_dir"]) / "split_leakage_report.json", leakage_report)

    feature_table = extract_feature_table(manifest_split=split_manifest, config=config)
    feature_path = Path(config["paths"]["metrics_dir"]) / "feature_table.csv"
    feature_table.to_csv(feature_path, index=False)
    LOGGER.info("Feature table saved: %s", feature_path)

    method_results = _train_methods(feature_table=feature_table, config=config)
    summary_df = _build_main_summary(method_results)
    bootstrap_df = _build_bootstrap_summary(method_results, config=config)

    summary_path = Path(config["paths"]["metrics_dir"]) / "main_metrics.csv"
    summary_df.to_csv(summary_path, index=False)
    bootstrap_path = Path(config["paths"]["metrics_dir"]) / "bootstrap_ci.csv"
    bootstrap_df.to_csv(bootstrap_path, index=False)

    primary_method = str(config["experiment"]["primary_method"])
    stats_df = run_method_comparison_stats(
        predictions_by_method={m: r.predictions["test"] for m, r in method_results.items()},
        primary_method=primary_method,
    )
    stats_path = Path(config["paths"]["metrics_dir"]) / "method_stats.csv"
    stats_df.to_csv(stats_path, index=False)

    test_manifest = split_manifest[split_manifest["split"] == "test"].reset_index(drop=True)
    robustness_df, _ = run_robustness_suite(test_manifest=test_manifest, method_results=method_results, config=config)
    robustness_path = Path(config["paths"]["metrics_dir"]) / "robustness_metrics.csv"
    robustness_df.to_csv(robustness_path, index=False)
    localization_df = run_localization_suite(test_manifest=test_manifest, config=config)
    localization_path = Path(config["paths"]["metrics_dir"]) / "localization_metrics.csv"
    localization_df.to_csv(localization_path, index=False)

    error_df = build_error_analysis_table(method_results[primary_method].predictions["test"], top_k=40)
    error_path = Path(config["paths"]["reports_dir"]) / "error_analysis.csv"
    error_df.to_csv(error_path, index=False)

    export_paths = _export_artifacts(config=config, method_results=method_results, summary_df=summary_df)
    metadata_path = Path(config["paths"]["models_dir"]) / "export_metadata.json"
    write_json(metadata_path, export_paths)

    assumptions = [
        "Dataset labels are inferred from folder names authentic/tampered (or aliases in manifest module).",
        "Localization metrics use proxy maps (CFA/PRNU/ManTra-like mask) against available ground-truth masks.",
        "Statistical test compares per-image correctness vectors on the same test split.",
        "Demo mode uses synthetic data and should not be interpreted as scientific benchmark.",
    ]
    report_path = Path(config["paths"]["reports_dir"]) / "experiment_report.md"
    write_markdown_report(
        output_path=report_path,
        config=config,
        summary_df=summary_df,
        bootstrap_df=bootstrap_df,
        robustness_df=robustness_df,
        localization_df=localization_df,
        stats_df=stats_df,
        error_df=error_df,
        assumptions=assumptions,
    )

    result = {
        "run_name": run_name,
        "log_path": str(log_path),
        "feature_table_path": str(feature_path),
        "summary_metrics_path": str(summary_path),
        "bootstrap_path": str(bootstrap_path),
        "stats_path": str(stats_path),
        "robustness_path": str(robustness_path),
        "localization_path": str(localization_path),
        "error_analysis_path": str(error_path),
        "report_path": str(report_path),
        "artifact_bundle_path": export_paths["bundle"],
        "primary_artifact_path": export_paths["primary"],
        "model_version": export_paths["model_version"],
    }
    write_json(Path(config["paths"]["reports_dir"]) / "pipeline_result.json", result)

    if bool(config.get("baseline", {}).get("freeze_enabled", False)):
        baseline_name = str(config.get("baseline", {}).get("snapshot_name", run_name))
        baseline_dir = Path(config["paths"]["artifacts_dir"]) / "baseline_snapshots" / baseline_name
        baseline_dir.mkdir(parents=True, exist_ok=True)
        for path_key in [
            "summary_metrics_path",
            "bootstrap_path",
            "stats_path",
            "robustness_path",
            "localization_path",
            "report_path",
            "artifact_bundle_path",
            "primary_artifact_path",
        ]:
            source = Path(result[path_key])
            if source.exists():
                shutil.copy2(source, baseline_dir / source.name)
        config_copy = baseline_dir / "config_snapshot.yaml"
        config_copy.write_text(Path(config_path).read_text(encoding="utf-8"), encoding="utf-8")

    LOGGER.info("Pipeline finished. Primary artifact: %s", export_paths["primary"])
    return result
