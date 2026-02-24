from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import joblib
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from ml_lab.config import load_config, resolve_paths
from ml_lab.eval.robustness import run_robustness_suite


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run robustness-only evaluation from exported model bundle")
    parser.add_argument("--config", type=str, default="configs/default.yaml")
    parser.add_argument("--bundle", type=str, default="artifacts/models/model_bundle.joblib")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config_path = PROJECT_ROOT / args.config if not Path(args.config).is_absolute() else Path(args.config)
    bundle_path = PROJECT_ROOT / args.bundle if not Path(args.bundle).is_absolute() else Path(args.bundle)

    config = resolve_paths(load_config(config_path), base_dir=PROJECT_ROOT)
    split_manifest = pd.read_csv(config["paths"]["split_csv"])
    test_manifest = split_manifest[split_manifest["split"] == "test"].reset_index(drop=True)

    bundle = joblib.load(bundle_path)
    method_results = {}
    for method, payload in bundle["methods"].items():
        method_results[method] = SimpleNamespace(
            feature_columns=payload["feature_columns"],
            model_pipeline=payload["pipeline"],
            threshold=payload["threshold"],
            split_metrics=payload["split_metrics"],
        )

    robustness_df, _ = run_robustness_suite(test_manifest=test_manifest, method_results=method_results, config=config)
    output_path = Path(config["paths"]["metrics_dir"]) / "robustness_metrics_standalone.csv"
    robustness_df.to_csv(output_path, index=False)
    print(json.dumps({"output_path": str(output_path), "rows": int(len(robustness_df))}, indent=2))


if __name__ == "__main__":
    main()
