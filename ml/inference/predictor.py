"""Inference Service and RiskPredictor for Campus Trace.

SYNTHETIC DEMO ESTIMATE ONLY.
Computational exposure-risk estimates are not medical diagnoses.
"""
import os
import joblib
from pathlib import Path
from typing import Any, Dict

from ml.features.extractor import FeatureExtractor, ExposureInput

DISCLAIMER = "This is a computational exposure-risk estimate, not a medical diagnosis or confirmed infection probability."


class RiskPredictor:
    """Loads persistent Random Forest model artifact and performs inference with fallback."""

    def __init__(self, model_path: str | None = None):
        if model_path is None:
            # Default path
            base = Path(__file__).resolve().parent.parent.parent
            model_path = str(base / "ml" / "models" / "demo-risk-model.joblib")

        self.model_path = model_path
        self.extractor = FeatureExtractor()
        self.model = None
        self.model_version = "demo-rf-fallback"
        self.feature_version = "v1.0"
        self._load_model()

    def _load_model(self):
        if os.path.exists(self.model_path):
            try:
                payload = joblib.load(self.model_path)
                self.model = payload["model"]
                self.model_version = payload.get("model_version", "demo-rf-1.0.0")
                self.feature_version = payload.get("feature_version", "v1.0")
            except Exception as exc:
                print(f"Failed to load ML model from {self.model_path}: {exc}. Using heuristic fallback.")
                self.model = None

    def predict(self, inp: ExposureInput) -> Dict[str, Any]:
        features = self.extractor.extract_features(inp)

        if self.model is not None:
            score = float(self.model.predict(features.reshape(1, -1))[0])
            score = round(max(0.0, min(100.0, score)), 1)
        else:
            # Heuristic calculation fallback
            score = round(min(100.0, (
                features[0] * 30.0 +
                features[1] * 24.0 +
                features[2] * 16.0 +
                features[3] * 14.0 +
                features[4] * 10.0 +
                features[5] * 6.0
            ) * 100.0), 1)

        category = self.classify_risk(score)
        confidence = round(0.70 + (0.15 if inp.encounters >= 2 else 0.0), 2)

        contributions = {
            "duration": round(float(features[0] * 0.30), 2),
            "distance": round(float(features[1] * 0.24), 2),
            "frequency": round(float(features[2] * 0.16), 2),
            "recency": round(float(features[3] * 0.14), 2),
            "environment": round(float(features[4] * 0.10), 2),
            "graph_distance": round(float(features[5] * 0.06), 2),
        }

        return {
            "risk_score": score,
            "confidence": confidence,
            "category": category,
            "feature_contributions": contributions,
            "model_version": self.model_version,
            "feature_version": self.feature_version,
            "disclaimer": DISCLAIMER,
            "dataset": "DEMO / SYNTHETIC DATA",
        }

    @staticmethod
    def classify_risk(score: float) -> str:
        if score >= 75.0:
            return "HIGH"
        if score >= 55.0:
            return "ELEVATED"
        if score >= 30.0:
            return "MODERATE"
        return "LOW"
