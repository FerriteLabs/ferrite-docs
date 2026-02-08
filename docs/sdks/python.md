---
sidebar_position: 2
title: Python Thin Client
description: Use redis-py to connect to Ferrite with a thin wrapper for Ferrite-specific commands like vector search and semantic caching.
keywords: [python, redis-py, ferrite python, vector search python, semantic cache python]
---

# Python Thin Client

Ferrite is wire-compatible with Redis, so [redis-py](https://redis-py.readthedocs.io/) works for all standard commands. This guide shows how to add a thin wrapper for Ferrite-specific extensions.

## Installation

```bash
pip install redis
```

No additional packages are needed. The `FerriteClient` wrapper below uses only `redis-py`.

## Standard Redis Operations

All standard Redis commands work directly through redis-py:

```python
import redis

client = redis.Redis(host="localhost", port=6380, decode_responses=True)

# Standard operations — identical to Redis
client.set("user:1:name", "Alice")
name = client.get("user:1:name")

client.hset("user:1", mapping={"name": "Alice", "email": "alice@example.com"})
user = client.hgetall("user:1")

client.lpush("queue:jobs", "job-123", "job-456")
job = client.rpop("queue:jobs")

client.zadd("leaderboard", {"alice": 100, "bob": 95})
top = client.zrevrange("leaderboard", 0, 9, withscores=True)
```

## Raw Ferrite Commands

You can execute any Ferrite-specific command directly via `execute_command()`:

```python
# Create a vector index
client.execute_command(
    "VECTOR.INDEX.CREATE", "embeddings",
    "DIM", 384, "DISTANCE", "COSINE", "TYPE", "HNSW"
)

# Add a vector
import struct
vector = [0.1, 0.2, 0.3]  # your embedding
blob = struct.pack(f"{len(vector)}f", *vector)
client.execute_command("VECTOR.ADD", "embeddings", "doc:1", blob)

# Search vectors
results = client.execute_command(
    "VECTOR.SEARCH", "embeddings", blob, "TOP_K", 10
)
```

## FerriteClient Wrapper

For a cleaner API, use this thin wrapper that provides typed methods for Ferrite extensions while preserving full access to the underlying redis-py client.

```python
"""Thin Ferrite wrapper around redis-py for Ferrite-specific commands."""

import struct
from typing import Any, Dict, List, Optional, Sequence, Union

import redis


class VectorSearchResult:
    """A single result from a vector search."""

    def __init__(self, id: str, score: float, metadata: Optional[Dict[str, str]] = None):
        self.id = id
        self.score = score
        self.metadata = metadata or {}

    def __repr__(self) -> str:
        return f"VectorSearchResult(id={self.id!r}, score={self.score:.4f})"


class FerriteClient:
    """Thin wrapper around redis.Redis that adds Ferrite-specific methods.

    All standard Redis methods are available via the `.redis` attribute
    or by calling them directly (proxied via __getattr__).
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6380,
        password: Optional[str] = None,
        db: int = 0,
        decode_responses: bool = True,
        **kwargs: Any,
    ):
        self.redis = redis.Redis(
            host=host,
            port=port,
            password=password,
            db=db,
            decode_responses=decode_responses,
            **kwargs,
        )

    def __getattr__(self, name: str) -> Any:
        """Proxy attribute access to the underlying Redis client."""
        return getattr(self.redis, name)

    def close(self) -> None:
        self.redis.close()

    def __enter__(self) -> "FerriteClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    # ── Vector Search (Stable) ──────────────────────────────────────────

    def vector_create(
        self,
        index: str,
        dim: int,
        distance: str = "COSINE",
        index_type: str = "HNSW",
        **kwargs: Any,
    ) -> Any:
        """Create a vector index.

        Args:
            index: Name of the vector index.
            dim: Dimensionality of vectors.
            distance: Distance metric — COSINE, L2, or IP.
            index_type: Index algorithm — HNSW or IVF.
        """
        args = ["VECTOR.INDEX.CREATE", index, "DIM", dim, "DISTANCE", distance, "TYPE", index_type]
        for k, v in kwargs.items():
            args.extend([k.upper(), v])
        return self.redis.execute_command(*args)

    def vector_add(
        self,
        index: str,
        key: str,
        vector: Sequence[float],
        metadata: Optional[Dict[str, str]] = None,
    ) -> Any:
        """Add a vector to an index.

        Args:
            index: Name of the vector index.
            key: Unique identifier for this vector.
            vector: List of floats (embedding).
            metadata: Optional key-value metadata attached to the vector.
        """
        blob = struct.pack(f"{len(vector)}f", *vector)
        args: list = ["VECTOR.ADD", index, key, blob]
        if metadata:
            for k, v in metadata.items():
                args.extend([k, v])
        return self.redis.execute_command(*args)

    def vector_search(
        self,
        index: str,
        vector: Sequence[float],
        top_k: int = 10,
        filter_expr: Optional[str] = None,
    ) -> List[VectorSearchResult]:
        """Search for nearest vectors.

        Args:
            index: Name of the vector index.
            vector: Query vector.
            top_k: Number of results to return.
            filter_expr: Optional filter expression for metadata.

        Returns:
            List of VectorSearchResult objects.
        """
        blob = struct.pack(f"{len(vector)}f", *vector)
        args: list = ["VECTOR.SEARCH", index, blob, "TOP_K", top_k]
        if filter_expr:
            args.extend(["FILTER", filter_expr])
        raw = self.redis.execute_command(*args)
        return self._parse_vector_results(raw)

    def vector_delete(self, index: str, key: str) -> Any:
        """Remove a vector from an index."""
        return self.redis.execute_command("VECTOR.DEL", index, key)

    def vector_index_drop(self, index: str) -> Any:
        """Drop a vector index."""
        return self.redis.execute_command("VECTOR.INDEX.DROP", index)

    # ── Semantic Cache (Stable) ──────────────────────────────────────────

    def semantic_set(
        self,
        key: str,
        text: str,
        value: str,
        ttl: Optional[int] = None,
    ) -> Any:
        """Store a value with semantic (meaning-based) lookup.

        Args:
            key: Namespace or cache key prefix.
            text: The text whose meaning will be used for matching.
            value: The value to cache.
            ttl: Optional TTL in seconds.
        """
        args: list = ["SEMANTIC.SET", key, text, value]
        if ttl is not None:
            args.extend(["EX", ttl])
        return self.redis.execute_command(*args)

    def semantic_get(
        self,
        key: str,
        text: str,
        threshold: float = 0.85,
    ) -> Optional[str]:
        """Retrieve a cached value by semantic similarity.

        Args:
            key: Namespace or cache key prefix.
            text: The query text to match against cached entries.
            threshold: Minimum similarity score (0.0–1.0) for a cache hit.

        Returns:
            The cached value if a match exceeds the threshold, else None.
        """
        result = self.redis.execute_command(
            "SEMANTIC.GET", key, text, "THRESHOLD", threshold
        )
        return result if result else None

    def semantic_delete(self, key: str) -> Any:
        """Delete a semantic cache entry."""
        return self.redis.execute_command("SEMANTIC.DEL", key)

    # ── CRDT Operations (Experimental) ───────────────────────────────────

    def crdt_counter_incr(self, key: str, amount: int = 1) -> Any:
        """Increment a CRDT counter.

        .. warning:: Experimental — API may change.
        """
        return self.redis.execute_command("CRDT.COUNTER.INCR", key, amount)

    def crdt_counter_get(self, key: str) -> int:
        """Get the value of a CRDT counter.

        .. warning:: Experimental — API may change.
        """
        return self.redis.execute_command("CRDT.COUNTER.GET", key)

    def crdt_set_add(self, key: str, *members: str) -> Any:
        """Add members to a CRDT set (OR-Set).

        .. warning:: Experimental — API may change.
        """
        return self.redis.execute_command("CRDT.SET.ADD", key, *members)

    def crdt_set_members(self, key: str) -> List[str]:
        """Get all members of a CRDT set.

        .. warning:: Experimental — API may change.
        """
        return self.redis.execute_command("CRDT.SET.MEMBERS", key)

    # ── CDC — Change Data Capture (Experimental) ─────────────────────────

    def cdc_subscribe(self, pattern: str) -> Any:
        """Subscribe to change data capture events matching a key pattern.

        .. warning:: Experimental — API may change.
        """
        return self.redis.execute_command("CDC.SUBSCRIBE", pattern)

    # ── Helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _parse_vector_results(raw: Any) -> List[VectorSearchResult]:
        """Parse raw VECTOR.SEARCH response into VectorSearchResult objects."""
        if not raw:
            return []
        results = []
        # Response format: [count, id1, score1, [meta...], id2, score2, [meta...], ...]
        if isinstance(raw, list) and len(raw) > 0:
            i = 1 if isinstance(raw[0], int) else 0
            while i < len(raw) - 1:
                doc_id = raw[i] if isinstance(raw[i], str) else str(raw[i])
                score = float(raw[i + 1])
                metadata: Dict[str, str] = {}
                i += 2
                if i < len(raw) and isinstance(raw[i], list):
                    pairs = raw[i]
                    for j in range(0, len(pairs) - 1, 2):
                        metadata[str(pairs[j])] = str(pairs[j + 1])
                    i += 1
                results.append(VectorSearchResult(doc_id, score, metadata))
        return results
```

## Usage Examples

### Standard + Ferrite Operations Together

```python
from ferrite_client import FerriteClient  # or paste the class above

client = FerriteClient(host="localhost", port=6380)

# ── Standard Redis commands (proxied to redis-py) ──
client.set("app:version", "2.1.0")
client.hset("user:42", mapping={"name": "Bob", "role": "admin"})

# ── Vector search ──
client.vector_create("products", dim=384, distance="COSINE")

embeddings = generate_embeddings(["Red running shoes", "Blue winter jacket"])

client.vector_add("products", "sku:1001", embeddings[0], metadata={
    "name": "Red running shoes",
    "category": "footwear",
})
client.vector_add("products", "sku:1002", embeddings[1], metadata={
    "name": "Blue winter jacket",
    "category": "outerwear",
})

query = generate_embedding("lightweight shoes for jogging")
results = client.vector_search("products", query, top_k=5)
for r in results:
    print(f"  {r.id} (score: {r.score:.4f})")

# ── Semantic caching ──
client.semantic_set("llm:cache", "What is Ferrite?", "Ferrite is a Redis-compatible ...", ttl=3600)
cached = client.semantic_get("llm:cache", "Tell me about Ferrite")
if cached:
    print(f"Cache hit: {cached}")

client.close()
```

### Async Usage with redis-py

redis-py supports async via `redis.asyncio`. The wrapper pattern is identical:

```python
import redis.asyncio as aioredis

class AsyncFerriteClient:
    """Async version of the thin Ferrite wrapper."""

    def __init__(self, host: str = "localhost", port: int = 6380, **kwargs):
        self.redis = aioredis.Redis(host=host, port=port, **kwargs)

    async def vector_search(self, index, vector, top_k=10):
        import struct
        blob = struct.pack(f"{len(vector)}f", *vector)
        raw = await self.redis.execute_command(
            "VECTOR.SEARCH", index, blob, "TOP_K", top_k
        )
        # ... parse results
        return raw

    async def semantic_get(self, key, text, threshold=0.85):
        return await self.redis.execute_command(
            "SEMANTIC.GET", key, text, "THRESHOLD", threshold
        )

    async def close(self):
        await self.redis.close()
```

### Connection Pooling

```python
import redis

pool = redis.ConnectionPool(
    host="localhost", port=6380, db=0,
    max_connections=20, decode_responses=True,
)

client = FerriteClient.__new__(FerriteClient)
client.redis = redis.Redis(connection_pool=pool)

# Reuse across threads / requests
client.set("key", "value")
results = client.vector_search("embeddings", query_vec, top_k=5)
```

## Command Stability

| Method | Command | Status |
|--------|---------|--------|
| `vector_create()` | `VECTOR.INDEX.CREATE` | **Stable** |
| `vector_add()` | `VECTOR.ADD` | **Stable** |
| `vector_search()` | `VECTOR.SEARCH` | **Stable** |
| `vector_delete()` | `VECTOR.DEL` | **Stable** |
| `semantic_set()` | `SEMANTIC.SET` | **Stable** |
| `semantic_get()` | `SEMANTIC.GET` | **Stable** |
| `crdt_counter_incr()` | `CRDT.COUNTER.INCR` | Experimental |
| `crdt_counter_get()` | `CRDT.COUNTER.GET` | Experimental |
| `crdt_set_add()` | `CRDT.SET.ADD` | Experimental |
| `crdt_set_members()` | `CRDT.SET.MEMBERS` | Experimental |
| `cdc_subscribe()` | `CDC.SUBSCRIBE` | Experimental |

:::warning Experimental commands
Commands marked **Experimental** may have breaking changes between minor releases. Pin your Ferrite server version when using them in production.
:::

## Next Steps

- [Node.js Thin Client](/docs/sdks/nodejs) — ioredis wrapper
- [Go Thin Client](/docs/sdks/go) — go-redis wrapper
- [Vector Commands Reference](/docs/reference/commands/vector)
- [Semantic Commands Reference](/docs/reference/commands/semantic)
