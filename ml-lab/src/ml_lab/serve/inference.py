from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from ml_lab.features.cfa import compute_cfa_features, compute_simple_cfa_score
from ml_lab.features.dwt_svd import compute_dwt_svd_features, compute_simple_dwt_svd_score
from ml_lab.features.ela import compute_ela_features, compute_simple_ela_score
from ml_lab.features.image_ops import decode_image_bytes
from ml_lab.features.mantra import compute_mantra_features, compute_simple_mantra_score
from ml_lab.features.prnu import compute_prnu_features, compute_simple_prnu_score


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

    def _predict_method_if_available(self, method: str, full_feature_row: dict[str, float]) -> float | None:
        if method not in self.methods:
            return None
        cols = self.methods[method]["feature_columns"]
        if any(col not in full_feature_row for col in cols):
            return None
        return self._predict_method(method, full_feature_row)

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
        cfa_cfg = self.config["features"].get("cfa", {})
        cfa_features, _, cfa_map_b64 = compute_cfa_features(
            image_rgb=image,
            window_size=int(cfa_cfg.get("window_size", 7)),
            variance_threshold=float(cfa_cfg.get("variance_threshold", 0.6)),
            smooth_sigma=float(cfa_cfg.get("smooth_sigma", 1.0)),
            with_map=return_heatmap,
        )
        prnu_cfg = self.config["features"].get("prnu", {})
        prnu_features, _, prnu_residual_b64 = compute_prnu_features(
            image_rgb=image,
            wavelet=str(prnu_cfg.get("wavelet", "db4")),
            level=int(prnu_cfg.get("level", 2)),
            with_map=return_heatmap,
        )
        mantra_cfg = self.config["features"].get("mantra", {})
        mantra_features, _, mantra_mask_b64 = compute_mantra_features(
            image_rgb=image,
            config=mantra_cfg,
            with_mask=return_heatmap,
        )
        full_features = {**ela_features, **dwt_features, **cfa_features, **prnu_features, **mantra_features}

        fusion_prob = self._predict_method_if_available(self.primary_method, full_features)
        if fusion_prob is None:
            fusion_prob = float(
                np.clip(
                    0.40 * compute_simple_mantra_score(mantra_features)
                    + 0.25 * compute_simple_cfa_score(cfa_features)
                    + 0.20 * compute_simple_prnu_score(prnu_features)
                    + 0.10 * compute_simple_ela_score(ela_features)
                    + 0.05 * compute_simple_dwt_svd_score(dwt_features),
                    0.0,
                    1.0,
                )
            )

        primary_threshold = float(self.methods[self.primary_method]["threshold"]) if self.primary_method in self.methods else 0.5
        label = "manipulated" if fusion_prob >= primary_threshold else "authentic"
        confidence = float(abs(fusion_prob - 0.5) * 2.0)

        ela_score = self._predict_method_if_available("ela_only", full_features)
        if ela_score is None:
            ela_score = compute_simple_ela_score(ela_features)
        dwt_score = self._predict_method_if_available("dwt_svd_only", full_features)
        if dwt_score is None:
            dwt_score = compute_simple_dwt_svd_score(dwt_features)
        cfa_score = self._predict_method_if_available("cfa_only", full_features)
        if cfa_score is None:
            cfa_score = compute_simple_cfa_score(cfa_features)
        prnu_score = self._predict_method_if_available("prnu_only", full_features)
        if prnu_score is None:
            prnu_score = compute_simple_prnu_score(prnu_features)
        mantra_score = self._predict_method_if_available("mantra_only", full_features)
        if mantra_score is None:
            mantra_score = compute_simple_mantra_score(mantra_features)

        if self.primary_method in self.methods:
            top_signals = self._top_signal_names(full_features, self.primary_method, top_k=3)
        else:
            top_signals = [
                name
                for name, _ in sorted(full_features.items(), key=lambda item: abs(float(item[1])), reverse=True)[:3]
            ]

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
                "cfaScore": round(float(cfa_score), 6),
                "prnuScore": round(float(prnu_score), 6),
                "mantraScore": round(float(mantra_score), 6),
                "fusionScore": round(float(fusion_prob), 6),
            },
            "explainability": {
                "topSignals": top_signals,
                "elaHeatmapBase64": heatmap_b64 if return_heatmap else None,
                "cfaMapBase64": cfa_map_b64 if return_heatmap else None,
                "mantraMaskBase64": mantra_mask_b64 if return_heatmap else None,
                "prnuResidualBase64": prnu_residual_b64 if return_heatmap else None,
            },
            "timingMs": round(float(elapsed_ms), 3),
        }
