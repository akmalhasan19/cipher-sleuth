from __future__ import annotations

import argparse
import shutil
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Package dataset/config for Colab/Kaggle training")
    parser.add_argument("--dataset-root", type=str, required=True, help="Path to dataset root folder")
    parser.add_argument("--config", type=str, default="configs/hybrid_mantra_cfa_prnu.yaml")
    parser.add_argument("--output-dir", type=str, default="artifacts/cloud_bundle")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    dataset_root = Path(args.dataset_root).resolve()
    if not dataset_root.exists():
        raise FileNotFoundError(f"dataset root not found: {dataset_root}")

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = (PROJECT_ROOT / config_path).resolve()
    if not config_path.exists():
        raise FileNotFoundError(f"config not found: {config_path}")

    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = (PROJECT_ROOT / output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    shutil.copy2(config_path, output_dir / config_path.name)
    archive_base = output_dir / dataset_root.name
    archive_path = shutil.make_archive(str(archive_base), "zip", root_dir=dataset_root)
    print(f"Cloud bundle ready: {archive_path}")
    print(f"Config copied: {output_dir / config_path.name}")


if __name__ == "__main__":
    main()
