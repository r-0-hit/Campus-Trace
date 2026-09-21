"""Synthetic Campus Contact Event Generator.

Generates realistic spatio-temporal contact events between students across campus facilities.
ALL DATA IS SYNTHETIC AND FOR DEMONSTRATION ONLY.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from random import Random
from typing import List, Dict, Any


@dataclass
class CampusLocation:
    name: str
    environment_type: str  # "indoor" or "outdoor"
    latitude: float
    longitude: float
    capacity: int


DEFAULT_LOCATIONS = [
    CampusLocation("Main Library", "indoor", 19.0722, 72.8820, 200),
    CampusLocation("Engineering Complex", "indoor", 19.0730, 72.8810, 150),
    CampusLocation("Science & Research Block", "indoor", 19.0715, 72.8809, 120),
    CampusLocation("Central Dining Hall", "indoor", 19.0719, 72.8827, 300),
    CampusLocation("North Residential Hall", "indoor", 19.0740, 72.8832, 100),
    CampusLocation("South Residential Hall", "indoor", 19.0709, 72.8833, 100),
    CampusLocation("Athletic & Sports Arena", "outdoor", 19.0704, 72.8817, 250),
    CampusLocation("Administration & Student Center", "indoor", 19.0728, 72.8835, 80),
    CampusLocation("Computing & AI Laboratories", "indoor", 19.0735, 72.8824, 90),
    CampusLocation("Lecture Theatres & Classrooms", "indoor", 19.0724, 72.8815, 180),
]


class ContactGenerator:
    """Configurable synthetic contact and trajectory simulator."""

    def __init__(self, seed: int = 42):
        self.rng = Random(seed)

    def generate_contacts(
        self,
        student_ids: List[int],
        location_ids: List[int],
        total_events: int = 1800,
        days_window: int = 5,
    ) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        events = []

        for _ in range(total_events):
            student_a, student_b = self.rng.sample(student_ids, 2)
            location_id = self.rng.choice(location_ids)
            delta_hours = self.rng.uniform(0.5, days_window * 24.0)
            occurred_at = now - timedelta(hours=delta_hours)

            # Realistic distributions: closer distance & longer duration inside dining/labs
            duration_minutes = round(self.rng.uniform(2.0, 50.0), 1)
            distance_meters = round(self.rng.uniform(0.4, 5.5), 2)
            encounter_count = self.rng.choices([1, 2, 3, 4], weights=[0.6, 0.25, 0.1, 0.05])[0]

            events.append({
                "student_a_id": student_a,
                "student_b_id": student_b,
                "location_id": location_id,
                "occurred_at": occurred_at,
                "duration_minutes": duration_minutes,
                "estimated_distance_meters": distance_meters,
                "encounter_count": encounter_count,
            })

        return events
