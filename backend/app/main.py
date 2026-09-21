"""Campus Trace API entry point.

The first implementation milestone intentionally exposes only an operational
health endpoint. Domain routers are introduced as their services are built.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings
from app.database import Base, SessionLocal, engine
from app.services.demo import seed_demo_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Temporary development bootstrap. Alembic migrations replace create_all in Phase 2.
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    yield

app = FastAPI(
    title="Campus Trace API",
    version="0.1.0",
    description=(
        "Prototype decision-support API. Exposure-risk estimates are not "
        "medical diagnoses or confirmed infection probabilities."
    ),
    lifespan=lifespan,
)
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Return dependency-aware process and subsystem health."""
    # Check DB
    db_status = "healthy"
    try:
        from sqlalchemy import text
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"

    # Check ML model
    from pathlib import Path
    import os
    model_path = Path(__file__).resolve().parent.parent.parent / "ml" / "models" / "demo-risk-model.joblib"
    ml_status = "ready (random_forest_v1)" if os.path.exists(model_path) else "ready (rule_based_fallback)"

    # Check Neo4j
    from app.services.graph import GraphService
    neo4j_service = GraphService()
    neo4j_status = "healthy" if neo4j_service.is_available() else "offline (using relational graph fallback)"
    neo4j_service.close()

    return {
        "backend": "healthy",
        "database": db_status,
        "neo4j": neo4j_status,
        "ml": ml_status,
    }
