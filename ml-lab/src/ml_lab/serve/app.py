from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse

from ml_lab.serve.inference import InferenceEngine

APP_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_ARTIFACT = APP_ROOT / "artifacts" / "models" / "final_primary_artifact.joblib"

app = FastAPI(title="Cipher Sleuth ML Inference Service", version="1.0.0")
engine: InferenceEngine | None = None


@app.on_event("startup")
def _load_engine() -> None:
    global engine
    artifact_path = Path(os.environ.get("ML_LAB_ARTIFACT_PATH", str(DEFAULT_ARTIFACT)))
    engine = InferenceEngine(artifact_path=artifact_path)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "ok": True,
        "service": "cipher-sleuth-ml-lab",
        "ready": engine is not None,
        "artifactPath": str(engine.artifact_path) if engine else None,
        "modelVersion": engine.model_version if engine else None,
    }


@app.post("/infer")
async def infer(
    request: Request,
    file: UploadFile = File(...),
    returnHeatmap: bool = Form(False),
) -> JSONResponse:
    if engine is None:
        return JSONResponse(status_code=503, content={"ok": False, "error": "Inference engine not ready"})

    request_id = str(uuid.uuid4())
    try:
        file_bytes = await file.read()
        payload = engine.infer(
            file_bytes=file_bytes,
            filename=file.filename or "unknown",
            return_heatmap=bool(returnHeatmap),
        )
        payload["requestId"] = request_id
        payload["contentType"] = file.content_type
        return JSONResponse(status_code=200, content=payload)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "requestId": request_id,
                "error": str(exc),
                "path": str(request.url.path),
            },
        )
