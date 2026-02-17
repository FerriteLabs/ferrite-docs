---
sidebar_position: 5
description: Compare Ferrite's multi-model capabilities against dedicated databases like MongoDB, Neo4j, InfluxDB, Pinecone, Elasticsearch, and Kafka.
maturity: stable
---

# Ferrite vs Dedicated Databases

Ferrite is a multi-model database that combines capabilities typically requiring multiple specialized databases. This comparison helps you understand when Ferrite can replace dedicated systems and when specialized databases remain the better choice.

## Overview

| Use Case | Ferrite | Dedicated Alternative |
|----------|---------|----------------------|
| Document Store | DOC.* commands | MongoDB |
| Graph Database | GRAPH.* commands | Neo4j |
| Time-Series | TIMESERIES.* commands | InfluxDB, TimescaleDB |
| Vector Search | VECTOR.* commands | Pinecone, Milvus |
| Full-Text Search | SEARCH.* commands | Elasticsearch |
| Message Queue | Streams, Pub/Sub | Kafka, RabbitMQ |
| Cache | Native | Redis, Memcached |

## Ferrite vs MongoDB (Document Store)

### Feature Comparison

| Feature | Ferrite | MongoDB |
|---------|---------|---------|
| JSON Documents | ✅ | ✅ |
| Nested Documents | ✅ | ✅ |
| Query Operators | Most common | Comprehensive |
| Aggregation | Basic pipeline | Full pipeline |
| Indexes | B-tree, compound | B-tree, compound, geospatial, text |
| Transactions | Single doc + multi-key | Multi-document ACID |
| Change Streams | ✅ CDC | ✅ Change Streams |
| Sharding | ✅ Built-in | ✅ Built-in |

### Document Operations

**Ferrite:**
```bash
# Insert document
DOC.INSERT users '{
  "name": "Alice",
  "email": "alice@example.com",
  "profile": {
    "age": 30,
    "city": "NYC"
  }
}'

# Query with operators
DOC.FIND users '{
  "profile.age": {"$gte": 25},
  "profile.city": "NYC"
}'

# Update nested field
DOC.UPDATE users '{"email": "alice@example.com"}' '{
  "$set": {"profile.city": "LA"}
}'

# Aggregation
DOC.AGGREGATE users '[
  {"$match": {"profile.age": {"$gte": 25}}},
  {"$group": {"_id": "$profile.city", "count": {"$sum": 1}}}
]'
```

**MongoDB:**
```javascript
// Insert
db.users.insertOne({
  name: "Alice",
  email: "alice@example.com",
  profile: { age: 30, city: "NYC" }
});

// Query
db.users.find({
  "profile.age": { $gte: 25 },
  "profile.city": "NYC"
});

// Update
db.users.updateOne(
  { email: "alice@example.com" },
  { $set: { "profile.city": "LA" } }
);

// Aggregation
db.users.aggregate([
  { $match: { "profile.age": { $gte: 25 } } },
  { $group: { _id: "$profile.city", count: { $sum: 1 } } }
]);
```

### When to Choose

**Choose Ferrite when:**
- Documents are one of several data models needed
- Lower latency is critical (&lt;1ms)
- Document queries are relatively simple
- You need cache + documents in one system

**Choose MongoDB when:**
- Documents are the primary data model
- Complex aggregation pipelines required
- Multi-document ACID transactions essential
- Rich ecosystem (Atlas, Charts, Compass) needed

## Ferrite vs Neo4j (Graph Database)

### Feature Comparison

| Feature | Ferrite | Neo4j |
|---------|---------|-------|
| Property Graphs | ✅ | ✅ |
| Traversals | BFS, DFS | Full traversal |
| Path Finding | Shortest path | Multiple algorithms |
| Query Language | Commands | Cypher |
| Graph Algorithms | Basic | 60+ algorithms |
| Visualization | Basic | Neo4j Bloom |
| ACID Transactions | ✅ | ✅ |

### Graph Operations

**Ferrite:**
```bash
# Create vertices
GRAPH.VERTEX.ADD social user:1 '{"name": "Alice"}'
GRAPH.VERTEX.ADD social user:2 '{"name": "Bob"}'
GRAPH.VERTEX.ADD social user:3 '{"name": "Carol"}'

# Create edges
GRAPH.EDGE.ADD social user:1 user:2 FOLLOWS '{"since": "2024-01-01"}'
GRAPH.EDGE.ADD social user:2 user:3 FOLLOWS

# Traverse (find friends-of-friends)
GRAPH.TRAVERSE social user:1 OUT FOLLOWS DEPTH 2

# Shortest path
GRAPH.PATH social user:1 user:3
```

**Neo4j (Cypher):**
```cypher
// Create nodes
CREATE (a:User {name: "Alice"})
CREATE (b:User {name: "Bob"})
CREATE (c:User {name: "Carol"})

// Create relationships
MATCH (a:User {name: "Alice"}), (b:User {name: "Bob"})
CREATE (a)-[:FOLLOWS {since: "2024-01-01"}]->(b)

// Friends of friends
MATCH (u:User {name: "Alice"})-[:FOLLOWS*2]->(fof)
RETURN fof

// Shortest path
MATCH path = shortestPath(
  (a:User {name: "Alice"})-[*]-(c:User {name: "Carol"})
)
RETURN path
```

### When to Choose

**Choose Ferrite when:**
- Graph is one of several data models
- Graphs are relatively simple (social follows, basic recommendations)
- Low latency traversals needed
- Integrated with other Ferrite data types

**Choose Neo4j when:**
- Graph is the primary data model
- Complex graph algorithms needed (PageRank, community detection)
- Cypher query language preferred
- Advanced visualization required
- Large-scale graph analytics

## Ferrite vs InfluxDB/TimescaleDB (Time-Series)

### Feature Comparison

| Feature | Ferrite | InfluxDB | TimescaleDB |
|---------|---------|----------|-------------|
| Time-Series Storage | ✅ | ✅ | ✅ |
| Compression | ✅ | ✅ Gorilla | ✅ |
| Downsampling | ✅ | ✅ Tasks | ✅ Continuous Agg |
| Retention Policies | ✅ | ✅ | ✅ |
| Query Language | Commands | Flux/InfluxQL | SQL |
| SQL Support | FerriteQL | Limited | Full PostgreSQL |
| Cardinality | Good | Limited | Excellent |

### Time-Series Operations

**Ferrite:**
```bash
# Add data point
TIMESERIES.ADD metrics:cpu 1704067200000 85.5

# Add with labels
TIMESERIES.ADD metrics:cpu * 85.5 LABELS host=server1 dc=us-east

# Range query
TIMESERIES.RANGE metrics:cpu 1704067200000 1704153600000

# Aggregation
TIMESERIES.AGGREGATE metrics:cpu 1704067200000 1704153600000
  AGGREGATION avg 60000  # 1-minute buckets

# Create downsampling rule
TIMESERIES.RULE.CREATE metrics:cpu:hourly
  SOURCE metrics:cpu
  AGGREGATION avg 3600000
```

**InfluxDB:**
```sql
-- Write data
INSERT cpu,host=server1,dc=us-east value=85.5 1704067200000000000

-- Query
SELECT mean("value")
FROM "cpu"
WHERE time >= '2024-01-01' AND time < '2024-01-02'
GROUP BY time(1m)

-- Continuous query (v1) / Task (v2)
CREATE CONTINUOUS QUERY "cpu_hourly" ON "metrics"
BEGIN
  SELECT mean("value") INTO "cpu_hourly"
  FROM "cpu"
  GROUP BY time(1h)
END
```

**TimescaleDB:**
```sql
-- Create hypertable
SELECT create_hypertable('metrics', 'time');

-- Insert
INSERT INTO metrics (time, host, value)
VALUES ('2024-01-01 00:00:00', 'server1', 85.5);

-- Time bucket aggregation
SELECT time_bucket('1 hour', time) AS hour,
       avg(value)
FROM metrics
GROUP BY hour;

-- Continuous aggregate
CREATE MATERIALIZED VIEW hourly_metrics
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS hour,
       avg(value)
FROM metrics
GROUP BY hour;
```

### When to Choose

**Choose Ferrite when:**
- Time-series is one of several data models
- Moderate cardinality requirements
- Integrated with caching/other workloads
- Simple aggregation needs

**Choose InfluxDB when:**
- Pure time-series workload
- High write throughput (millions/sec)
- Advanced time-series functions
- Native time-series compression

**Choose TimescaleDB when:**
- Need full SQL support
- Complex JOINs with relational data
- PostgreSQL ecosystem integration
- Advanced analytics with SQL

## Ferrite vs Pinecone/Milvus (Vector Database)

### Feature Comparison

| Feature | Ferrite | Pinecone | Milvus |
|---------|---------|----------|--------|
| Vector Storage | ✅ | ✅ | ✅ |
| HNSW Index | ✅ | ✅ | ✅ |
| IVF Index | ✅ | ❌ | ✅ |
| Metadata Filtering | ✅ | ✅ | ✅ |
| Hybrid Search | ✅ | ✅ | ✅ |
| Embedding Generation | ✅ Built-in | ❌ External | ❌ External |
| Managed Service | ❌ | ✅ | ✅ Cloud |
| Max Dimensions | 4096 | 20000 | 32768 |

### Vector Operations

**Ferrite:**
```bash
# Create index
VECTOR.INDEX.CREATE products DIM 768 METRIC cosine ALGORITHM hnsw

# Add vector with metadata
VECTOR.ADD products item:1 [0.1, 0.2, ...]
  METADATA '{"category": "electronics", "price": 299.99}'

# Search with filter
VECTOR.SEARCH products [0.15, 0.25, ...] 10
  FILTER "category = 'electronics' AND price < 500"

# Semantic search (auto-embed)
SEMANTIC.SEARCH products "wireless headphones with noise cancellation" 10

# Hybrid search
VECTOR.SEARCH products $embedding 10
  HYBRID KEYWORDS "headphones noise cancellation"
  ALPHA 0.7  # 70% vector, 30% keyword
```

**Pinecone:**
```python
import pinecone

index = pinecone.Index("products")

# Upsert
index.upsert([
    ("item:1", [0.1, 0.2, ...], {"category": "electronics", "price": 299.99})
])

# Query with filter
results = index.query(
    vector=[0.15, 0.25, ...],
    top_k=10,
    filter={"category": "electronics", "price": {"$lt": 500}}
)
```

**Milvus:**
```python
from pymilvus import Collection

collection = Collection("products")

# Insert
collection.insert([
    [1],  # ids
    [[0.1, 0.2, ...]],  # vectors
    ["electronics"],  # category
    [299.99]  # price
])

# Search with filter
results = collection.search(
    data=[[0.15, 0.25, ...]],
    anns_field="embedding",
    param={"nprobe": 10},
    limit=10,
    expr="category == 'electronics' and price < 500"
)
```

### When to Choose

**Choose Ferrite when:**
- Vectors are one of several data models
- Need built-in embedding generation
- Hybrid vector + keyword search
- Integration with caching/documents

**Choose Pinecone when:**
- Fully managed service preferred
- Scale to billions of vectors
- Minimal operational overhead
- Advanced filtering capabilities

**Choose Milvus when:**
- Self-hosted required
- Very large scale (billions of vectors)
- GPU acceleration needed
- Advanced index types (DiskANN)

## Ferrite vs Elasticsearch (Search)

### Feature Comparison

| Feature | Ferrite | Elasticsearch |
|---------|---------|---------------|
| Full-Text Search | ✅ | ✅ |
| Inverted Index | ✅ | ✅ |
| BM25 Scoring | ✅ | ✅ |
| Analyzers | Basic | Comprehensive |
| Aggregations | Basic | Advanced |
| Query DSL | Commands | Full DSL |
| Distributed | ✅ | ✅ |
| Near Real-Time | ✅ | ✅ |

### Search Operations

**Ferrite:**
```bash
# Create search index
SEARCH.INDEX.CREATE articles
  FIELDS title TEXT WEIGHT 2.0
  FIELDS body TEXT
  FIELDS category TAG

# Add document
SEARCH.ADD articles doc:1
  TITLE "Introduction to Machine Learning"
  BODY "Machine learning is a subset of AI..."
  CATEGORY "tech"

# Search
SEARCH.QUERY articles "machine learning"
  FILTER "category = 'tech'"
  HIGHLIGHT

# Fuzzy search
SEARCH.QUERY articles "machin~2 lerning~1"
```

**Elasticsearch:**
```json
// Create index
PUT /articles
{
  "mappings": {
    "properties": {
      "title": { "type": "text", "boost": 2.0 },
      "body": { "type": "text" },
      "category": { "type": "keyword" }
    }
  }
}

// Index document
POST /articles/_doc/1
{
  "title": "Introduction to Machine Learning",
  "body": "Machine learning is a subset of AI...",
  "category": "tech"
}

// Search
GET /articles/_search
{
  "query": {
    "bool": {
      "must": { "match": { "body": "machine learning" } },
      "filter": { "term": { "category": "tech" } }
    }
  },
  "highlight": { "fields": { "body": {} } }
}
```

### When to Choose

**Choose Ferrite when:**
- Search is one of several data models
- Basic full-text search sufficient
- Integrated with caching/vectors
- Lower operational complexity

**Choose Elasticsearch when:**
- Search is the primary use case
- Complex query DSL needed
- Advanced text analysis (synonyms, language-specific)
- Log analytics (ELK stack)
- Kibana visualization

## Ferrite vs Kafka/RabbitMQ (Messaging)

### Feature Comparison

| Feature | Ferrite | Kafka | RabbitMQ |
|---------|---------|-------|----------|
| Pub/Sub | ✅ | ✅ Topics | ✅ Exchanges |
| Streams | ✅ | ✅ | ✅ Streams |
| Consumer Groups | ✅ | ✅ | ✅ |
| Message Ordering | Per-key | Per-partition | Per-queue |
| Retention | Configurable | Configurable | Limited |
| Replay | ✅ | ✅ | Limited |
| Throughput | High | Very High | High |
| Exactly-once | ❌ | ✅ | ❌ |

### Messaging Operations

**Ferrite:**
```bash
# Pub/Sub
PUBLISH channel:orders '{"order_id": 123}'
SUBSCRIBE channel:orders

# Streams with consumer groups
XADD orders * order_id 123 status pending
XGROUP CREATE orders processors $ MKSTREAM
XREADGROUP GROUP processors worker-1 COUNT 10 STREAMS orders >
XACK orders processors 1234567890-0
```

**Kafka:**
```java
// Producer
producer.send(new ProducerRecord<>("orders",
    "123", "{\"order_id\": 123}"));

// Consumer with group
consumer.subscribe(Collections.singletonList("orders"));
while (true) {
    ConsumerRecords<String, String> records = consumer.poll(100);
    for (ConsumerRecord<String, String> record : records) {
        process(record);
    }
    consumer.commitSync();
}
```

### When to Choose

**Choose Ferrite when:**
- Messaging is secondary to other needs
- Simple pub/sub or streams sufficient
- Integrated with caching/data
- Lower infrastructure complexity

**Choose Kafka when:**
- High-throughput event streaming (millions/sec)
- Event sourcing architecture
- Cross-datacenter replication
- Exactly-once semantics required
- Long-term event retention

**Choose RabbitMQ when:**
- Complex routing patterns
- Multiple protocols (AMQP, MQTT, STOMP)
- Traditional message queue semantics
- Request-reply patterns

## Summary: When Multi-Model Works

### Ferrite Excels When:

1. **Multiple data models needed**: Rather than 5 databases, use 1

2. **Low latency required**: Sub-millisecond across all models

3. **Operational simplicity**: Single system to manage

4. **Data locality**: Related data in same system

5. **Cost optimization**: One cluster vs multiple services

### Use Dedicated Databases When:

1. **Deep specialization needed**: Complex graph algorithms, ML pipelines

2. **Massive scale**: Billions of documents/vectors/events

3. **Managed services preferred**: Operational overhead concerns

4. **Advanced features required**: Features beyond Ferrite's scope

5. **Regulatory requirements**: Specific certifications needed

## Architecture Patterns

### Hybrid Architecture

Use Ferrite for primary workloads, specialized databases for advanced needs:

```
┌─────────────────────────────────────────────────┐
│                   Application                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │              Ferrite                   │     │
│  │  - Caching                            │     │
│  │  - Sessions                           │     │
│  │  - Real-time data                     │     │
│  │  - Basic documents/graphs/vectors     │     │
│  └───────────────────────────────────────┘     │
│                    │                            │
│          CDC/Sync  │                            │
│                    ▼                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Neo4j   │  │Elastic  │  │ Kafka   │        │
│  │ Complex │  │ Full    │  │ Event   │        │
│  │ Graphs  │  │ Search  │  │ Stream  │        │
│  └─────────┘  └─────────┘  └─────────┘        │
│                                                 │
└─────────────────────────────────────────────────┘
```

### All-in-One Architecture

Use Ferrite for everything when requirements fit:

```
┌─────────────────────────────────────────────────┐
│                   Application                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │              Ferrite                   │     │
│  │                                        │     │
│  │  ┌─────────┐  ┌─────────┐            │     │
│  │  │ Cache   │  │Documents│            │     │
│  │  └─────────┘  └─────────┘            │     │
│  │  ┌─────────┐  ┌─────────┐            │     │
│  │  │ Vectors │  │ Graphs  │            │     │
│  │  └─────────┘  └─────────┘            │     │
│  │  ┌─────────┐  ┌─────────┐            │     │
│  │  │TimeSeries│ │ Search  │            │     │
│  │  └─────────┘  └─────────┘            │     │
│  │  ┌─────────┐  ┌─────────┐            │     │
│  │  │ Streams │  │ Pub/Sub │            │     │
│  │  └─────────┘  └─────────┘            │     │
│  │                                        │     │
│  └───────────────────────────────────────┘     │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Related Resources

- [Ferrite vs Redis](/docs/comparisons/vs-redis)
- [Document Store Guide](/docs/data-models/document-store)
- [Graph Database Guide](/docs/data-models/graph-database)
- [Vector Search Guide](/docs/ai-ml/vector-indexes)
- [Time-Series Guide](/docs/data-models/time-series)
