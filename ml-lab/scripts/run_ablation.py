from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path
import sys

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from ml_lab.train.pipeline import run_pipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run ablation variants on the same config")
    parser.add_argument("--config", type=str, default="configs/default.yaml")
    parser.add_argument(
        "--methods",
        type=str,
        default="ela_only,dwt_svd_only,ela_dwt,ela_dwt_svd",
        help="Comma-separated methods to run",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = PROJECT_ROOT / config_path

    with config_path.open("r", encoding="utf-8") as fh:
        config = yaml.safe_load(fh)

    config["experiment"]["methods"] = [x.strip() for x in args.methods.split(",") if x.strip()]
    config["experiment"]["primary_method"] = config["experiment"]["methods"][-1]

    with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False, encoding="utf-8") as tmp:
        yaml.safe_dump(config, tmp, sort_keys=False)
        temp_config = Path(tmp.name)

    result = run_pipeline(config_path=temp_config, project_root=PROJECT_ROOT, force_rebuild_manifest=False)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
