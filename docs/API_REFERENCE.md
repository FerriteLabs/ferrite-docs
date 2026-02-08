# Ferrite API Reference

This document provides a comprehensive reference for Ferrite's public API, including commands, embedded mode APIs, and advanced features.

> Note: The public surface includes core, beta, and experimental modules. See
> `src/lib.rs` for the current maturity grouping; experimental APIs may change
> without notice.

## API Stability & Versioning

- **Stable**: Core Redis compatibility and foundational modules. Breaking changes
  are avoided whenever possible.
- **Beta**: Feature-complete but still evolving; minor breaking changes may occur
  between releases.
- **Experimental**: Under active development; expect breaking changes at any time.

Ferrite follows semantic versioning after 1.0. Until then, `0.x` releases may
include breaking changes, especially in beta/experimental modules.

## Table of Contents

1. [Core Redis Commands](#core-redis-commands)
2. [Embedded Mode API](#embedded-mode-api)
3. [Vector Search API](#vector-search-api)
4. [Semantic Caching API](#semantic-caching-api)
5. [FerriteQL Query API](#ferriteql-query-api)
6. [Time-Travel API](#time-travel-api)
7. [CDC API](#cdc-api)
8. [CRDT API](#crdt-api)
9. [Graph API](#graph-api)
10. [Document Store API](#document-store-api)
11. [Time-Series API](#time-series-api)
12. [Stream Processing API](#stream-processing-api)
13. [Triggers API](#triggers-api)
14. [Multi-Tenancy API](#multi-tenancy-api)
15. [RAG Pipeline API](#rag-pipeline-api)
16. [Conversation Memory API](#conversation-memory-api)
17. [Policy Engine API](#policy-engine-api)
18. [Auto-Index API](#auto-index-api)
19. [Inference API](#inference-api)

---

## Core Redis Commands

Ferrite implements full Redis command compatibility via the RESP protocol.

### String Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `GET` | `GET key` | Get the value of a key |
| `SET` | `SET key value [EX seconds] [PX ms] [NX\|XX]` | Set a key with optional expiry |
| `MGET` | `MGET key [key ...]` | Get multiple keys atomically |
| `MSET` | `MSET key value [key value ...]` | Set multiple keys atomically |
| `INCR` | `INCR key` | Increment integer value by 1 |
| `INCRBY` | `INCRBY key increment` | Increment by specific amount |
| `INCRBYFLOAT` | `INCRBYFLOAT key increment` | Increment float value |
| `DECR` | `DECR key` | Decrement integer value by 1 |
| `DECRBY` | `DECRBY key decrement` | Decrement by specific amount |
| `APPEND` | `APPEND key value` | Append to string value |
| `STRLEN` | `STRLEN key` | Get string length |
| `GETRANGE` | `GETRANGE key start end` | Get substring |
| `SETRANGE` | `SETRANGE key offset value` | Overwrite part of string |
| `SETNX` | `SETNX key value` | Set only if not exists |
| `SETEX` | `SETEX key seconds value` | Set with expiry in seconds |
| `PSETEX` | `PSETEX key milliseconds value` | Set with expiry in milliseconds |
| `GETSET` | `GETSET key value` | Set new value and return old |
| `GETEX` | `GETEX key [EX\|PX\|EXAT\|PXAT] [PERSIST]` | Get and optionally set expiry |
| `GETDEL` | `GETDEL key` | Get and delete |

### List Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `LPUSH` | `LPUSH key element [element ...]` | Push to head of list |
| `RPUSH` | `RPUSH key element [element ...]` | Push to tail of list |
| `LPOP` | `LPOP key [count]` | Pop from head |
| `RPOP` | `RPOP key [count]` | Pop from tail |
| `LRANGE` | `LRANGE key start stop` | Get range of elements |
| `LLEN` | `LLEN key` | Get list length |
| `LINDEX` | `LINDEX key index` | Get element by index |
| `LSET` | `LSET key index element` | Set element at index |
| `LREM` | `LREM key count element` | Remove elements |
| `LINSERT` | `LINSERT key BEFORE\|AFTER pivot element` | Insert element |
| `LTRIM` | `LTRIM key start stop` | Trim list to range |
| `BLPOP` | `BLPOP key [key ...] timeout` | Blocking pop from head |
| `BRPOP` | `BRPOP key [key ...] timeout` | Blocking pop from tail |
| `LPOS` | `LPOS key element [RANK rank] [COUNT count] [MAXLEN len]` | Find element position |
| `LMOVE` | `LMOVE source destination LEFT\|RIGHT LEFT\|RIGHT` | Move element between lists |

### Hash Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `HSET` | `HSET key field value [field value ...]` | Set hash fields |
| `HGET` | `HGET key field` | Get field value |
| `HMSET` | `HMSET key field value [field value ...]` | Set multiple fields |
| `HMGET` | `HMGET key field [field ...]` | Get multiple fields |
| `HDEL` | `HDEL key field [field ...]` | Delete fields |
| `HEXISTS` | `HEXISTS key field` | Check field existence |
| `HGETALL` | `HGETALL key` | Get all fields and values |
| `HKEYS` | `HKEYS key` | Get all field names |
| `HVALS` | `HVALS key` | Get all values |
| `HLEN` | `HLEN key` | Get number of fields |
| `HINCRBY` | `HINCRBY key field increment` | Increment field by integer |
| `HINCRBYFLOAT` | `HINCRBYFLOAT key field increment` | Increment field by float |
| `HSETNX` | `HSETNX key field value` | Set field only if not exists |
| `HSTRLEN` | `HSTRLEN key field` | Get field value length |
| `HSCAN` | `HSCAN key cursor [MATCH pattern] [COUNT count]` | Incrementally iterate |

### Set Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `SADD` | `SADD key member [member ...]` | Add members |
| `SREM` | `SREM key member [member ...]` | Remove members |
| `SMEMBERS` | `SMEMBERS key` | Get all members |
| `SISMEMBER` | `SISMEMBER key member` | Check membership |
| `SCARD` | `SCARD key` | Get set size |
| `SUNION` | `SUNION key [key ...]` | Union of sets |
| `SINTER` | `SINTER key [key ...]` | Intersection of sets |
| `SDIFF` | `SDIFF key [key ...]` | Difference of sets |
| `SUNIONSTORE` | `SUNIONSTORE destination key [key ...]` | Store union result |
| `SINTERSTORE` | `SINTERSTORE destination key [key ...]` | Store intersection result |
| `SDIFFSTORE` | `SDIFFSTORE destination key [key ...]` | Store difference result |
| `SPOP` | `SPOP key [count]` | Remove and return random members |
| `SRANDMEMBER` | `SRANDMEMBER key [count]` | Get random members |
| `SMOVE` | `SMOVE source destination member` | Move member between sets |
| `SSCAN` | `SSCAN key cursor [MATCH pattern] [COUNT count]` | Incrementally iterate |

### Sorted Set Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `ZADD` | `ZADD key [NX\|XX] [GT\|LT] [CH] [INCR] score member [score member ...]` | Add members with scores |
| `ZREM` | `ZREM key member [member ...]` | Remove members |
| `ZSCORE` | `ZSCORE key member` | Get member score |
| `ZCARD` | `ZCARD key` | Get set size |
| `ZCOUNT` | `ZCOUNT key min max` | Count members in score range |
| `ZRANK` | `ZRANK key member` | Get member rank (0-based) |
| `ZREVRANK` | `ZREVRANK key member` | Get reverse rank |
| `ZRANGE` | `ZRANGE key start stop [BYSCORE\|BYLEX] [REV] [LIMIT offset count] [WITHSCORES]` | Get range |
| `ZRANGEBYSCORE` | `ZRANGEBYSCORE key min max [WITHSCORES] [LIMIT offset count]` | Get by score range |
| `ZINCRBY` | `ZINCRBY key increment member` | Increment member score |
| `ZUNIONSTORE` | `ZUNIONSTORE destination numkeys key [key ...] [WEIGHTS weight ...] [AGGREGATE SUM\|MIN\|MAX]` | Store union |
| `ZINTERSTORE` | `ZINTERSTORE destination numkeys key [key ...] [WEIGHTS weight ...] [AGGREGATE SUM\|MIN\|MAX]` | Store intersection |
| `ZPOPMIN` | `ZPOPMIN key [count]` | Pop lowest scoring members |
| `ZPOPMAX` | `ZPOPMAX key [count]` | Pop highest scoring members |
| `BZPOPMIN` | `BZPOPMIN key [key ...] timeout` | Blocking pop min |
| `BZPOPMAX` | `BZPOPMAX key [key ...] timeout` | Blocking pop max |
| `ZSCAN` | `ZSCAN key cursor [MATCH pattern] [COUNT count]` | Incrementally iterate |

### Key Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `DEL` | `DEL key [key ...]` | Delete keys |
| `EXISTS` | `EXISTS key [key ...]` | Check key existence |
| `EXPIRE` | `EXPIRE key seconds [NX\|XX\|GT\|LT]` | Set TTL in seconds |
| `PEXPIRE` | `PEXPIRE key milliseconds [NX\|XX\|GT\|LT]` | Set TTL in milliseconds |
| `EXPIREAT` | `EXPIREAT key timestamp [NX\|XX\|GT\|LT]` | Set expiry timestamp |
| `PEXPIREAT` | `PEXPIREAT key ms-timestamp [NX\|XX\|GT\|LT]` | Set expiry ms timestamp |
| `TTL` | `TTL key` | Get TTL in seconds |
| `PTTL` | `PTTL key` | Get TTL in milliseconds |
| `PERSIST` | `PERSIST key` | Remove expiry |
| `KEYS` | `KEYS pattern` | Find keys by pattern |
| `SCAN` | `SCAN cursor [MATCH pattern] [COUNT count] [TYPE type]` | Incrementally iterate keys |
| `TYPE` | `TYPE key` | Get key type |
| `RENAME` | `RENAME key newkey` | Rename key |
| `RENAMENX` | `RENAMENX key newkey` | Rename if new key doesn't exist |
| `TOUCH` | `TOUCH key [key ...]` | Update last access time |
| `UNLINK` | `UNLINK key [key ...]` | Async delete |
| `OBJECT` | `OBJECT ENCODING\|FREQ\|IDLETIME\|REFCOUNT key` | Inspect key internals |

### Server Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `PING` | `PING [message]` | Test connectivity |
| `ECHO` | `ECHO message` | Echo message |
| `INFO` | `INFO [section]` | Get server info |
| `SELECT` | `SELECT index` | Switch database |
| `DBSIZE` | `DBSIZE` | Get key count |
| `FLUSHDB` | `FLUSHDB [ASYNC\|SYNC]` | Clear current database |
| `FLUSHALL` | `FLUSHALL [ASYNC\|SYNC]` | Clear all databases |
| `CONFIG` | `CONFIG GET\|SET\|REWRITE parameter [value]` | Manage configuration |
| `CLIENT` | `CLIENT ID\|INFO\|LIST\|KILL\|SETNAME\|GETNAME` | Manage connections |
| `DEBUG` | `DEBUG SLEEP seconds` | Debug commands |
| `SHUTDOWN` | `SHUTDOWN [NOSAVE\|SAVE]` | Shutdown server |
| `BGSAVE` | `BGSAVE` | Background save |
| `LASTSAVE` | `LASTSAVE` | Last save timestamp |

### Transaction Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `MULTI` | `MULTI` | Start transaction |
| `EXEC` | `EXEC` | Execute transaction |
| `DISCARD` | `DISCARD` | Discard transaction |
| `WATCH` | `WATCH key [key ...]` | Watch keys for changes |
| `UNWATCH` | `UNWATCH` | Unwatch all keys |

### Pub/Sub Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `SUBSCRIBE` | `SUBSCRIBE channel [channel ...]` | Subscribe to channels |
| `UNSUBSCRIBE` | `UNSUBSCRIBE [channel [channel ...]]` | Unsubscribe |
| `PSUBSCRIBE` | `PSUBSCRIBE pattern [pattern ...]` | Pattern subscribe |
| `PUNSUBSCRIBE` | `PUNSUBSCRIBE [pattern [pattern ...]]` | Pattern unsubscribe |
| `PUBLISH` | `PUBLISH channel message` | Publish message |
| `PUBSUB` | `PUBSUB CHANNELS\|NUMSUB\|NUMPAT [argument ...]` | Pub/Sub introspection |

### Scripting Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `EVAL` | `EVAL script numkeys key [key ...] arg [arg ...]` | Execute Lua script |
| `EVALSHA` | `EVALSHA sha1 numkeys key [key ...] arg [arg ...]` | Execute cached script |
| `SCRIPT` | `SCRIPT LOAD\|EXISTS\|FLUSH\|KILL script\|sha1` | Script management |

### Stream Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `XADD` | `XADD key [NOMKSTREAM] [MAXLEN\|MINID [=\|~] threshold] [LIMIT count] * field value [field value ...]` | Add to stream |
| `XREAD` | `XREAD [COUNT count] [BLOCK ms] STREAMS key [key ...] id [id ...]` | Read from stream |
| `XRANGE` | `XRANGE key start end [COUNT count]` | Range query |
| `XLEN` | `XLEN key` | Get stream length |
| `XGROUP` | `XGROUP CREATE\|DESTROY\|SETID\|DELCONSUMER key groupname [id\|$] [MKSTREAM]` | Consumer groups |
| `XREADGROUP` | `XREADGROUP GROUP group consumer [COUNT count] [BLOCK ms] [NOACK] STREAMS key [key ...] id [id ...]` | Consumer group read |
| `XACK` | `XACK key group id [id ...]` | Acknowledge messages |
| `XPENDING` | `XPENDING key group [start end count] [consumer]` | Pending entries |
| `XCLAIM` | `XCLAIM key group consumer min-idle-time id [id ...]` | Claim pending messages |

### HyperLogLog Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `PFADD` | `PFADD key element [element ...]` | Add elements |
| `PFCOUNT` | `PFCOUNT key [key ...]` | Get cardinality estimate |
| `PFMERGE` | `PFMERGE destkey sourcekey [sourcekey ...]` | Merge HyperLogLogs |

### Geo Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `GEOADD` | `GEOADD key [NX\|XX] [CH] longitude latitude member [...]` | Add locations |
| `GEODIST` | `GEODIST key member1 member2 [m\|km\|ft\|mi]` | Distance between members |
| `GEOPOS` | `GEOPOS key member [member ...]` | Get positions |
| `GEOSEARCH` | `GEOSEARCH key FROMMEMBER member\|FROMLONLAT lon lat BYRADIUS radius m\|km\|...\|BYBOX width height m\|km\|...` | Search by location |
| `GEORADIUS` | `GEORADIUS key longitude latitude radius m\|km\|... [WITHCOORD] [WITHDIST] [WITHHASH] [COUNT count]` | Query by radius |

---

## Embedded Mode API

Use Ferrite as a library without a network server.

### Database Operations

```rust
use ferrite::embedded::{Database, Config};

// Open database with default config
let db = Database::open("./data")?;

// Open with custom config
let config = Config::builder()
    .max_memory(8 * 1024 * 1024 * 1024)  // 8GB
    .enable_persistence(true)
    .build();
let db = Database::open_with_config("./data", config)?;

// Basic operations
db.set("key", "value")?;
let value = db.get("key")?;
db.del(&["key1", "key2"])?;

// With expiry
db.set_ex("temp", "value", 3600)?;  // Expires in 1 hour

// Atomic operations
db.incr("counter")?;
db.incrby("counter", 10)?;

// Lists
db.lpush("list", &["a", "b", "c"])?;
let items = db.lrange("list", 0, -1)?;
let item = db.rpop("list")?;

// Hashes
db.hset("hash", "field", "value")?;
db.hmset("hash", &[("f1", "v1"), ("f2", "v2")])?;
let val = db.hget("hash", "field")?;
let all = db.hgetall("hash")?;

// Sets
db.sadd("set", &["a", "b", "c"])?;
let members = db.smembers("set")?;
let is_member = db.sismember("set", "a")?;

// Sorted sets
db.zadd("zset", &[("a", 1.0), ("b", 2.0)])?;
let top = db.zrange("zset", 0, 9)?;
let score = db.zscore("zset", "a")?;

// Transactions
let tx = db.transaction();
tx.set("key1", "value1")?;
tx.incr("counter")?;
let results = tx.commit()?;

// Close gracefully
db.close()?;
```

### Configuration Options

```rust
use ferrite::embedded::Config;

let config = Config::builder()
    // Memory settings
    .max_memory(8 * 1024 * 1024 * 1024)  // 8GB
    .eviction_policy(EvictionPolicy::Lru)

    // Persistence
    .enable_persistence(true)
    .aof_sync(AofSync::EverySec)
    .checkpoint_interval(Duration::from_secs(300))

    // Features
    .enable_time_travel(true)
    .time_travel_retention(Duration::from_secs(86400 * 7))  // 7 days
    .enable_cdc(true)

    // Performance
    .read_cache_size(1024 * 1024 * 1024)  // 1GB
    .write_buffer_size(64 * 1024 * 1024)   // 64MB

    .build();
```

---

## Vector Search API

Native vector similarity search for AI/ML workloads.

### Via RESP Protocol

```bash
# Create index
VECTOR.CREATE myindex DIM 384 DISTANCE cosine [TYPE hnsw] [M 16] [EF_CONSTRUCTION 200]

# Add vector
VECTOR.ADD myindex doc1 [0.1, 0.2, 0.3, ...] [METADATA '{"title": "Hello"}']

# Search
VECTOR.SEARCH myindex [0.1, 0.2, ...] TOP 10 [FILTER '$.category == "tech"']

# Delete vector
VECTOR.DELETE myindex doc1

# Get vector
VECTOR.GET myindex doc1

# Index info
VECTOR.INFO myindex
```

### Via Embedded API

```rust
use ferrite::vector::{IndexType, DistanceMetric, VectorIndex};

// Create index
db.vector_create_index(
    "embeddings",
    384,  // dimensions
    IndexType::Hnsw { m: 16, ef_construction: 200 },
    DistanceMetric::Cosine,
)?;

// Add vectors
let embedding = vec![0.1, 0.2, 0.3, /* ... 384 dims */];
db.vector_add(
    "embeddings",
    "doc:1",
    &embedding,
    Some(r#"{"title": "Hello", "category": "greeting"}"#),
)?;

// Batch add
let vectors = vec![
    ("doc:1", vec![0.1, 0.2, ...], Some(metadata1)),
    ("doc:2", vec![0.2, 0.3, ...], Some(metadata2)),
];
db.vector_add_batch("embeddings", vectors)?;

// Search
let query = vec![0.15, 0.22, ...];
let results = db.vector_search("embeddings", &query, 10, None)?;

// Search with filter
let filter = r#"$.category == "greeting""#;
let results = db.vector_search("embeddings", &query, 10, Some(filter))?;

for result in results {
    println!("ID: {}, Score: {:.4}, Metadata: {:?}",
        result.id, result.score, result.metadata);
}

// Delete vector
db.vector_delete("embeddings", "doc:1")?;

// Get index info
let info = db.vector_info("embeddings")?;
println!("Vectors: {}, Dimensions: {}", info.count, info.dimensions);
```

### Index Types

| Type | Best For | Time Complexity | Space | Recall |
|------|----------|-----------------|-------|--------|
| `Hnsw` | General purpose, balanced | O(log n) | Medium | ~98% |
| `Ivf` | Large datasets | O(√n) | Low | ~95% |
| `Flat` | Small datasets, exact search | O(n) | Low | 100% |

### Distance Metrics

| Metric | Use Case | Formula |
|--------|----------|---------|
| `Cosine` | Text embeddings | 1 - cos(a, b) |
| `Euclidean` | Spatial data | √Σ(aᵢ - bᵢ)² |
| `DotProduct` | Normalized vectors | -Σ(aᵢ × bᵢ) |
| `Manhattan` | Grid-based | Σ\|aᵢ - bᵢ\| |

---

## Semantic Caching API

Cache LLM responses by semantic similarity.

### Via RESP Protocol

```bash
# Set with semantic key
SEMANTIC.SET "What is the capital of France?" "Paris is the capital of France." [TTL 3600]

# Get with similarity threshold
SEMANTIC.GET "France's capital city?" 0.85

# Delete
SEMANTIC.DELETE "What is the capital of France?"

# Stats
SEMANTIC.STATS
```

### Via Embedded API

```rust
use ferrite::semantic::{SemanticCache, EmbeddingProvider};

// Create with local ONNX embeddings (no API calls)
let cache = SemanticCache::new(&db, EmbeddingProvider::Onnx {
    model_path: "./models/all-MiniLM-L6-v2.onnx".into(),
})?;

// Or with OpenAI
let cache = SemanticCache::new(&db, EmbeddingProvider::OpenAi {
    api_key: std::env::var("OPENAI_API_KEY")?,
    model: "text-embedding-3-small".into(),
})?;

// Cache a response
cache.set(
    "What is the capital of France?",
    "Paris is the capital of France.",
    Some(Duration::from_secs(3600)),  // Optional TTL
).await?;

// Query with similarity threshold
let response = cache.get("France's capital city?", 0.85).await?;
// Returns: Some("Paris is the capital of France.")

// Get with metadata
let result = cache.get_with_metadata("France capital", 0.85).await?;
if let Some(hit) = result {
    println!("Response: {}", hit.value);
    println!("Similarity: {:.2}", hit.similarity);
    println!("Original query: {}", hit.original_query);
}

// Delete entry
cache.delete("What is the capital of France?").await?;

// Get statistics
let stats = cache.stats()?;
println!("Entries: {}, Hit rate: {:.2}%", stats.entries, stats.hit_rate * 100.0);
```

---

## FerriteQL Query API

SQL-like queries across key-value data.

### Via RESP Protocol

```bash
# Simple query
QUERY "SELECT * FROM users:* WHERE $.active = true LIMIT 10"

# Join query
QUERY "SELECT users.name, COUNT(orders.*) FROM users:* JOIN orders:* ON orders.user_id = users.id GROUP BY users.id"

# Create view
QUERY "CREATE VIEW active_users AS SELECT * FROM users:* WHERE $.active = true MATERIALIZE EVERY 5s"

# Query view
QUERY "SELECT * FROM VIEW active_users"
```

### Via Embedded API

```rust
use ferrite::query::{Query, QueryResult};

// Simple query
let results = db.query(r#"
    SELECT * FROM users:*
    WHERE $.active = true
    ORDER BY $.created_at DESC
    LIMIT 10
"#)?;

for row in results {
    println!("Key: {}, Value: {:?}", row.key, row.value);
}

// Join across patterns
let results = db.query(r#"
    SELECT
        users.name,
        users.email,
        COUNT(orders.*) as order_count,
        SUM(orders.total) as total_spent
    FROM users:* AS users
    JOIN orders:* AS orders ON orders.user_id = users.id
    WHERE users.active = true
    GROUP BY users.id
    HAVING order_count > 5
    ORDER BY total_spent DESC
    LIMIT 100
"#)?;

// Create materialized view
db.query(r#"
    CREATE VIEW user_stats AS
    SELECT
        users.id,
        users.name,
        COUNT(orders.*) as orders,
        AVG(orders.total) as avg_order
    FROM users:* AS users
    LEFT JOIN orders:* AS orders ON orders.user_id = users.id
    GROUP BY users.id
    MATERIALIZE EVERY 1m
"#)?;

// Query from view (fast, pre-computed)
let stats = db.query("SELECT * FROM VIEW user_stats WHERE orders > 10")?;

// Parameterized queries
let results = db.query_with_params(
    "SELECT * FROM users:* WHERE $.email = $1",
    &["alice@example.com"],
)?;
```

### FerriteQL Syntax

```sql
-- Basic SELECT
SELECT field1, field2 FROM pattern:* WHERE condition

-- Supported operators
$.field = value          -- Equality
$.field != value         -- Inequality
$.field > value          -- Greater than
$.field >= value         -- Greater than or equal
$.field < value          -- Less than
$.field <= value         -- Less than or equal
$.field LIKE '%pattern%' -- Pattern matching
$.field IN (v1, v2)      -- In list
$.field IS NULL          -- Null check
$.field IS NOT NULL      -- Not null check

-- Logical operators
condition AND condition
condition OR condition
NOT condition

-- Aggregations
COUNT(*), COUNT(field)
SUM(field), AVG(field)
MIN(field), MAX(field)

-- Joins
JOIN pattern:* ON condition
LEFT JOIN pattern:* ON condition

-- Grouping
GROUP BY field1, field2
HAVING aggregate_condition

-- Ordering
ORDER BY field ASC|DESC

-- Limiting
LIMIT count OFFSET start
```

---

## Time-Travel API

Query historical data at any point in time.

### Via RESP Protocol

```bash
# Get value at specific time
GET mykey AS OF -1h
GET mykey AS OF "2024-01-01T12:00:00Z"

# Get history
HISTORY mykey SINCE -24h
HISTORY mykey FROM "2024-01-01" TO "2024-01-02"
```

### Via Embedded API

```rust
use ferrite::temporal::{TimeSpec, HistoryEntry};
use std::time::Duration;

// Get value from 1 hour ago
let past = db.get_as_of("user:1:status", TimeSpec::Ago(Duration::from_secs(3600)))?;

// Get value at specific timestamp
let past = db.get_as_of("user:1:status", TimeSpec::At(timestamp))?;

// Get full history since a time
let history = db.history("user:1:status", TimeSpec::Ago(Duration::from_secs(86400)))?;
for entry in history {
    println!("At {}: {} (op: {:?})",
        entry.timestamp,
        entry.value.unwrap_or_default(),
        entry.operation
    );
}

// History with range
let history = db.history_range(
    "user:1:status",
    TimeSpec::At(start_timestamp),
    TimeSpec::At(end_timestamp),
)?;

// Check if key existed at time
let existed = db.existed_at("user:1:status", TimeSpec::Ago(Duration::from_secs(3600)))?;
```

---

## CDC API

Real-time change data capture and event streaming.

### Via RESP Protocol

```bash
# Subscribe to changes
CDC.SUBSCRIBE users:* [FORMAT json] [SINCE offset]

# List subscriptions
CDC.SUBSCRIPTIONS

# Unsubscribe
CDC.UNSUBSCRIBE subscription_id

# Get events
CDC.EVENTS subscription_id [COUNT 100]
```

### Via Embedded API

```rust
use ferrite::cdc::{CdcSubscription, EventFilter, Operation};

// Subscribe to key pattern
let mut subscription = db.cdc_subscribe(EventFilter::Pattern("users:*"))?;

// Process events
while let Some(event) = subscription.next().await {
    println!("Operation: {:?}", event.operation);
    println!("Key: {}", event.key);
    println!("Value: {:?}", event.value);
    println!("Timestamp: {}", event.timestamp);
    println!("Sequence: {}", event.sequence);

    match event.operation {
        Operation::Set => {
            // Handle insert/update
            forward_to_kafka(&event).await?;
        }
        Operation::Delete => {
            // Handle delete
            forward_to_kafka(&event).await?;
        }
        _ => {}
    }
}

// Subscribe with options
let subscription = db.cdc_subscribe_with_options(CdcOptions {
    filter: EventFilter::Pattern("orders:*"),
    since: Some(last_offset),  // Resume from offset
    include_value: true,
    batch_size: 100,
})?;

// Get current offset (for resume)
let offset = subscription.current_offset();
```

---

## CRDT API

Conflict-free replicated data types for geo-distribution.

### Via RESP Protocol

```bash
# G-Counter (grow-only)
CRDT.GCOUNTER mycounter INCR 5
CRDT.GCOUNTER mycounter GET

# PN-Counter (positive-negative)
CRDT.PNCOUNTER balance INCR 100
CRDT.PNCOUNTER balance DECR 25
CRDT.PNCOUNTER balance GET

# OR-Set
CRDT.ORSET tags ADD "rust"
CRDT.ORSET tags ADD "database"
CRDT.ORSET tags REMOVE "rust"
CRDT.ORSET tags MEMBERS

# LWW-Register
CRDT.LWWREGISTER config SET '{"theme": "dark"}'
CRDT.LWWREGISTER config GET
```

### Via Embedded API

```rust
use ferrite::crdt::{GCounter, PnCounter, OrSet, LwwRegister};

// G-Counter (grow-only, always converges up)
db.crdt_gcounter_incr("page_views", 1)?;
db.crdt_gcounter_incr("page_views", 5)?;
let views = db.crdt_gcounter_get("page_views")?;  // 6

// PN-Counter (positive-negative)
db.crdt_pncounter_incr("balance", 100)?;
db.crdt_pncounter_decr("balance", 25)?;
let balance = db.crdt_pncounter_get("balance")?;  // 75

// OR-Set (add/remove with concurrent safety)
db.crdt_orset_add("tags", "rust")?;
db.crdt_orset_add("tags", "database")?;
db.crdt_orset_remove("tags", "rust")?;
let tags = db.crdt_orset_members("tags")?;  // ["database"]
let has = db.crdt_orset_contains("tags", "database")?;  // true

// LWW-Register (last-writer-wins)
db.crdt_lww_set("config", r#"{"theme": "dark"}"#)?;
let config = db.crdt_lww_get("config")?;

// Manual merge (for custom replication)
let local = db.crdt_gcounter_state("views")?;
let remote = receive_from_replica();
let merged = local.merge(&remote);
db.crdt_gcounter_set_state("views", merged)?;
```

---

## Graph API

Property graph with traversals and algorithms.

### Via RESP Protocol

```bash
# Add vertex
GRAPH.ADD_VERTEX user:1 LABELS Person PROPS '{"name": "Alice", "age": 30}'

# Add edge
GRAPH.ADD_EDGE user:1 user:2 LABEL FOLLOWS PROPS '{"since": 2020}'

# Traverse
GRAPH.TRAVERSE user:1 OUT FOLLOWS DEPTH 2

# Query
GRAPH.QUERY "MATCH (a:Person)-[:FOLLOWS]->(b:Person) WHERE a.name = 'Alice' RETURN b"

# Algorithms
GRAPH.PAGERANK
GRAPH.SHORTEST_PATH user:1 user:100
```

### Via Embedded API

```rust
use ferrite::graph::{Graph, Vertex, Edge, Traversal};

// Add vertices
db.graph_add_vertex(
    "user:1",
    &["Person"],
    json!({"name": "Alice", "age": 30}),
)?;

db.graph_add_vertex(
    "user:2",
    &["Person"],
    json!({"name": "Bob", "age": 25}),
)?;

// Add edge
db.graph_add_edge(
    "user:1",
    "user:2",
    "FOLLOWS",
    Some(json!({"since": 2020})),
)?;

// Simple traversal
let followers = db.graph_traverse("user:1")
    .out("FOLLOWS")
    .collect()?;

// Multi-hop traversal with filters
let friends_of_friends = db.graph_traverse("user:1")
    .out("FOLLOWS")
    .out("FOLLOWS")
    .filter(|v| v.get("age").map(|a| a > 21).unwrap_or(false))
    .limit(10)
    .collect()?;

// Shortest path
let path = db.graph_shortest_path("user:1", "user:100")?;
for vertex in path {
    println!("-> {}", vertex.id);
}

// PageRank
let ranks = db.graph_pagerank(PageRankConfig {
    damping: 0.85,
    iterations: 20,
    tolerance: 0.0001,
})?;

for (id, rank) in ranks.iter().take(10) {
    println!("{}: {:.4}", id, rank);
}

// Pattern matching (Cypher-like)
let results = db.graph_query(r#"
    MATCH (a:Person)-[:FOLLOWS]->(b:Person)-[:FOLLOWS]->(c:Person)
    WHERE a.name = 'Alice' AND c.age > 25
    RETURN c.name, c.age
"#)?;
```

---

## Document Store API

MongoDB-compatible JSON document operations.

### Via RESP Protocol

```bash
# Insert document
DOC.INSERT users '{"name": "Alice", "email": "alice@example.com", "age": 30}'

# Find documents
DOC.FIND users '{"age": {"$gt": 25}}'

# Update
DOC.UPDATE users '{"name": "Alice"}' '{"$set": {"age": 31}}'

# Delete
DOC.DELETE users '{"name": "Alice"}'

# Aggregate
DOC.AGGREGATE users '[{"$match": {"active": true}}, {"$group": {"_id": "$city", "count": {"$sum": 1}}}]'
```

### Via Embedded API

```rust
use ferrite::document::{Collection, Document, Query};
use serde_json::json;

// Create/get collection
let users = db.collection("users");

// Insert document
let id = users.insert_one(json!({
    "name": "Alice",
    "email": "alice@example.com",
    "age": 30,
    "tags": ["developer", "rust"]
}))?;

// Insert many
users.insert_many(&[
    json!({"name": "Bob", "age": 25}),
    json!({"name": "Charlie", "age": 35}),
])?;

// Find with query
let results = users.find(json!({
    "age": {"$gt": 25},
    "tags": {"$in": ["developer"]}
}))?;

for doc in results {
    println!("{}: {}", doc["_id"], doc["name"]);
}

// Find one
let alice = users.find_one(json!({"name": "Alice"}))?;

// Update
users.update_one(
    json!({"name": "Alice"}),
    json!({"$set": {"age": 31}, "$push": {"tags": "senior"}}),
)?;

// Update many
users.update_many(
    json!({"age": {"$lt": 30}}),
    json!({"$set": {"category": "young"}}),
)?;

// Delete
users.delete_one(json!({"name": "Alice"}))?;
users.delete_many(json!({"age": {"$lt": 25}}))?;

// Aggregation pipeline
let pipeline = users.aggregate()
    .match_query(json!({"active": true}))
    .group("$city", vec![
        ("count", Accumulator::Sum(1)),
        ("avg_age", Accumulator::Avg("$age")),
    ])
    .sort("count", -1)
    .limit(10)
    .execute()?;

// Create index
users.create_index("email", IndexOptions {
    unique: true,
    sparse: false,
})?;
```

---

## Time-Series API

Optimized storage for timestamped data.

### Via RESP Protocol

```bash
# Add sample
TS.ADD cpu_usage 1704067200000 85.5 LABELS host=server1 region=us-east

# Range query
TS.RANGE cpu_usage 1704067200000 1704153600000 AGGREGATION avg 60000

# Get latest
TS.GET cpu_usage

# Create rule (downsampling)
TS.CREATERULE cpu_usage cpu_usage_hourly AGGREGATION avg 3600000
```

### Via Embedded API

```rust
use ferrite::timeseries::{TimeSeriesStorage, Sample, Labels, Aggregation};

// Create storage
let ts = db.timeseries();

// Write samples
let labels = Labels::new()
    .add("__name__", "http_requests_total")
    .add("method", "GET")
    .add("status", "200");

ts.write(Sample::new(labels.clone(), timestamp, 42.0))?;

// Write batch
ts.write_batch(&[
    Sample::new(labels.clone(), t1, 10.0),
    Sample::new(labels.clone(), t2, 15.0),
    Sample::new(labels.clone(), t3, 20.0),
])?;

// Query range
let results = ts.query_range(
    "http_requests_total",
    start_time,
    end_time,
)?;

// Query with aggregation
let results = ts.query_builder("http_requests_total")
    .label_match("method", "GET")
    .range(start, end)
    .step(Duration::from_secs(60))
    .aggregation(Aggregation::Avg)
    .execute()?;

for point in results {
    println!("Time: {}, Value: {}", point.timestamp, point.value);
}

// Create retention policy
ts.create_retention_policy("cpu_usage", RetentionPolicy {
    raw_retention: Duration::from_secs(86400 * 7),      // 7 days raw
    downsampled_retention: Duration::from_secs(86400 * 365),  // 1 year downsampled
    downsample_interval: Duration::from_secs(3600),  // 1 hour buckets
})?;
```

---

## Stream Processing API

Real-time event processing with windowing.

### Via Embedded API

```rust
use ferrite::streaming::{StreamBuilder, WindowType, Source, Sink};
use std::time::Duration;

// Build pipeline
let pipeline = StreamBuilder::new("click-analytics")
    // Source from Redis stream
    .source(RedisSource::new("clicks"))

    // Filter
    .filter(|event| event.get_str("type") == Some("click"))

    // Transform
    .map(|event| StreamEvent::new(
        event.get("page").cloned(),
        event.value,
    ))

    // Window (1 minute tumbling)
    .window(WindowType::Tumbling(Duration::from_secs(60)))

    // Aggregate
    .aggregate(|acc: &mut i64, _event| *acc += 1)

    // Output
    .sink(RedisSink::new("click-counts"))
    .build();

// Start processing
pipeline.start().await?;

// Session windows
let pipeline = StreamBuilder::new("user-sessions")
    .source(source)
    .key_by(|e| e.get_str("user_id").unwrap().to_string())
    .window(WindowType::Session {
        gap: Duration::from_secs(300),  // 5 min inactivity ends session
        max_duration: Duration::from_secs(3600),  // 1 hour max
    })
    .aggregate(SessionAggregator::new())
    .sink(sink)
    .build();

// Sliding window
let pipeline = StreamBuilder::new("moving-avg")
    .source(source)
    .window(WindowType::Sliding {
        size: Duration::from_secs(300),
        slide: Duration::from_secs(60),
    })
    .aggregate(|acc: &mut f64, event| {
        // Calculate moving average
    })
    .sink(sink)
    .build();
```

---

## Triggers API

Event-driven functions on data mutations.

### Via RESP Protocol

```bash
# Create trigger
TRIGGER.CREATE order_notify ON SET orders:* DO
  PUBLISH order_events $KEY
  HTTP.POST "https://api.example.com/webhook" $VALUE
END

# List triggers
TRIGGER.LIST

# Delete trigger
TRIGGER.DELETE order_notify

# Enable/disable
TRIGGER.ENABLE order_notify
TRIGGER.DISABLE order_notify
```

### Via Embedded API

```rust
use ferrite::triggers::{Trigger, TriggerAction, TriggerTiming, TriggerEvent};

// Create trigger with multiple actions
db.trigger_create(Trigger {
    name: "order_notify".to_string(),
    pattern: "orders:*".to_string(),
    events: vec![TriggerEvent::Set, TriggerEvent::Delete],
    timing: TriggerTiming::After,
    actions: vec![
        TriggerAction::Publish {
            channel: "order_events".to_string(),
        },
        TriggerAction::HttpPost {
            url: "https://api.example.com/webhook".to_string(),
            headers: HashMap::new(),
        },
        TriggerAction::SetKey {
            key_template: "order_log:${KEY}:${TIMESTAMP}".to_string(),
            value_template: "${VALUE}".to_string(),
        },
    ],
    enabled: true,
})?;

// Trigger with WASM function
db.trigger_create(Trigger {
    name: "validate_user".to_string(),
    pattern: "users:*".to_string(),
    events: vec![TriggerEvent::Set],
    timing: TriggerTiming::Before,  // Runs before the operation
    actions: vec![
        TriggerAction::Wasm {
            module: "validate_user".to_string(),
            function: "validate".to_string(),
        },
    ],
    enabled: true,
})?;

// List triggers
let triggers = db.trigger_list()?;

// Delete trigger
db.trigger_delete("order_notify")?;

// Enable/disable
db.trigger_enable("validate_user")?;
db.trigger_disable("validate_user")?;
```

---

## Multi-Tenancy API

Tenant isolation with resource limits.

### Via RESP Protocol

```bash
# Create tenant
TENANT.CREATE acme TIER pro MEMORY 8gb KEYS 1000000 OPS 100000

# Switch to tenant context
TENANT.USE acme

# Get tenant stats
TENANT.STATS acme

# List tenants
TENANT.LIST

# Delete tenant
TENANT.DELETE acme
```

### Via Embedded API

```rust
use ferrite::tenancy::{Tenant, TenantTier, TenantStats};

// Create tenant
db.tenant_create(Tenant {
    id: "acme".to_string(),
    tier: TenantTier::Pro,
    max_memory: 8 * 1024 * 1024 * 1024,  // 8GB
    max_keys: 1_000_000,
    ops_per_second: 100_000,
    max_connections: 1000,
})?;

// Get tenant-scoped database
let tenant_db = db.use_tenant("acme")?;

// All operations are isolated
tenant_db.set("mykey", "myvalue")?;  // Stored as tenant:acme:mykey
let val = tenant_db.get("mykey")?;

// Check tenant stats
let stats = db.tenant_stats("acme")?;
println!("Memory: {} / {} bytes", stats.memory_used, stats.memory_limit);
println!("Keys: {} / {}", stats.key_count, stats.key_limit);
println!("Ops/sec: {}", stats.ops_per_second);

// Update tenant limits
db.tenant_update("acme", TenantUpdate {
    max_memory: Some(16 * 1024 * 1024 * 1024),
    ..Default::default()
})?;

// List all tenants
let tenants = db.tenant_list()?;

// Delete tenant (and all data)
db.tenant_delete("acme")?;
```

---

## RAG Pipeline API

Retrieval-Augmented Generation for AI applications.

### Via Embedded API

```rust
use ferrite::rag::{RagPipeline, ChunkingStrategy, RagConfig};

// Create RAG pipeline
let rag = RagPipeline::new(&db, RagConfig {
    embedding_provider: EmbeddingProvider::Onnx {
        model_path: "./models/all-MiniLM-L6-v2.onnx".into(),
    },
    chunking: ChunkingStrategy::Semantic {
        max_tokens: 512,
        overlap: 50,
    },
    vector_index: "rag_vectors".to_string(),
})?;

// Ingest documents
rag.ingest_document(Document {
    id: "doc1".to_string(),
    content: "Long document text here...".to_string(),
    metadata: json!({"source": "manual", "category": "technical"}),
})?;

// Batch ingest
rag.ingest_batch(&documents)?;

// Retrieve relevant chunks
let results = rag.retrieve("How do I configure authentication?", RetrieveOptions {
    top_k: 5,
    min_score: 0.7,
    filter: Some(json!({"category": "technical"})),
    rerank: true,
})?;

// Build context for LLM
let context = rag.build_context(&results, ContextOptions {
    max_tokens: 4000,
    include_metadata: true,
    citation_style: CitationStyle::Numbered,
})?;

// Full pipeline: retrieve + build context
let context = rag.query("How do I configure authentication?", QueryOptions {
    top_k: 5,
    max_context_tokens: 4000,
})?;

println!("Context:\n{}", context.text);
println!("Sources: {:?}", context.sources);
```

---

## Conversation Memory API

Stateful LLM conversation management.

### Via Embedded API

```rust
use ferrite::conversation::{ConversationStore, Message, WindowStrategy};

// Create store
let store = ConversationStore::new(&db, ConversationConfig {
    window_strategy: WindowStrategy::SlidingTokens {
        max_tokens: 4000,
        preserve_system: true,
    },
    summarize_old_messages: true,
    ttl: Some(Duration::from_secs(86400 * 7)),  // 7 days
})?;

// Create conversation for user
let conv_id = store.create("user:123")?;

// Add messages
store.add_message(&conv_id, Message::system("You are a helpful assistant."))?;
store.add_message(&conv_id, Message::user("Hello!"))?;
store.add_message(&conv_id, Message::assistant("Hi! How can I help?"))?;

// Get context window for LLM
let context = store.get_context(&conv_id)?;
// Returns messages within token limit, with older messages summarized

// Get full history
let history = store.get_history(&conv_id)?;

// Clear conversation
store.clear(&conv_id)?;

// Delete conversation
store.delete(&conv_id)?;

// List user conversations
let conversations = store.list_for_user("user:123")?;
```

---

## Policy Engine API

Declarative data governance policies.

### Via Embedded API

```rust
use ferrite::policy::{PolicyEngine, Policy, PolicyAction, PolicyCondition};

// Create policy engine
let policies = PolicyEngine::new(&db)?;

// Create auto-expire policy
policies.create(Policy {
    name: "session_ttl".to_string(),
    pattern: "session:*".to_string(),
    conditions: vec![PolicyCondition::OnCreate],
    actions: vec![
        PolicyAction::SetTtl(Duration::from_secs(3600)),
    ],
})?;

// Create encryption policy
policies.create(Policy {
    name: "encrypt_pii".to_string(),
    pattern: "user:*:ssn".to_string(),
    conditions: vec![PolicyCondition::OnCreate, PolicyCondition::OnUpdate],
    actions: vec![
        PolicyAction::Encrypt { key_id: "pii-key".to_string() },
    ],
})?;

// Create access logging policy
policies.create(Policy {
    name: "audit_sensitive".to_string(),
    pattern: "sensitive:*".to_string(),
    conditions: vec![PolicyCondition::OnRead, PolicyCondition::OnWrite],
    actions: vec![
        PolicyAction::AuditLog {
            include_value: false,
            destination: "audit:log".to_string(),
        },
    ],
})?;

// Create retention policy
policies.create(Policy {
    name: "logs_retention".to_string(),
    pattern: "logs:*".to_string(),
    conditions: vec![PolicyCondition::Scheduled {
        cron: "0 0 * * *".to_string(),  // Daily
    }],
    actions: vec![
        PolicyAction::DeleteOlderThan(Duration::from_secs(86400 * 30)),  // 30 days
    ],
})?;

// List policies
let all = policies.list()?;

// Evaluate policy manually
let result = policies.evaluate("user:123:email", PolicyContext {
    operation: Operation::Read,
    user: Some("admin".to_string()),
})?;
```

---

## Auto-Index API

AI-powered automatic index creation.

### Via Embedded API

```rust
use ferrite::autoindex::{AutoIndexEngine, AutoIndexConfig, AccessType};

// Create engine
let autoindex = AutoIndexEngine::new(&db, AutoIndexConfig {
    collection_window: Duration::from_secs(3600),  // 1 hour
    min_samples: 100,
    confidence_threshold: 0.8,
    auto_apply: false,  // Recommend only, don't auto-apply
})?;

// Record access patterns (automatic in normal operations)
autoindex.record_access("users:*", AccessType::Read, Duration::from_micros(50), None)?;

// Get recommendations
let recommendations = autoindex.analyze()?;
for rec in &recommendations {
    println!("Pattern: {}", rec.pattern);
    println!("Index type: {:?}", rec.index_type);
    println!("Confidence: {:.2}", rec.confidence);
    println!("Estimated improvement: {:.1}x", rec.estimated_speedup);
}

// Apply a recommendation
autoindex.apply_recommendation(&recommendations[0])?;

// Enable auto-apply mode
autoindex.set_auto_apply(true)?;

// Get current indexes
let indexes = autoindex.list_indexes()?;
```

---

## Inference API

Streaming ML inference on cached data.

### Via Embedded API

```rust
use ferrite::inference::{InferenceEngine, InferenceConfig, ModelConfig, InferenceInput};

// Create engine
let inference = InferenceEngine::new(&db, InferenceConfig {
    batch_size: 32,
    batch_timeout: Duration::from_millis(10),
    cache_results: true,
    cache_ttl: Duration::from_secs(3600),
})?;

// Load model
inference.load_model("sentiment", ModelConfig::onnx("./models/sentiment.onnx")).await?;
inference.load_model("embedding", ModelConfig::onnx("./models/embeddings.onnx")).await?;

// Run inference
let result = inference.predict("sentiment", InferenceInput::Text("Great product!".into())).await?;
println!("Sentiment: {:?}", result);

// Batch inference
let results = inference.predict_batch("sentiment", &[
    InferenceInput::Text("Great!".into()),
    InferenceInput::Text("Terrible.".into()),
]).await?;

// Setup CDC trigger for automatic inference
inference.create_trigger(InferenceTrigger {
    model: "sentiment".to_string(),
    source_pattern: "reviews:*".to_string(),
    output_pattern: "sentiment:{}".to_string(),
    input_transform: |value| InferenceInput::Text(value["text"].as_str()?.into()),
})?;

// Model management
let models = inference.list_models()?;
inference.unload_model("sentiment").await?;
```

---

## Error Handling

All APIs return `ferrite::Result<T>` which is an alias for `Result<T, FerriteError>`.

```rust
use ferrite::{Result, FerriteError};

fn example() -> Result<()> {
    match db.get("key") {
        Ok(Some(value)) => println!("Found: {}", value),
        Ok(None) => println!("Not found"),
        Err(FerriteError::KeyNotFound(key)) => println!("Key not found: {}", key),
        Err(FerriteError::InvalidCommand(msg)) => println!("Invalid command: {}", msg),
        Err(FerriteError::Storage(e)) => println!("Storage error: {}", e),
        Err(e) => println!("Other error: {}", e),
    }
    Ok(())
}
```

### Error Types

| Error | Description |
|-------|-------------|
| `KeyNotFound` | Key does not exist |
| `InvalidCommand` | Malformed command |
| `InvalidArgument` | Invalid argument value |
| `WrongType` | Operation against wrong data type |
| `OutOfMemory` | Memory limit exceeded |
| `Unauthorized` | Authentication/authorization failure |
| `Storage` | Storage layer error |
| `Network` | Network error |
| `Timeout` | Operation timed out |
| `TransactionAborted` | WATCH key was modified |

---

## Further Reading

- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical deep-dive
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [OPERATIONS.md](OPERATIONS.md) - Operations guide
- [PERFORMANCE_TUNING.md](PERFORMANCE_TUNING.md) - Performance optimization
