from __future__ import annotations

import argparse
import shutil
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Copy model artifacts produced in cloud back to local repo")
    parser.add_argument("--cloud-dir", type=str, required=True, help="Folder containing exported cloud artifacts")
    parser.add_argument("--target-dir", type=str, default="artifacts/models")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    cloud_dir = Path(args.cloud_dir).resolve()
    if not cloud_dir.exists():
        raise FileNotFoundError(f"cloud artifacts folder not found: {cloud_dir}")

    target_dir = Path(args.target_dir)
    if not target_dir.is_absolute():
        target_dir = (PROJECT_ROOT / target_dir).resolve()
    target_dir.mkdir(parents=True, exist_ok=True)

    copied = 0
    for ext in ("*.joblib", "*.pt", "*.pth", "*.onnx", "*.json", "*.yaml"):
        for src in cloud_dir.glob(ext):
            shutil.copy2(src, target_dir / src.name)
            copied += 1

    print(f"Copied {copied} artifact files to {target_dir}")


if __name__ == "__main__":
    main()
