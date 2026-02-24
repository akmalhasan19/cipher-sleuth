from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import uvicorn

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run FastAPI inference service for ml-lab")
    parser.add_argument("--host", type=str, default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8100)
    parser.add_argument("--artifact", type=str, default="artifacts/models/final_primary_artifact.joblib")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    artifact = Path(args.artifact)
    if not artifact.is_absolute():
        artifact = PROJECT_ROOT / artifact
    os.environ["ML_LAB_ARTIFACT_PATH"] = str(artifact.resolve())

    uvicorn.run(
        "ml_lab.serve.app:app",
        host=args.host,
        port=args.port,
        log_level="info",
        reload=False,
    )


if __name__ == "__main__":
    main()
