"""Campus Outbreak Demonstration Scenario.

Orchestrates synthetic cohort generation, dense index case contact cluster,
and verification of risk propagation across graph hops.
"""
from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class OutbreakConfig:
    num_students: int = 100
    num_locations: int = 10
    total_contacts: int = 1800
    dense_index_cluster_size: int = 20
    disease_name: str = "Respiratory illness (demo)"
    exposure_window_hours: int = 72


def get_default_scenario() -> Dict[str, Any]:
    config = OutbreakConfig()
    return {
        "title": "Residence Hall & Cafeteria Outbreak Demo",
        "description": "Dense interaction cluster centered around central dining and study halls.",
        "config": config,
        "is_synthetic": True,
        "disclaimer": "This scenario uses entirely synthetic entities for contact tracing algorithm demonstration.",
    }
