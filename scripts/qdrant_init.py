"""
Run ONCE against your Qdrant Cloud cluster to create the collection.
Usage:
    QDRANT_URL=https://...aws.cloud.qdrant.io QDRANT_API_KEY= python scripts/qdrant_init.py
"""
import os

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

COLLECTION = os.environ.get("QDRANT_COLLECTION", "legal_corpus_chunks")
EMBED_DIM = 768  # text-embedding-004 output size

client = QdrantClient(
    url=os.environ["QDRANT_URL"], api_key=os.environ.get("QDRANT_API_KEY")
)

client.recreate_collection(
    collection_name=COLLECTION,
    vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
)

print(f"Created Qdrant collection '{COLLECTION}' ({EMBED_DIM}-dim, cosine).")
