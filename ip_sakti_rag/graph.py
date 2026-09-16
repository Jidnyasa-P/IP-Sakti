"""
Knowledge-graph enrichment via Neo4j Aura.

Used to pull in statutorily *related* sections that hybrid search might
miss — e.g. a query about Section 3(p) should also surface Section 3(e)
(mere admixture) and the linked Concept "Traditional Knowledge", even if
those chunks don't score highly on BM25/vector similarity alone.

Schema (see scripts/neo4j_schema.cypher for constraints + seed data):
  (:Statute)<-[:PART_OF]-(:Section)-[:GOVERNED_BY]->(:Authority)
  (:Section)-[:APPLIES_TO]->(:ProductCategory)
  (:Section)-[:REFERENCES]->(:Section)
  (:Section)-[:DEFINES]->(:Concept)
  (:Concept)-[:BARS]->(:ProductCategory)
  (:ProductCategory)-[:REQUIRES]->(:Form)
"""
import os

from neo4j import GraphDatabase

_driver = GraphDatabase.driver(
    os.environ["NEO4J_URI"],
    auth=(os.environ["NEO4J_USER"], os.environ["NEO4J_PASSWORD"]),
)


def close() -> None:
    _driver.close()


def related_sections(section_id: str, hops: int = 2, limit: int = 20) -> list[dict]:
    query = """
    MATCH (s:Section {id: $id})-[:REFERENCES|DEFINES|APPLIES_TO*1..%d]-(related)
    RETURN DISTINCT labels(related) AS labels, related AS node
    LIMIT $limit
    """ % hops
    with _driver.session() as session:
        result = session.run(query, id=section_id, limit=limit)
        return [{"labels": r["labels"], **dict(r["node"])} for r in result]


def barred_categories(section_id: str) -> list[str]:
    """e.g. which ProductCategory nodes a Section's linked Concepts BAR."""
    query = """
    MATCH (:Section {id: $id})-[:DEFINES]->(:Concept)-[:BARS]->(p:ProductCategory)
    RETURN DISTINCT p.name AS name
    """
    with _driver.session() as session:
        return [r["name"] for r in session.run(query, id=section_id)]
