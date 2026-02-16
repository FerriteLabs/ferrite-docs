---
sidebar_position: 2
title: Python SDK
description: Official Ferrite Python SDK with sync and async APIs, full type hints, Pydantic integration, and connection pooling.
keywords: [python sdk, ferrite python, async python, pydantic, redis python client]
maturity: beta
---

# Python SDK

The official Ferrite Python SDK provides both synchronous and asynchronous APIs with full type hints and Pydantic integration.

## Installation

```bash
pip install ferrite-py

# With async support
pip install ferrite-py[async]

# With all extras
pip install ferrite-py[all]
```

## Quick Start

### Synchronous API

```python
from ferrite import Ferrite

# Connect to Ferrite
client = Ferrite(host="localhost", port=6380)

# Basic operations
client.set("key", "value")
value = client.get("key")
print(f"Value: {value}")

# Close connection
client.close()
```

### Asynchronous API

```python
import asyncio
from ferrite import AsyncFerrite

async def main():
    # Connect to Ferrite
    client = await AsyncFerrite.connect(host="localhost", port=6380)

    # Basic operations
    await client.set("key", "value")
    value = await client.get("key")
    print(f"Value: {value}")

    # Close connection
    await client.close()

asyncio.run(main())
```

### Context Manager

```python
# Synchronous
with Ferrite(host="localhost", port=6380) as client:
    client.set("key", "value")

# Asynchronous
async with AsyncFerrite.connect(host="localhost", port=6380) as client:
    await client.set("key", "value")
```

## Connection Configuration

```python
from ferrite import Ferrite, ConnectionConfig

config = ConnectionConfig(
    host="localhost",
    port=6380,
    password="secret",
    username="default",
    database=0,
    connect_timeout=5.0,
    read_timeout=30.0,
    write_timeout=30.0,
    ssl=True,
    ssl_ca_certs="/path/to/ca.crt",
    ssl_certfile="/path/to/client.crt",
    ssl_keyfile="/path/to/client.key",
)

client = Ferrite.from_config(config)
```

### Connection Pool

```python
from ferrite import FerritePool

pool = FerritePool(
    host="localhost",
    port=6380,
    min_connections=5,
    max_connections=20,
    idle_timeout=300,
)

# Get connection from pool
with pool.connection() as conn:
    conn.set("key", "value")

# Async pool
from ferrite import AsyncFerritePool

pool = AsyncFerritePool(
    host="localhost",
    port=6380,
    min_connections=5,
    max_connections=20,
)

async with pool.connection() as conn:
    await conn.set("key", "value")
```

### Cluster Connection

```python
from ferrite import FerriteCluster

cluster = FerriteCluster(
    startup_nodes=[
        {"host": "node1", "port": 6380},
        {"host": "node2", "port": 6380},
        {"host": "node3", "port": 6380},
    ]
)

# Automatic routing
cluster.set("key", "value")
```

## Data Types

### Strings

```python
# Basic operations
client.set("name", "Ferrite")
client.set("session", "token123", ex=3600)  # With TTL
client.setnx("unique", "first")  # Set if not exists

name = client.get("name")
length = client.strlen("name")

# Numeric operations
client.set("counter", 0)
client.incr("counter")
client.incrby("counter", 10)
client.incrbyfloat("counter", 0.5)

# Batch operations
client.mset({"k1": "v1", "k2": "v2", "k3": "v3"})
values = client.mget(["k1", "k2", "k3"])
```

### Lists

```python
# Push operations
client.lpush("queue", "a", "b", "c")
client.rpush("queue", "d", "e", "f")

# Pop operations
item = client.lpop("queue")
items = client.lpop("queue", count=3)

# Blocking pop (for queues)
result = client.blpop(["queue1", "queue2"], timeout=5)
if result:
    queue, item = result
    print(f"Got {item} from {queue}")

# Range operations
items = client.lrange("queue", 0, -1)
client.ltrim("queue", 0, 99)  # Keep first 100
```

### Hashes

```python
# Single field operations
client.hset("user:1", "name", "Alice")
name = client.hget("user:1", "name")

# Multiple fields
client.hset("user:1", mapping={
    "name": "Alice",
    "email": "alice@example.com",
    "age": "30",
})

# Get all fields
user = client.hgetall("user:1")

# With Pydantic models
from pydantic import BaseModel

class User(BaseModel):
    name: str
    email: str
    age: int

user = client.hgetall_model("user:1", User)
print(user.name)  # Type-safe access
```

### Sets

```python
# Add members
client.sadd("tags", "python", "database", "redis")

# Check membership
is_member = client.sismember("tags", "python")

# Set operations
common = client.sinter("tags1", "tags2")
all_tags = client.sunion("tags1", "tags2")
diff = client.sdiff("tags1", "tags2")

# Random members
random_tag = client.srandmember("tags")
random_tags = client.srandmember("tags", count=3)
```

### Sorted Sets

```python
# Add with scores
client.zadd("leaderboard", {
    "alice": 100,
    "bob": 95,
    "carol": 110,
})

# Get rankings
rank = client.zrank("leaderboard", "alice")
score = client.zscore("leaderboard", "alice")

# Range queries
top10 = client.zrevrange("leaderboard", 0, 9, withscores=True)

# Score range
high_scorers = client.zrangebyscore("leaderboard", 100, "+inf")
```

### Streams

```python
# Add entries
entry_id = client.xadd("events", {
    "type": "click",
    "page": "/home",
})

# Read entries
entries = client.xrange("events", "-", "+", count=100)

# Consumer groups
client.xgroup_create("events", "processors", id="$", mkstream=True)

entries = client.xreadgroup(
    "processors",
    "worker-1",
    {"events": ">"},
    count=10,
    block=5000,
)

# Acknowledge processing
for stream, messages in entries:
    for msg_id, fields in messages:
        # Process message
        client.xack("events", "processors", msg_id)
```

## Extended Features

### Vector Search

```python
import numpy as np
from ferrite.vector import VectorIndex, SearchOptions

# Create index
client.execute_command(
    "VECTOR.INDEX.CREATE",
    "embeddings", "DIM", "384", "DISTANCE", "COSINE", "TYPE", "HNSW"
)

# Add vectors
embedding = model.encode("Hello world")  # numpy array or list
client.vector_add("embeddings", "doc:1", embedding, metadata={
    "text": "Hello world",
    "category": "greeting",
})

# Search
query_embedding = model.encode("Hi there")
results = client.vector_search(
    "embeddings",
    query_embedding,
    top_k=10,
    filter="category == 'greeting'",
)

for result in results:
    print(f"ID: {result.id}, Score: {result.score}")
```

### Document Store

```python
from ferrite.document import Query, Aggregation

# Insert document
doc = {
    "title": "Getting Started",
    "author": "Alice",
    "tags": ["tutorial", "beginner"],
    "views": 100,
}

client.doc_insert("articles", "article:1", doc)

# Query documents
query = Query().filter(author="Alice").sort("views", desc=True).limit(10)
docs = client.doc_find("articles", query)

# Aggregation pipeline
pipeline = Aggregation() \
    .match({"author": "Alice"}) \
    .group({"_id": "$category", "count": {"$sum": 1}}) \
    .sort({"count": -1})

results = client.doc_aggregate("articles", pipeline)
```

### Graph Database

```python
from ferrite.graph import TraversalOptions

# Create vertices
client.graph_vertex_add("social", "user:alice", "User", {
    "name": "Alice",
    "age": 30,
})

client.graph_vertex_add("social", "user:bob", "User", {
    "name": "Bob",
    "age": 28,
})

# Create edge
client.graph_edge_add(
    "social",
    "user:alice",
    "user:bob",
    "FOLLOWS",
    properties={"since": "2024-01-01"},
)

# Traverse graph
friends = client.graph_traverse(
    "social",
    "user:alice",
    direction="OUT",
    edge_type="FOLLOWS",
    max_depth=2,
)

# Query with Cypher-like syntax
results = client.graph_query(
    "social",
    "MATCH (a:User)-[:FOLLOWS]->(b:User) WHERE a.name = 'Alice' RETURN b"
)
```

### Time Series

```python
from datetime import datetime, timedelta
from ferrite.timeseries import AggregationType

# Add samples
client.ts_add("temperature:room1", "*", 23.5)
client.ts_add("temperature:room1", "*", 24.0, labels={
    "location": "office",
    "sensor": "temp-01",
})

# Add with specific timestamp
client.ts_add("temperature:room1", datetime.now(), 23.8)

# Query range
samples = client.ts_range(
    "temperature:room1",
    start=datetime.now() - timedelta(hours=24),
    end=datetime.now(),
)

# Aggregated query
hourly_avg = client.ts_range(
    "temperature:room1",
    start="-24h",
    end="now",
    aggregation=AggregationType.AVG,
    bucket_size=timedelta(hours=1),
)
```

### Semantic Search

```python
from ferrite.semantic import SemanticIndex, EmbeddingProvider

# Configure embedding provider
client.semantic_config(
    provider=EmbeddingProvider.OPENAI,
    api_key=os.environ["OPENAI_API_KEY"],
    model="text-embedding-3-small",
)

# Create semantic index
client.semantic_index_create("knowledge", dimensions=1536)

# Add text (auto-embeds)
client.semantic_add("knowledge", "doc:1", "Ferrite is a Redis replacement")

# Semantic search
results = client.semantic_search(
    "knowledge",
    "What is Ferrite?",
    top_k=5,
)
```

## Transactions

### Basic Transaction

```python
def transfer_funds(pipe):
    balance = int(pipe.get("account:1:balance") or 0)

    if balance >= 100:
        pipe.multi()
        pipe.decrby("account:1:balance", 100)
        pipe.incrby("account:2:balance", 100)
        return True
    return False

result = client.transaction(transfer_funds, "account:1:balance")
```

### Pipeline (Without WATCH)

```python
pipe = client.pipeline()
pipe.set("key1", "value1")
pipe.set("key2", "value2")
pipe.get("key1")
pipe.get("key2")
results = pipe.execute()
```

## Pub/Sub

### Publishing

```python
client.publish("events", "Hello, subscribers!")
```

### Subscribing

```python
from ferrite import PubSub

pubsub = client.pubsub()

# Subscribe to channels
pubsub.subscribe("events", "notifications")

# Pattern subscribe
pubsub.psubscribe("events:*")

# Receive messages
for message in pubsub.listen():
    if message["type"] == "message":
        print(f"Channel {message['channel']}: {message['data']}")
    elif message["type"] == "pmessage":
        print(f"Pattern {message['pattern']} matched {message['channel']}")
```

### Async Pub/Sub

```python
from ferrite import AsyncPubSub

pubsub = client.pubsub()
await pubsub.subscribe("events")

async for message in pubsub.listen():
    print(f"Received: {message}")
```

## Lua Scripting

```python
# Load script
script = """
local current = redis.call('GET', KEYS[1])
if current then
    return redis.call('SET', KEYS[1], ARGV[1])
else
    return nil
end
"""

# Register script
update_if_exists = client.register_script(script)

# Execute
result = update_if_exists(keys=["mykey"], args=["newvalue"])
```

## Error Handling

```python
from ferrite import (
    FerriteError,
    ConnectionError,
    TimeoutError,
    ResponseError,
)

try:
    value = client.get("key")
except ConnectionError as e:
    print(f"Connection failed: {e}")
    # Retry logic
except TimeoutError as e:
    print(f"Operation timed out: {e}")
except ResponseError as e:
    print(f"Server error: {e}")
except FerriteError as e:
    print(f"General error: {e}")
```

## Type Hints and Models

### Pydantic Integration

```python
from pydantic import BaseModel
from typing import List, Optional
from ferrite import Ferrite

class Product(BaseModel):
    id: str
    name: str
    price: float
    tags: List[str] = []
    description: Optional[str] = None

# Store as hash
product = Product(id="p1", name="Widget", price=9.99, tags=["sale"])
client.hset_model("product:p1", product)

# Retrieve as model
product = client.hgetall_model("product:p1", Product)
print(product.price)  # Type-safe: float

# Store as JSON document
client.doc_insert("products", "p1", product.dict())

# Query with model
products: List[Product] = client.doc_find_models(
    "products",
    Query().filter(price__lt=10),
    Product,
)
```

### Dataclass Support

```python
from dataclasses import dataclass, asdict
from ferrite import Ferrite

@dataclass
class Session:
    user_id: str
    token: str
    expires_at: int

session = Session(user_id="123", token="abc", expires_at=1234567890)
client.hset("session:123", mapping=asdict(session))
```

## FastAPI Integration

```python
from fastapi import FastAPI, Depends
from ferrite import AsyncFerrite, AsyncFerritePool
from contextlib import asynccontextmanager

pool: AsyncFerritePool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    pool = AsyncFerritePool(host="localhost", port=6380)
    await pool.initialize()
    yield
    await pool.close()

app = FastAPI(lifespan=lifespan)

async def get_ferrite():
    async with pool.connection() as conn:
        yield conn

@app.get("/user/{user_id}")
async def get_user(user_id: str, ferrite: AsyncFerrite = Depends(get_ferrite)):
    user = await ferrite.hgetall(f"user:{user_id}")
    return user

@app.post("/user/{user_id}")
async def create_user(
    user_id: str,
    user: User,
    ferrite: AsyncFerrite = Depends(get_ferrite)
):
    await ferrite.hset(f"user:{user_id}", mapping=user.dict())
    return {"status": "created"}
```

## Django Integration

```python
# settings.py
FERRITE_CONFIG = {
    "host": "localhost",
    "port": 6380,
    "password": "secret",
    "pool_size": 10,
}

# cache.py
from django.conf import settings
from ferrite import FerritePool

_pool = None

def get_pool():
    global _pool
    if _pool is None:
        _pool = FerritePool(**settings.FERRITE_CONFIG)
    return _pool

def cache_get(key):
    with get_pool().connection() as conn:
        return conn.get(key)

def cache_set(key, value, ttl=None):
    with get_pool().connection() as conn:
        conn.set(key, value, ex=ttl)

# views.py
from .cache import cache_get, cache_set

def product_view(request, product_id):
    cache_key = f"product:{product_id}"

    product = cache_get(cache_key)
    if product is None:
        product = Product.objects.get(id=product_id)
        cache_set(cache_key, product.to_json(), ttl=3600)

    return JsonResponse(product)
```

## CLI Tool

```bash
# Install CLI
pip install ferrite-py[cli]

# Connect to server
ferrite-cli -h localhost -p 6380

# Execute commands
ferrite-cli -h localhost -p 6380 SET key value
ferrite-cli -h localhost -p 6380 GET key

# Interactive mode
ferrite-cli -h localhost -p 6380
localhost:6380> SET key value
OK
localhost:6380> GET key
"value"
```

## Configuration Reference

```python
from ferrite import Ferrite, ConnectionConfig

config = ConnectionConfig(
    # Connection
    host="localhost",
    port=6380,
    password=None,
    username="default",
    database=0,

    # Timeouts (seconds)
    connect_timeout=5.0,
    read_timeout=30.0,
    write_timeout=30.0,

    # Socket options
    socket_keepalive=True,
    socket_keepalive_options={
        "tcp_keepidle": 30,
        "tcp_keepintvl": 10,
        "tcp_keepcnt": 3,
    },

    # TLS/SSL
    ssl=False,
    ssl_ca_certs=None,
    ssl_certfile=None,
    ssl_keyfile=None,
    ssl_check_hostname=True,

    # Retry
    retry_on_error=True,
    retry_count=3,
    retry_delay=0.1,

    # Encoding
    encoding="utf-8",
    decode_responses=True,
)

client = Ferrite.from_config(config)
```

## Best Practices

### Connection Management

```python
# Use connection pools in production
pool = FerritePool(
    host="localhost",
    port=6380,
    max_connections=20,
    health_check_interval=30,
)

# Always close connections
try:
    with pool.connection() as conn:
        conn.set("key", "value")
finally:
    pool.close()
```

### Async Best Practices

```python
import asyncio

async def batch_operations(client, keys):
    # Use gather for concurrent operations
    tasks = [client.get(key) for key in keys]
    results = await asyncio.gather(*tasks)
    return dict(zip(keys, results))
```

### Memory Efficiency

```python
# Use scan for large key spaces
for key in client.scan_iter("user:*", count=100):
    process(key)

# Don't load all keys at once
# BAD: keys = client.keys("*")
# GOOD: use scan_iter
```

## Next Steps

- [TypeScript SDK](/docs/sdk/typescript) - For Node.js applications
- [Go SDK](/docs/sdk/go) - For Go applications
- [SDK Generator](/docs/sdk/generator) - Generate custom SDKs
