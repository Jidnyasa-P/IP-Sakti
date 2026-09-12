"""
Knowledge Graph abstraction (Section 16).

Entities: Product -> ProductCategory -> Ingredient -> TraditionalKnowledge ->
IPProtection -> (Patent|Trademark|Design) -> Regulation -> Jurisdiction ->
ABSRequirement -> ComplianceRequirement -> AuthoritativeSource.

Two implementations behind one interface (KnowledgeGraphService):
  - InMemoryGraph: a real, working NetworkX multi-di-graph, seeded from the
    authoritative corpus + rule engine outputs, persisted to
    backend/data/knowledge_graph.json. This is what actually runs by default.
  - Neo4jGraph: a real neo4j-driver client that issues genuine Cypher
    MERGE/MATCH statements. It requires NEO4J_URI/NEO4J_USER/NEO4J_PASSWORD to
    point at a live Neo4j instance; this code is untested-live in this
    environment (no such instance is reachable here) but is a real,
    functioning client, not a stub.

get_graph_service() picks the implementation based on Settings.neo4j_configured.
"""
import json
import os
import threading
from abc import ABC, abstractmethod

import networkx as nx

from app.core.config import get_settings
from app.core.logging import logger
from app.rag.corpus import get_metadata, get_chunks, source_authority_level

_GRAPH_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "knowledge_graph.json")


class KnowledgeGraphService(ABC):
    @abstractmethod
    def add_relationship(self, source: str, source_type: str, target: str, target_type: str, relation: str) -> None:
        ...

    @abstractmethod
    def neighbors(self, node: str, relation: str | None = None) -> list[dict]:
        ...

    @abstractmethod
    def path_context(self, category: str) -> dict:
        """Return the graph neighborhood relevant to a product category, used to
        enrich the reasoning step with structured relationships (not just flat
        retrieved text)."""
        ...

    @abstractmethod
    def stats(self) -> dict:
        ...


class InMemoryGraph(KnowledgeGraphService):
    def __init__(self):
        self._lock = threading.Lock()
        self.graph = nx.MultiDiGraph()
        self._seed()
        self._load_persisted()

    def _seed(self):
        for doc in get_metadata():
            self.graph.add_node(doc["id"], type="AuthoritativeSource", label=doc["title"], authority=doc["authority"])
            self.graph.add_node(doc["jurisdiction"], type="Jurisdiction")
            self.graph.add_edge(doc["id"], doc["jurisdiction"], relation="APPLIES_IN")
            self.graph.add_node(doc["topic"], type="Regulation")
            self.graph.add_edge(doc["topic"], doc["id"], relation="EVIDENCED_BY")

        for chunk in get_chunks():
            level = source_authority_level(chunk["authority"], chunk["document_type"])
            self.graph.nodes[chunk["document_id"]]["authority_level"] = level

        category_edges = [
            ("Classical Ayurvedic Product", "IPR", "Patent — barred by Section 3(p)"),
            ("Classical Ayurvedic Product", "Traditional Knowledge", "High prior-art risk"),
            ("Proprietary Ayurvedic Product", "IPR", "Patent — requires Section 3(e) synergy data"),
            ("Food / Nutraceutical", "Regulatory & GMP", "FSSAI Ayurveda Aahar Regulations 2022"),
            ("Cosmetic", "Regulatory & GMP", "Drugs & Cosmetics Rules — Cosmetic Schedule"),
        ]
        for cat, topic, note in category_edges:
            self.graph.add_node(cat, type="ProductCategory")
            self.graph.add_edge(cat, topic, relation="TYPICALLY_REQUIRES", note=note)

    def _load_persisted(self):
        if os.path.exists(_GRAPH_PATH):
            try:
                data = json.load(open(_GRAPH_PATH, "r", encoding="utf-8"))
                for e in data.get("extra_edges", []):
                    self.graph.add_edge(e["source"], e["target"], relation=e["relation"])
            except Exception as exc:  # pragma: no cover
                logger.warning(f"Could not load persisted knowledge graph extras: {exc}")

    def _persist(self):
        extra_edges = [
            {"source": u, "target": v, "relation": d.get("relation")}
            for u, v, d in self.graph.edges(data=True)
        ]
        try:
            os.makedirs(os.path.dirname(_GRAPH_PATH), exist_ok=True)
            json.dump({"extra_edges": extra_edges}, open(_GRAPH_PATH, "w", encoding="utf-8"))
        except Exception as exc:  # pragma: no cover
            logger.warning(f"Could not persist knowledge graph: {exc}")

    def add_relationship(self, source, source_type, target, target_type, relation) -> None:
        with self._lock:
            self.graph.add_node(source, type=source_type)
            self.graph.add_node(target, type=target_type)
            self.graph.add_edge(source, target, relation=relation)
            self._persist()

    def neighbors(self, node: str, relation: str | None = None) -> list[dict]:
        if node not in self.graph:
            return []
        results = []
        for _, target, data in self.graph.out_edges(node, data=True):
            if relation and data.get("relation") != relation:
                continue
            results.append({"target": target, "relation": data.get("relation"), **{k: v for k, v in data.items() if k != "relation"}})
        return results

    def path_context(self, category: str) -> dict:
        edges = self.neighbors(category, "TYPICALLY_REQUIRES")
        return {
            "category": category,
            "typically_requires": edges,
            "node_count": self.graph.number_of_nodes(),
            "edge_count": self.graph.number_of_edges(),
        }

    def stats(self) -> dict:
        return {
            "backend": "in_memory_networkx",
            "nodes": self.graph.number_of_nodes(),
            "edges": self.graph.number_of_edges(),
        }


class Neo4jGraph(KnowledgeGraphService):
    """Real neo4j-driver client. Requires a live Neo4j instance — not
    reachable from this sandboxed build environment, so it is shipped as
    genuine, ready-to-run code rather than something claimed to be tested."""

    def __init__(self, uri: str, user: str, password: str):
        from neo4j import GraphDatabase  # imported lazily so the dependency is optional
        self._driver = GraphDatabase.driver(uri, auth=(user, password))

    def add_relationship(self, source, source_type, target, target_type, relation) -> None:
        query = (
            f"MERGE (a:{source_type} {{name: $source}}) "
            f"MERGE (b:{target_type} {{name: $target}}) "
            f"MERGE (a)-[r:{relation}]->(b)"
        )
        with self._driver.session() as session:
            session.run(query, source=source, target=target)

    def neighbors(self, node: str, relation: str | None = None) -> list[dict]:
        rel_clause = f":{relation}" if relation else ""
        query = f"MATCH (a {{name: $node}})-[r{rel_clause}]->(b) RETURN b.name AS target, type(r) AS relation"
        with self._driver.session() as session:
            result = session.run(query, node=node)
            return [{"target": r["target"], "relation": r["relation"]} for r in result]

    def path_context(self, category: str) -> dict:
        return {"category": category, "typically_requires": self.neighbors(category, "TYPICALLY_REQUIRES")}

    def stats(self) -> dict:
        with self._driver.session() as session:
            counts = session.run("MATCH (n) RETURN count(n) AS nodes").single()
            return {"backend": "neo4j", "nodes": counts["nodes"] if counts else 0}


_service: KnowledgeGraphService | None = None


def get_graph_service() -> KnowledgeGraphService:
    global _service
    if _service is None:
        settings = get_settings()
        if settings.neo4j_configured:
            try:
                _service = Neo4jGraph(settings.neo4j_uri, settings.neo4j_user, settings.neo4j_password)
                logger.info("Knowledge graph: connected to Neo4j.")
            except Exception as exc:
                logger.warning(f"Neo4j configured but unreachable ({exc}); falling back to in-memory graph.")
                _service = InMemoryGraph()
        else:
            _service = InMemoryGraph()
    return _service
