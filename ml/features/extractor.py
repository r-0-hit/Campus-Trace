"""Synthetic Feature Extractor for Computational Exposure Risk Scoring.

DEMO / SYNTHETIC DATA ONLY.
Features and weights are for algorithmic demonstration and decision-support prototypes.
They do not constitute clinical or medical diagnosis.
"""
from dataclasses import dataclass, asdict
import numpy as np


@dataclass
class ExposureInput:
    duration_minutes: float
    distance_meters: float
    encounters: int
    recency_hours: float
    indoor: bool
    graph_distance: int


class FeatureExtractor:
    """Extracts normalised feature vectors for the risk estimation model."""

    FEATURE_NAMES = [
        "duration_scaled",
        "distance_scaled",
        "encounter_frequency",
        "recency_decay",
        "indoor_flag",
        "graph_proximity",
    ]

    def extract_features(self, inp: ExposureInput) -> np.ndarray:
        # Scale duration (capped at 60 mins)
        duration_scaled = min(inp.duration_minutes / 60.0, 1.0)
        # Distance penalty: closer = higher score (0 to 4m)
        distance_scaled = max(0.0, 1.0 - (inp.distance_meters / 4.0))
        # Encounter count scaled (capped at 5)
        encounter_frequency = min(inp.encounters / 5.0, 1.0)
        # Recency decay (over 96 hours window)
        recency_decay = max(0.0, 1.0 - (inp.recency_hours / 96.0))
        # Environment
        indoor_flag = 1.0 if inp.indoor else 0.0
        # Graph proximity (1.0 for direct contacts, decay for higher hops)
        graph_proximity = max(0.0, 1.0 - (inp.graph_distance - 1) * 0.45)

        return np.array([
            duration_scaled,
            distance_scaled,
            encounter_frequency,
            recency_decay,
            indoor_flag,
            graph_proximity,
        ], dtype=np.float32)

    def extract_batch(self, inputs: list[ExposureInput]) -> np.ndarray:
        return np.array([self.extract_features(inp) for inp in inputs], dtype=np.float32)
