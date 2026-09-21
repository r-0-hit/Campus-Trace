# Campus Trace – College Infectious Disease Contact Tracing & Early-Warning Platform

Campus Trace is a complete, functional, demo-ready web application for infectious-disease contact tracing and early outbreak detection within a college campus.

All demonstration data is **100% synthetic**. The platform supports the general aims of **UN Sustainable Development Goal 3: Good Health and Well-Being** (independent initiative; not certified or endorsed by the United Nations).

> **Important Medical Disclaimer:** This platform is a prototype decision-support and exposure-monitoring system. Computational risk scores are not medical diagnoses or confirmed infection probabilities. Real-world deployment requires validation by qualified public-health professionals, institutional review, privacy and security auditing, and compliance with applicable laws and regulations.

---

## Key Features

### 1. Multi-Role Web Application
- **Student Portal**:
  - Private exposure status overview & risk scores
  - Interactive notification feed with symptom follow-up workflow (YES / NO / NOT SURE)
  - Confidential case self-reporting (disease, onset date, symptoms, notes)
  - Zero leakage of other students' health or proximity records
- **Teacher Portal**:
  - Anonymized aggregate class exposure monitoring
  - Recommended actions and hygiene guidance
  - Absolute privacy preservation (no individual student names or diagnostic details)
- **Administrator Situation Room**:
  - Live campus metrics: Active cases, students under monitoring, high-risk contacts, potential clusters
  - One-click synthetic simulation generation (100 students, 10 locations, 1,800 contacts, index case)
  - Interactive **Contact Graph Visualization** (powered by React Flow) with zoom, pan, node inspection, and risk color-coding
  - Interactive **Campus Map** (powered by Leaflet) showing location-based contact densities and hotspots
  - **Analytics Dashboard** (powered by Recharts): risk distribution pie charts, case timeline, top location contact density, and graph-depth risk breakdown
  - Student roster with monitoring status and highest computed exposure risk
  - System-wide **Audit Trail** logging case creations, investigations, and notification events

### 2. Computational Exposure Risk Engine & ML Pipeline
- **scikit-learn Random Forest Model** trained on synthetic contact feature vectors (`ml/models/demo-risk-model.joblib`)
- Transparent, explainable risk decomposition:
  - Duration of contact
  - Proximity / estimated distance
  - Frequency / encounter count
  - Temporal recency decay
  - Indoor vs. outdoor environment
  - Graph topological distance
- Normalized 0–100 risk score with confidence and categories (`LOW`, `MODERATE`, `ELEVATED`, `HIGH`)
- Graceful heuristic fallback if model artifact is absent

### 3. Contact Network Graph & Traversal
- Bounded breadth-first search (BFS) graph traversal engine (depth 1, 2, 3)
- First and second-order contact identification
- Neo4j schema constraints, Cypher queries, and graph synchronization seed script (`neo4j/`)
- Offline resilience: works on relational database when Neo4j is offline in local dev

### 4. Robust Security & Privacy Architecture
- JWT-based authentication with Argon2 password hashing
- Strict server-side Role-Based Access Control (RBAC) enforced on all API endpoints
- Dependency-aware health checks (`GET /health`) monitoring Backend, Database, Neo4j, and ML services

---

## Local Demo Accounts

The following demo accounts are seeded automatically for local evaluation:

| Role | Username | Password | Access / Views |
| :--- | :--- | :--- | :--- |
| **Student** | `student.demo` | `StudentDemo123!` | Private dashboard, case report, notifications |
| **Teacher** | `teacher.demo` | `TeacherDemo123!` | Anonymized class alerts, aggregate advice |
| **Admin** | `admin.demo` | `AdminDemo123!` | Full situation room, simulation, graph, map, analytics |

*Note: Demo buttons on the login screen pre-fill these credentials with a single click.*

---

## Running the Application

### Option A: Local Development (Fastest, zero-Docker fallback)

#### 1. Backend
```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API Documentation (Swagger UI): `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

#### 2. Frontend
```powershell
cd frontend
npm install
npm run dev
```
- Web Application: `http://localhost:5173`

---

### Option B: Docker Compose (Full infrastructure stack)

Runs frontend, backend, PostgreSQL 16, and Neo4j 5 in Docker containers:

```powershell
# Copy environment file
cp .env.example .env

# Build and start all services
docker compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000/docs`
- Neo4j Browser: `http://localhost:7474` (neo4j / change-me-local-only)

---

## Automated Testing

### Backend Unit & Integration Tests
```powershell
cd backend
python -m pytest -v
```
Verifies authentication, role permissions, case reporting, notifications, ML inference, and all admin endpoints.

### Frontend Typecheck & Production Build
```powershell
cd frontend
npm run build
```
Typechecks and compiles TypeScript with Vite into an optimized production bundle in `dist/`.

### End-to-End Tests (Playwright)
```powershell
npx playwright test
```
Tests the complete end-to-end critical journey from case reporting to graph traversal, notification generation, and dashboard update.

---

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, React Router 7, @xyflow/react (React Flow), Recharts, Leaflet, Lucide Icons
- **Backend**: Python 3.12, FastAPI, Pydantic, SQLAlchemy 2.0, PyJWT, pwdlib (Argon2), SQLite / PostgreSQL
- **Graph & ML**: Neo4j Community 5, scikit-learn Random Forest Regressor, joblib
- **Testing & DevOps**: Pytest, Playwright, Docker, Docker Compose
