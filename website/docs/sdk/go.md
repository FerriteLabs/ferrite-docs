---
sidebar_position: 4
title: Go SDK
description: Official Ferrite Go SDK with idiomatic Go access, connection pooling, context support, and generics.
keywords: [go sdk, golang, ferrite go, redis go client, connection pool]
maturity: beta
---

# Go SDK

The official Ferrite Go SDK provides idiomatic Go access to all Ferrite features with connection pooling, context support, and generics.

## Installation

```bash
go get github.com/ferrite-rs/ferrite-go
```

Requires Go 1.21 or later.

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/ferrite-rs/ferrite-go"
)

func main() {
    ctx := context.Background()

    // Connect to Ferrite
    client, err := ferrite.NewClient(ctx, &ferrite.Options{
        Addr: "localhost:6380",
    })
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    // Basic operations
    err = client.Set(ctx, "key", "value", 0).Err()
    if err != nil {
        log.Fatal(err)
    }

    val, err := client.Get(ctx, "key").Result()
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Value: %s\n", val)
}
```

## Connection Configuration

### Single Connection

```go
import "github.com/ferrite-rs/ferrite-go"

client, err := ferrite.NewClient(ctx, &ferrite.Options{
    Addr:     "localhost:6380",
    Password: "secret",
    Username: "default",
    DB:       0,

    // Timeouts
    DialTimeout:  5 * time.Second,
    ReadTimeout:  30 * time.Second,
    WriteTimeout: 30 * time.Second,

    // Pool settings
    PoolSize:     10,
    MinIdleConns: 5,
    MaxIdleTime:  5 * time.Minute,

    // TLS
    TLSConfig: &tls.Config{
        MinVersion: tls.VersionTLS12,
    },
})
```

### Connection Pool

```go
// The client has built-in connection pooling
client, err := ferrite.NewClient(ctx, &ferrite.Options{
    Addr:         "localhost:6380",
    PoolSize:     100,              // Maximum connections
    MinIdleConns: 10,               // Minimum idle connections
    MaxIdleTime:  5 * time.Minute,  // Close idle connections after
    PoolTimeout:  4 * time.Second,  // Wait for connection
})

// Pool stats
stats := client.PoolStats()
fmt.Printf("Total: %d, Idle: %d, Stale: %d\n",
    stats.TotalConns, stats.IdleConns, stats.StaleConns)
```

### Cluster Connection

```go
cluster, err := ferrite.NewClusterClient(ctx, &ferrite.ClusterOptions{
    Addrs: []string{
        "node1:6380",
        "node2:6380",
        "node3:6380",
    },
    ReadOnly:       true,  // Allow reads from replicas
    RouteByLatency: true,  // Route to lowest latency node
})

// Automatic routing to correct node
err = cluster.Set(ctx, "key", "value", 0).Err()
```

## Data Types

### Strings

```go
// Basic operations
err := client.Set(ctx, "name", "Ferrite", 0).Err()
err = client.Set(ctx, "session", "token123", time.Hour).Err() // With TTL
ok, err := client.SetNX(ctx, "unique", "first", 0).Result() // Set if not exists

name, err := client.Get(ctx, "name").Result()
length, err := client.StrLen(ctx, "name").Result()

// Numeric operations
err = client.Set(ctx, "counter", 0, 0).Err()
newVal, err := client.Incr(ctx, "counter").Result()
newVal, err = client.IncrBy(ctx, "counter", 10).Result()
floatVal, err := client.IncrByFloat(ctx, "counter", 0.5).Result()

// Batch operations
err = client.MSet(ctx, map[string]interface{}{
    "k1": "v1",
    "k2": "v2",
    "k3": "v3",
}).Err()
values, err := client.MGet(ctx, "k1", "k2", "k3").Result()
```

### Lists

```go
// Push operations
count, err := client.LPush(ctx, "queue", "a", "b", "c").Result()
count, err = client.RPush(ctx, "queue", "d", "e", "f").Result()

// Pop operations
item, err := client.LPop(ctx, "queue").Result()
items, err := client.LPopCount(ctx, "queue", 3).Result()

// Blocking pop (for queues)
result, err := client.BLPop(ctx, 5*time.Second, "queue1", "queue2").Result()
if err != ferrite.Nil {
    queue, item := result[0], result[1]
    fmt.Printf("Got %s from %s\n", item, queue)
}

// Range operations
items, err := client.LRange(ctx, "queue", 0, -1).Result()
err = client.LTrim(ctx, "queue", 0, 99).Err() // Keep first 100
```

### Hashes

```go
// Single field operations
err := client.HSet(ctx, "user:1", "name", "Alice").Err()
name, err := client.HGet(ctx, "user:1", "name").Result()

// Multiple fields
err = client.HSet(ctx, "user:1",
    "name", "Alice",
    "email", "alice@example.com",
    "age", "30",
).Err()

// Get all fields
user, err := client.HGetAll(ctx, "user:1").Result()

// Struct mapping with generics
type User struct {
    Name  string `redis:"name"`
    Email string `redis:"email"`
    Age   int    `redis:"age"`
}

var user User
err = client.HGetAll(ctx, "user:1").Scan(&user)
fmt.Printf("Name: %s, Age: %d\n", user.Name, user.Age)
```

### Sets

```go
// Add members
count, err := client.SAdd(ctx, "tags", "go", "database", "redis").Result()

// Check membership
isMember, err := client.SIsMember(ctx, "tags", "go").Result()

// Set operations
common, err := client.SInter(ctx, "tags1", "tags2").Result()
all, err := client.SUnion(ctx, "tags1", "tags2").Result()
diff, err := client.SDiff(ctx, "tags1", "tags2").Result()

// Random members
random, err := client.SRandMember(ctx, "tags").Result()
randoms, err := client.SRandMemberN(ctx, "tags", 3).Result()
```

### Sorted Sets

```go
// Add with scores
err := client.ZAdd(ctx, "leaderboard",
    ferrite.Z{Score: 100, Member: "alice"},
    ferrite.Z{Score: 95, Member: "bob"},
    ferrite.Z{Score: 110, Member: "carol"},
).Err()

// Get rankings
rank, err := client.ZRank(ctx, "leaderboard", "alice").Result()
score, err := client.ZScore(ctx, "leaderboard", "alice").Result()

// Range queries
top10, err := client.ZRevRangeWithScores(ctx, "leaderboard", 0, 9).Result()
for _, z := range top10 {
    fmt.Printf("%s: %.0f\n", z.Member, z.Score)
}

// Score range
highScorers, err := client.ZRangeByScore(ctx, "leaderboard", &ferrite.ZRangeBy{
    Min: "100",
    Max: "+inf",
}).Result()
```

### Streams

```go
// Add entries
id, err := client.XAdd(ctx, &ferrite.XAddArgs{
    Stream: "events",
    ID:     "*",
    Values: map[string]interface{}{
        "type": "click",
        "page": "/home",
    },
}).Result()

// Read entries
entries, err := client.XRange(ctx, "events", "-", "+").Result()

// Consumer groups
err = client.XGroupCreate(ctx, "events", "processors", "$").Err()

streams, err := client.XReadGroup(ctx, &ferrite.XReadGroupArgs{
    Group:    "processors",
    Consumer: "worker-1",
    Streams:  []string{"events", ">"},
    Count:    10,
    Block:    5 * time.Second,
}).Result()

// Acknowledge processing
for _, stream := range streams {
    for _, msg := range stream.Messages {
        // Process message
        client.XAck(ctx, "events", "processors", msg.ID)
    }
}
```

## Extended Features

### Vector Search

```go
import "github.com/ferrite-rs/ferrite-go/vector"

// Create index
err := client.Do(ctx,
    "VECTOR.INDEX.CREATE", "embeddings",
    "DIM", 384,
    "DISTANCE", "COSINE",
    "TYPE", "HNSW",
).Err()

// Add vectors
embedding := []float32{0.1, 0.2, 0.3, /* ... */}
err = vector.Add(ctx, client, "embeddings", "doc:1", embedding, map[string]string{
    "text":     "Hello world",
    "category": "greeting",
})

// Search
queryEmbedding := []float32{0.1, 0.2, 0.3, /* ... */}
results, err := vector.Search(ctx, client, "embeddings", queryEmbedding, &vector.SearchOptions{
    TopK:   10,
    Filter: "category == 'greeting'",
})

for _, r := range results {
    fmt.Printf("ID: %s, Score: %f\n", r.ID, r.Score)
}
```

### Document Store

```go
import "github.com/ferrite-rs/ferrite-go/document"

type Article struct {
    Title  string   `json:"title"`
    Author string   `json:"author"`
    Tags   []string `json:"tags"`
    Views  int      `json:"views"`
}

// Insert document
doc := Article{
    Title:  "Getting Started",
    Author: "Alice",
    Tags:   []string{"tutorial", "beginner"},
    Views:  100,
}

err := document.Insert(ctx, client, "articles", "article:1", doc)

// Query documents
query := document.NewQuery().
    Filter(map[string]interface{}{"author": "Alice"}).
    Sort("views", document.Desc).
    Limit(10)

var articles []Article
err = document.Find(ctx, client, "articles", query, &articles)

// Aggregation
pipeline := document.NewAggregation().
    Match(map[string]interface{}{"author": "Alice"}).
    Group(map[string]interface{}{
        "_id":   "$category",
        "count": map[string]interface{}{"$sum": 1},
    })

results, err := document.Aggregate(ctx, client, "articles", pipeline)
```

### Graph Database

```go
import "github.com/ferrite-rs/ferrite-go/graph"

// Create vertices
err := graph.AddVertex(ctx, client, "social", "user:alice", "User", map[string]string{
    "name": "Alice",
    "age":  "30",
})

err = graph.AddVertex(ctx, client, "social", "user:bob", "User", map[string]string{
    "name": "Bob",
    "age":  "28",
})

// Create edge
err = graph.AddEdge(ctx, client, "social",
    "user:alice", "user:bob", "FOLLOWS",
    map[string]string{"since": "2024-01-01"},
)

// Traverse graph
opts := &graph.TraversalOptions{
    Direction: graph.Out,
    EdgeType:  "FOLLOWS",
    MaxDepth:  2,
}

friends, err := graph.Traverse(ctx, client, "social", "user:alice", opts)

// Query with Cypher-like syntax
results, err := graph.Query(ctx, client, "social",
    "MATCH (a:User)-[:FOLLOWS]->(b:User) WHERE a.name = 'Alice' RETURN b",
)
```

### Time Series

```go
import (
    "github.com/ferrite-rs/ferrite-go/timeseries"
    "time"
)

// Add samples
err := timeseries.Add(ctx, client, "temperature:room1", time.Now(), 23.5)
err = timeseries.AddWithLabels(ctx, client, "temperature:room1", time.Now(), 24.0,
    map[string]string{
        "location": "office",
        "sensor":   "temp-01",
    },
)

// Query range
samples, err := timeseries.Range(ctx, client, "temperature:room1",
    time.Now().Add(-24*time.Hour),
    time.Now(),
    nil,
)

// Aggregated query
hourlyAvg, err := timeseries.Range(ctx, client, "temperature:room1",
    time.Now().Add(-24*time.Hour),
    time.Now(),
    &timeseries.RangeOptions{
        Aggregation: timeseries.Avg,
        BucketSize:  time.Hour,
    },
)
```

### Semantic Search

```go
import "github.com/ferrite-rs/ferrite-go/semantic"

// Configure embedding provider
err := semantic.Config(ctx, client, &semantic.ProviderConfig{
    Provider: semantic.OpenAI,
    APIKey:   os.Getenv("OPENAI_API_KEY"),
    Model:    "text-embedding-3-small",
})

// Create semantic index
err = semantic.CreateIndex(ctx, client, "knowledge", 1536)

// Add text (auto-embeds)
err = semantic.Add(ctx, client, "knowledge", "doc:1", "Ferrite is a Redis replacement")

// Semantic search
results, err := semantic.Search(ctx, client, "knowledge", "What is Ferrite?", &semantic.SearchOptions{
    TopK: 5,
})
```

## Transactions

### Basic Pipeline

```go
// Pipeline (without transaction guarantee)
pipe := client.Pipeline()
pipe.Set(ctx, "key1", "value1", 0)
pipe.Set(ctx, "key2", "value2", 0)
pipe.Get(ctx, "key1")
pipe.Get(ctx, "key2")

cmds, err := pipe.Exec(ctx)
```

### MULTI/EXEC Transaction

```go
// Transaction with MULTI/EXEC
err := client.Watch(ctx, func(tx *ferrite.Tx) error {
    // Read balance
    balance, err := tx.Get(ctx, "account:1:balance").Int()
    if err != nil && err != ferrite.Nil {
        return err
    }

    if balance < 100 {
        return errors.New("insufficient funds")
    }

    // Execute atomically
    _, err = tx.TxPipelined(ctx, func(pipe ferrite.Pipeliner) error {
        pipe.DecrBy(ctx, "account:1:balance", 100)
        pipe.IncrBy(ctx, "account:2:balance", 100)
        return nil
    })
    return err
}, "account:1:balance")

if err == ferrite.TxFailedErr {
    // Key was modified by another client, retry
}
```

## Pub/Sub

### Publishing

```go
err := client.Publish(ctx, "events", "Hello, subscribers!").Err()
```

### Subscribing

```go
pubsub := client.Subscribe(ctx, "events", "notifications")
defer pubsub.Close()

// Pattern subscribe
pubsub.PSubscribe(ctx, "events:*")

// Receive messages (blocking)
for {
    msg, err := pubsub.ReceiveMessage(ctx)
    if err != nil {
        break
    }
    fmt.Printf("Channel %s: %s\n", msg.Channel, msg.Payload)
}

// Or use channel
ch := pubsub.Channel()
for msg := range ch {
    fmt.Printf("Channel %s: %s\n", msg.Channel, msg.Payload)
}
```

## Lua Scripting

```go
// Define script
script := ferrite.NewScript(`
    local current = redis.call('GET', KEYS[1])
    if current then
        return redis.call('SET', KEYS[1], ARGV[1])
    else
        return nil
    end
`)

// Execute script
result, err := script.Run(ctx, client, []string{"mykey"}, "newvalue").Result()

// With type assertion
if result != nil {
    value := result.(string)
    fmt.Printf("Updated value: %s\n", value)
}
```

## Error Handling

```go
import "github.com/ferrite-rs/ferrite-go"

val, err := client.Get(ctx, "key").Result()
switch {
case err == ferrite.Nil:
    fmt.Println("Key does not exist")
case err != nil:
    // Check specific error types
    var connErr *ferrite.ConnectionError
    var timeoutErr *ferrite.TimeoutError

    if errors.As(err, &connErr) {
        fmt.Printf("Connection error: %v\n", connErr)
        // Retry logic
    } else if errors.As(err, &timeoutErr) {
        fmt.Printf("Timeout: %v\n", timeoutErr)
    } else {
        fmt.Printf("Error: %v\n", err)
    }
default:
    fmt.Printf("Value: %s\n", val)
}
```

## Context Support

```go
// With timeout
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

val, err := client.Get(ctx, "key").Result()

// With cancellation
ctx, cancel := context.WithCancel(context.Background())
go func() {
    time.Sleep(time.Second)
    cancel() // Cancel operation
}()

val, err := client.Get(ctx, "key").Result()
if errors.Is(err, context.Canceled) {
    fmt.Println("Operation was cancelled")
}
```

## Generics (Go 1.21+)

```go
import "github.com/ferrite-rs/ferrite-go/generic"

// Type-safe get/set
count, err := generic.Get[int](ctx, client, "counter")
err = generic.Set(ctx, client, "counter", 42, 0)

// Type-safe hash operations
type User struct {
    Name  string `redis:"name"`
    Email string `redis:"email"`
    Age   int    `redis:"age"`
}

user, err := generic.HGetAll[User](ctx, client, "user:1")
err = generic.HSet(ctx, client, "user:1", User{
    Name:  "Alice",
    Email: "alice@example.com",
    Age:   30,
})
```

## HTTP Handler Integration

```go
import (
    "net/http"
    "github.com/ferrite-rs/ferrite-go"
)

var client *ferrite.Client

func init() {
    var err error
    client, err = ferrite.NewClient(context.Background(), &ferrite.Options{
        Addr: "localhost:6380",
    })
    if err != nil {
        log.Fatal(err)
    }
}

func getUser(w http.ResponseWriter, r *http.Request) {
    userID := r.URL.Query().Get("id")

    user, err := client.HGetAll(r.Context(), "user:"+userID).Result()
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    json.NewEncoder(w).Encode(user)
}

func main() {
    http.HandleFunc("/user", getUser)
    http.ListenAndServe(":8080", nil)
}
```

## Gin Integration

```go
import (
    "github.com/gin-gonic/gin"
    "github.com/ferrite-rs/ferrite-go"
)

func main() {
    client, _ := ferrite.NewClient(context.Background(), &ferrite.Options{
        Addr: "localhost:6380",
    })

    r := gin.Default()

    // Middleware to inject client
    r.Use(func(c *gin.Context) {
        c.Set("ferrite", client)
        c.Next()
    })

    r.GET("/user/:id", func(c *gin.Context) {
        client := c.MustGet("ferrite").(*ferrite.Client)
        userID := c.Param("id")

        user, err := client.HGetAll(c.Request.Context(), "user:"+userID).Result()
        if err != nil {
            c.JSON(500, gin.H{"error": err.Error()})
            return
        }

        c.JSON(200, user)
    })

    r.Run(":8080")
}
```

## Configuration Reference

```go
import "github.com/ferrite-rs/ferrite-go"

options := &ferrite.Options{
    // Connection
    Addr:     "localhost:6380",
    Network:  "tcp", // or "unix" for Unix sockets
    Password: "",
    Username: "",
    DB:       0,

    // Timeouts
    DialTimeout:  5 * time.Second,
    ReadTimeout:  3 * time.Second,
    WriteTimeout: 3 * time.Second,

    // Connection pool
    PoolSize:        10,
    MinIdleConns:    5,
    MaxIdleTime:     5 * time.Minute,
    PoolTimeout:     4 * time.Second,
    ConnMaxLifetime: 0, // No max lifetime

    // TLS
    TLSConfig: &tls.Config{
        MinVersion:         tls.VersionTLS12,
        InsecureSkipVerify: false,
    },

    // Retry
    MaxRetries:      3,
    MinRetryBackoff: 8 * time.Millisecond,
    MaxRetryBackoff: 512 * time.Millisecond,

    // Hooks
    OnConnect: func(ctx context.Context, cn *ferrite.Conn) error {
        return cn.Ping(ctx).Err()
    },

    // Limiter
    Limiter: nil, // rate.NewLimiter for rate limiting
}

client, err := ferrite.NewClient(ctx, options)
```

## Best Practices

### Connection Pool Sizing

```go
// Rule of thumb: PoolSize = NumCPU * 10
runtime.GOMAXPROCS(0)
poolSize := runtime.NumCPU() * 10

client, _ := ferrite.NewClient(ctx, &ferrite.Options{
    Addr:         "localhost:6380",
    PoolSize:     poolSize,
    MinIdleConns: poolSize / 4,
})
```

### Graceful Shutdown

```go
func main() {
    client, _ := ferrite.NewClient(ctx, &ferrite.Options{
        Addr: "localhost:6380",
    })

    // Handle shutdown
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        <-sigCh
        fmt.Println("Shutting down...")
        client.Close()
        os.Exit(0)
    }()

    // Run application
    runApp(client)
}
```

### Logging

```go
import (
    "log/slog"
    "github.com/ferrite-rs/ferrite-go"
)

// Create client with logging hook
client, _ := ferrite.NewClient(ctx, &ferrite.Options{
    Addr: "localhost:6380",
    OnConnect: func(ctx context.Context, cn *ferrite.Conn) error {
        slog.Info("Connected to Ferrite", "addr", cn.RemoteAddr())
        return nil
    },
})
```

## Next Steps

- [Rust SDK](/docs/sdk/rust) - For Rust applications
- [Python SDK](/docs/sdk/python) - For Python applications
- [SDK Generator](/docs/sdk/generator) - Generate custom SDKs
