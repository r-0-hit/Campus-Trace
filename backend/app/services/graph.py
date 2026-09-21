"""GraphService for Neo4j Contact Network Projection and Traversal.

Handles connections to Neo4j when available, with clean fallback when offline.
Keeps graph logic isolated from API routes.
"""
from typing import Any, Dict, List, Optional
from app.core.config import get_settings


class GraphService:
    """Encapsulates Neo4j interaction and queries with offline safety."""

    def __init__(self):
        self.settings = get_settings()
        self.driver = None
        self._init_driver()

    def _init_driver(self):
        if not self.settings.neo4j_uri:
            return
        try:
            from neo4j import GraphDatabase
            user = self.settings.neo4j_username or "neo4j"
            pwd = self.settings.neo4j_password or "change-me-local-only"
            self.driver = GraphDatabase.driver(self.settings.neo4j_uri, auth=(user, pwd))
        except Exception:
            self.driver = None

    def is_available(self) -> bool:
        if self.driver is None:
            return False
        try:
            with self.driver.session() as session:
                result = session.run("RETURN 1 AS ok")
                return result.single()["ok"] == 1
        except Exception:
            return False

    def get_direct_contacts(self, student_id: int) -> List[Dict[str, Any]]:
        if not self.is_available():
            return []
        query = """
        MATCH (a:Student {student_id: $id})-[r:CONTACTED]-(b:Student)
        RETURN b.student_id AS student_id,
               b.student_code AS student_code,
               1 AS graph_distance,
               r.duration_seconds AS duration_seconds,
               r.estimated_distance AS estimated_distance
        """
        try:
            with self.driver.session() as session:
                result = session.run(query, id=student_id)
                return [dict(record) for record in result]
        except Exception:
            return []

    def get_k_hop_contacts(self, student_id: int, max_depth: int = 2) -> List[Dict[str, Any]]:
        if not self.is_available():
            return []
        query = f"""
        MATCH path = (a:Student {{student_id: $id}})-[:CONTACTED*1..{max_depth}]-(b:Student)
        WHERE b <> a
        WITH b, min(length(path)) AS shortest_dist
        RETURN b.student_id AS student_id,
               b.student_code AS student_code,
               shortest_dist AS graph_distance
        ORDER BY shortest_dist
        """
        try:
            with self.driver.session() as session:
                result = session.run(query, id=student_id)
                return [dict(record) for record in result]
        except Exception:
            return []

    def close(self):
        if self.driver:
            self.driver.close()
