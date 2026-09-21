from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.models.entities import Case, Disease, Notification, RiskCategory, Role, Student, User


def seed_demo_data(db: Session) -> None:
    """Create intentionally obvious local-only demo accounts and synthetic records."""
    if db.scalar(select(User.id).limit(1)):
        return
    users = [
        User(username="student.demo", full_name="Demo Student", password_hash=hash_password("StudentDemo123!"), role=Role.STUDENT),
        User(username="teacher.demo", full_name="Demo Teacher", password_hash=hash_password("TeacherDemo123!"), role=Role.TEACHER),
        User(username="admin.demo", full_name="Demo Administrator", password_hash=hash_password("AdminDemo123!"), role=Role.ADMIN),
    ]
    db.add_all(users)
    db.flush()
    student = Student(user_id=users[0].id, student_code="S-DEMO-102", course="BSc Computer Science")
    disease = Disease(name="Respiratory illness (demo)", description="Synthetic configurable profile. Not clinical guidance.", symptoms=["Fever", "Cough", "Fatigue"])
    db.add_all([student, disease])
    db.flush()
    db.add(Notification(
        student_id=student.id,
        title="Potential exposure detected",
        message="You may have had a recent proximity event associated with a reported case. Please review the symptom follow-up. This is not a diagnosis.",
        risk_score=64.0,
        category=RiskCategory.ELEVATED,
    ))
    db.commit()


def dashboard_summary(db: Session) -> dict:
    """Build admin dashboard summary from live database state."""
    students_count = len(db.scalars(select(Student)).all())
    notifications = db.scalars(select(Notification)).all()
    active_cases = len(db.scalars(select(Case).where(Case.status == "OPEN")).all())

    # Count unique students under monitoring (have unacknowledged notifications)
    students_under_monitoring = len(set(n.student_id for n in notifications if not n.is_acknowledged))
    elevated_or_high = sum(1 for n in notifications if n.category in {RiskCategory.ELEVATED, RiskCategory.HIGH})

    # Very rough cluster estimate: locations with 3+ associated exposure notifications
    from collections import defaultdict
    from app.models.entities import ContactEvent
    loc_student_sets: dict[int, set[int]] = defaultdict(set)
    for event in db.scalars(select(ContactEvent)):
        loc_student_sets[event.location_id].add(event.student_a_id)
        loc_student_sets[event.location_id].add(event.student_b_id)
    potential_clusters = sum(1 for students_set in loc_student_sets.values() if len(students_set) >= 5)

    return {
        "label": "DEMO / SYNTHETIC DATA",
        "active_cases": active_cases,
        "students_under_monitoring": students_under_monitoring,
        "elevated_or_high_contacts": elevated_or_high,
        "potential_exposure_clusters": min(potential_clusters, 10),  # Cap for demo clarity
        "students": students_count,
        "disclaimer": "Exposure estimates are not diagnoses or confirmed infection probabilities.",
    }
