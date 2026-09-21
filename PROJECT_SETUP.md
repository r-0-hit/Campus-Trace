# Project setup and environment audit

## Audit recorded 2026-09-20

| Item | Result |
| --- | --- |
| Operating shell | PowerShell 7.6.5 on Windows |
| Node.js | v22.19.0 |
| npm | 10.9.3 |
| Python | Not found on `PATH` |
| Docker / Docker Compose | Not found on `PATH` |
| Git repository | Not initialized in this workspace |
| Existing application | Empty workspace at audit time |
| Existing environment file | No `.env` detected |
| Connected Figma design | None available in the current tool context |

## Required local environment

- Node.js 22+ and npm 10+
- Python 3.12+
- Docker Desktop with Docker Compose v2
- Git (recommended)

Install Python and Docker Desktop, ensure both commands are on `PATH`, then restart the shell before running the full stack.

## First-time setup

```powershell
Copy-Item .env.example .env
docker compose up --build
```

The client will be at `http://localhost:5173`, the API and OpenAPI docs at `http://localhost:8000/docs`, and Neo4j Browser at `http://localhost:7474`.

## Development commands

```powershell
docker compose up --build
docker compose down
docker compose logs -f backend
docker compose down -v # resets local database volumes

Set-Location frontend; npm install; npm run dev
Set-Location backend; python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt; uvicorn app.main:app --reload
```

## Testing commands

```powershell
Set-Location frontend; npm test
Set-Location backend; pytest
npx playwright test
```

Playwright and its browser installation will be added with the end-to-end test milestone. The current frontend production build is verified with `npm run build`.

## Database commands

```powershell
docker compose exec postgres psql -U campus_trace -d campus_trace
docker compose exec neo4j cypher-shell -u neo4j -p $env:NEO4J_PASSWORD
```

Alembic migrations, graph schema setup, seed data, and retention jobs are introduced in the persistence and simulation phases.

## Architecture and phases

See [architecture](docs/ARCHITECTURE.md). The implementation proceeds through: foundation; containerized persistence; authentication/RBAC; domain APIs; synthetic data; graph; exposure risk and ML; investigations/notifications; dashboards; visualization; test automation; and privacy/security hardening.
