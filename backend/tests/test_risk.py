from app.models.entities import RiskCategory
from app.services.risk import ExposureFeatures, ExposureRiskService


def test_high_risk_proximity_event_is_explainable() -> None:
    estimate = ExposureRiskService().estimate(
        ExposureFeatures(
            duration_minutes=55,
            distance_meters=0.5,
            encounters=4,
            recency_hours=4,
            indoor=True,
            graph_distance=1,
        )
    )

    assert estimate["category"] == RiskCategory.HIGH
    assert 75 <= estimate["risk_score"] <= 100
    assert "duration" in estimate["feature_contributions"]
    assert "not a medical diagnosis" in estimate["disclaimer"]


def test_distant_old_contact_has_lower_exposure_risk() -> None:
    estimate = ExposureRiskService().estimate(
        ExposureFeatures(
            duration_minutes=3,
            distance_meters=8,
            encounters=1,
            recency_hours=120,
            indoor=False,
            graph_distance=2,
        )
    )

    assert estimate["category"] == RiskCategory.LOW
    assert estimate["risk_score"] < 30
