---
sidebar_position: 1
title: Embedded Mode Guide
description: Use Ferrite as an embedded database library like SQLite. Perfect for desktop apps, CLI tools, and edge deployments without a separate server.
keywords: [ferrite embedded, embedded database, sqlite alternative, rust embedded db, local database]
maturity: beta
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Embedded Mode

Ferrite can be used as an embedded library, similar to SQLite. This mode is ideal for desktop applications, CLI tools, and edge deployments where running a separate server process isn't practical.

## Adding Ferrite to Your Project

Add Ferrite to your `Cargo.toml`:

```toml
[dependencies]
ferrite = "0.1"
```

## Basic Usage

```rust
use ferrite::embedded::Database;

fn main() -> anyhow::Result<()> {
    // Open or create a database
    let db = Database::open("./my_data")?;

    // Basic key-value operations
    db.set("user:1", r#"{"name": "Alice", "email": "alice@example.com"}"#)?;
    let user = db.get("user:1")?;
    println!("User: {:?}", user);

    // Delete a key
    db.del("user:1")?;

    Ok(())
}
```

## Configuration

Configure the embedded database with `DatabaseConfig`:

```rust
use ferrite::embedded::{Database, DatabaseConfig};

let config = DatabaseConfig::builder()
    .data_dir("./my_data")
    .max_memory("512MB")
    .aof_enabled(true)
    .aof_sync_policy("everysec")
    .build();

let db = Database::open_with_config(config)?;
```

## Data Types

<Tabs groupId="datatype">
  <TabItem value="strings" label="Strings" default>

```rust
// Set and get
db.set("key", "value")?;
let value: Option<String> = db.get("key")?;

// Set with expiration
db.setex("key", 3600, "value")?;  // Expires in 1 hour

// Increment/decrement
db.incr("counter")?;
db.incrby("counter", 10)?;
db.decr("counter")?;

// Append and get length
db.append("key", " world")?;
let len = db.strlen("key")?;
```

  </TabItem>
  <TabItem value="lists" label="Lists">

```rust
// Push elements
db.lpush("queue", &["task1", "task2"])?;
db.rpush("queue", &["task3"])?;

// Pop elements
let task: Option<String> = db.lpop("queue")?;
let task: Option<String> = db.rpop("queue")?;

// Blocking pop (for queues)
let task: Option<String> = db.blpop("queue", 5)?;  // 5 second timeout

// Get range
let tasks: Vec<String> = db.lrange("queue", 0, -1)?;

// Get length
let len: usize = db.llen("queue")?;
```

  </TabItem>
  <TabItem value="hashes" label="Hashes">

```rust
// Set fields
db.hset("user:1", "name", "Alice")?;
db.hset_multiple("user:1", &[("email", "alice@example.com"), ("age", "30")])?;

// Get fields
let name: Option<String> = db.hget("user:1", "name")?;
let user: HashMap<String, String> = db.hgetall("user:1")?;

// Check existence
let exists: bool = db.hexists("user:1", "email")?;

// Increment numeric fields
db.hincrby("user:1", "login_count", 1)?;

// Delete fields
db.hdel("user:1", &["age"])?;
```

  </TabItem>
  <TabItem value="sets" label="Sets">

```rust
// Add members
db.sadd("tags", &["rust", "database", "redis"])?;

// Check membership
let is_member: bool = db.sismember("tags", "rust")?;

// Get all members
let members: HashSet<String> = db.smembers("tags")?;

// Random member
let random: Option<String> = db.srandmember("tags")?;

// Set operations
let union: HashSet<String> = db.sunion(&["tags1", "tags2"])?;
let intersection: HashSet<String> = db.sinter(&["tags1", "tags2"])?;
let difference: HashSet<String> = db.sdiff(&["tags1", "tags2"])?;
```

  </TabItem>
  <TabItem value="sorted-sets" label="Sorted Sets">

```rust
// Add with scores
db.zadd("leaderboard", &[("alice", 100.0), ("bob", 85.0)])?;

// Get by rank (lowest to highest)
let top_players: Vec<(String, f64)> = db.zrange_withscores("leaderboard", 0, 9)?;

// Get by rank (highest to lowest)
let top_players: Vec<(String, f64)> = db.zrevrange_withscores("leaderboard", 0, 9)?;

// Get by score range
let high_scores: Vec<String> = db.zrangebyscore("leaderboard", 90.0, 100.0)?;

// Get score and rank
let score: Option<f64> = db.zscore("leaderboard", "alice")?;
let rank: Option<usize> = db.zrank("leaderboard", "alice")?;

// Increment score
db.zincrby("leaderboard", "alice", 5.0)?;
```

  </TabItem>
</Tabs>

## Transactions

Ferrite supports atomic transactions:

```rust
// Start a transaction
let tx = db.transaction();

tx.set("key1", "value1")?;
tx.set("key2", "value2")?;
tx.incr("counter")?;

// Commit all operations atomically
tx.commit()?;

// Or discard
// tx.discard()?;
```

## Vector Search

Use vector search for AI/ML workloads:

```rust
use ferrite::vector::{VectorIndex, DistanceMetric};

// Create an index
db.vector_create("embeddings", 384, DistanceMetric::Cosine)?;

// Add vectors
let embedding = vec![0.1, 0.2, /* ... 384 dimensions */];
let metadata = json!({"title": "Document 1", "category": "tech"});
db.vector_add("embeddings", "doc1", &embedding, &metadata)?;

// Search
let query = vec![0.1, 0.2, /* ... */];
let results = db.vector_search("embeddings", &query, 10)?;

for result in results {
    println!("ID: {}, Score: {}, Metadata: {:?}",
             result.id, result.score, result.metadata);
}
```

## Semantic Caching

Cache LLM responses by semantic similarity:

```rust
// Cache a response
db.semantic_set(
    "What is the capital of France?",
    "Paris is the capital of France."
)?;

// Query with similar phrasing (returns cached response if similarity > 0.85)
let response = db.semantic_get("France's capital city?", 0.85)?;
```

## Persistence

Control when data is persisted:

```rust
// Force a checkpoint
db.checkpoint()?;

// Force AOF sync
db.aof_sync()?;

// Get persistence stats
let stats = db.persistence_stats()?;
println!("AOF size: {} bytes", stats.aof_size);
```

## Shutdown

Properly close the database:

```rust
// Graceful shutdown - flushes all pending writes
db.close()?;

// Or let the Drop trait handle it (will also flush)
drop(db);
```

## Thread Safety

The embedded database is thread-safe and can be shared across threads:

```rust
use std::sync::Arc;
use std::thread;

let db = Arc::new(Database::open("./my_data")?);

let handles: Vec<_> = (0..4).map(|i| {
    let db = Arc::clone(&db);
    thread::spawn(move || {
        db.set(&format!("key:{}", i), &format!("value:{}", i)).unwrap();
    })
}).collect();

for handle in handles {
    handle.join().unwrap();
}
```

## Error Handling

Ferrite uses `Result` types for error handling:

```rust
use ferrite::error::FerriteError;

match db.get("nonexistent") {
    Ok(Some(value)) => println!("Value: {}", value),
    Ok(None) => println!("Key not found"),
    Err(FerriteError::Storage(e)) => eprintln!("Storage error: {}", e),
    Err(e) => eprintln!("Error: {}", e),
}
```

## Next Steps

- [Server Mode](/docs/guides/server-mode) - Run Ferrite as a server
- [Persistence](/docs/guides/persistence) - Configure durability
- [Vector Search](/docs/guides/vector-search) - Learn more about vector operations
