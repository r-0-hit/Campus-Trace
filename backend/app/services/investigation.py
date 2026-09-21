from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (Case, ContactEvent, Investigation, InvestigationContact,
                                 Notification, RiskCategory, Student)
from app.services.risk import ExposureFeatures, ExposureRiskService


class InvestigationService:
    """Bounded BFS over contact events; a future adapter will query Neo4j instead."""

    def start(self, db: Session, case: Case, max_depth: int = 2) -> Investigation:
        if max_depth not in {1, 2, 3}:
            raise ValueError("max_depth must be between 1 and 3")
        investigation = Investigation(case_id=case.id, max_depth=max_depth, status="RUNNING")
        db.add(investigation)
        db.flush()
        exposure_start = datetime.combine(case.date_reported, datetime.min.time(), tzinfo=timezone.utc) - timedelta(hours=case.disease.exposure_window_hours)
        events = list(db.scalars(select(ContactEvent).where(ContactEvent.occurred_at >= exposure_start)))
        adjacency: dict[int, list[ContactEvent]] = defaultdict(list)
        for event in events:
            adjacency[event.student_a_id].append(event)
            adjacency[event.student_b_id].append(event)
        visited = {case.student_id}
        queue = deque([(case.student_id, 0)])
        results: list[InvestigationContact] = []
        now = datetime.now(timezone.utc)
        while queue:
            current_id, depth = queue.popleft()
            if depth >= max_depth:
                continue
            contacts: dict[int, list[ContactEvent]] = defaultdict(list)
            for event in adjacency[current_id]:
                other_id = event.student_b_id if event.student_a_id == current_id else event.student_a_id
                contacts[other_id].append(event)
            for other_id, related_events in contacts.items():
                if other_id in visited:
                    continue
                visited.add(other_id)
                next_depth = depth + 1
                queue.append((other_id, next_depth))
                duration = sum(event.duration_minutes for event in related_events)
                closest_distance = min(event.estimated_distance_meters for event in related_events)
                recent_event = max(event.occurred_at for event in related_events)
                if recent_event.tzinfo is None:
                    recent_event = recent_event.replace(tzinfo=timezone.utc)
                risk = ExposureRiskService().estimate(ExposureFeatures(duration, closest_distance, sum(event.encounter_count for event in related_events), max(0, (now - recent_event).total_seconds() / 3600), any(event.indoor for event in related_events), next_depth))
                results.append(InvestigationContact(investigation_id=investigation.id, student_id=other_id, graph_distance=next_depth, risk_score=risk["risk_score"], confidence=risk["confidence"], category=risk["category"], feature_contributions=risk["feature_contributions"]))
                if risk["category"] in {RiskCategory.ELEVATED, RiskCategory.HIGH}:
                    db.add(Notification(student_id=other_id, title="Potential exposure detected", message="You may have been exposed based on recent synthetic proximity events. Please review the symptom follow-up. This is not a diagnosis.", risk_score=risk["risk_score"], category=risk["category"]))
        db.add_all(results)
        investigation.status = "COMPLETED"
        db.commit()
        db.refresh(investigation)
        return investigation

    def graph(self, db: Session, investigation_id: int) -> dict:
        investigation = db.get(Investigation, investigation_id)
        if not investigation:
            raise LookupError("Investigation not found")
        contacts = list(db.scalars(select(InvestigationContact).where(InvestigationContact.investigation_id == investigation_id)))
        case = investigation.case
        index = db.get(Student, case.student_id)
        nodes = [{"id": str(index.id), "label": index.student_code, "role": "INDEX_CASE", "risk_score": None, "graph_distance": 0}]
        edges = []
        for contact in contacts:
            student = db.get(Student, contact.student_id)
            nodes.append({"id": str(student.id), "label": student.student_code, "role": "CONTACT", "risk_score": contact.risk_score, "category": contact.category.value, "confidence": contact.confidence, "graph_distance": contact.graph_distance})
            edges.append({"source": str(index.id), "target": str(student.id), "graph_distance": contact.graph_distance})
        return {"investigation_id": investigation.id, "status": investigation.status, "max_depth": investigation.max_depth, "nodes": nodes, "edges": edges, "disclaimer": "All graph records are synthetic demo data. Exposure estimates are not diagnoses."}
