"""
Neo4j / GraphRAG knowledge-graph context — products, classifications,
regulations, authorities, ingredients, TK and ABS as a connected graph.

Off unless NEO4J_ENABLED=true AND all of NEO4J_URI/NEO4J_USERNAME/
NEO4J_PASSWORD are set. The rest of the pipeline (hybrid RAG, generation,
safety) works fully without it — this class only ever *adds* graph-derived
context on top, and fails open (falls back to "no graph context") on any
connection problem, so a paused/misconfigured Aura instance never breaks
answering.

`app/pipeline.py` currently only constructs `KnowledgeGraphContext()` at
startup (`self.graph = KnowledgeGraphContext()`); wiring `get_context()`
into `IPSaktiRAG.answer_query()` to enrich retrieval is the natural next
step once you've loaded actual nodes/relationships into Aura — the method
is ready to call, it just isn't invoked yet.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.config import settings


@dataclass
class GraphContextResult:
    related_regulations: list[str] = field(default_factory=list)
    related_authorities: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


class KnowledgeGraphContext:
    def __init__(self):
        self.enabled = bool(
            settings.neo4j_enabled and settings.neo4j_uri and settings.neo4j_username and settings.neo4j_password
        )
        self._driver = None
        if self.enabled:
            self._connect()

    def _connect(self) -> None:
        try:
            from neo4j import GraphDatabase

            self._driver = GraphDatabase.driver(
                settings.neo4j_uri, auth=(settings.neo4j_username, settings.neo4j_password)
            )
            self._driver.verify_connectivity()
        except Exception:
            # Aura free tier auto-pauses after ~72h idle; the first connection
            # after a pause can time out while it wakes back up. Fail open.
            self._driver = None
            self.enabled = False

    def get_context(self, entity_names: list[str]) -> GraphContextResult:
        """Look up regulations/authorities connected to the given entity
        names (e.g. an ingredient or product name) within 2 hops."""
        if not self.enabled or not self._driver or not entity_names:
            return GraphContextResult()

        cypher = """
        UNWIND $names AS name
        MATCH (n {name: name})-[:GOVERNED_BY|REQUIRES_APPROVAL_FROM|CLASSIFIED_UNDER*1..2]-(m)
        RETURN DISTINCT labels(m) AS labels, m.name AS name
        LIMIT 20
        """
        try:
            with self._driver.session() as session:
                records = session.run(cypher, names=entity_names).data()
        except Exception:
            return GraphContextResult(notes=["Graph lookup failed — continuing without graph context."])

        regulations, authorities = [], []
        for r in records:
            name = r.get("name")
            if not name:
                continue
            if "Authority" in (r.get("labels") or []):
                authorities.append(name)
            else:
                regulations.append(name)
        return GraphContextResult(related_regulations=regulations, related_authorities=authorities)

    def close(self) -> None:
        if self._driver:
            self._driver.close()
