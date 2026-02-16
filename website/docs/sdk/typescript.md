---
sidebar_position: 3
title: TypeScript SDK
description: Official Ferrite TypeScript SDK with type-safe access to all features, async/await support for Node.js and Deno.
keywords: [typescript sdk, javascript, nodejs, deno, redis typescript client]
maturity: beta
---

# TypeScript SDK

The official Ferrite TypeScript SDK provides type-safe access to all Ferrite features with full async/await support for Node.js and Deno.

## Installation

```bash
# npm
npm install @ferrite/client

# yarn
yarn add @ferrite/client

# pnpm
pnpm add @ferrite/client

# Deno
import { Ferrite } from "https://deno.land/x/ferrite/mod.ts";
```

## Quick Start

```typescript
import { Ferrite } from "@ferrite/client";

// Connect to Ferrite
const client = new Ferrite({
  host: "localhost",
  port: 6380,
});

await client.connect();

// Basic operations
await client.set("key", "value");
const value = await client.get("key");
console.log(`Value: ${value}`);

// Close connection
await client.disconnect();
```

## Connection Configuration

### Single Connection

```typescript
import { Ferrite, FerriteOptions } from "@ferrite/client";

const options: FerriteOptions = {
  host: "localhost",
  port: 6380,
  password: "secret",
  username: "default",
  database: 0,
  connectTimeout: 5000,
  readTimeout: 30000,
  writeTimeout: 30000,
  tls: {
    ca: fs.readFileSync("/path/to/ca.crt"),
    cert: fs.readFileSync("/path/to/client.crt"),
    key: fs.readFileSync("/path/to/client.key"),
  },
};

const client = new Ferrite(options);
await client.connect();
```

### Connection Pool

```typescript
import { FerritePool, PoolOptions } from "@ferrite/client";

const poolOptions: PoolOptions = {
  host: "localhost",
  port: 6380,
  minConnections: 5,
  maxConnections: 20,
  idleTimeout: 300000,
  connectionTimeout: 5000,
};

const pool = new FerritePool(poolOptions);

// Get connection from pool
const conn = await pool.acquire();
try {
  await conn.set("key", "value");
} finally {
  await pool.release(conn);
}

// Or use withConnection helper
await pool.withConnection(async (conn) => {
  await conn.set("key", "value");
});
```

### Cluster Connection

```typescript
import { FerriteCluster } from "@ferrite/client";

const cluster = new FerriteCluster({
  nodes: [
    { host: "node1", port: 6380 },
    { host: "node2", port: 6380 },
    { host: "node3", port: 6380 },
  ],
  readPreference: "replica", // 'primary' | 'replica' | 'any'
});

await cluster.connect();

// Automatic routing to correct node
await cluster.set("key", "value");
```

## Data Types

### Strings

```typescript
// Basic operations
await client.set("name", "Ferrite");
await client.set("session", "token123", { ex: 3600 }); // With TTL
await client.setNX("unique", "first"); // Set if not exists

const name = await client.get("name");
const length = await client.strlen("name");

// Numeric operations
await client.set("counter", 0);
await client.incr("counter");
await client.incrBy("counter", 10);
await client.incrByFloat("counter", 0.5);

// Batch operations
await client.mset({ k1: "v1", k2: "v2", k3: "v3" });
const values = await client.mget(["k1", "k2", "k3"]);
```

### Lists

```typescript
// Push operations
await client.lPush("queue", ["a", "b", "c"]);
await client.rPush("queue", ["d", "e", "f"]);

// Pop operations
const item = await client.lPop("queue");
const items = await client.lPop("queue", 3);

// Blocking pop (for queues)
const result = await client.blPop(["queue1", "queue2"], 5);
if (result) {
  const [queue, item] = result;
  console.log(`Got ${item} from ${queue}`);
}

// Range operations
const range = await client.lRange("queue", 0, -1);
await client.lTrim("queue", 0, 99); // Keep first 100
```

### Hashes

```typescript
// Single field operations
await client.hSet("user:1", "name", "Alice");
const name = await client.hGet("user:1", "name");

// Multiple fields
await client.hSet("user:1", {
  name: "Alice",
  email: "alice@example.com",
  age: "30",
});

// Get all fields
const user = await client.hGetAll("user:1");

// Type-safe interface mapping
interface User {
  name: string;
  email: string;
  age: number;
}

const user = await client.hGetAll<User>("user:1");
console.log(user.name); // Type-safe access
```

### Sets

```typescript
// Add members
await client.sAdd("tags", ["typescript", "database", "redis"]);

// Check membership
const isMember = await client.sIsMember("tags", "typescript");

// Set operations
const common = await client.sInter(["tags1", "tags2"]);
const all = await client.sUnion(["tags1", "tags2"]);
const diff = await client.sDiff(["tags1", "tags2"]);

// Random members
const random = await client.sRandMember("tags");
const randoms = await client.sRandMember("tags", 3);
```

### Sorted Sets

```typescript
// Add with scores
await client.zAdd("leaderboard", [
  { score: 100, value: "alice" },
  { score: 95, value: "bob" },
  { score: 110, value: "carol" },
]);

// Get rankings
const rank = await client.zRank("leaderboard", "alice");
const score = await client.zScore("leaderboard", "alice");

// Range queries
const top10 = await client.zRevRange("leaderboard", 0, 9, {
  withScores: true,
});

// Score range
const highScorers = await client.zRangeByScore("leaderboard", 100, "+inf");
```

### Streams

```typescript
import { StreamEntry, ReadGroupOptions } from "@ferrite/client";

// Add entries
const id = await client.xAdd("events", "*", {
  type: "click",
  page: "/home",
});

// Read entries
const entries = await client.xRange("events", "-", "+", 100);

// Consumer groups
await client.xGroupCreate("events", "processors", "$", { mkstream: true });

const options: ReadGroupOptions = {
  count: 10,
  block: 5000,
};

const streams = await client.xReadGroup(
  "processors",
  "worker-1",
  [{ key: "events", id: ">" }],
  options
);

// Acknowledge processing
for (const [stream, messages] of streams) {
  for (const { id, fields } of messages) {
    // Process message
    await client.xAck("events", "processors", id);
  }
}
```

## Extended Features

### Vector Search

```typescript
import { VectorIndex, SearchOptions } from "@ferrite/client/vector";

// Create index
await client.executeCommand([
  "VECTOR.INDEX.CREATE",
  "embeddings",
  "DIM",
  "384",
  "DISTANCE",
  "COSINE",
  "TYPE",
  "HNSW",
]);

// Add vectors
const embedding = await model.encode("Hello world"); // Float32Array
await client.vectorAdd("embeddings", "doc:1", embedding, {
  text: "Hello world",
  category: "greeting",
});

// Search
const queryEmbedding = await model.encode("Hi there");
const options: SearchOptions = {
  topK: 10,
  filter: "category == 'greeting'",
};

const results = await client.vectorSearch("embeddings", queryEmbedding, options);

for (const result of results) {
  console.log(`ID: ${result.id}, Score: ${result.score}`);
}
```

### Document Store

```typescript
import { Query, Aggregation } from "@ferrite/client/document";

interface Article {
  title: string;
  author: string;
  tags: string[];
  views: number;
}

// Insert document
const doc: Article = {
  title: "Getting Started",
  author: "Alice",
  tags: ["tutorial", "beginner"],
  views: 100,
};

await client.docInsert("articles", "article:1", doc);

// Query documents
const query = new Query<Article>()
  .filter({ author: "Alice" })
  .sort("views", "desc")
  .limit(10);

const docs = await client.docFind("articles", query);

// Aggregation pipeline
const pipeline = new Aggregation()
  .match({ author: "Alice" })
  .group({ _id: "$category", count: { $sum: 1 } })
  .sort({ count: -1 });

const results = await client.docAggregate("articles", pipeline);
```

### Graph Database

```typescript
import { TraversalOptions, Vertex, Edge } from "@ferrite/client/graph";

// Create vertices
await client.graphVertexAdd("social", "user:alice", "User", {
  name: "Alice",
  age: 30,
});

await client.graphVertexAdd("social", "user:bob", "User", {
  name: "Bob",
  age: 28,
});

// Create edge
await client.graphEdgeAdd(
  "social",
  "user:alice",
  "user:bob",
  "FOLLOWS",
  { since: "2024-01-01" }
);

// Traverse graph
const options: TraversalOptions = {
  direction: "OUT",
  edgeType: "FOLLOWS",
  maxDepth: 2,
};

const friends = await client.graphTraverse("social", "user:alice", options);

// Query with Cypher-like syntax
const results = await client.graphQuery(
  "social",
  "MATCH (a:User)-[:FOLLOWS]->(b:User) WHERE a.name = 'Alice' RETURN b"
);
```

### Time Series

```typescript
import { Sample, AggregationType } from "@ferrite/client/timeseries";

// Add samples
await client.tsAdd("temperature:room1", "*", 23.5);
await client.tsAdd("temperature:room1", "*", 24.0, {
  labels: {
    location: "office",
    sensor: "temp-01",
  },
});

// Add with specific timestamp
await client.tsAdd("temperature:room1", Date.now(), 23.8);

// Query range
const samples = await client.tsRange("temperature:room1", "-", "+");

// Aggregated query
const hourlyAvg = await client.tsRange("temperature:room1", "-24h", "now", {
  aggregation: AggregationType.AVG,
  bucketSize: 3600000, // 1 hour in ms
});
```

### Semantic Search

```typescript
import { EmbeddingProvider, SemanticSearchOptions } from "@ferrite/client/semantic";

// Configure embedding provider
await client.semanticConfig({
  provider: EmbeddingProvider.OpenAI,
  apiKey: process.env.OPENAI_API_KEY!,
  model: "text-embedding-3-small",
});

// Create semantic index
await client.semanticIndexCreate("knowledge", { dimensions: 1536 });

// Add text (auto-embeds)
await client.semanticAdd("knowledge", "doc:1", "Ferrite is a Redis replacement");

// Semantic search
const options: SemanticSearchOptions = {
  topK: 5,
};

const results = await client.semanticSearch("knowledge", "What is Ferrite?", options);
```

## Transactions

### Basic Transaction

```typescript
const result = await client.transaction(async (tx) => {
  const balance = parseInt((await tx.get("account:1:balance")) || "0");

  if (balance >= 100) {
    await tx.decrBy("account:1:balance", 100);
    await tx.incrBy("account:2:balance", 100);
    return true;
  }
  return false;
});
```

### WATCH-based Transaction

```typescript
const result = await client.watchTransaction(
  ["account:1:balance"],
  async (tx) => {
    const balance = parseInt((await tx.get("account:1:balance")) || "0");

    if (balance < 100) {
      return null; // Abort transaction
    }

    return tx
      .multi()
      .decrBy("account:1:balance", 100)
      .incrBy("account:2:balance", 100)
      .exec();
  }
);

if (result === null) {
  console.log("Transaction aborted or key changed");
} else {
  console.log("Transaction committed");
}
```

## Pub/Sub

### Publishing

```typescript
await client.publish("events", "Hello, subscribers!");
```

### Subscribing

```typescript
import { PubSub } from "@ferrite/client";

const pubsub = client.pubsub();

// Subscribe to channels
await pubsub.subscribe("events", "notifications");

// Pattern subscribe
await pubsub.pSubscribe("events:*");

// Handle messages
pubsub.on("message", (channel, message) => {
  console.log(`Channel ${channel}: ${message}`);
});

pubsub.on("pmessage", (pattern, channel, message) => {
  console.log(`Pattern ${pattern} matched ${channel}: ${message}`);
});

// Or use async iterator
for await (const message of pubsub) {
  if (message.type === "message") {
    console.log(`${message.channel}: ${message.data}`);
  }
}
```

## Pipelining

```typescript
// Execute multiple commands in a single round-trip
const pipeline = client.pipeline();

pipeline.set("key1", "value1");
pipeline.set("key2", "value2");
pipeline.get("key1");
pipeline.get("key2");

const results = await pipeline.exec();

// Results are returned in order
const [setResult1, setResult2, value1, value2] = results;
```

## Lua Scripting

```typescript
// Load script
const script = `
  local current = redis.call('GET', KEYS[1])
  if current then
    return redis.call('SET', KEYS[1], ARGV[1])
  else
    return nil
  end
`;

// Register script
const updateIfExists = client.createScript(script);

// Execute
const result = await updateIfExists.run({
  keys: ["mykey"],
  args: ["newvalue"],
});

// Or one-shot execution
const result = await client.eval(script, {
  keys: ["mykey"],
  args: ["newvalue"],
});
```

## Error Handling

```typescript
import {
  FerriteError,
  ConnectionError,
  TimeoutError,
  ResponseError,
} from "@ferrite/client";

try {
  const value = await client.get("key");
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error(`Connection failed: ${error.message}`);
    // Retry logic
  } else if (error instanceof TimeoutError) {
    console.error(`Operation timed out: ${error.message}`);
  } else if (error instanceof ResponseError) {
    console.error(`Server error: ${error.message}`);
  } else if (error instanceof FerriteError) {
    console.error(`General error: ${error.message}`);
  } else {
    throw error;
  }
}
```

## Type Safety

### Generic Methods

```typescript
// Strongly typed get/set
const count = await client.get<number>("counter");
await client.set<User>("user:1", { name: "Alice", age: 30 });

// Type-safe hash operations
interface UserHash {
  name: string;
  email: string;
  age: string; // Hash values are strings
}

const user = await client.hGetAll<UserHash>("user:1");
```

### Zod Integration

```typescript
import { z } from "zod";
import { withValidation } from "@ferrite/client/validation";

const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().positive(),
});

type User = z.infer<typeof UserSchema>;

// Create validated client methods
const validatedClient = withValidation(client, {
  "user:*": UserSchema,
});

// Automatically validates on read
const user = await validatedClient.hGetAll("user:1"); // Type: User
```

## Express Integration

```typescript
import express from "express";
import { Ferrite, FerritePool } from "@ferrite/client";

const app = express();
const pool = new FerritePool({ host: "localhost", port: 6380 });

// Middleware to attach Ferrite connection
app.use(async (req, res, next) => {
  req.ferrite = await pool.acquire();
  res.on("finish", () => pool.release(req.ferrite));
  next();
});

app.get("/user/:id", async (req, res) => {
  const user = await req.ferrite.hGetAll(`user:${req.params.id}`);
  res.json(user);
});

app.post("/user/:id", async (req, res) => {
  await req.ferrite.hSet(`user:${req.params.id}`, req.body);
  res.json({ status: "created" });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

## NestJS Integration

```typescript
// ferrite.module.ts
import { Module, Global } from "@nestjs/common";
import { FerritePool } from "@ferrite/client";

@Global()
@Module({
  providers: [
    {
      provide: "FERRITE_POOL",
      useFactory: async () => {
        const pool = new FerritePool({
          host: process.env.FERRITE_HOST || "localhost",
          port: parseInt(process.env.FERRITE_PORT || "6380"),
          maxConnections: 20,
        });
        await pool.initialize();
        return pool;
      },
    },
  ],
  exports: ["FERRITE_POOL"],
})
export class FerriteModule {}

// user.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { FerritePool } from "@ferrite/client";

@Injectable()
export class UserService {
  constructor(@Inject("FERRITE_POOL") private pool: FerritePool) {}

  async getUser(id: string): Promise<User | null> {
    return this.pool.withConnection(async (conn) => {
      const user = await conn.hGetAll(`user:${id}`);
      return Object.keys(user).length > 0 ? user : null;
    });
  }

  async setUser(id: string, user: User): Promise<void> {
    await this.pool.withConnection((conn) => conn.hSet(`user:${id}`, user));
  }
}
```

## Configuration Reference

```typescript
import { Ferrite, FerriteOptions } from "@ferrite/client";

const options: FerriteOptions = {
  // Connection
  host: "localhost",
  port: 6380,
  password: undefined,
  username: "default",
  database: 0,

  // URL alternative (overrides above)
  url: "ferrite://user:password@localhost:6380/0",

  // Timeouts (milliseconds)
  connectTimeout: 5000,
  readTimeout: 30000,
  writeTimeout: 30000,

  // Socket options
  keepAlive: true,
  keepAliveInitialDelay: 30000,
  noDelay: true,

  // TLS/SSL
  tls: {
    ca: Buffer.from("..."),
    cert: Buffer.from("..."),
    key: Buffer.from("..."),
    rejectUnauthorized: true,
    servername: "localhost",
  },

  // Retry
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,

  // Serialization
  stringNumbers: false, // Return numbers as strings
  enableReadyCheck: true,
  enableOfflineQueue: true,

  // Logging
  logger: console,
  logLevel: "info",
};

const client = new Ferrite(options);
```

## Best Practices

### Connection Management

```typescript
// Use connection pools in production
const pool = new FerritePool({
  host: "localhost",
  port: 6380,
  maxConnections: 20,
  healthCheckInterval: 30000,
});

// Initialize on startup
await pool.initialize();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await pool.close();
  process.exit(0);
});
```

### Error Handling with Retries

```typescript
import { retry } from "@ferrite/client/utils";

const result = await retry(
  () => client.get("key"),
  {
    maxAttempts: 3,
    delay: 100,
    backoff: "exponential",
    onRetry: (error, attempt) => {
      console.log(`Retry ${attempt}: ${error.message}`);
    },
  }
);
```

### Memory Efficiency

```typescript
// Use scan for large key spaces
for await (const key of client.scanIterator({ match: "user:*", count: 100 })) {
  await process(key);
}

// Stream large values
const stream = client.getStream("large:key");
stream.pipe(fs.createWriteStream("output.bin"));
```

## Next Steps

- [Rust SDK](/docs/sdk/rust) - For Rust applications
- [Python SDK](/docs/sdk/python) - For Python applications
- [SDK Generator](/docs/sdk/generator) - Generate custom SDKs
