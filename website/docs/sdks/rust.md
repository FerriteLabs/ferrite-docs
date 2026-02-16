---
title: "Rust Client Guide"
description: Connect to Ferrite from Rust using redis-rs, with embedded mode, deadpool-redis connection pooling, and Ferrite-specific command examples.
sidebar_position: 5
maturity: beta
---

# Rust Client Guide

This guide shows how to connect to Ferrite from Rust using the `redis-rs` crate for standard operations, `deadpool-redis` for connection pooling, and Ferrite's embedded mode for in-process usage without a server.

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
redis = { version = "0.27", features = ["tokio-comp", "aio"] }
tokio = { version = "1", features = ["full"] }
```

For connection pooling:

```toml
[dependencies]
deadpool-redis = "0.18"
```

## Basic Operations with redis-rs

### Connecting

```rust
use redis::AsyncCommands;

#[tokio::main]
async fn main() -> redis::RedisResult<()> {
    let client = redis::Client::open("redis://localhost:6380/")?;
    let mut conn = client.get_multiplexed_async_connection().await?;

    // Verify connectivity
    let pong: String = redis::cmd("PING").query_async(&mut conn).await?;
    println!("{}", pong); // "PONG"

    Ok(())
}
```

### CRUD Operations

```rust
use redis::AsyncCommands;

let mut conn = client.get_multiplexed_async_connection().await?;

// Strings
conn.set("user:1:name", "Alice").await?;
conn.set_ex("session:abc", "token123", 3600).await?; // 1-hour TTL

let name: Option<String> = conn.get("user:1:name").await?;

// Hashes
conn.hset_multiple("user:1", &[
    ("name", "Alice"),
    ("email", "alice@example.com"),
    ("role", "admin"),
]).await?;

let user: std::collections::HashMap<String, String> =
    conn.hgetall("user:1").await?;

// Lists
conn.rpush("events", &["login", "page_view", "click"]).await?;
let events: Vec<String> = conn.lrange("events", 0, -1).await?;

// Sets
conn.sadd("user:1:tags", &["premium", "beta-tester"]).await?;
let is_premium: bool = conn.sismember("user:1:tags", "premium").await?;

// Sorted sets
conn.zadd_multiple("leaderboard", &[
    (100.0, "alice"),
    (95.0, "bob"),
    (110.0, "carol"),
]).await?;
let top3: Vec<(String, f64)> =
    conn.zrevrange_withscores("leaderboard", 0, 2).await?;
```

### Caching Pattern

```rust
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct User {
    name: String,
    email: String,
}

async fn get_user(
    conn: &mut redis::aio::MultiplexedConnection,
    user_id: &str,
) -> anyhow::Result<User> {
    let cache_key = format!("cache:user:{}", user_id);

    // Try cache first
    let cached: Option<String> = conn.get(&cache_key).await?;
    if let Some(data) = cached {
        return Ok(serde_json::from_str(&data)?);
    }

    // Miss — fetch from database
    let user = db_query_user(user_id).await?;

    // Cache for 5 minutes
    let data = serde_json::to_string(&user)?;
    conn.set_ex(&cache_key, &data, 300).await?;
    Ok(user)
}
```

## Connection Pool with deadpool-redis

For multi-threaded applications, use `deadpool-redis` to manage a pool of connections:

```rust
use deadpool_redis::{Config, Runtime, Pool};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cfg = Config::from_url("redis://localhost:6380/");
    let pool: Pool = cfg.create_pool(Some(Runtime::Tokio1))?;

    // Use in a handler
    let mut conn = pool.get().await?;
    conn.set::<_, _, ()>("key", "value").await?;

    Ok(())
}
```

### With Axum

```rust
use axum::{extract::State, routing::get, Json, Router};
use deadpool_redis::{Config, Pool, Runtime};
use redis::AsyncCommands;

type AppState = Pool;

async fn get_user(
    State(pool): State<AppState>,
    axum::extract::Path(user_id): axum::extract::Path<String>,
) -> Json<serde_json::Value> {
    let mut conn = pool.get().await.unwrap();
    let user: std::collections::HashMap<String, String> =
        conn.hgetall(format!("user:{}", user_id)).await.unwrap();
    Json(serde_json::to_value(user).unwrap())
}

#[tokio::main]
async fn main() {
    let cfg = Config::from_url("redis://localhost:6380/");
    let pool = cfg.create_pool(Some(Runtime::Tokio1)).unwrap();

    let app = Router::new()
        .route("/user/{id}", get(get_user))
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

:::tip
`deadpool-redis` manages connection lifecycle, health checks, and recycling automatically. It's the recommended approach for web servers and long-running services.
:::

## Ferrite Embedded Mode

Ferrite can be used as an **in-process library** without running a separate server. This is useful for testing, single-process applications, or when you want direct access to the storage engine:

```toml
[dependencies]
ferrite = { version = "1.0", features = ["lite"] }
```

```rust
use ferrite::embedded::{Ferrite, Config};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Start an in-process Ferrite instance
    let config = Config::builder()
        .data_dir("/tmp/ferrite-data")
        .max_memory(1024 * 1024 * 512) // 512 MB
        .build();

    let db = Ferrite::open(config).await?;

    // Use directly — no network overhead
    db.set("key", "value").await?;
    let value: Option<String> = db.get("key").await?;
    println!("Value: {:?}", value);

    // Ferrite-specific features work too
    db.execute_command(&["TS.ADD", "temp", "*", "23.5"]).await?;

    // Data is persisted to disk
    db.close().await?;
    Ok(())
}
```

:::warning
Embedded mode shares the process memory space. Ensure `max_memory` is set appropriately to avoid OOM situations in your application.
:::

### Embedded Mode for Testing

```rust
#[cfg(test)]
mod tests {
    use ferrite::embedded::{Ferrite, Config};

    async fn test_db() -> Ferrite {
        let config = Config::builder()
            .data_dir(tempfile::tempdir().unwrap().path())
            .build();
        Ferrite::open(config).await.unwrap()
    }

    #[tokio::test]
    async fn test_basic_operations() {
        let db = test_db().await;

        db.set("key", "value").await.unwrap();
        let val: Option<String> = db.get("key").await.unwrap();
        assert_eq!(val, Some("value".to_string()));
    }
}
```

## Ferrite-Specific Commands

Use `redis::cmd()` to execute Ferrite extension commands:

### Vector Search

```rust
// Create a vector index
redis::cmd("VECTOR.INDEX.CREATE")
    .arg("embeddings")
    .arg("DIM").arg(384)
    .arg("DISTANCE").arg("COSINE")
    .arg("TYPE").arg("HNSW")
    .query_async::<()>(&mut conn)
    .await?;

// Add a vector (pack floats as little-endian bytes)
let embedding: Vec<f32> = vec![0.1, 0.2, 0.3];
let bytes: Vec<u8> = embedding.iter()
    .flat_map(|f| f.to_le_bytes())
    .collect();

redis::cmd("VECTOR.ADD")
    .arg("embeddings")
    .arg("doc:1")
    .arg(bytes.as_slice())
    .arg("TEXT").arg("Hello world")
    .arg("CATEGORY").arg("greeting")
    .query_async::<()>(&mut conn)
    .await?;

// Search for similar vectors
let query_bytes: Vec<u8> = query_embedding.iter()
    .flat_map(|f| f.to_le_bytes())
    .collect();

let results: Vec<redis::Value> = redis::cmd("VECTOR.SEARCH")
    .arg("embeddings")
    .arg(query_bytes.as_slice())
    .arg("K").arg(10)
    .query_async(&mut conn)
    .await?;
```

### Semantic Set/Get

```rust
redis::cmd("SEMANTIC.SET")
    .arg("facts:capital")
    .arg("The capital of France is Paris")
    .query_async::<()>(&mut conn)
    .await?;

let result: Option<String> = redis::cmd("SEMANTIC.GET")
    .arg("facts:capital")
    .arg("What city is France's capital?")
    .query_async(&mut conn)
    .await?;
```

### Time Series

```rust
// Add data points
redis::cmd("TS.ADD")
    .arg("temperature:office")
    .arg("*")
    .arg(23.5)
    .query_async::<()>(&mut conn)
    .await?;

// Query last hour
let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)?
    .as_millis();
let hour_ago = now - 3_600_000;

let samples: Vec<redis::Value> = redis::cmd("TS.RANGE")
    .arg("temperature:office")
    .arg(hour_ago as u64)
    .arg(now as u64)
    .query_async(&mut conn)
    .await?;
```

## Pub/Sub

### Publisher

```rust
conn.publish::<_, _, ()>("notifications", "New order received").await?;
```

### Subscriber

```rust
use redis::AsyncCommands;
use futures_util::StreamExt;

let mut pubsub = client.get_async_pubsub().await?;
pubsub.subscribe("notifications").await?;
pubsub.psubscribe("events:*").await?;

let mut stream = pubsub.on_message();
while let Some(msg) = stream.next().await {
    let channel: String = msg.get_channel()?;
    let payload: String = msg.get_payload()?;
    println!("[{}] {}", channel, payload);
}
```

## Pipelines

```rust
let (v1, v2): (String, String) = redis::pipe()
    .cmd("SET").arg("key1").arg("value1").ignore()
    .cmd("SET").arg("key2").arg("value2").ignore()
    .cmd("GET").arg("key1")
    .cmd("GET").arg("key2")
    .query_async(&mut conn)
    .await?;
```

## Error Handling

```rust
use redis::RedisError;

match conn.get::<_, Option<String>>("key").await {
    Ok(Some(value)) => println!("Value: {}", value),
    Ok(None) => println!("Key not found"),
    Err(e) if e.is_connection_refusal() => {
        eprintln!("Connection refused — is Ferrite running?");
    }
    Err(e) if e.is_timeout() => {
        eprintln!("Operation timed out");
    }
    Err(e) => eprintln!("Error: {}", e),
}
```

## Best Practices

1. **Use `get_multiplexed_async_connection`** — multiplexes commands over a single TCP connection
2. **Use `deadpool-redis` for web servers** — manages a pool of connections with health checks
3. **Prefer embedded mode for tests** — no external server needed, fast setup/teardown
4. **Use pipelines** for batch operations — reduces round-trips
5. **Handle `RedisError` variants** — distinguish connection failures from command errors

## Next Steps

- [Python Client Guide](./python) — Connect from Python
- [Node.js Client Guide](./nodejs) — Connect from Node.js
- [Go Client Guide](./go) — Connect from Go
- [Rust SDK Reference](/docs/sdk/rust) — Full Ferrite Rust SDK with zero-cost abstractions
