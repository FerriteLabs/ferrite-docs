---
title: "Python Client Guide"
description: Connect to Ferrite from Python using redis-py and aioredis, with examples for basic operations, vector search, pub/sub, and connection pooling.
sidebar_position: 2
maturity: beta
---

# Python Client Guide

This guide shows how to connect to Ferrite from Python using the standard `redis-py` library for basic operations and raw commands for Ferrite-specific features.

## Installation

```bash
# Standard Redis client
pip install redis

# For async support
pip install redis[hiredis]
```

:::tip
The `hiredis` extra installs a C-based parser that significantly improves performance for high-throughput workloads.
:::

## Basic Operations with redis-py

### Connecting

```python
import redis

# Simple connection
r = redis.Redis(host="localhost", port=6380, decode_responses=True)

# Verify connectivity
r.ping()  # True
```

### CRUD Operations

```python
# Strings
r.set("user:1:name", "Alice")
r.set("session:abc", "token123", ex=3600)  # 1-hour TTL

name = r.get("user:1:name")  # "Alice"

# Hashes
r.hset("user:1", mapping={
    "name": "Alice",
    "email": "alice@example.com",
    "role": "admin",
})
user = r.hgetall("user:1")  # {"name": "Alice", "email": "alice@example.com", ...}

# Lists
r.rpush("events", "login", "page_view", "click")
events = r.lrange("events", 0, -1)  # ["login", "page_view", "click"]

# Sets
r.sadd("user:1:tags", "premium", "beta-tester")
is_premium = r.sismember("user:1:tags", "premium")  # True

# Sorted sets
r.zadd("leaderboard", {"alice": 100, "bob": 95, "carol": 110})
top3 = r.zrevrange("leaderboard", 0, 2, withscores=True)
```

### Caching Pattern

```python
import json

def get_user(user_id: str) -> dict:
    """Fetch user with read-through cache."""
    cache_key = f"cache:user:{user_id}"

    # Try cache first
    cached = r.get(cache_key)
    if cached:
        return json.loads(cached)

    # Miss — fetch from database
    user = db.query_user(user_id)

    # Cache for 5 minutes
    r.set(cache_key, json.dumps(user), ex=300)
    return user
```

## Async Client

```python
import asyncio
import redis.asyncio as aioredis

async def main():
    r = aioredis.Redis(host="localhost", port=6380, decode_responses=True)

    await r.set("key", "value")
    value = await r.get("key")
    print(f"Value: {value}")

    await r.aclose()

asyncio.run(main())
```

### Async Caching Example

```python
import redis.asyncio as aioredis

async def get_user_async(r: aioredis.Redis, user_id: str) -> dict:
    cache_key = f"cache:user:{user_id}"
    cached = await r.get(cache_key)
    if cached:
        return json.loads(cached)

    user = await db.async_query_user(user_id)
    await r.set(cache_key, json.dumps(user), ex=300)
    return user
```

## Connection Pooling

```python
import redis

# Create a connection pool
pool = redis.ConnectionPool(
    host="localhost",
    port=6380,
    max_connections=20,
    decode_responses=True,
)

# Use the pool
r = redis.Redis(connection_pool=pool)
r.set("key", "value")
```

### Async Connection Pool

```python
import redis.asyncio as aioredis

pool = aioredis.ConnectionPool(
    host="localhost",
    port=6380,
    max_connections=20,
    decode_responses=True,
)

r = aioredis.Redis(connection_pool=pool)
```

:::warning
Always set `max_connections` in production. The default is unlimited, which can exhaust file descriptors under load.
:::

## Ferrite-Specific Commands

Use `execute_command()` to access Ferrite extensions that aren't part of the standard Redis command set.

### Vector Search

```python
import struct

def float_list_to_bytes(floats: list[float]) -> bytes:
    """Pack a list of floats into a binary blob for VECTOR commands."""
    return struct.pack(f"{len(floats)}f", *floats)

# Create a vector index
r.execute_command(
    "VECTOR.INDEX.CREATE", "embeddings",
    "DIM", 384,
    "DISTANCE", "COSINE",
    "TYPE", "HNSW",
)

# Add a vector
embedding = [0.1, 0.2, 0.3]  # Your embedding from a model
r.execute_command(
    "VECTOR.ADD", "embeddings", "doc:1",
    float_list_to_bytes(embedding),
    "TEXT", "Hello world",
    "CATEGORY", "greeting",
)

# Search for similar vectors
query_vec = float_list_to_bytes([0.1, 0.2, 0.3])
results = r.execute_command(
    "VECTOR.SEARCH", "embeddings",
    query_vec,
    "K", 10,
)
```

### Semantic Set/Get

```python
# Store with semantic meaning
r.execute_command("SEMANTIC.SET", "facts:capital", "The capital of France is Paris")

# Retrieve by semantic similarity
result = r.execute_command("SEMANTIC.GET", "facts:capital", "What city is France's capital?")
```

### Time Series

```python
import time

# Add data points
r.execute_command("TS.ADD", "temperature:office", "*", 23.5)
r.execute_command("TS.ADD", "temperature:office", "*", 24.0)

# Query a time range (last hour)
now = int(time.time() * 1000)
hour_ago = now - 3600000
samples = r.execute_command("TS.RANGE", "temperature:office", hour_ago, now)
```

## Pub/Sub

### Publisher

```python
r.publish("notifications", "New order received")
r.publish("events:user:123", "profile_updated")
```

### Subscriber

```python
pubsub = r.pubsub()
pubsub.subscribe("notifications")
pubsub.psubscribe("events:*")

for message in pubsub.listen():
    if message["type"] == "message":
        print(f"[{message['channel']}] {message['data']}")
    elif message["type"] == "pmessage":
        print(f"[{message['pattern']} → {message['channel']}] {message['data']}")
```

### Async Pub/Sub

```python
import redis.asyncio as aioredis

async def subscriber():
    r = aioredis.Redis(host="localhost", port=6380, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe("notifications")

    async for message in pubsub.listen():
        if message["type"] == "message":
            print(f"Received: {message['data']}")

    await r.aclose()
```

## Pipelines

Batch multiple commands into a single round-trip:

```python
pipe = r.pipeline()
pipe.set("key1", "value1")
pipe.set("key2", "value2")
pipe.get("key1")
pipe.get("key2")
results = pipe.execute()
# [True, True, "value1", "value2"]
```

## Error Handling

```python
from redis.exceptions import (
    ConnectionError,
    TimeoutError,
    ResponseError,
)

try:
    value = r.get("key")
except ConnectionError:
    print("Could not connect to Ferrite")
except TimeoutError:
    print("Operation timed out")
except ResponseError as e:
    print(f"Command error: {e}")
```

## Best Practices

1. **Use connection pools** — avoid creating a new connection per request
2. **Set `decode_responses=True`** — unless you're working with binary data
3. **Use pipelines** for batch operations — reduces round-trips significantly
4. **Handle `ConnectionError`** with retry logic in production
5. **Set TTLs on cache keys** — prevent unbounded memory growth

## Next Steps

- [Node.js Client Guide](./nodejs) — Connect from Node.js
- [Go Client Guide](./go) — Connect from Go
- [Rust Client Guide](./rust) — Connect from Rust
- [Python SDK Reference](/docs/sdk/python) — Full Ferrite Python SDK with type-safe APIs
