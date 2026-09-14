"""
Optional Neo4j knowledge-graph context provider.

Fully optional and guarded — the entire pipeline runs correctly with
`NEO4J_ENABLED=false` (the default), which keeps free-deployment simple
(no extra service to provision). When enabled, this module can surface
related entities (e.g. "Section 3(p) --EXCLUDES--> Traditional Knowledge
inventions", "NBA --REQUIRES_APPROVAL_BEFORE--> IPR filing on biological
resource") to enrich the evidence context passed to the LLM.

This ships with a minimal schema/example query — populate the graph with your
own extraction pipeline from the same authoritative documents used for RAG.
"""
from __future__ import annotations

from app.config import settings


class KnowledgeGraphContext:
    def __init__(self):
        self.enabled = settings.neo4j_enabled
        self._driver = None
        if self.enabled:
            self._connect()

    def _connect(self) -> None:
        try:
            from neo4j import GraphDatabase

            self._driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_username, settings.neo4j_password),
            )
        except Exception as exc:  # pragma: no cover - optional dependency path
            print(f"[graph] Neo4j unavailable, continuing without knowledge graph context: {exc}")
            self.enabled = False
            self._driver = None

    def related_entities(self, entity_names: list[str], limit: int = 8) -> list[dict]:
        """
        Returns related-entity edges for the given entity names (e.g. section
        numbers, statute names, authorities) extracted from the top retrieved
        chunks. Returns [] if the graph is disabled/unavailable — callers must
        treat this as purely additive context, never a required dependency.
        """
        if not self.enabled or not self._driver or not entity_names:
            return []
        query = """
        MATCH (n)-[r]->(m)
        WHERE n.name IN $names
        RETURN n.name AS source, type(r) AS relation, m.name AS target
        LIMIT $limit
        """
        with self._driver.session() as session:
            result = session.run(query, names=entity_names, limit=limit)
            return [dict(record) for record in result]

    def close(self) -> None:
        if self._driver:
            self._driver.close()
