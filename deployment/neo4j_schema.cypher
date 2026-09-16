// Run in Neo4j Aura's "Query" tab (or via cypher-shell / neo4j driver) ONCE.

// --- Constraints (also creates supporting indexes automatically) ---
CREATE CONSTRAINT statute_name IF NOT EXISTS FOR (s:Statute) REQUIRE s.short_name IS UNIQUE;
CREATE CONSTRAINT section_id IF NOT EXISTS FOR (s:Section) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT concept_name IF NOT EXISTS FOR (c:Concept) REQUIRE c.name IS UNIQUE;
CREATE CONSTRAINT authority_name IF NOT EXISTS FOR (a:Authority) REQUIRE a.name IS UNIQUE;
CREATE CONSTRAINT productcat_name IF NOT EXISTS FOR (p:ProductCategory) REQUIRE p.name IS UNIQUE;
CREATE CONSTRAINT form_name IF NOT EXISTS FOR (f:Form) REQUIRE f.name IS UNIQUE;

// --- Seed data, derived from the sample audit_logs / product_analyses you shared ---

MERGE (patentsAct:Statute {short_name: "Patents Act 1970"})
MERGE (bioDivAct:Statute {short_name: "Biological Diversity Act 2002"})
MERGE (dcAct:Statute {short_name: "Drugs and Cosmetics Act 1940"})
MERGE (tmAct:Statute {short_name: "Trade Marks Act 1999"})

MERGE (cgpdtm:Authority {name: "CGPDTM"})
MERGE (nba:Authority {name: "National Biodiversity Authority"})
MERGE (ayush:Authority {name: "Ministry of AYUSH"})

MERGE (sec3p:Section {id: "PatentsAct-3p"})
  SET sec3p.number = "3(p)", sec3p.title = "Traditional knowledge non-patentability"
MERGE (sec3e:Section {id: "PatentsAct-3e"})
  SET sec3e.number = "3(e)", sec3e.title = "Mere admixture of known substances"
MERGE (sec6:Section {id: "BioDivAct-6"})
  SET sec6.number = "6", sec6.title = "Prior NBA approval before IPR filing"

MERGE (tk:Concept {name: "Traditional Knowledge"})
MERGE (synergy:Concept {name: "Unexpected Synergistic Efficacy"})

MERGE (classicalFormulation:ProductCategory {name: "Classical Ayurvedic Formulation"})
MERGE (proprietaryFormulation:ProductCategory {name: "Proprietary Ayurvedic Medicine"})

MERGE (formIII:Form {name: "Form III"})

MERGE (sec3p)-[:PART_OF]->(patentsAct)
MERGE (sec3e)-[:PART_OF]->(patentsAct)
MERGE (sec6)-[:PART_OF]->(bioDivAct)

MERGE (sec3p)-[:GOVERNED_BY]->(cgpdtm)
MERGE (sec3e)-[:GOVERNED_BY]->(cgpdtm)
MERGE (sec6)-[:GOVERNED_BY]->(nba)

MERGE (sec3p)-[:DEFINES]->(tk)
MERGE (sec3e)-[:DEFINES]->(synergy)

MERGE (tk)-[:BARS]->(classicalFormulation)
MERGE (sec3e)-[:APPLIES_TO]->(proprietaryFormulation)
MERGE (sec3p)-[:REFERENCES]->(sec3e)

MERGE (proprietaryFormulation)-[:REQUIRES]->(formIII)

// Extend this with the rest of your 18+ indexed statutory provisions as you
// build out manifest.json — one Section node per citable provision, linked
// to the Statute/Authority/Concept/ProductCategory it touches.