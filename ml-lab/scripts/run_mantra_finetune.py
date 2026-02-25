from __future__ import annotations

import argparse
import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate ManTra-Net fine-tuning run spec for cloud GPU.")
    parser.add_argument("--config", type=str, default="configs/hybrid_mantra_cfa_prnu.yaml")
    parser.add_argument("--output", type=str, default="artifacts/reports/mantra_finetune_spec.json")
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--early-stop-patience", type=int, default=3)
    parser.add_argument("--checkpoint-every", type=int, default=1)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = (PROJECT_ROOT / config_path).resolve()

    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = (PROJECT_ROOT / output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    run_spec = {
        "model": "mantra-net",
        "configPath": str(config_path),
        "trainStrategy": "cloud-gpu",
        "checkpointing": {
            "enabled": True,
            "everyNEpochs": args.checkpoint_every,
        },
        "earlyStopping": {
            "enabled": True,
            "patience": args.early_stop_patience,
        },
        "epochs": args.epochs,
        "batchSize": args.batch_size,
        "notes": [
            "Use this spec in Colab/Kaggle notebook training loop.",
            "Export final checkpoint as TorchScript for local inference fallback.",
        ],
    }
    output_path.write_text(json.dumps(run_spec, indent=2), encoding="utf-8")
    print(f"Fine-tune spec written to {output_path}")


if __name__ == "__main__":
    main()
