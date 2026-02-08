---
sidebar_position: 3
title: Node.js Thin Client
description: Use ioredis to connect to Ferrite with a thin wrapper for Ferrite-specific commands like vector search and semantic caching.
keywords: [nodejs, ioredis, ferrite javascript, vector search node, semantic cache node]
---

# Node.js Thin Client

Ferrite is wire-compatible with Redis, so [ioredis](https://github.com/redis/ioredis) works for all standard commands. This guide shows how to add a thin wrapper for Ferrite-specific extensions.

## Installation

```bash
npm install ioredis
```

No additional packages are needed. The `FerriteClient` wrapper below uses only ioredis.

## Standard Redis Operations

All standard Redis commands work directly through ioredis:

```javascript
const Redis = require("ioredis");

const client = new Redis({ host: "localhost", port: 6380 });

// Standard operations — identical to Redis
await client.set("user:1:name", "Alice");
const name = await client.get("user:1:name");

await client.hset("user:1", { name: "Alice", email: "alice@example.com" });
const user = await client.hgetall("user:1");

await client.lpush("queue:jobs", "job-123", "job-456");
const job = await client.rpop("queue:jobs");

await client.zadd("leaderboard", 100, "alice", 95, "bob");
const top = await client.zrevrange("leaderboard", 0, 9, "WITHSCORES");
```

## Raw Ferrite Commands

You can execute any Ferrite-specific command directly via `call()`:

```javascript
// Create a vector index
await client.call(
  "VECTOR.INDEX.CREATE", "embeddings",
  "DIM", 384, "DISTANCE", "COSINE", "TYPE", "HNSW"
);

// Add a vector
const vector = Buffer.from(new Float32Array([0.1, 0.2, 0.3]).buffer);
await client.call("VECTOR.ADD", "embeddings", "doc:1", vector);

// Search vectors
const results = await client.call(
  "VECTOR.SEARCH", "embeddings", vector, "TOP_K", 10
);
```

## FerriteClient Wrapper

For a cleaner API, use this thin wrapper that provides typed methods for Ferrite extensions while preserving full access to the underlying ioredis client.

```javascript
const Redis = require("ioredis");

/**
 * A single result from a vector search.
 */
class VectorSearchResult {
  constructor(id, score, metadata = {}) {
    this.id = id;
    this.score = score;
    this.metadata = metadata;
  }

  toString() {
    return `VectorSearchResult(id=${this.id}, score=${this.score.toFixed(4)})`;
  }
}

/**
 * Thin wrapper around ioredis that adds Ferrite-specific methods.
 *
 * All standard Redis methods are available via the `.redis` property
 * or by calling them directly (proxied via Proxy).
 */
class FerriteClient {
  /**
   * @param {import("ioredis").RedisOptions} options - ioredis connection options
   */
  constructor(options = {}) {
    const { host = "localhost", port = 6380, ...rest } = options;
    this.redis = new Redis({ host, port, ...rest });

    // Proxy standard Redis methods to the underlying client
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) return target[prop];
        const val = target.redis[prop];
        if (typeof val === "function") return val.bind(target.redis);
        return val;
      },
    });
  }

  async close() {
    await this.redis.quit();
  }

  // ── Vector Search (Stable) ──────────────────────────────────────────

  /**
   * Create a vector index.
   * @param {string} index - Name of the vector index
   * @param {number} dim - Dimensionality of vectors
   * @param {object} [opts]
   * @param {string} [opts.distance="COSINE"] - Distance metric: COSINE, L2, IP
   * @param {string} [opts.indexType="HNSW"] - Index algorithm: HNSW, IVF
   */
  async vectorCreate(index, dim, { distance = "COSINE", indexType = "HNSW" } = {}) {
    return this.redis.call(
      "VECTOR.INDEX.CREATE", index,
      "DIM", dim, "DISTANCE", distance, "TYPE", indexType
    );
  }

  /**
   * Add a vector to an index.
   * @param {string} index - Name of the vector index
   * @param {string} key - Unique identifier for this vector
   * @param {number[]} vector - Array of floats (embedding)
   * @param {Record<string, string>} [metadata] - Optional metadata
   */
  async vectorAdd(index, key, vector, metadata = {}) {
    const blob = Buffer.from(new Float32Array(vector).buffer);
    const args = ["VECTOR.ADD", index, key, blob];
    for (const [k, v] of Object.entries(metadata)) {
      args.push(k, v);
    }
    return this.redis.call(...args);
  }

  /**
   * Search for nearest vectors.
   * @param {string} index - Name of the vector index
   * @param {number[]} vector - Query vector
   * @param {object} [opts]
   * @param {number} [opts.topK=10] - Number of results
   * @param {string} [opts.filter] - Metadata filter expression
   * @returns {Promise<VectorSearchResult[]>}
   */
  async vectorSearch(index, vector, { topK = 10, filter } = {}) {
    const blob = Buffer.from(new Float32Array(vector).buffer);
    const args = ["VECTOR.SEARCH", index, blob, "TOP_K", topK];
    if (filter) args.push("FILTER", filter);
    const raw = await this.redis.call(...args);
    return FerriteClient._parseVectorResults(raw);
  }

  /**
   * Remove a vector from an index.
   * @param {string} index
   * @param {string} key
   */
  async vectorDelete(index, key) {
    return this.redis.call("VECTOR.DEL", index, key);
  }

  /**
   * Drop a vector index.
   * @param {string} index
   */
  async vectorIndexDrop(index) {
    return this.redis.call("VECTOR.INDEX.DROP", index);
  }

  // ── Semantic Cache (Stable) ──────────────────────────────────────────

  /**
   * Store a value with semantic (meaning-based) lookup.
   * @param {string} key - Namespace or cache key prefix
   * @param {string} text - Text whose meaning is used for matching
   * @param {string} value - Value to cache
   * @param {object} [opts]
   * @param {number} [opts.ttl] - TTL in seconds
   */
  async semanticSet(key, text, value, { ttl } = {}) {
    const args = ["SEMANTIC.SET", key, text, value];
    if (ttl !== undefined) args.push("EX", ttl);
    return this.redis.call(...args);
  }

  /**
   * Retrieve a cached value by semantic similarity.
   * @param {string} key - Namespace or cache key prefix
   * @param {string} text - Query text to match
   * @param {object} [opts]
   * @param {number} [opts.threshold=0.85] - Minimum similarity (0.0–1.0)
   * @returns {Promise<string|null>}
   */
  async semanticGet(key, text, { threshold = 0.85 } = {}) {
    const result = await this.redis.call(
      "SEMANTIC.GET", key, text, "THRESHOLD", threshold
    );
    return result || null;
  }

  /**
   * Delete a semantic cache entry.
   * @param {string} key
   */
  async semanticDelete(key) {
    return this.redis.call("SEMANTIC.DEL", key);
  }

  // ── CRDT Operations (Experimental) ───────────────────────────────────

  /**
   * Increment a CRDT counter.
   * @experimental API may change.
   */
  async crdtCounterIncr(key, amount = 1) {
    return this.redis.call("CRDT.COUNTER.INCR", key, amount);
  }

  /**
   * Get the value of a CRDT counter.
   * @experimental API may change.
   */
  async crdtCounterGet(key) {
    return this.redis.call("CRDT.COUNTER.GET", key);
  }

  /**
   * Add members to a CRDT set (OR-Set).
   * @experimental API may change.
   */
  async crdtSetAdd(key, ...members) {
    return this.redis.call("CRDT.SET.ADD", key, ...members);
  }

  /**
   * Get all members of a CRDT set.
   * @experimental API may change.
   */
  async crdtSetMembers(key) {
    return this.redis.call("CRDT.SET.MEMBERS", key);
  }

  // ── CDC — Change Data Capture (Experimental) ─────────────────────────

  /**
   * Subscribe to change data capture events matching a key pattern.
   * @experimental API may change.
   */
  async cdcSubscribe(pattern) {
    return this.redis.call("CDC.SUBSCRIBE", pattern);
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  static _parseVectorResults(raw) {
    if (!raw || !Array.isArray(raw)) return [];
    const results = [];
    let i = typeof raw[0] === "number" ? 1 : 0; // skip count header
    while (i < raw.length - 1) {
      const id = String(raw[i]);
      const score = parseFloat(raw[i + 1]);
      const metadata = {};
      i += 2;
      if (i < raw.length && Array.isArray(raw[i])) {
        const pairs = raw[i];
        for (let j = 0; j < pairs.length - 1; j += 2) {
          metadata[String(pairs[j])] = String(pairs[j + 1]);
        }
        i += 1;
      }
      results.push(new VectorSearchResult(id, score, metadata));
    }
    return results;
  }
}

module.exports = { FerriteClient, VectorSearchResult };
```

### TypeScript Version

```typescript
import Redis, { RedisOptions } from "ioredis";

interface VectorSearchOptions {
  topK?: number;
  filter?: string;
}

interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, string>;
}

interface SemanticGetOptions {
  threshold?: number;
}

class FerriteClient {
  public readonly redis: Redis;

  constructor(options: RedisOptions & { host?: string; port?: number } = {}) {
    const { host = "localhost", port = 6380, ...rest } = options;
    this.redis = new Redis({ host, port, ...rest });
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  async vectorCreate(
    index: string,
    dim: number,
    opts: { distance?: string; indexType?: string } = {}
  ): Promise<unknown> {
    const { distance = "COSINE", indexType = "HNSW" } = opts;
    return this.redis.call(
      "VECTOR.INDEX.CREATE", index,
      "DIM", dim, "DISTANCE", distance, "TYPE", indexType
    );
  }

  async vectorAdd(
    index: string,
    key: string,
    vector: number[],
    metadata: Record<string, string> = {}
  ): Promise<unknown> {
    const blob = Buffer.from(new Float32Array(vector).buffer);
    const args: (string | number | Buffer)[] = ["VECTOR.ADD", index, key, blob];
    for (const [k, v] of Object.entries(metadata)) {
      args.push(k, v);
    }
    return this.redis.call(...(args as [string, ...unknown[]]));
  }

  async vectorSearch(
    index: string,
    vector: number[],
    opts: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    const { topK = 10, filter } = opts;
    const blob = Buffer.from(new Float32Array(vector).buffer);
    const args: (string | number | Buffer)[] = [
      "VECTOR.SEARCH", index, blob, "TOP_K", topK,
    ];
    if (filter) args.push("FILTER", filter);
    const raw = await this.redis.call(...(args as [string, ...unknown[]]));
    return FerriteClient.parseVectorResults(raw);
  }

  async semanticSet(
    key: string,
    text: string,
    value: string,
    opts: { ttl?: number } = {}
  ): Promise<unknown> {
    const args: (string | number)[] = ["SEMANTIC.SET", key, text, value];
    if (opts.ttl !== undefined) args.push("EX", opts.ttl);
    return this.redis.call(...(args as [string, ...unknown[]]));
  }

  async semanticGet(
    key: string,
    text: string,
    opts: SemanticGetOptions = {}
  ): Promise<string | null> {
    const { threshold = 0.85 } = opts;
    const result = await this.redis.call(
      "SEMANTIC.GET", key, text, "THRESHOLD", threshold
    );
    return (result as string) || null;
  }

  private static parseVectorResults(raw: unknown): VectorSearchResult[] {
    if (!raw || !Array.isArray(raw)) return [];
    const results: VectorSearchResult[] = [];
    let i = typeof raw[0] === "number" ? 1 : 0;
    while (i < raw.length - 1) {
      const id = String(raw[i]);
      const score = parseFloat(raw[i + 1]);
      const metadata: Record<string, string> = {};
      i += 2;
      if (i < raw.length && Array.isArray(raw[i])) {
        const pairs = raw[i];
        for (let j = 0; j < pairs.length - 1; j += 2) {
          metadata[String(pairs[j])] = String(pairs[j + 1]);
        }
        i += 1;
      }
      results.push({ id, score, metadata });
    }
    return results;
  }
}

export { FerriteClient, VectorSearchResult, VectorSearchOptions };
```

## Usage Examples

### Standard + Ferrite Operations Together

```javascript
const { FerriteClient } = require("./ferrite-client");

async function main() {
  const client = new FerriteClient({ host: "localhost", port: 6380 });

  // ── Standard Redis commands (proxied to ioredis) ──
  await client.set("app:version", "2.1.0");
  await client.hset("user:42", { name: "Bob", role: "admin" });

  // ── Vector search ──
  await client.vectorCreate("products", 384, { distance: "COSINE" });

  const embeddings = await generateEmbeddings([
    "Red running shoes",
    "Blue winter jacket",
  ]);

  await client.vectorAdd("products", "sku:1001", embeddings[0], {
    name: "Red running shoes",
    category: "footwear",
  });
  await client.vectorAdd("products", "sku:1002", embeddings[1], {
    name: "Blue winter jacket",
    category: "outerwear",
  });

  const query = await generateEmbedding("lightweight shoes for jogging");
  const results = await client.vectorSearch("products", query, { topK: 5 });
  for (const r of results) {
    console.log(`  ${r.id} (score: ${r.score.toFixed(4)})`);
  }

  // ── Semantic caching ──
  await client.semanticSet(
    "llm:cache",
    "What is Ferrite?",
    "Ferrite is a Redis-compatible ...",
    { ttl: 3600 }
  );

  const cached = await client.semanticGet("llm:cache", "Tell me about Ferrite");
  if (cached) {
    console.log(`Cache hit: ${cached}`);
  }

  await client.close();
}

main().catch(console.error);
```

### Express.js Middleware

```javascript
const express = require("express");
const { FerriteClient } = require("./ferrite-client");

const app = express();
const ferrite = new FerriteClient({ host: "localhost", port: 6380 });

app.get("/search", async (req, res) => {
  const query = req.query.q;
  const embedding = await generateEmbedding(query);
  const results = await ferrite.vectorSearch("products", embedding, { topK: 10 });
  res.json(results);
});

app.get("/cached-answer", async (req, res) => {
  const question = req.query.q;
  const cached = await ferrite.semanticGet("qa:cache", question);
  if (cached) {
    return res.json({ answer: cached, source: "cache" });
  }
  const answer = await callLLM(question);
  await ferrite.semanticSet("qa:cache", question, answer, { ttl: 7200 });
  res.json({ answer, source: "llm" });
});

app.listen(3000);
```

## Command Stability

| Method | Command | Status |
|--------|---------|--------|
| `vectorCreate()` | `VECTOR.INDEX.CREATE` | **Stable** |
| `vectorAdd()` | `VECTOR.ADD` | **Stable** |
| `vectorSearch()` | `VECTOR.SEARCH` | **Stable** |
| `vectorDelete()` | `VECTOR.DEL` | **Stable** |
| `semanticSet()` | `SEMANTIC.SET` | **Stable** |
| `semanticGet()` | `SEMANTIC.GET` | **Stable** |
| `crdtCounterIncr()` | `CRDT.COUNTER.INCR` | Experimental |
| `crdtCounterGet()` | `CRDT.COUNTER.GET` | Experimental |
| `crdtSetAdd()` | `CRDT.SET.ADD` | Experimental |
| `crdtSetMembers()` | `CRDT.SET.MEMBERS` | Experimental |
| `cdcSubscribe()` | `CDC.SUBSCRIBE` | Experimental |

:::warning Experimental commands
Commands marked **Experimental** may have breaking changes between minor releases. Pin your Ferrite server version when using them in production.
:::

## Next Steps

- [Python Thin Client](/docs/sdks/python) — redis-py wrapper
- [Go Thin Client](/docs/sdks/go) — go-redis wrapper
- [Vector Commands Reference](/docs/reference/commands/vector)
- [Semantic Commands Reference](/docs/reference/commands/semantic)
