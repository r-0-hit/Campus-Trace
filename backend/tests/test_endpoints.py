from fastapi.testclient import TestClient
from app.main import app


def test_health_endpoint():
    with TestClient(app) as client:
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["backend"] == "healthy"
        assert data["database"] == "healthy"
        assert "ready" in data["ml"]


def test_auth_roles_and_permissions():
    with TestClient(app) as client:
        # Invalid login
        res = client.post("/api/auth/login", json={"username": "wrong", "password": "wrongpassword"})
        assert res.status_code == 401

        # Student login
        res = client.post("/api/auth/login", json={"username": "student.demo", "password": "StudentDemo123!"})
        assert res.status_code == 200
        student_token = res.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # Student can get their profile
        me = client.get("/api/students/me", headers=student_headers)
        assert me.status_code == 200
        assert me.json()["role"] == "STUDENT"

        # Student cannot access admin endpoints
        assert client.get("/api/admin/dashboard", headers=student_headers).status_code == 403
        assert client.get("/api/cases", headers=student_headers).status_code == 403
        assert client.get("/api/investigations", headers=student_headers).status_code == 403

        # Teacher login
        res = client.post("/api/auth/login", json={"username": "teacher.demo", "password": "TeacherDemo123!"})
        assert res.status_code == 200
        teacher_token = res.json()["access_token"]
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

        # Teacher can access teacher dashboard
        t_dash = client.get("/api/teacher/dashboard", headers=teacher_headers)
        assert t_dash.status_code == 200
        assert "assigned_classes" in t_dash.json()

        # Teacher cannot access admin endpoints
        assert client.get("/api/admin/dashboard", headers=teacher_headers).status_code == 403


def test_student_workflow_case_report_and_notification():
    with TestClient(app) as client:
        # Student login
        res = client.post("/api/auth/login", json={"username": "student.demo", "password": "StudentDemo123!"})
        headers = {"Authorization": f"Bearer {res.json()['access_token']}"}

        # Get diseases
        diseases = client.get("/api/diseases", headers=headers)
        assert diseases.status_code == 200
        assert len(diseases.json()) > 0
        disease_id = diseases.json()[0]["id"]

        # Report case
        report = client.post(
            "/api/cases/report",
            headers=headers,
            json={
                "disease_id": disease_id,
                "date_reported": "2026-09-20",
                "symptoms": ["Fever", "Cough"],
                "notes": "Feeling unwell",
            },
        )
        assert report.status_code == 201
        case_data = report.json()
        assert case_data["status"] == "OPEN"

        # Check exposure notifications
        notifs = client.get("/api/students/me/exposure", headers=headers)
        assert notifs.status_code == 200
        notifs_list = notifs.json()
        if notifs_list:
            notif_id = notifs_list[0]["id"]
            # Acknowledge
            ack = client.post(f"/api/notifications/{notif_id}/acknowledge", headers=headers)
            assert ack.status_code == 200

            # Respond to symptoms
            resp = client.post(
                f"/api/notifications/{notif_id}/symptom-response",
                headers=headers,
                json={"response": "YES"},
            )
            assert resp.status_code in [200, 409]


def test_admin_analytics_and_audit():
    with TestClient(app) as client:
        res = client.post("/api/auth/login", json={"username": "admin.demo", "password": "AdminDemo123!"})
        headers = {"Authorization": f"Bearer {res.json()['access_token']}"}

        # Dashboard
        dash = client.get("/api/admin/dashboard", headers=headers)
        assert dash.status_code == 200
        assert "students" in dash.json()

        # Analytics
        analytics = client.get("/api/admin/analytics", headers=headers)
        assert analytics.status_code == 200
        assert "risk_distribution" in analytics.json()
        assert "location_density" in analytics.json()

        # Students
        students = client.get("/api/admin/students", headers=headers)
        assert students.status_code == 200

        # Audit
        audit = client.get("/api/admin/audit", headers=headers)
        assert audit.status_code == 200

        # Locations
        locs = client.get("/api/locations", headers=headers)
        assert locs.status_code == 200

        # Cases list
        cases = client.get("/api/cases", headers=headers)
        assert cases.status_code == 200
