from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from ml_lab.train.pipeline import run_pipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run end-to-end ML lab pipeline")
    parser.add_argument("--config", type=str, default="configs/default.yaml", help="Path to YAML config")
    parser.add_argument(
        "--force-rebuild-manifest",
        action="store_true",
        help="Rebuild manifest CSV from dataset_root",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = PROJECT_ROOT / config_path

    result = run_pipeline(
        config_path=config_path,
        project_root=PROJECT_ROOT,
        force_rebuild_manifest=bool(args.force_rebuild_manifest),
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
