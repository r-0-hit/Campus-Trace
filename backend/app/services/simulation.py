"""Deterministic synthetic campus data generator for demo use only."""

from datetime import datetime, timedelta, timezone
from random import Random

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.entities import (Case, ContactEvent, Disease, Investigation,
                                 InvestigationContact, Location, Notification,
                                 Role, Student, SymptomReport, User)

DEMO_LOCATIONS = [
    ("Library", "indoor", 19.0722, 72.8820), ("Engineering Block", "indoor", 19.0730, 72.8810),
    ("Science Block", "indoor", 19.0715, 72.8809), ("Cafeteria", "indoor", 19.0719, 72.8827),
    ("North Hostel", "indoor", 19.0740, 72.8832), ("South Hostel", "indoor", 19.0709, 72.8833),
    ("Sports Area", "outdoor", 19.0704, 72.8817), ("Administration", "indoor", 19.0728, 72.8835),
    ("Laboratories", "indoor", 19.0735, 72.8824), ("Classrooms", "indoor", 19.0724, 72.8815),
]


class SimulationService:
    """Generates pseudonymous records with no real-world health interpretation."""

    def generate(self, db: Session, student_count: int = 100, contact_count: int = 1800) -> Case:
        rng = Random(20260921)
        # Keep the original local demo account; clear only earlier generated scenario records.
        generated_codes = db.scalars(select(Student.student_code).where(Student.student_code.like("SIM-%"))).all()
        if generated_codes:
            generated_ids = list(db.scalars(select(Student.id).where(Student.student_code.like("SIM-%"))))
            if generated_ids:
                case_ids = list(db.scalars(select(Case.id).where(Case.student_id.in_(generated_ids))))
                investigation_ids = list(db.scalars(select(Investigation.id).where(Investigation.case_id.in_(case_ids)))) if case_ids else []
                notification_ids = list(db.scalars(select(Notification.id).where(Notification.student_id.in_(generated_ids))))
                if notification_ids:
                    db.execute(delete(SymptomReport).where(SymptomReport.notification_id.in_(notification_ids)))
                if investigation_ids:
                    db.execute(delete(InvestigationContact).where(InvestigationContact.investigation_id.in_(investigation_ids)))
                    db.execute(delete(Investigation).where(Investigation.id.in_(investigation_ids)))
                if case_ids:
                    db.execute(delete(Case).where(Case.id.in_(case_ids)))
                db.execute(delete(Notification).where(Notification.student_id.in_(generated_ids)))
                db.execute(delete(ContactEvent).where(ContactEvent.student_a_id.in_(generated_ids) | ContactEvent.student_b_id.in_(generated_ids)))
                db.execute(delete(Student).where(Student.id.in_(generated_ids)))
            db.execute(delete(User).where(User.username.like("sim.%")))
        db.execute(delete(Location).where(Location.is_demo.is_(True)))
        db.flush()

        locations = [Location(name=name, environment_type=environment, latitude=lat, longitude=lon) for name, environment, lat, lon in DEMO_LOCATIONS]
        db.add_all(locations)
        db.flush()
        sample_hash = db.scalar(select(User.password_hash).where(User.username == "student.demo"))
        users = [User(username=f"sim.{index:03d}", full_name=f"Synthetic Student {index:03d}", password_hash=sample_hash, role=Role.STUDENT) for index in range(1, student_count + 1)]
        db.add_all(users)
        db.flush()
        students = [Student(user_id=user.id, student_code=f"SIM-{index:03d}", course=f"Demo cohort {(index - 1) % 5 + 1}") for index, user in enumerate(users, 1)]
        db.add_all(students)
        db.flush()

        now = datetime.now(timezone.utc)
        index_student = students[0]
        events: list[ContactEvent] = []
        # A small dense cohort around the index case guarantees a useful demo traversal.
        for target in students[1:22]:
            events.append(ContactEvent(student_a_id=index_student.id, student_b_id=target.id, location_id=locations[3].id, occurred_at=now - timedelta(hours=rng.randint(2, 40)), duration_minutes=rng.uniform(16, 48), estimated_distance_meters=rng.uniform(.6, 2.0), indoor=True, encounter_count=rng.randint(2, 5)))
        for _ in range(contact_count - len(events)):
            first, second = rng.sample(students, 2)
            location = rng.choice(locations)
            events.append(ContactEvent(student_a_id=first.id, student_b_id=second.id, location_id=location.id, occurred_at=now - timedelta(hours=rng.randint(1, 120)), duration_minutes=round(rng.uniform(2, 55), 1), estimated_distance_meters=round(rng.uniform(.5, 6), 1), indoor=location.environment_type == "indoor", encounter_count=rng.randint(1, 4)))
        db.add_all(events)
        disease = db.scalar(select(Disease).where(Disease.name == "Respiratory illness (demo)"))
        case = Case(student_id=index_student.id, disease_id=disease.id, date_reported=now.date(), symptom_onset=(now - timedelta(days=1)).date(), symptoms=["Fever", "Cough"], notes="Synthetic demo index case.")
        db.add(case)
        db.commit()
        db.refresh(case)
        return case
