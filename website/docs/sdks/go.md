---
title: "Go Client Guide"
description: Connect to Ferrite from Go using go-redis, with context handling, connection pooling, and Ferrite-specific command examples.
sidebar_position: 4
maturity: beta
---

# Go Client Guide

This guide shows how to connect to Ferrite from Go using the `go-redis` client library for basic operations and raw commands for Ferrite-specific features.

## Installation

```bash
go get github.com/redis/go-redis/v9
```

Requires Go 1.21 or later.

## Basic Operations with go-redis

### Connecting

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/redis/go-redis/v9"
)

func main() {
    ctx := context.Background()

    rdb := redis.NewClient(&redis.Options{
        Addr:     "localhost:6380",
        Password: "",
        DB:       0,
    })

    // Verify connectivity
    if err := rdb.Ping(ctx).Err(); err != nil {
        log.Fatal(err)
    }
    fmt.Println("Connected to Ferrite")
}
```

### CRUD Operations

```go
ctx := context.Background()

// Strings
rdb.Set(ctx, "user:1:name", "Alice", 0)
rdb.Set(ctx, "session:abc", "token123", time.Hour) // 1-hour TTL

name, err := rdb.Get(ctx, "user:1:name").Result()

// Hashes
rdb.HSet(ctx, "user:1",
    "name", "Alice",
    "email", "alice@example.com",
    "role", "admin",
)
user, err := rdb.HGetAll(ctx, "user:1").Result()

// Lists
rdb.RPush(ctx, "events", "login", "page_view", "click")
events, err := rdb.LRange(ctx, "events", 0, -1).Result()

// Sets
rdb.SAdd(ctx, "user:1:tags", "premium", "beta-tester")
isPremium, err := rdb.SIsMember(ctx, "user:1:tags", "premium").Result()

// Sorted sets
rdb.ZAdd(ctx, "leaderboard",
    redis.Z{Score: 100, Member: "alice"},
    redis.Z{Score: 95, Member: "bob"},
    redis.Z{Score: 110, Member: "carol"},
)
top3, err := rdb.ZRevRangeWithScores(ctx, "leaderboard", 0, 2).Result()
```

### Caching Pattern

```go
func getUser(ctx context.Context, rdb *redis.Client, userID string) (*User, error) {
    cacheKey := fmt.Sprintf("cache:user:%s", userID)

    // Try cache first
    cached, err := rdb.Get(ctx, cacheKey).Result()
    if err == nil {
        var user User
        json.Unmarshal([]byte(cached), &user)
        return &user, nil
    }
    if err != redis.Nil {
        return nil, err // Real error, not a cache miss
    }

    // Miss — fetch from database
    user, err := db.QueryUser(ctx, userID)
    if err != nil {
        return nil, err
    }

    // Cache for 5 minutes
    data, _ := json.Marshal(user)
    rdb.Set(ctx, cacheKey, data, 5*time.Minute)
    return user, nil
}
```

## Context Handling

Go's `context.Context` is passed to every go-redis call, enabling cancellation and timeouts:

### Request-Scoped Timeout

```go
// Timeout for a single operation
ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
defer cancel()

val, err := rdb.Get(ctx, "key").Result()
if errors.Is(err, context.DeadlineExceeded) {
    log.Println("Operation timed out")
}
```

### HTTP Handler Context

```go
func getUserHandler(w http.ResponseWriter, r *http.Request) {
    // Use the request context — cancelled if client disconnects
    user, err := rdb.HGetAll(r.Context(), "user:"+r.URL.Query().Get("id")).Result()
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    json.NewEncoder(w).Encode(user)
}
```

:::tip
Always propagate the request context to Redis calls. This ensures operations are cancelled if the HTTP client disconnects, preventing wasted work.
:::

## Connection Pooling

go-redis includes a built-in connection pool. Configure it via `Options`:

```go
rdb := redis.NewClient(&redis.Options{
    Addr: "localhost:6380",

    // Pool configuration
    PoolSize:     100,              // Max connections
    MinIdleConns: 10,               // Keep warm connections ready
    MaxIdleTime:  5 * time.Minute,  // Close idle connections
    PoolTimeout:  4 * time.Second,  // Wait for a connection
})

// Check pool stats
stats := rdb.PoolStats()
fmt.Printf("Hits: %d, Misses: %d, Timeouts: %d, Total: %d, Idle: %d\n",
    stats.Hits, stats.Misses, stats.Timeouts, stats.TotalConns, stats.IdleConns)
```

:::warning
Set `PoolSize` based on your concurrency level. A good starting point is `GOMAXPROCS * 10`. Too few connections cause pool timeouts; too many waste server resources.
:::

## Ferrite-Specific Commands

Use `rdb.Do()` to execute Ferrite extension commands:

### Vector Search

```go
import (
    "encoding/binary"
    "math"
)

// Helper: convert float slice to bytes
func floatsToBytes(floats []float32) []byte {
    buf := make([]byte, len(floats)*4)
    for i, f := range floats {
        binary.LittleEndian.PutUint32(buf[i*4:], math.Float32bits(f))
    }
    return buf
}

// Create a vector index
err := rdb.Do(ctx,
    "VECTOR.INDEX.CREATE", "embeddings",
    "DIM", 384,
    "DISTANCE", "COSINE",
    "TYPE", "HNSW",
).Err()

// Add a vector
embedding := floatsToBytes([]float32{0.1, 0.2, 0.3})
err = rdb.Do(ctx,
    "VECTOR.ADD", "embeddings", "doc:1",
    embedding,
    "TEXT", "Hello world",
    "CATEGORY", "greeting",
).Err()

// Search for similar vectors
queryVec := floatsToBytes([]float32{0.1, 0.2, 0.3})
results, err := rdb.Do(ctx,
    "VECTOR.SEARCH", "embeddings",
    queryVec,
    "K", 10,
).Result()
```

### Semantic Set/Get

```go
err := rdb.Do(ctx,
    "SEMANTIC.SET", "facts:capital",
    "The capital of France is Paris",
).Err()

result, err := rdb.Do(ctx,
    "SEMANTIC.GET", "facts:capital",
    "What city is France's capital?",
).Text()
```

### Time Series

```go
// Add data points
err := rdb.Do(ctx, "TS.ADD", "temperature:office", "*", 23.5).Err()
err = rdb.Do(ctx, "TS.ADD", "temperature:office", "*", 24.0).Err()

// Query last hour
now := time.Now().UnixMilli()
hourAgo := now - 3600000
samples, err := rdb.Do(ctx,
    "TS.RANGE", "temperature:office",
    hourAgo, now,
).Result()
```

## Pub/Sub

### Publisher

```go
err := rdb.Publish(ctx, "notifications", "New order received").Err()
```

### Subscriber

```go
pubsub := rdb.Subscribe(ctx, "notifications")
defer pubsub.Close()

// Also subscribe to patterns
pubsub.PSubscribe(ctx, "events:*")

ch := pubsub.Channel()
for msg := range ch {
    fmt.Printf("[%s] %s\n", msg.Channel, msg.Payload)
}
```

### Subscriber with Context Cancellation

```go
ctx, cancel := context.WithCancel(context.Background())
defer cancel()

pubsub := rdb.Subscribe(ctx, "notifications")
defer pubsub.Close()

go func() {
    ch := pubsub.Channel()
    for msg := range ch {
        fmt.Printf("[%s] %s\n", msg.Channel, msg.Payload)
    }
}()

// Cancel when done
<-sigCh
cancel()
```

## Pipelines

```go
pipe := rdb.Pipeline()
pipe.Set(ctx, "key1", "value1", 0)
pipe.Set(ctx, "key2", "value2", 0)
getCmd1 := pipe.Get(ctx, "key1")
getCmd2 := pipe.Get(ctx, "key2")

_, err := pipe.Exec(ctx)
if err != nil {
    log.Fatal(err)
}

val1, _ := getCmd1.Result()
val2, _ := getCmd2.Result()
```

## Struct Scanning

```go
type User struct {
    Name  string `redis:"name"`
    Email string `redis:"email"`
    Age   int    `redis:"age"`
}

// Write struct to hash
user := User{Name: "Alice", Email: "alice@example.com", Age: 30}
rdb.HSet(ctx, "user:1", "name", user.Name, "email", user.Email, "age", user.Age)

// Read hash into struct
var loaded User
err := rdb.HGetAll(ctx, "user:1").Scan(&loaded)
fmt.Printf("%+v\n", loaded) // {Name:Alice Email:alice@example.com Age:30}
```

## Error Handling

```go
val, err := rdb.Get(ctx, "key").Result()
switch {
case errors.Is(err, redis.Nil):
    fmt.Println("Key does not exist")
case err != nil:
    fmt.Printf("Error: %v\n", err)
default:
    fmt.Printf("Value: %s\n", val)
}
```

## Best Practices

1. **Always propagate context** — enables timeouts and cancellation
2. **Use `redis.Nil` checks** — distinguish "not found" from errors
3. **Size the pool to your concurrency** — `GOMAXPROCS * 10` is a good starting point
4. **Close the client on shutdown** — call `rdb.Close()` in a defer or shutdown hook
5. **Use pipelines** for batch operations — reduces round-trips

## Next Steps

- [Python Client Guide](./python) — Connect from Python
- [Node.js Client Guide](./nodejs) — Connect from Node.js
- [Rust Client Guide](./rust) — Connect from Rust
- [Go SDK Reference](/docs/sdk/go) — Full Ferrite Go SDK
