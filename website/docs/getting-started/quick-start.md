---
sidebar_position: 2
title: Quick Start Guide
description: Get up and running with Ferrite in minutes. Learn basic commands, connect with Redis clients, and explore Ferrite-specific features like vector search.
keywords: [ferrite quick start, redis commands, ferrite tutorial, vector search, semantic caching]
maturity: stable
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Quick Start

Get up and running with Ferrite in minutes.

## Starting the Server

```bash
# Generate a config and start
./target/release/ferrite init --output ferrite.toml
./target/release/ferrite --config ferrite.toml

# Or with debug logging
RUST_LOG=ferrite=debug ./target/release/ferrite --config ferrite.toml
```

Ferrite will start listening on port 6379 by default.

## Connecting with Redis CLI

Ferrite is fully compatible with the standard Redis CLI:

```bash
redis-cli -p 6379
```

## Basic Commands

### Strings

```bash
127.0.0.1:6379> SET name "Alice"
OK
127.0.0.1:6379> GET name
"Alice"
127.0.0.1:6379> INCR counter
(integer) 1
127.0.0.1:6379> INCR counter
(integer) 2
```

### Hashes

```bash
127.0.0.1:6379> HSET user:1 name "Alice" email "alice@example.com"
(integer) 2
127.0.0.1:6379> HGETALL user:1
1) "name"
2) "Alice"
3) "email"
4) "alice@example.com"
```

### Lists

```bash
127.0.0.1:6379> LPUSH queue "task1"
(integer) 1
127.0.0.1:6379> LPUSH queue "task2"
(integer) 2
127.0.0.1:6379> RPOP queue
"task1"
```

### Sets

```bash
127.0.0.1:6379> SADD tags "rust" "database" "redis"
(integer) 3
127.0.0.1:6379> SMEMBERS tags
1) "rust"
2) "database"
3) "redis"
```

### Sorted Sets

```bash
127.0.0.1:6379> ZADD leaderboard 100 "alice" 85 "bob" 92 "charlie"
(integer) 3
127.0.0.1:6379> ZRANGE leaderboard 0 -1 WITHSCORES
1) "bob"
2) "85"
3) "charlie"
4) "92"
5) "alice"
6) "100"
```

## Ferrite-Specific Features

### Vector Search

```bash
# Create a vector index
127.0.0.1:6379> VECTOR.CREATE myindex DIM 384 DISTANCE cosine

# Add vectors with metadata
127.0.0.1:6379> VECTOR.ADD myindex doc1 [0.1, 0.2, ...] '{"title": "Hello"}'

# Search for similar vectors
127.0.0.1:6379> VECTOR.SEARCH myindex [0.1, 0.2, ...] TOP 10
```

### Semantic Caching

```bash
# Cache a response by meaning
127.0.0.1:6379> SEMANTIC.SET "What is the capital of France?" "Paris is the capital of France."

# Query with similar phrasing
127.0.0.1:6379> SEMANTIC.GET "France's capital city?" 0.85
"Paris is the capital of France."
```

### Time-Travel Queries

```bash
# Get a value from 1 hour ago
127.0.0.1:6379> GET mykey AS OF -1h

# View change history
127.0.0.1:6379> HISTORY mykey SINCE -24h
```

## Using with Client Libraries

Ferrite works with any standard Redis client. Choose your language:

<Tabs groupId="language">
  <TabItem value="python" label="Python" default>

```python
import redis

# Connect to Ferrite
r = redis.Redis(host='localhost', port=6379)

# Basic operations
r.set('mykey', 'Hello, Ferrite!')
print(r.get('mykey'))

# With connection pool (recommended for production)
pool = redis.ConnectionPool(host='localhost', port=6379, db=0)
r = redis.Redis(connection_pool=pool)
```

**Install:** `pip install redis`

  </TabItem>
  <TabItem value="nodejs" label="Node.js">

```javascript
const Redis = require('ioredis');

// Connect to Ferrite
const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

// Basic operations
await redis.set('mykey', 'Hello, Ferrite!');
const value = await redis.get('mykey');
console.log(value);

// With cluster support
const cluster = new Redis.Cluster([
  { port: 6379, host: '127.0.0.1' },
]);
```

**Install:** `npm install ioredis`

  </TabItem>
  <TabItem value="rust" label="Rust">

```rust
use redis::Commands;

fn main() -> redis::RedisResult<()> {
    // Connect to Ferrite
    let client = redis::Client::open("redis://127.0.0.1/")?;
    let mut con = client.get_connection()?;

    // Basic operations
    con.set("mykey", "Hello, Ferrite!")?;
    let value: String = con.get("mykey")?;
    println!("{}", value);

    Ok(())
}
```

**Install:** Add to `Cargo.toml`:
```toml
[dependencies]
redis = "0.24"
```

  </TabItem>
  <TabItem value="go" label="Go">

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
    rdb := redis.NewClient(&redis.Options{
        Addr: "localhost:6379",
    })

    // Basic operations
    err := rdb.Set(ctx, "mykey", "Hello, Ferrite!", 0).Err()
    if err != nil {
        panic(err)
    }

    val, err := rdb.Get(ctx, "mykey").Result()
    fmt.Println(val)
}
```

**Install:** `go get github.com/redis/go-redis/v9`

  </TabItem>
  <TabItem value="java" label="Java">

```java
import redis.clients.jedis.Jedis;

public class Example {
    public static void main(String[] args) {
        // Connect to Ferrite
        try (Jedis jedis = new Jedis("localhost", 6379)) {
            // Basic operations
            jedis.set("mykey", "Hello, Ferrite!");
            String value = jedis.get("mykey");
            System.out.println(value);
        }
    }
}
```

**Install (Maven):**
```xml
<dependency>
    <groupId>redis.clients</groupId>
    <artifactId>jedis</artifactId>
    <version>5.1.0</version>
</dependency>
```

  </TabItem>
</Tabs>

## Next Steps

- [Configuration](/docs/getting-started/configuration) - Customize Ferrite settings
- [Embedded Mode](/docs/guides/embedded-mode) - Use Ferrite as a library
- [Persistence](/docs/guides/persistence) - Configure durability options
