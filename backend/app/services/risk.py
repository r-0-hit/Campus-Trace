from dataclasses import dataclass
from pathlib import Path
import os
import sys

from app.models.entities import RiskCategory

DISCLAIMER = "This is a computational exposure-risk estimate, not a medical diagnosis or confirmed infection probability."


@dataclass(frozen=True)
class ExposureFeatures:
    duration_minutes: float
    distance_meters: float
    encounters: int
    recency_hours: float
    indoor: bool
    graph_distance: int


class ExposureRiskService:
    """Exposure risk scoring engine powered by Random Forest ML model with heuristic fallback."""

    def __init__(self):
        self._predictor = None
        self._init_predictor()

    def _init_predictor(self):
        try:
            # Add project root to sys.path to access ml module if needed
            root = Path(__file__).resolve().parent.parent.parent.parent
            if str(root) not in sys.path:
                sys.path.insert(0, str(root))
            from ml.inference.predictor import RiskPredictor, ExposureInput
            self._exposure_input_cls = ExposureInput
            self._predictor = RiskPredictor()
        except Exception:
            self._predictor = None

    def estimate(self, features: ExposureFeatures) -> dict:
        if self._predictor is not None and self._predictor.model is not None:
            inp = self._exposure_input_cls(
                duration_minutes=features.duration_minutes,
                distance_meters=features.distance_meters,
                encounters=features.encounters,
                recency_hours=features.recency_hours,
                indoor=features.indoor,
                graph_distance=features.graph_distance,
            )
            result = self._predictor.predict(inp)
            result["category"] = self.category(result["risk_score"])
            return result

        # Graceful transparent fallback
        duration = min(features.duration_minutes / 60, 1) * 0.30
        distance = max(0, 1 - features.distance_meters / 4) * 0.24
        frequency = min(features.encounters / 5, 1) * 0.16
        recency = max(0, 1 - features.recency_hours / 96) * 0.14
        environment = 0.10 if features.indoor else 0.03
        graph = max(0, 1 - (features.graph_distance - 1) * 0.45) * 0.06
        score = round(min(100, (duration + distance + frequency + recency + environment + graph) * 100), 1)
        category = self.category(score)
        return {
            "risk_score": score,
            "confidence": round(0.70 + (0.15 if features.encounters >= 2 else 0), 2),
            "category": category,
            "feature_contributions": {
                "duration": round(duration, 2),
                "distance": round(distance, 2),
                "frequency": round(frequency, 2),
                "recency": round(recency, 2),
                "environment": round(environment, 2),
                "graph_distance": round(graph, 2),
            },
            "model_version": "rule-based-fallback-0.1",
            "disclaimer": DISCLAIMER,
        }

    @staticmethod
    def category(score: float) -> RiskCategory:
        if score >= 75:
            return RiskCategory.HIGH
        if score >= 55:
            return RiskCategory.ELEVATED
        if score >= 30:
            return RiskCategory.MODERATE
        return RiskCategory.LOW
