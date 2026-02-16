---
sidebar_position: 1
title: Rust SDK
description: Official Ferrite Rust SDK with native access to all features, zero-cost abstractions, async/await support, and connection pooling.
keywords: [rust sdk, ferrite client, async rust, connection pool, redis client rust]
maturity: beta
---

# Rust SDK

The official Ferrite Rust SDK provides native access to all Ferrite features with zero-cost abstractions and async/await support.

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
ferrite-client = "1.0"
tokio = { version = "1", features = ["full"] }
```

## Quick Start

```rust
use ferrite_client::{Client, Result};

#[tokio::main]
async fn main() -> Result<()> {
    // Connect to Ferrite
    let client = Client::connect("ferrite://localhost:6380").await?;

    // Basic operations
    client.set("key", "value").await?;
    let value: Option<String> = client.get("key").await?;
    println!("Value: {:?}", value);

    Ok(())
}
```

## Connection Management

### Single Connection

```rust
use ferrite_client::{Client, ConnectionConfig};

let config = ConnectionConfig::builder()
    .host("localhost")
    .port(6380)
    .password("secret")
    .database(0)
    .connect_timeout(Duration::from_secs(5))
    .read_timeout(Duration::from_secs(30))
    .build();

let client = Client::with_config(config).await?;
```

### Connection Pool

```rust
use ferrite_client::{Pool, PoolConfig};

let pool_config = PoolConfig::builder()
    .min_connections(5)
    .max_connections(20)
    .idle_timeout(Duration::from_secs(300))
    .connection_timeout(Duration::from_secs(5))
    .build();

let pool = Pool::connect_with_config(
    "ferrite://localhost:6380",
    pool_config
).await?;

// Get connection from pool
let conn = pool.get().await?;
conn.set("key", "value").await?;
```

### Cluster Connection

```rust
use ferrite_client::{Cluster, ClusterConfig};

let cluster = Cluster::connect(&[
    "ferrite://node1:6380",
    "ferrite://node2:6380",
    "ferrite://node3:6380",
]).await?;

// Automatic routing to correct node
cluster.set("key", "value").await?;
```

## Data Types

### Strings

```rust
// Basic string operations
client.set("name", "Ferrite").await?;
client.set_ex("session", "token123", 3600).await?; // With TTL
client.setnx("unique", "first").await?; // Set if not exists

let name: String = client.get("name").await?.unwrap();
let length: i64 = client.strlen("name").await?;

// Numeric operations
client.set("counter", 0).await?;
client.incr("counter").await?;
client.incrby("counter", 10).await?;
client.incrbyfloat("counter", 0.5).await?;

// Batch operations
client.mset(&[("k1", "v1"), ("k2", "v2"), ("k3", "v3")]).await?;
let values: Vec<Option<String>> = client.mget(&["k1", "k2", "k3"]).await?;
```

### Lists

```rust
// Push operations
client.lpush("queue", &["a", "b", "c"]).await?;
client.rpush("queue", &["d", "e", "f"]).await?;

// Pop operations
let item: Option<String> = client.lpop("queue").await?;
let items: Vec<String> = client.lpop_count("queue", 3).await?;

// Blocking pop (for queues)
let item: Option<(String, String)> = client
    .blpop(&["queue1", "queue2"], 5.0)
    .await?;

// Range operations
let range: Vec<String> = client.lrange("queue", 0, -1).await?;
client.ltrim("queue", 0, 99).await?; // Keep first 100
```

### Hashes

```rust
use std::collections::HashMap;

// Single field operations
client.hset("user:1", "name", "Alice").await?;
let name: Option<String> = client.hget("user:1", "name").await?;

// Multiple fields
client.hset_multiple("user:1", &[
    ("name", "Alice"),
    ("email", "alice@example.com"),
    ("age", "30"),
]).await?;

// Get all fields
let user: HashMap<String, String> = client.hgetall("user:1").await?;

// Typed struct mapping
#[derive(Debug, Serialize, Deserialize)]
struct User {
    name: String,
    email: String,
    age: u32,
}

let user: User = client.hgetall_as("user:1").await?;
```

### Sets

```rust
// Add members
client.sadd("tags", &["rust", "database", "redis"]).await?;

// Check membership
let is_member: bool = client.sismember("tags", "rust").await?;

// Set operations
let common: Vec<String> = client.sinter(&["tags1", "tags2"]).await?;
let all: Vec<String> = client.sunion(&["tags1", "tags2"]).await?;
let diff: Vec<String> = client.sdiff(&["tags1", "tags2"]).await?;

// Random members
let random: Option<String> = client.srandmember("tags").await?;
let randoms: Vec<String> = client.srandmember_count("tags", 3).await?;
```

### Sorted Sets

```rust
// Add with scores
client.zadd("leaderboard", &[
    ("alice", 100.0),
    ("bob", 95.0),
    ("carol", 110.0),
]).await?;

// Get rankings
let rank: Option<i64> = client.zrank("leaderboard", "alice").await?;
let score: Option<f64> = client.zscore("leaderboard", "alice").await?;

// Range queries
let top10: Vec<(String, f64)> = client
    .zrevrange_withscores("leaderboard", 0, 9)
    .await?;

// Score range
let high_scorers: Vec<String> = client
    .zrangebyscore("leaderboard", 100.0, f64::INFINITY)
    .await?;
```

### Streams

```rust
use ferrite_client::stream::{StreamEntry, ReadOptions};

// Add entries
let id = client.xadd("events", "*", &[
    ("type", "click"),
    ("page", "/home"),
]).await?;

// Read entries
let entries: Vec<StreamEntry> = client
    .xrange("events", "-", "+", Some(100))
    .await?;

// Consumer groups
client.xgroup_create("events", "processors", "$", true).await?;

let entries = client.xreadgroup(
    "processors",
    "worker-1",
    ReadOptions::new()
        .count(10)
        .block(Duration::from_secs(5)),
    &[("events", ">")],
).await?;

// Acknowledge processing
client.xack("events", "processors", &[entry.id]).await?;
```

## Extended Features

### Vector Search

```rust
use ferrite_client::vector::{VectorIndex, SearchOptions};

// Create index
client.execute_command(
    "VECTOR.INDEX.CREATE",
    &["embeddings", "DIM", "384", "DISTANCE", "COSINE", "TYPE", "HNSW"]
).await?;

// Add vectors
let embedding: Vec<f32> = model.encode("Hello world")?;
client.vector_add("embeddings", "doc:1", &embedding, &[
    ("text", "Hello world"),
    ("category", "greeting"),
]).await?;

// Search
let results = client.vector_search(
    "embeddings",
    &query_embedding,
    SearchOptions::new()
        .top_k(10)
        .filter("category == 'greeting'")
        .include_vectors(false)
).await?;

for result in results {
    println!("ID: {}, Score: {}", result.id, result.score);
}
```

### Document Store

```rust
use ferrite_client::document::{Document, Query};
use serde_json::json;

// Insert document
let doc = json!({
    "title": "Getting Started",
    "author": "Alice",
    "tags": ["tutorial", "beginner"],
    "views": 100
});

client.doc_insert("articles", "article:1", &doc).await?;

// Query documents
let query = Query::new()
    .filter(json!({"author": "Alice"}))
    .sort("views", false) // Descending
    .limit(10);

let docs: Vec<Document> = client.doc_find("articles", query).await?;

// Aggregation
let pipeline = json!([
    {"$match": {"author": "Alice"}},
    {"$group": {"_id": "$category", "count": {"$sum": 1}}}
]);

let results = client.doc_aggregate("articles", pipeline).await?;
```

### Graph Database

```rust
use ferrite_client::graph::{Vertex, Edge, TraversalOptions};

// Create vertices
client.graph_vertex_add("social", "user:alice", "User", &[
    ("name", "Alice"),
    ("age", "30"),
]).await?;

client.graph_vertex_add("social", "user:bob", "User", &[
    ("name", "Bob"),
    ("age", "28"),
]).await?;

// Create edge
client.graph_edge_add(
    "social",
    "user:alice",
    "user:bob",
    "FOLLOWS",
    &[("since", "2024-01-01")],
).await?;

// Traverse graph
let friends = client.graph_traverse(
    "social",
    "user:alice",
    TraversalOptions::new()
        .direction("OUT")
        .edge_type("FOLLOWS")
        .max_depth(2)
).await?;
```

### Time Series

```rust
use ferrite_client::timeseries::{Sample, AggregationType};

// Add samples
client.ts_add("temperature:room1", None, 23.5).await?;
client.ts_add_with_labels(
    "temperature:room1",
    None,
    23.5,
    &[("location", "office"), ("sensor", "temp-01")],
).await?;

// Query range
let samples: Vec<Sample> = client.ts_range(
    "temperature:room1",
    "-",  // Start
    "+",  // End
    None, // No aggregation
).await?;

// Aggregated query
let hourly_avg: Vec<Sample> = client.ts_range(
    "temperature:room1",
    "now-24h",
    "now",
    Some(AggregationType::Avg(Duration::from_secs(3600))),
).await?;
```

### Semantic Search

```rust
use ferrite_client::semantic::{EmbeddingProvider, SemanticSearchOptions};

// Configure embedding provider
client.semantic_config(EmbeddingProvider::OpenAI {
    api_key: std::env::var("OPENAI_API_KEY")?,
    model: "text-embedding-3-small".into(),
}).await?;

// Create semantic index
client.semantic_index_create("knowledge", 1536).await?;

// Add text (auto-embeds)
client.semantic_add("knowledge", "doc:1", "Ferrite is a Redis replacement").await?;

// Semantic search
let results = client.semantic_search(
    "knowledge",
    "What is Ferrite?",
    SemanticSearchOptions::new().top_k(5)
).await?;
```

## Transactions

### Basic Transaction

```rust
let result = client.transaction(|tx| async move {
    let balance: i64 = tx.get("account:1:balance").await?.unwrap_or(0);

    if balance >= 100 {
        tx.decrby("account:1:balance", 100).await?;
        tx.incrby("account:2:balance", 100).await?;
        Ok(true)
    } else {
        Ok(false)
    }
}).await?;
```

### WATCH-based Transaction

```rust
// Optimistic locking
let result = client.watch_transaction(&["account:1"], |tx| async move {
    let balance: i64 = tx.get("account:1:balance").await?.unwrap_or(0);

    tx.multi().await?;
    tx.decrby("account:1:balance", 100).await?;
    tx.incrby("account:2:balance", 100).await?;
    tx.exec().await
}).await?;

match result {
    TransactionResult::Success(values) => println!("Committed"),
    TransactionResult::Aborted => println!("Concurrent modification, retry"),
}
```

## Pub/Sub

### Publishing

```rust
client.publish("events", "Hello, subscribers!").await?;

// Pattern publish
client.publish("events:user:123", "User event").await?;
```

### Subscribing

```rust
use ferrite_client::pubsub::{PubSub, Message};

let mut pubsub = client.pubsub();

// Subscribe to channels
pubsub.subscribe(&["events", "notifications"]).await?;

// Pattern subscribe
pubsub.psubscribe(&["events:*"]).await?;

// Receive messages
while let Some(msg) = pubsub.next().await {
    match msg {
        Message::Message { channel, payload } => {
            println!("Channel {}: {}", channel, payload);
        }
        Message::PMessage { pattern, channel, payload } => {
            println!("Pattern {} matched {}: {}", pattern, channel, payload);
        }
        _ => {}
    }
}
```

## Pipelining

```rust
// Execute multiple commands in a single round-trip
let results = client.pipeline()
    .set("key1", "value1")
    .set("key2", "value2")
    .get("key1")
    .get("key2")
    .execute()
    .await?;

// Results are returned in order
let v1: String = results.get(2)?;
let v2: String = results.get(3)?;
```

## Lua Scripting

```rust
// Load script
let script = r#"
    local current = redis.call('GET', KEYS[1])
    if current then
        return redis.call('SET', KEYS[1], ARGV[1])
    else
        return nil
    end
"#;

let script_sha = client.script_load(script).await?;

// Execute script
let result: Option<String> = client
    .evalsha(&script_sha, &["mykey"], &["newvalue"])
    .await?;
```

## Error Handling

```rust
use ferrite_client::{Error, ErrorKind};

match client.get::<String>("key").await {
    Ok(Some(value)) => println!("Value: {}", value),
    Ok(None) => println!("Key not found"),
    Err(e) => match e.kind() {
        ErrorKind::ConnectionError => {
            eprintln!("Connection failed: {}", e);
            // Retry logic
        }
        ErrorKind::Timeout => {
            eprintln!("Operation timed out");
        }
        ErrorKind::Protocol(msg) => {
            eprintln!("Protocol error: {}", msg);
        }
        _ => eprintln!("Error: {}", e),
    }
}
```

## Async Iterators

```rust
use futures::StreamExt;

// Scan keys
let mut cursor = client.scan("user:*");
while let Some(keys) = cursor.next().await {
    for key in keys? {
        println!("Key: {}", key);
    }
}

// Scan hash fields
let mut cursor = client.hscan("user:1", "*");
while let Some(fields) = cursor.next().await {
    for (field, value) in fields? {
        println!("{}: {}", field, value);
    }
}
```

## Configuration Reference

```rust
use ferrite_client::{Client, ConnectionConfig, TlsConfig};

let config = ConnectionConfig::builder()
    // Connection
    .host("localhost")
    .port(6380)
    .password("secret")
    .username("default")  // ACL username
    .database(0)

    // Timeouts
    .connect_timeout(Duration::from_secs(5))
    .read_timeout(Duration::from_secs(30))
    .write_timeout(Duration::from_secs(30))

    // TLS
    .tls(TlsConfig::builder()
        .ca_cert("/path/to/ca.crt")
        .client_cert("/path/to/client.crt")
        .client_key("/path/to/client.key")
        .build())

    // Retry
    .retry_count(3)
    .retry_delay(Duration::from_millis(100))

    // Buffer sizes
    .read_buffer_size(65536)
    .write_buffer_size(65536)

    .build();

let client = Client::with_config(config).await?;
```

## Best Practices

### Connection Reuse

```rust
// Use a connection pool in multi-threaded applications
lazy_static! {
    static ref POOL: Pool = Pool::connect("ferrite://localhost:6380")
        .expect("Failed to create pool");
}

async fn handler() -> Result<()> {
    let conn = POOL.get().await?;
    // Use connection
    Ok(())
}
```

### Graceful Shutdown

```rust
use tokio::signal;

async fn main() -> Result<()> {
    let client = Client::connect("ferrite://localhost:6380").await?;

    tokio::select! {
        _ = signal::ctrl_c() => {
            println!("Shutting down...");
            client.close().await?;
        }
        _ = run_app(&client) => {}
    }

    Ok(())
}
```

### Structured Logging

```rust
use tracing::{info, instrument};

#[instrument(skip(client))]
async fn process_user(client: &Client, user_id: &str) -> Result<User> {
    info!(user_id, "Fetching user");

    let user: User = client.hgetall_as(&format!("user:{}", user_id)).await?;

    info!(user_id, name = %user.name, "User fetched");
    Ok(user)
}
```

## Next Steps

- [TypeScript SDK](/docs/sdk/typescript) - For Node.js applications
- [Python SDK](/docs/sdk/python) - For Python applications
- [SDK Generator](/docs/sdk/generator) - Generate custom SDKs
