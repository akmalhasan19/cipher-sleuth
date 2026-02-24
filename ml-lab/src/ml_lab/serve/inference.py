from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from ml_lab.features.dwt_svd import compute_dwt_svd_features, compute_simple_dwt_svd_score
from ml_lab.features.ela import compute_ela_features, compute_simple_ela_score
from ml_lab.features.image_ops import decode_image_bytes


class InferenceEngine:
    def __init__(self, artifact_path: str | Path):
        self.artifact_path = Path(artifact_path)
        if not self.artifact_path.exists():
            raise FileNotFoundError(f"Artifact not found: {self.artifact_path}")
        self.bundle = joblib.load(self.artifact_path)
        self.primary_method = self.bundle["primary_method"]
        self.methods = self.bundle["methods"]
        self.config = self.bundle["config"]
        self.model_version = self.bundle.get("model_version", "ela-dwtsvd-fusion-v1.0.0")

    def _predict_method(self, method: str, full_feature_row: dict[str, float]) -> float:
        method_payload = self.methods[method]
        cols = method_payload["feature_columns"]
        x = np.array([full_feature_row[c] for c in cols], dtype=np.float32).reshape(1, -1)
        prob = float(method_payload["pipeline"].predict_proba(x)[0, 1])
        return prob

    def _top_signal_names(self, full_feature_row: dict[str, float], method: str, top_k: int = 3) -> list[str]:
        method_payload = self.methods[method]
        pipeline = method_payload["pipeline"]
        cols = method_payload["feature_columns"]
        x = np.array([full_feature_row[c] for c in cols], dtype=np.float32).reshape(1, -1)

        scaler = pipeline.named_steps["scaler"]
        clf = pipeline.named_steps["clf"]
        x_scaled = scaler.transform(x)

        selected_idx = np.arange(len(cols))
        x_model = x_scaled
        if "selector" in pipeline.named_steps:
            selector = pipeline.named_steps["selector"]
            selected_idx = selector.get_support(indices=True)
            x_model = selector.transform(x_scaled)

        if hasattr(clf, "coef_"):
            model_weights = np.asarray(clf.coef_[0], dtype=np.float32)
            contribution = x_model[0] * model_weights
        elif hasattr(clf, "feature_importances_"):
            importances = np.asarray(clf.feature_importances_, dtype=np.float32)
            contribution = np.abs(x_model[0]) * importances
        else:
            contribution = np.abs(x_model[0])

        ranked_idx = np.argsort(np.abs(contribution))[::-1][:top_k]
        return [cols[selected_idx[i]] for i in ranked_idx]

    def infer(self, file_bytes: bytes, filename: str, return_heatmap: bool = False) -> dict[str, Any]:
        started = time.perf_counter()
        image_size = tuple(self.config["experiment"]["image_size"])
        ela_cfg = self.config["features"]["ela"]
        dwt_cfg = self.config["features"]["dwt"]

        image = decode_image_bytes(file_bytes=file_bytes, image_size=image_size)
        ela_features, _, heatmap_b64 = compute_ela_features(
            image_rgb=image,
            jpeg_quality=int(ela_cfg["jpeg_quality"]),
            high_threshold=float(ela_cfg["high_threshold"]),
            smooth_blur_kernel=int(ela_cfg["smooth_blur_kernel"]),
            with_heatmap=return_heatmap,
        )
        dwt_features = compute_dwt_svd_features(
            image_rgb=image,
            wavelet=str(dwt_cfg["wavelet"]),
            level=int(dwt_cfg["level"]),
            top_k_singular=int(dwt_cfg["top_k_singular"]),
        )
        full_features = {**ela_features, **dwt_features}

        fusion_prob = self._predict_method(self.primary_method, full_features)
        primary_threshold = float(self.methods[self.primary_method]["threshold"])
        label = "manipulated" if fusion_prob >= primary_threshold else "authentic"
        confidence = float(abs(fusion_prob - 0.5) * 2.0)

        ela_score = (
            self._predict_method("ela_only", full_features)
            if "ela_only" in self.methods
            else compute_simple_ela_score(ela_features)
        )
        dwt_score = (
            self._predict_method("dwt_svd_only", full_features)
            if "dwt_svd_only" in self.methods
            else compute_simple_dwt_svd_score(dwt_features)
        )
        top_signals = self._top_signal_names(full_features, self.primary_method, top_k=3)

        elapsed_ms = (time.perf_counter() - started) * 1000.0
        return {
            "ok": True,
            "modelVersion": self.model_version,
            "filename": filename,
            "prediction": {
                "label": label,
                "probability": round(fusion_prob, 6),
                "confidence": round(confidence, 6),
            },
            "scores": {
                "elaScore": round(float(ela_score), 6),
                "dwtsvdScore": round(float(dwt_score), 6),
                "fusionScore": round(float(fusion_prob), 6),
            },
            "explainability": {
                "topSignals": top_signals,
                "elaHeatmapBase64": heatmap_b64 if return_heatmap else None,
            },
            "timingMs": round(float(elapsed_ms), 3),
        }
