"""Seed script for Neo4j Graph Database projection.

Projection of students, locations, and contacts to Neo4j.
Handles Neo4j connection failure gracefully if Neo4j is offline in local dev.
"""
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from neo4j import GraphDatabase
except ImportError:
    print("neo4j driver not installed; run pip install neo4j")
    sys.exit(0)

from app.core.config import get_settings
from app.database.session import SessionLocal
from app.models.entities import Student, Location, ContactEvent, Case


def sync_to_neo4j():
    settings = get_settings()
    if not settings.neo4j_uri:
        print("NEO4J_URI not configured. Skipping Neo4j graph synchronization.")
        return False

    uri = settings.neo4j_uri
    user = settings.neo4j_username or "neo4j"
    pwd = settings.neo4j_password or "change-me-local-only"

    print(f"Connecting to Neo4j at {uri} as {user}...")
    try:
        driver = GraphDatabase.driver(uri, auth=(user, pwd))
        with driver.session() as session:
            # Check connectivity
            session.run("RETURN 1 AS connected")
            print("Connected to Neo4j successfully.")

            # Apply constraints
            constraints = [
                "CREATE CONSTRAINT student_id_unique IF NOT EXISTS FOR (s:Student) REQUIRE s.student_id IS UNIQUE",
                "CREATE CONSTRAINT location_id_unique IF NOT EXISTS FOR (l:Location) REQUIRE l.location_id IS UNIQUE",
            ]
            for c in constraints:
                session.run(c)

            # Sync entities from PostgreSQL / SQLite
            with SessionLocal() as db:
                students = db.query(Student).all()
                for s in students:
                    session.run(
                        """
                        MERGE (n:Student {student_id: $id})
                        SET n.student_code = $code, n.course = $course
                        """,
                        id=s.id, code=s.student_code, course=s.course,
                    )
                print(f"Synchronized {len(students)} Student nodes.")

                locations = db.query(Location).all()
                for loc in locations:
                    session.run(
                        """
                        MERGE (l:Location {location_id: $id})
                        SET l.name = $name, l.environment_type = $env, l.latitude = $lat, l.longitude = $lon
                        """,
                        id=loc.id, name=loc.name, env=loc.environment_type, lat=loc.latitude, lon=loc.longitude,
                    )
                print(f"Synchronized {len(locations)} Location nodes.")

                contacts = db.query(ContactEvent).all()
                for c in contacts:
                    session.run(
                        """
                        MATCH (a:Student {student_id: $a_id}), (b:Student {student_id: $b_id})
                        MERGE (a)-[r:CONTACTED {event_id: $event_id}]-(b)
                        SET r.duration_seconds = $duration_seconds,
                            r.estimated_distance = $distance,
                            r.encounter_count = $encounters,
                            r.indoor = $indoor,
                            r.timestamp = $ts
                        """,
                        a_id=c.student_a_id,
                        b_id=c.student_b_id,
                        event_id=c.id,
                        duration_seconds=c.duration_minutes * 60.0,
                        distance=c.estimated_distance_meters,
                        encounters=c.encounter_count,
                        indoor=c.indoor,
                        ts=c.occurred_at.isoformat() if c.occurred_at else None,
                    )
                print(f"Synchronized {len(contacts)} Contact relationships.")
        driver.close()
        return True
    except Exception as exc:
        print(f"Could not connect to or sync Neo4j: {exc}")
        return False


if __name__ == "__main__":
    sync_to_neo4j()
