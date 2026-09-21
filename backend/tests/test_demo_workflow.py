from fastapi.testclient import TestClient

from app.main import app


def test_admin_can_generate_and_read_a_synthetic_investigation() -> None:
    with TestClient(app) as client:
        login = client.post("/api/auth/login", json={"username": "admin.demo", "password": "AdminDemo123!"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        generated = client.post("/api/simulation/generate", headers=headers)
        assert generated.status_code == 200, generated.text
        payload = generated.json()
        assert payload["students"] == 100
        assert payload["locations"] == 10
        assert payload["contact_events"] == 1800
        assert payload["contacts_identified"] > 0

        investigation = client.get(f"/api/investigations/{payload['investigation_id']}", headers=headers)
        assert investigation.status_code == 200
        assert len(investigation.json()["nodes"]) > 1


def test_student_is_not_allowed_to_run_simulation() -> None:
    with TestClient(app) as client:
        login = client.post("/api/auth/login", json={"username": "student.demo", "password": "StudentDemo123!"})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        assert client.post("/api/simulation/generate", headers=headers).status_code == 403
