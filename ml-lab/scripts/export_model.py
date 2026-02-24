from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export trained artifact bundle for deployment")
    parser.add_argument("--source", type=str, default="artifacts/models/final_primary_artifact.joblib")
    parser.add_argument("--target-dir", type=str, default="artifacts/export")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    project_root = Path(__file__).resolve().parents[1]
    source_path = project_root / args.source if not Path(args.source).is_absolute() else Path(args.source)
    target_dir = project_root / args.target_dir if not Path(args.target_dir).is_absolute() else Path(args.target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    target_model = target_dir / "model_bundle.joblib"
    shutil.copy2(source_path, target_model)

    contract = {
        "artifact_path": str(target_model.resolve()),
        "input_schema": {
            "type": "multipart/form-data",
            "fields": {
                "file": "binary image",
                "returnHeatmap": "boolean (optional)",
            },
        },
        "output_schema": {
            "ok": "boolean",
            "modelVersion": "string",
            "prediction": {"label": "authentic|manipulated", "probability": "float", "confidence": "float"},
            "scores": {"elaScore": "float", "dwtsvdScore": "float", "fusionScore": "float"},
            "explainability": {"topSignals": "string[]", "elaHeatmapBase64": "string|null"},
            "timingMs": "float",
            "requestId": "string",
        },
    }
    contract_path = target_dir / "inference_contract.json"
    contract_path.write_text(json.dumps(contract, indent=2), encoding="utf-8")
    print(json.dumps({"model": str(target_model), "contract": str(contract_path)}, indent=2))


if __name__ == "__main__":
    main()
