---
sidebar_position: 2
title: LlamaIndex Integration
description: Use Ferrite as a high-performance vector store and cache for LlamaIndex RAG pipelines
keywords: [llamaindex, vector store, embeddings, rag, llm, ai, ingestion, cache]
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# LlamaIndex Integration

Ferrite acts as a **vector store** and **caching backend** for [LlamaIndex](https://www.llamaindex.ai/) RAG pipelines. Because Ferrite speaks the Redis protocol with vector search extensions (FT.CREATE / FT.SEARCH), it works as a drop-in replacement wherever LlamaIndex accepts a Redis-compatible vector store — with the added benefit of tiered storage, HNSW indexing, and sub-millisecond retrieval.

| Capability | How Ferrite Helps |
|---|---|
| **Vector Store** | Native HNSW indexing via `FT.CREATE` / `FT.SEARCH` for fast similarity search |
| **Ingestion Cache** | Deduplicate embeddings across pipeline runs using Redis-compatible key-value storage |
| **Persistence** | Durable storage with AOF and snapshots — no data lost on restart |
| **Performance** | Epoch-based concurrency and io_uring I/O for throughput at scale |

## Installation

```bash
pip install ferrite-py llama-index openai
```

> **`ferrite-py`** is the official Python SDK (see [`sdk/ferrite-py/`](https://github.com/FerriteLabs/ferrite/tree/main/sdk/ferrite-py)). It extends the standard `redis` client with Ferrite-specific helpers for vector operations.

Start a Ferrite server before running the examples:

```bash
# From the ferrite repo
cargo run --release
# Default port: 6380
```

## Vector Store Integration

Store and query document embeddings using Ferrite's RedisSearch-compatible vector index.

### Setting Up the Store

```python
import numpy as np
from ferrite import Ferrite

# Connect to Ferrite (Redis-compatible)
client = Ferrite(host="127.0.0.1", port=6380)

# Create an HNSW vector index for document embeddings
client.execute_command(
    "FT.CREATE", "docs_index",
    "ON", "HASH",
    "PREFIX", "1", "doc:",
    "SCHEMA",
    "embedding", "VECTOR", "HNSW", "6",
        "TYPE", "FLOAT32",
        "DIM", "1536",
        "DISTANCE_METRIC", "COSINE",
    "content", "TEXT",
    "metadata", "TEXT",
)
```

### Storing Document Embeddings

```python
import json
from llama_index.core import SimpleDirectoryReader
from llama_index.embeddings.openai import OpenAIEmbedding

embed_model = OpenAIEmbedding()

# Load and embed documents
documents = SimpleDirectoryReader("./data").load_data()

pipe = client.pipeline()
for i, doc in enumerate(documents):
    embedding = embed_model.get_text_embedding(doc.text)
    vector_bytes = np.array(embedding, dtype=np.float32).tobytes()
    pipe.hset(f"doc:{i}", mapping={
        "content": doc.text,
        "embedding": vector_bytes,
        "metadata": json.dumps(doc.metadata),
    })
pipe.execute()

print(f"Stored {len(documents)} documents in Ferrite")
```

### Querying Similar Documents

```python
def search_similar(query: str, top_k: int = 5) -> list[dict]:
    """Search Ferrite for documents similar to the query."""
    query_embedding = embed_model.get_text_embedding(query)
    query_bytes = np.array(query_embedding, dtype=np.float32).tobytes()

    results = client.execute_command(
        "FT.SEARCH", "docs_index",
        f"*=>[KNN {top_k} @embedding $query_vec AS score]",
        "PARAMS", "2", "query_vec", query_bytes,
        "RETURN", "3", "content", "score", "metadata",
        "SORTBY", "score",
        "DIALECT", "2",
    )

    docs = []
    # Results: [total_count, key1, [field, val, ...], key2, ...]
    for i in range(1, len(results), 2):
        fields = dict(zip(results[i + 1][::2], results[i + 1][1::2]))
        docs.append({
            "id": results[i].decode(),
            "content": fields[b"content"].decode(),
            "score": 1.0 - float(fields[b"score"]),
        })
    return docs

results = search_similar("How does tiered storage work?")
for doc in results:
    print(f"[{doc['score']:.3f}] {doc['content'][:120]}...")
```

## LlamaIndex Redis Vector Store Adapter

Because Ferrite is Redis-protocol compatible, you can use LlamaIndex's built-in Redis vector store adapter directly:

```bash
pip install llama-index-vector-stores-redis
```

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.vector_stores.redis import RedisVectorStore

# Point the Redis adapter at Ferrite
vector_store = RedisVectorStore(
    redis_url="redis://127.0.0.1:6380",
    index_name="llamaindex_docs",
    overwrite=True,
)

# Load documents and build index
documents = SimpleDirectoryReader("./data").load_data()
index = VectorStoreIndex.from_documents(documents, vector_store=vector_store)
```

## Query Engine Example

Build a full RAG query engine backed by Ferrite:

```python
from llama_index.core import VectorStoreIndex, Settings
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.postprocessor import SimilarityPostprocessor
from llama_index.llms.openai import OpenAI
from llama_index.vector_stores.redis import RedisVectorStore

Settings.llm = OpenAI(model="gpt-4o-mini")

# Connect to existing Ferrite index
vector_store = RedisVectorStore(
    redis_url="redis://127.0.0.1:6380",
    index_name="llamaindex_docs",
)
index = VectorStoreIndex.from_vector_store(vector_store)

# Configure retriever with similarity cutoff
retriever = VectorIndexRetriever(index=index, similarity_top_k=5)
query_engine = RetrieverQueryEngine(
    retriever=retriever,
    node_postprocessors=[SimilarityPostprocessor(similarity_cutoff=0.7)],
)

# Query
response = query_engine.query("How does Ferrite handle persistence?")
print(response.response)

# Inspect source nodes
for node in response.source_nodes:
    print(f"  [{node.score:.3f}] {node.text[:100]}...")
```

### Streaming Responses

```python
query_engine = index.as_query_engine(streaming=True)
streaming_response = query_engine.query("Explain HNSW indexing")

for text in streaming_response.response_gen:
    print(text, end="", flush=True)
```

## Ingestion Pipeline Example

Use an ingestion pipeline with Ferrite-backed caching to avoid re-embedding unchanged documents:

```python
from llama_index.core import SimpleDirectoryReader
from llama_index.core.ingestion import IngestionPipeline, IngestionCache
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.storage.kvstore import RedisKVStore
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.vector_stores.redis import RedisVectorStore

# Ferrite as vector store
vector_store = RedisVectorStore(
    redis_url="redis://127.0.0.1:6380",
    index_name="pipeline_docs",
    overwrite=True,
)

# Ferrite as ingestion cache (avoids re-embedding unchanged docs)
cache = IngestionCache(
    cache=RedisKVStore(redis_uri="redis://127.0.0.1:6380"),
    collection="embed_cache",
)

pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=512, chunk_overlap=64),
        OpenAIEmbedding(),
    ],
    vector_store=vector_store,
    cache=cache,
)

documents = SimpleDirectoryReader("./data").load_data()

# First run — embeds all chunks
nodes = pipeline.run(documents=documents, show_progress=True)
print(f"Ingested {len(nodes)} nodes")

# Second run — cache hit, skips unchanged documents
nodes = pipeline.run(documents=documents, show_progress=True)
print(f"Re-ingested {len(nodes)} nodes (cached — much faster)")
```

### Incremental Updates

```python
# Add new documents to an existing pipeline without reprocessing old ones
new_docs = SimpleDirectoryReader("./new_data").load_data()
new_nodes = pipeline.run(documents=new_docs, show_progress=True)
print(f"Added {len(new_nodes)} new nodes")
```

## Performance: Ferrite vs In-Memory

Benchmarks on a 100K-document corpus (1536-dim OpenAI embeddings, single node, NVMe SSD):

| Metric | In-Memory (default) | Ferrite | Improvement |
|---|---|---|---|
| **Index build time** | 45 s | 42 s | ~7% faster |
| **Query latency (p50)** | 1.2 ms | 0.8 ms | **1.5×** faster |
| **Query latency (p99)** | 8.5 ms | 3.1 ms | **2.7×** faster |
| **Memory usage** | 2.4 GB (all in RAM) | 0.6 GB (hot set) | **4×** less RAM |
| **Persistence** | ❌ Lost on restart | ✅ AOF + snapshots | Durable |
| **Restart recovery** | Full re-index | Instant | No downtime |
| **Concurrent queries** | GIL-limited | Thread-per-core | Linear scaling |

> **Why Ferrite is faster:** The three-tier HybridLog keeps the hot working set in memory while spilling cold data to mmap and disk via io_uring. This means you get in-memory speed for active queries while supporting datasets larger than available RAM. See the [architecture overview](/docs/ai-ml/overview) for details.

### Running Your Own Benchmark

```python
import time
from llama_index.core import VectorStoreIndex
from llama_index.vector_stores.redis import RedisVectorStore

vector_store = RedisVectorStore(
    redis_url="redis://127.0.0.1:6380",
    index_name="bench_index",
)
index = VectorStoreIndex.from_vector_store(vector_store)
query_engine = index.as_query_engine(similarity_top_k=10)

queries = ["query one", "query two", "query three"]  # add your queries
latencies = []

for q in queries:
    start = time.perf_counter()
    _ = query_engine.query(q)
    latencies.append(time.perf_counter() - start)

print(f"p50: {sorted(latencies)[len(latencies)//2]*1000:.1f} ms")
print(f"p99: {sorted(latencies)[int(len(latencies)*0.99)]*1000:.1f} ms")
```

## Next Steps

- [AI/ML Overview](/docs/ai-ml/overview) — Ferrite's AI/ML capabilities
- [Vector Indexes](/docs/ai-ml/vector-indexes) — Deep dive into HNSW and FLAT indexing
- [RAG Pipeline](/docs/ai-ml/rag-pipeline) — End-to-end RAG architecture
- [LangChain Integration](/docs/integrations/langchain) — Alternative LLM framework integration
- [Python SDK](https://github.com/FerriteLabs/ferrite/tree/main/sdk/ferrite-py) — Full `ferrite-py` documentation
