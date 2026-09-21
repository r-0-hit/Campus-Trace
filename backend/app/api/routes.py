"""Campus Trace API routes – all HTTP handlers.

Business logic lives in dedicated service classes, not here.
Authorization is always enforced server-side via require_roles().
"""
from __future__ import annotations

import datetime as dt
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import current_user, require_roles
from app.auth.security import create_access_token, verify_password
from app.database import get_db
from app.models.entities import (
    Case, ContactEvent, Disease, Investigation, InvestigationContact,
    Location, Notification, RiskCategory, Role, Student, SymptomReport, User,
)
from app.schemas.api import (
    CaseReportRequest, CaseResponse, LoginRequest, NotificationResponse,
    RiskEstimate, SymptomResponseRequest, TokenResponse, UserMe,
)
from app.services.demo import dashboard_summary
from app.services.investigation import InvestigationService
from app.services.risk import ExposureFeatures, ExposureRiskService
from app.services.simulation import SimulationService

router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

@router.post("/auth/login", response_model=TokenResponse, tags=["authentication"])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token_str = create_access_token(str(user.id), user.role.value)
    return TokenResponse(access_token=token_str, token=token_str, role=user.role)


# ---------------------------------------------------------------------------
# Students (self)
# ---------------------------------------------------------------------------

@router.get("/students/me", response_model=UserMe, tags=["students"])
def get_me(user: User = Depends(current_user)) -> UserMe:
    return UserMe(
        id=user.id, username=user.username, full_name=user.full_name,
        role=user.role, student_code=user.student.student_code if user.student else None,
    )


@router.get("/students/me/exposure", response_model=list[NotificationResponse], tags=["students"])
def my_exposure(user: User = Depends(require_roles(Role.STUDENT)), db: Session = Depends(get_db)) -> list[Notification]:
    return list(
        db.scalars(
            select(Notification)
            .where(Notification.student_id == user.student.id)
            .order_by(Notification.created_at.desc())
        )
    )


# ---------------------------------------------------------------------------
# Cases
# ---------------------------------------------------------------------------

@router.post("/cases/report", response_model=CaseResponse, status_code=status.HTTP_201_CREATED, tags=["cases"])
def report_case(payload: CaseReportRequest, user: User = Depends(require_roles(Role.STUDENT)), db: Session = Depends(get_db)) -> CaseResponse:
    disease = db.get(Disease, payload.disease_id)
    if not disease:
        raise HTTPException(status_code=404, detail="Disease profile not found")
    case = Case(
        student_id=user.student.id, disease_id=disease.id,
        date_reported=payload.date_reported, symptom_onset=payload.symptom_onset,
        symptoms=payload.symptoms, notes=payload.notes,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    InvestigationService().start(db, case, max_depth=2)
    return CaseResponse(id=case.id, disease=disease.name, date_reported=case.date_reported, status=case.status)


@router.get("/cases", tags=["cases"])
def list_cases(user: User = Depends(require_roles(Role.ADMIN)), db: Session = Depends(get_db)) -> list[dict]:
    cases = list(db.scalars(select(Case).order_by(Case.created_at.desc())))
    result = []
    for c in cases:
        student = db.get(Student, c.student_id)
        disease = db.get(Disease, c.disease_id)
        result.append({
            "id": c.id,
            "student_code": student.student_code if student else "Unknown",
            "disease": disease.name if disease else "Unknown",
            "date_reported": str(c.date_reported),
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return result


@router.get("/cases/{case_id}", tags=["cases"])
def get_case(case_id: int, user: User = Depends(require_roles(Role.ADMIN)), db: Session = Depends(get_db)) -> dict:
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    student = db.get(Student, c.student_id)
    disease = db.get(Disease, c.disease_id)
    return {
        "id": c.id,
        "student_code": student.student_code if student else "Unknown",
        "disease": disease.name if disease else "Unknown",
        "date_reported": str(c.date_reported),
        "symptom_onset": str(c.symptom_onset) if c.symptom_onset else None,
        "symptoms": c.symptoms,
        "status": c.status,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

@router.get("/notifications", response_model=list[NotificationResponse], tags=["notifications"])
def notifications(user: User = Depends(require_roles(Role.STUDENT)), db: Session = Depends(get_db)) -> list[Notification]:
    return list(
        db.scalars(
            select(Notification)
            .where(Notification.student_id == user.student.id)
            .order_by(Notification.created_at.desc())
        )
    )


@router.post("/notifications/{notification_id}/acknowledge", tags=["notifications"])
def acknowledge(notification_id: int, user: User = Depends(require_roles(Role.STUDENT)), db: Session = Depends(get_db)) -> dict:
    notification = db.get(Notification, notification_id)
    if not notification or notification.student_id != user.student.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_acknowledged = True
    db.commit()
    return {"status": "acknowledged"}


@router.post("/notifications/{notification_id}/symptom-response", tags=["notifications"])
def symptom_response(
    notification_id: int,
    payload: SymptomResponseRequest,
    user: User = Depends(require_roles(Role.STUDENT)),
    db: Session = Depends(get_db),
) -> dict:
    notification = db.get(Notification, notification_id)
    if not notification or notification.student_id != user.student.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    if db.scalar(select(SymptomReport).where(SymptomReport.notification_id == notification_id)):
        raise HTTPException(status_code=409, detail="A symptom response already exists for this notification")
    db.add(SymptomReport(notification_id=notification_id, response=payload.response))
    db.commit()
    return {"status": "recorded", "message": "Response recorded. This does not determine infection status."}


# ---------------------------------------------------------------------------
# Risk
# ---------------------------------------------------------------------------

@router.post("/risk/predict", response_model=RiskEstimate, tags=["risk"])
def predict_risk(user: User = Depends(require_roles(Role.ADMIN, Role.TEACHER))) -> dict:
    return ExposureRiskService().estimate(ExposureFeatures(35, 1.2, 3, 20, True, 1))


# ---------------------------------------------------------------------------
# Teacher
# ---------------------------------------------------------------------------

@router.get("/teacher/dashboard", tags=["teacher"])
def teacher_dashboard(user: User = Depends(require_roles(Role.TEACHER))) -> dict:
    return {
        "label": "DEMO / SYNTHETIC DATA",
        "assigned_classes": ["CS-301", "CS-302", "Data-Science-401"],
        "anonymized_exposure_status": {"monitoring": 3, "elevated": 2, "high": 1},
        "recommended_action": "Share general hygiene guidance; do not identify students or infer medical status.",
        "affected_locations": ["Cafeteria", "Classrooms"],
        "disclaimer": "Aggregate information only. Individual health data is not accessible.",
    }


# ---------------------------------------------------------------------------
# Admin – dashboard
# ---------------------------------------------------------------------------

@router.get("/admin/dashboard", tags=["admin"])
def admin_dashboard(user: User = Depends(require_roles(Role.ADMIN)), db: Session = Depends(get_db)) -> dict:
    return dashboard_summary(db)


# ---------------------------------------------------------------------------
# Admin – analytics (chart data)
# ---------------------------------------------------------------------------

@router.get("/admin/analytics", tags=["admin"])
def admin_analytics(user: User = Depends(require_roles(Role.ADMIN)), db: Session = Depends(get_db)) -> dict:
    notifications_all = list(db.scalars(select(Notification)))
    risk_dist = {"LOW": 0, "MODERATE": 0, "ELEVATED": 0, "HIGH": 0}
    for n in notifications_all:
        risk_dist[n.category.value] += 1

    cases = list(db.scalars(select(Case).order_by(Case.created_at.desc())))
    cases_by_day: dict[str, int] = defaultdict(int)
    for c in cases:
        if c.created_at:
            day = c.created_at.strftime("%Y-%m-%d")
            cases_by_day[day] += 1
    case_timeline = [{"date": k, "cases": v} for k, v in sorted(cases_by_day.items())[-14:]]

    events = list(db.scalars(select(ContactEvent)))
    location_density: dict[int, int] = defaultdict(int)
    for e in events:
        location_density[e.location_id] += 1
    locations = list(db.scalars(select(Location)))
    location_chart = sorted(
        [{"name": loc.name, "contacts": location_density.get(loc.id, 0), "environment": loc.environment_type} for loc in locations],
        key=lambda x: x["contacts"], reverse=True,
    )

    ic_records = list(db.scalars(select(InvestigationContact)))
    depth_risk: dict[str, dict[str, int]] = {
        "1": {"LOW": 0, "MODERATE": 0, "ELEVATED": 0, "HIGH": 0},
        "2": {"LOW": 0, "MODERATE": 0, "ELEVATED": 0, "HIGH": 0},
    }
    for ic in ic_records:
        key = str(min(ic.graph_distance, 2))
        depth_risk[key][ic.category.value] += 1

    return {
        "label": "DEMO / SYNTHETIC DATA",
        "risk_distribution": [{"category": k, "count": v} for k, v in risk_dist.items()],
        "case_timeline": case_timeline,
        "location_density": location_chart[:10],
        "depth_risk_breakdown": depth_risk,
        "total_students_in_graph": len(ic_records),
        "disclaimer": "All data is synthetic. Estimates are not medical diagnoses.",
    }


# ---------------------------------------------------------------------------
# Admin – students
# ---------------------------------------------------------------------------

@router.get("/admin/students", tags=["admin"])
def admin_students(user: User = Depends(require_roles(Role.ADMIN)), db: Session = Depends(get_db)) -> list[dict]:
    students = list(db.scalars(select(Student)))
    all_notifications = list(db.scalars(select(Notification)))
    notif_by_student: dict[int, dict] = {}
    for n in all_notifications:
        if n.student_id not in notif_by_student or n.risk_score > notif_by_student[n.student_id]["risk_score"]:
            notif_by_student[n.student_id] = {"risk_score": n.risk_score, "category": n.category.value}
    result = []
    for s in students:
        notif = notif_by_student.get(s.id)
        result.append({
            "id": s.id,
            "student_code": s.student_code,
            "course": s.course,
            "risk_score": notif["risk_score"] if notif else None,
            "risk_category": notif["category"] if notif else "NONE",
        })
    result.sort(key=lambda x: (x["risk_score"] or 0), reverse=True)
    return result


# ---------------------------------------------------------------------------
# Admin – audit trail
# ---------------------------------------------------------------------------

@router.get("/admin/audit", tags=["admin"])
def admin_audit(user: User = Depends(require_roles(Role.ADMIN)), db: Session = Depends(get_db)) -> list[dict]:
    events: list[dict] = []
    for c in db.scalars(select(Case).order_by(Case.created_at.desc()).limit(20)):
        student = db.get(Student, c.student_id)
        events.append({
            "timestamp": c.created_at.isoformat() if c.created_at else "",
            "action": "CASE_REPORTED",
            "detail": f"Case #{c.id} reported by {student.student_code if student else 'Unknown'}",
            "actor": "STUDENT",
        })
    for inv in db.scalars(select(Investigation).order_by(Investigation.created_at.desc()).limit(20)):
        events.append({
            "timestamp": inv.created_at.isoformat() if inv.created_at else "",
            "action": "INVESTIGATION_STARTED",
            "detail": f"Investigation #{inv.id} started (depth={inv.max_depth})",
            "actor": "SYSTEM",
        })
    for n in db.scalars(select(Notification).order_by(Notification.created_at.desc()).limit(30)):
        events.append({
            "timestamp": n.created_at.isoformat() if n.created_at else "",
            "action": "NOTIFICATION_GENERATED",
            "detail": f"Notification sent · {n.category.value} · score {n.risk_score}",
            "actor": "SYSTEM",
        })
    events.sort(key=lambda x: x["timestamp"], reverse=True)
    return events[:50]


# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------

@router.post("/simulation/generate", tags=["simulation"])
def generate_simulation(user: User = Depends(require_roles(Role.ADMIN)), db: Session = Depends(get_db)) -> dict:
    case = SimulationService().generate(db)
    investigation = InvestigationService().start(db, case, max_depth=2)
    graph = InvestigationService().graph(db, investigation.id)
    return {
        "case_id": case.id,
        "investigation_id": investigation.id,
        "students": 100,
        "locations": 10,
        "contact_events": 1800,
        "contacts_identified": len(graph["nodes"]) - 1,
        "label": "DEMO / SYNTHETIC DATA",
    }


# ---------------------------------------------------------------------------
# Investigations
# ---------------------------------------------------------------------------

@router.post("/investigations/start", tags=["investigations"])
def start_investigation(case_id: int, max_depth: int = 2, user: User = Depends(require_roles(Role.ADMIN)), db: Session = Depends(get_db)) -> dict:
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        investigation = InvestigationService().start(db, c, max_depth=max_depth)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return InvestigationService().graph(db, investigation.id)


@router.get("/investigations", tags=["investigations"])
def list_investigations(user: User = Depends(require_roles(Role.ADMIN)), db: Session = Depends(get_db)) -> list[dict]:
    investigations = list(db.scalars(select(Investigation).order_by(Investigation.created_at.desc())))
    result = []
    for inv in investigations:
        c = db.get(Case, inv.case_id)
        student = db.get(Student, c.student_id) if c else None
        disease = db.get(Disease, c.disease_id) if c else None
        contact_count = len(list(db.scalars(select(InvestigationContact).where(InvestigationContact.investigation_id == inv.id))))
        result.append({
            "id": inv.id,
            "case_id": inv.case_id,
            "status": inv.status,
            "max_depth": inv.max_depth,
            "index_student": student.student_code if student else "Unknown",
            "disease": disease.name if disease else "Unknown",
            "contact_count": contact_count,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
        })
    return result


@router.get("/investigations/{investigation_id}", tags=["investigations"])
def get_investigation(investigation_id: int, user: User = Depends(require_roles(Role.ADMIN)), db: Session = Depends(get_db)) -> dict:
    try:
        return InvestigationService().graph(db, investigation_id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------

@router.get("/graph/case/{case_id}", tags=["graph"])
def graph_for_case(case_id: int, user: User = Depends(require_roles(Role.ADMIN)), db: Session = Depends(get_db)) -> dict:
    inv = db.scalar(select(Investigation).where(Investigation.case_id == case_id).order_by(Investigation.created_at.desc()))
    if not inv:
        raise HTTPException(status_code=404, detail="No investigation found for this case")
    try:
        return InvestigationService().graph(db, inv.id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


# ---------------------------------------------------------------------------
# Locations
# ---------------------------------------------------------------------------

@router.get("/locations", tags=["locations"])
def list_locations(user: User = Depends(require_roles(Role.ADMIN)), db: Session = Depends(get_db)) -> list[dict]:
    locations = list(db.scalars(select(Location)))
    events = list(db.scalars(select(ContactEvent)))
    loc_event_count: dict[int, int] = defaultdict(int)
    for e in events:
        loc_event_count[e.location_id] += 1
    return [
        {
            "id": loc.id, "name": loc.name, "environment_type": loc.environment_type,
            "latitude": loc.latitude, "longitude": loc.longitude,
            "contact_events": loc_event_count.get(loc.id, 0),
        }
        for loc in locations
    ]


# ---------------------------------------------------------------------------
# Diseases
# ---------------------------------------------------------------------------

@router.get("/diseases", tags=["diseases"])
def diseases(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    return [
        {"id": item.id, "name": item.name, "symptoms": item.symptoms, "is_demo": item.is_demo}
        for item in db.scalars(select(Disease).order_by(Disease.name))
    ]
