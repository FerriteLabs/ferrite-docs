---
title: "Node.js Client Guide"
description: Connect to Ferrite from Node.js using ioredis, with TypeScript types, custom Ferrite commands, and code examples.
sidebar_position: 3
maturity: beta
---

# Node.js Client Guide

This guide shows how to connect to Ferrite from Node.js using `ioredis` for basic operations and custom commands for Ferrite-specific features.

## Installation

```bash
npm install ioredis
# or
yarn add ioredis
```

For TypeScript projects:

```bash
npm install ioredis
# Types are included in the ioredis package
```

## Basic Operations with ioredis

### Connecting

```typescript
import Redis from "ioredis";

const redis = new Redis({
  host: "localhost",
  port: 6380,
});

// Verify connectivity
await redis.ping(); // "PONG"
```

### CRUD Operations

```typescript
// Strings
await redis.set("user:1:name", "Alice");
await redis.set("session:abc", "token123", "EX", 3600); // 1-hour TTL

const name = await redis.get("user:1:name"); // "Alice"

// Hashes
await redis.hset("user:1", {
  name: "Alice",
  email: "alice@example.com",
  role: "admin",
});
const user = await redis.hgetall("user:1");

// Lists
await redis.rpush("events", "login", "page_view", "click");
const events = await redis.lrange("events", 0, -1);

// Sets
await redis.sadd("user:1:tags", "premium", "beta-tester");
const isPremium = await redis.sismember("user:1:tags", "premium"); // 1

// Sorted sets
await redis.zadd("leaderboard", 100, "alice", 95, "bob", 110, "carol");
const top3 = await redis.zrevrange("leaderboard", 0, 2, "WITHSCORES");
```

### Caching Pattern

```typescript
async function getUser(userId: string): Promise<User> {
  const cacheKey = `cache:user:${userId}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Miss — fetch from database
  const user = await db.queryUser(userId);

  // Cache for 5 minutes
  await redis.set(cacheKey, JSON.stringify(user), "EX", 300);
  return user;
}
```

## TypeScript Type Definitions

Create type-safe wrappers for Ferrite-specific commands:

```typescript
interface VectorSearchResult {
  id: string;
  score: number;
  fields: Record<string, string>;
}

interface FerriteClient {
  vectorIndexCreate(
    index: string,
    dim: number,
    distance: "COSINE" | "L2" | "IP",
    type: "HNSW" | "FLAT"
  ): Promise<string>;

  vectorAdd(
    index: string,
    id: string,
    vector: Buffer,
    metadata?: Record<string, string>
  ): Promise<string>;

  vectorSearch(
    index: string,
    query: Buffer,
    topK: number
  ): Promise<VectorSearchResult[]>;

  semanticSet(key: string, text: string): Promise<string>;
  semanticGet(key: string, query: string): Promise<string | null>;

  tsAdd(key: string, value: number, timestamp?: string): Promise<string>;
  tsRange(key: string, from: string, to: string): Promise<[string, string][]>;
}
```

### Extending ioredis with Custom Commands

```typescript
import Redis from "ioredis";

// Define custom commands
const redis = new Redis({ host: "localhost", port: 6380 });

redis.defineCommand("vectorSearch", {
  numberOfKeys: 0,
  lua: undefined, // Not a Lua script — uses custom command
});

// Use the call method for Ferrite-specific commands
async function vectorSearch(
  index: string,
  queryVec: Buffer,
  topK: number
): Promise<unknown[]> {
  return redis.call("VECTOR.SEARCH", index, queryVec, "K", topK);
}
```

## Ferrite-Specific Commands

Use `redis.call()` to invoke Ferrite extensions:

### Vector Search

```typescript
// Helper: convert float array to Buffer
function floatsToBuffer(floats: number[]): Buffer {
  const buf = Buffer.alloc(floats.length * 4);
  floats.forEach((f, i) => buf.writeFloatLE(f, i * 4));
  return buf;
}

// Create a vector index
await redis.call(
  "VECTOR.INDEX.CREATE",
  "embeddings",
  "DIM",
  "384",
  "DISTANCE",
  "COSINE",
  "TYPE",
  "HNSW"
);

// Add a vector
const embedding = floatsToBuffer([0.1, 0.2, 0.3 /* ... */]);
await redis.call(
  "VECTOR.ADD",
  "embeddings",
  "doc:1",
  embedding,
  "TEXT",
  "Hello world",
  "CATEGORY",
  "greeting"
);

// Search for similar vectors
const queryVec = floatsToBuffer([0.1, 0.2, 0.3 /* ... */]);
const results = await redis.call(
  "VECTOR.SEARCH",
  "embeddings",
  queryVec,
  "K",
  "10"
);
```

### Semantic Set/Get

```typescript
await redis.call(
  "SEMANTIC.SET",
  "facts:capital",
  "The capital of France is Paris"
);

const result = await redis.call(
  "SEMANTIC.GET",
  "facts:capital",
  "What city is France's capital?"
);
```

### Time Series

```typescript
// Add data points
await redis.call("TS.ADD", "temperature:office", "*", "23.5");
await redis.call("TS.ADD", "temperature:office", "*", "24.0");

// Query last hour
const now = Date.now();
const hourAgo = now - 3600000;
const samples = await redis.call(
  "TS.RANGE",
  "temperature:office",
  String(hourAgo),
  String(now)
);
```

## Pub/Sub

### Publisher

```typescript
await redis.publish("notifications", "New order received");
await redis.publish("events:user:123", "profile_updated");
```

### Subscriber

```typescript
const subscriber = new Redis({ host: "localhost", port: 6380 });

subscriber.subscribe("notifications", (err, count) => {
  console.log(`Subscribed to ${count} channels`);
});

subscriber.psubscribe("events:*");

subscriber.on("message", (channel, message) => {
  console.log(`[${channel}] ${message}`);
});

subscriber.on("pmessage", (pattern, channel, message) => {
  console.log(`[${pattern} → ${channel}] ${message}`);
});
```

:::warning
In ioredis, a client in subscriber mode cannot be used for other commands. Create a separate `Redis` instance for subscriptions.
:::

## Pipelines

```typescript
const pipeline = redis.pipeline();
pipeline.set("key1", "value1");
pipeline.set("key2", "value2");
pipeline.get("key1");
pipeline.get("key2");
const results = await pipeline.exec();
// [[null, "OK"], [null, "OK"], [null, "value1"], [null, "value2"]]
```

## Connection Pooling with Cluster

```typescript
import Redis from "ioredis";

// ioredis has built-in connection pooling
const redis = new Redis({
  host: "localhost",
  port: 6380,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    return err.message.includes("READONLY");
  },
});
```

### Cluster Mode

```typescript
import Redis from "ioredis";

const cluster = new Redis.Cluster(
  [
    { host: "node1", port: 6380 },
    { host: "node2", port: 6380 },
    { host: "node3", port: 6380 },
  ],
  {
    scaleReads: "slave", // Read from replicas
    redisOptions: {
      password: "secret",
    },
  }
);
```

## Error Handling

```typescript
import Redis from "ioredis";

const redis = new Redis({
  host: "localhost",
  port: 6380,
  retryStrategy(times) {
    if (times > 10) {
      return null; // Stop retrying
    }
    return Math.min(times * 100, 3000);
  },
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

redis.on("connect", () => {
  console.log("Connected to Ferrite");
});

redis.on("reconnecting", () => {
  console.log("Reconnecting to Ferrite...");
});
```

## Express.js Integration

```typescript
import express from "express";
import Redis from "ioredis";

const app = express();
const redis = new Redis({ host: "localhost", port: 6380 });

app.get("/user/:id", async (req, res) => {
  const cacheKey = `cache:user:${req.params.id}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return res.json(JSON.parse(cached));
  }

  const user = await db.getUser(req.params.id);
  await redis.set(cacheKey, JSON.stringify(user), "EX", 300);
  res.json(user);
});

app.listen(3000);
```

## Best Practices

1. **Use a single Redis instance** — ioredis handles reconnection and pipelining internally
2. **Set `maxRetriesPerRequest`** — prevent hung requests during connection issues
3. **Use pipelines** for batch operations — reduces round-trips
4. **Create separate instances for Pub/Sub** — subscriber mode blocks other commands
5. **Handle the `error` event** — unhandled errors crash the Node.js process

## Next Steps

- [Python Client Guide](./python) — Connect from Python
- [Go Client Guide](./go) — Connect from Go
- [Rust Client Guide](./rust) — Connect from Rust
- [TypeScript SDK Reference](/docs/sdk/typescript) — Full Ferrite TypeScript SDK
