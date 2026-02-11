---
sidebar_position: 4
maturity: stable
---

# Client Libraries

Ferrite is fully Redis-compatible, which means you can use any Redis client library with Ferrite. This page lists officially supported SDKs and popular third-party libraries.

## Official SDKs

These SDKs are developed and maintained by the Ferrite team with full feature coverage including extended features like vector search, document store, and graph database:

| Language | Package | Documentation |
|----------|---------|---------------|
| **Rust** | `ferrite-client` | [Rust SDK Guide](/docs/sdk/rust) |
| **Python** | `ferrite-py` | [Python SDK Guide](/docs/sdk/python) |
| **TypeScript/Node.js** | `@ferrite/client` | [TypeScript SDK Guide](/docs/sdk/typescript) |
| **Go** | `github.com/ferrite-rs/ferrite-go` | [Go SDK Guide](/docs/sdk/go) |
| **Java** | `io.ferrite:ferrite-client` | [Java SDK Guide](/docs/sdk/java) |

### Quick Installation

```bash
# Rust
cargo add ferrite-client

# Python
pip install ferrite-py

# TypeScript/Node.js
npm install @ferrite/client

# Go
go get github.com/ferrite-rs/ferrite-go
```

## Redis Client Libraries

Since Ferrite implements the Redis protocol (RESP2/RESP3), any Redis client library works out of the box:

| Language | Recommended Library | Extended Features |
|----------|--------------------|--------------------|
| Rust | `redis-rs` | Use official SDK |
| Python | `redis-py` | Use official SDK |
| Node.js | `ioredis` | Use official SDK |
| Go | `go-redis` | Use official SDK |
| Java | `Jedis` or `Lettuce` | Use official SDK |
| C# | `StackExchange.Redis` | Raw commands |
| Ruby | `redis-rb` | Raw commands |
| PHP | `phpredis` or `predis` | Raw commands |

## Python

### Using redis-py

```bash
pip install redis
```

```python
import redis

# Connect to Ferrite
client = redis.Redis(host='localhost', port=6380, decode_responses=True)

# Basic operations
client.set('user:123', 'Alice')
name = client.get('user:123')
print(f"Name: {name}")

# With expiration
client.setex('session:abc', 3600, 'session_data')

# Hash operations
client.hset('user:123:profile', mapping={
    'name': 'Alice',
    'email': 'alice@example.com',
    'age': 30
})
profile = client.hgetall('user:123:profile')
```

### Using Official SDK (Recommended)

```bash
pip install ferrite-py
```

```python
from ferrite import Ferrite

client = Ferrite(host='localhost', port=6380)

# Basic operations
client.set('user:123', 'Alice')
name = client.get('user:123')

# Extended features with typed API
# Vector search
results = client.vector.search('embeddings', query_vector, top_k=10)

# Document store
docs = client.doc.find('articles', {'author': 'Alice'})

# Semantic search
results = client.semantic.search('knowledge', 'What is Ferrite?')
```

### Async Support

```python
import asyncio
from ferrite import AsyncFerrite

async def main():
    client = await AsyncFerrite.connect(host='localhost', port=6380)

    await client.set('key', 'value')
    value = await client.get('key')
    print(value)

    await client.close()

asyncio.run(main())
```

### Connection Pooling

```python
from ferrite import FerritePool

pool = FerritePool(
    host='localhost',
    port=6380,
    max_connections=20,
    min_idle_connections=5
)

with pool.connection() as conn:
    conn.set('key', 'value')
```

## Node.js / TypeScript

### Using ioredis

```bash
npm install ioredis
```

```javascript
const Redis = require('ioredis');

// Connect to Ferrite
const client = new Redis({
  host: 'localhost',
  port: 6380,
});

// Basic operations
await client.set('user:123', 'Alice');
const name = await client.get('user:123');
console.log(`Name: ${name}`);

// Hash operations
await client.hset('user:123:profile', {
  name: 'Alice',
  email: 'alice@example.com',
  age: '30'
});
const profile = await client.hgetall('user:123:profile');
```

### Using Official SDK (Recommended)

```bash
npm install @ferrite/client
```

```typescript
import { Ferrite } from "@ferrite/client";

const client = new Ferrite({ host: "localhost", port: 6380 });
await client.connect();

// Basic operations
await client.set("user:123", "Alice");
const name = await client.get("user:123");

// Extended features with typed API
// Vector search
const results = await client.vectorSearch("embeddings", queryVector, { topK: 10 });

// Document store
const docs = await client.docFind<Article>("articles", { author: "Alice" });

// Type-safe hash operations
interface User {
  name: string;
  email: string;
  age: number;
}
const user = await client.hGetAll<User>("user:123");
```

### Clustering

```javascript
const Redis = require('ioredis');

const cluster = new Redis.Cluster([
  { host: 'node1', port: 6380 },
  { host: 'node2', port: 6380 },
  { host: 'node3', port: 6380 },
]);

await cluster.set('key', 'value');
```

## Go

### Using go-redis

```bash
go get github.com/redis/go-redis/v9
```

```go
package main

import (
    "context"
    "fmt"
    "github.com/redis/go-redis/v9"
)

func main() {
    ctx := context.Background()

    // Connect to Ferrite
    client := redis.NewClient(&redis.Options{
        Addr:     "localhost:6380",
        Password: "",
        DB:       0,
    })

    // Basic operations
    err := client.Set(ctx, "user:123", "Alice", 0).Err()
    if err != nil {
        panic(err)
    }

    val, err := client.Get(ctx, "user:123").Result()
    if err != nil {
        panic(err)
    }
    fmt.Println("Name:", val)
}
```

### Using Official SDK (Recommended)

```bash
go get github.com/ferrite-rs/ferrite-go
```

```go
import "github.com/ferrite-rs/ferrite-go"

client, _ := ferrite.NewClient(ctx, &ferrite.Options{
    Addr: "localhost:6380",
})

// Basic operations
client.Set(ctx, "user:123", "Alice", 0)
val, _ := client.Get(ctx, "user:123").Result()

// Extended features
results, _ := client.VectorSearch(ctx, "embeddings", queryVector, 10)
docs, _ := client.DocFind(ctx, "articles", map[string]interface{}{"author": "Alice"})
```

## Rust

### Using redis-rs

```toml
[dependencies]
redis = "0.24"
tokio = { version = "1", features = ["full"] }
```

```rust
use redis::AsyncCommands;

#[tokio::main]
async fn main() -> redis::RedisResult<()> {
    // Connect to Ferrite
    let client = redis::Client::open("redis://127.0.0.1:6380/")?;
    let mut con = client.get_async_connection().await?;

    // Basic operations
    con.set("user:123", "Alice").await?;
    let name: String = con.get("user:123").await?;
    println!("Name: {}", name);

    Ok(())
}
```

### Using Official SDK (Recommended)

```toml
[dependencies]
ferrite-client = "1.0"
tokio = { version = "1", features = ["full"] }
```

```rust
use ferrite_client::{Client, Result};

#[tokio::main]
async fn main() -> Result<()> {
    let client = Client::connect("ferrite://localhost:6380").await?;

    // Basic operations
    client.set("user:123", "Alice").await?;
    let name: String = client.get("user:123").await?.unwrap();

    // Extended features with typed API
    // Vector search
    let results = client.vector_search("embeddings", &query_vector, 10).await?;

    // Document store
    let docs: Vec<Article> = client.doc_find("articles", json!({"author": "Alice"})).await?;

    Ok(())
}
```

## Java

### Using Jedis

```xml
<dependency>
    <groupId>redis.clients</groupId>
    <artifactId>jedis</artifactId>
    <version>5.0.0</version>
</dependency>
```

```java
import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;

public class Example {
    public static void main(String[] args) {
        JedisPool pool = new JedisPool("localhost", 6380);

        try (Jedis jedis = pool.getResource()) {
            jedis.set("user:123", "Alice");
            String name = jedis.get("user:123");
            System.out.println("Name: " + name);
        }

        pool.close();
    }
}
```

### Using Official SDK (Recommended)

```xml
<dependency>
    <groupId>io.ferrite</groupId>
    <artifactId>ferrite-client</artifactId>
    <version>1.0.0</version>
</dependency>
```

```java
import io.ferrite.FerriteClient;

FerriteClient client = FerriteClient.create(config);

// Basic operations
client.sync().set("user:123", "Alice");
String name = client.sync().get("user:123");

// Extended features
List<SearchResult> results = client.vectors().search("embeddings", queryVector, 10);
List<Document> docs = client.documents().find("articles", Filter.eq("author", "Alice"));
```

## Connection Configuration

### TLS/SSL

```python
# Python
client = Ferrite(
    host='localhost',
    port=6380,
    ssl=True,
    ssl_certfile='client.crt',
    ssl_keyfile='client.key',
    ssl_ca_certs='ca.crt'
)
```

```javascript
// Node.js
const client = new Ferrite({
  host: 'localhost',
  port: 6380,
  tls: {
    cert: fs.readFileSync('client.crt'),
    key: fs.readFileSync('client.key'),
    ca: fs.readFileSync('ca.crt')
  }
});
```

### Authentication

```python
# With password
client = Ferrite(host='localhost', port=6380, password='secret')

# With ACL (username + password)
client = Ferrite(host='localhost', port=6380, username='user', password='secret')
```

## Extended Features: Official SDK vs Raw Commands

| Feature | Redis Clients | Official SDKs |
|---------|--------------|---------------|
| Basic commands (GET, SET, etc.) | ✅ | ✅ |
| Data structures (List, Hash, Set, etc.) | ✅ | ✅ |
| Pub/Sub | ✅ | ✅ |
| Transactions | ✅ | ✅ |
| Lua scripting | ✅ | ✅ |
| **Vector search** | Raw commands | ✅ Typed API |
| **Document store** | Raw commands | ✅ Typed API |
| **Graph database** | Raw commands | ✅ Typed API |
| **Time series** | Raw commands | ✅ Typed API |
| **Semantic search** | Raw commands | ✅ Typed API |
| **FerriteQL** | Raw commands | ✅ Typed API |

## Best Practices

1. **Use connection pooling** - Avoid creating new connections per request
2. **Enable pipelining** - Batch multiple commands for better performance
3. **Handle errors** - Implement retry logic for transient failures
4. **Set timeouts** - Prevent hanging connections
5. **Use async clients** - Better concurrency in async environments
6. **Use official SDKs** - For extended features with type safety

## Next Steps

- [Quick Start](/docs/getting-started/quick-start) - First steps with Ferrite
- [Rust SDK](/docs/sdk/rust) - Full Rust SDK documentation
- [Python SDK](/docs/sdk/python) - Full Python SDK documentation
- [TypeScript SDK](/docs/sdk/typescript) - Full TypeScript SDK documentation
