---
title: TypeScript AI SDK
description: Semantic caching for LangChain.js and OpenAI with the Ferrite TypeScript SDK.
sidebar_position: 7
maturity: experimental
---

# TypeScript AI SDK

The `@ferrite/ai` package provides semantic caching integrations for JavaScript/TypeScript LLM frameworks.

## Installation

```bash
npm install @ferrite/ai

# Peer dependencies (install the ones you need)
npm install @langchain/core   # for LangChain.js integration
npm install openai             # for OpenAI wrapper
```

## Core Client

```typescript
import { FerriteClient } from "@ferrite/ai";

const client = new FerriteClient({ host: "127.0.0.1", port: 6380 });

// Store
await client.semanticSet(
  "What is the capital of France?",
  "Paris is the capital of France.",
  { source: "geography" },
  3600,
);

// Retrieve (by meaning, not exact match)
const result = await client.semanticGet("France's capital city?", 0.85);
if (result) {
  console.log(result.response);   // "Paris is the capital of France."
  console.log(result.similarity);  // 0.92
}

// Delete
await client.semanticDelete("What is the capital of France?");

// Stats
const stats = await client.semanticStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
console.log(`Entries:  ${stats.entryCount}`);

await client.disconnect();
```

### API Reference

#### `new FerriteClient(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | `string` | `"127.0.0.1"` | Server hostname |
| `port` | `number` | `6380` | Server port |
| `password` | `string` | — | Auth password |
| `db` | `number` | `0` | Database index |
| `namespace` | `string` | `"sem"` | Cache key prefix |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `semanticSet(query, response, metadata?, ttl?)` | `Promise<void>` | Store a cache entry |
| `semanticGet(query, threshold?)` | `Promise<SemanticResult \| null>` | Look up by similarity |
| `semanticDelete(query)` | `Promise<number>` | Delete an entry |
| `semanticStats()` | `Promise<SemanticStats>` | Hit rate, entry count, avg similarity |
| `ping()` | `Promise<string>` | Check connectivity |
| `connect()` | `Promise<void>` | Explicitly open connection |
| `disconnect()` | `Promise<void>` | Close connection |

#### `SemanticResult`

| Field | Type | Description |
|-------|------|-------------|
| `query` | `string` | Original cached query |
| `response` | `string` | Cached response |
| `similarity` | `number` | Cosine similarity score |
| `metadata` | `Record<string, unknown>` | Optional metadata |

#### `SemanticStats`

| Field | Type | Description |
|-------|------|-------------|
| `hitCount` | `number` | Total cache hits |
| `missCount` | `number` | Total cache misses |
| `entryCount` | `number` | Cached entry count |
| `avgSimilarity` | `number` | Average similarity score |
| `hitRate` | `number` | Hit ratio (0.0–1.0) |

## LangChain.js Integration

```typescript
import { FerriteSemanticCache } from "@ferrite/ai";

const cache = new FerriteSemanticCache({
  host: "127.0.0.1",
  port: 6380,
  similarityThreshold: 0.85,
  ttl: 3600,
  namespace: "lc_cache",
});

// Use the lookup/update pattern expected by LangChain
const cached = await cache.lookup("What is France's capital?", "gpt-4o-mini");
if (!cached) {
  // Call your LLM, then store the result
  await cache.update("What is France's capital?", "gpt-4o-mini", [
    { text: "Paris is the capital of France." },
  ]);
}
```

### `FerriteSemanticCache` Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | `string` | `"127.0.0.1"` | Ferrite host |
| `port` | `number` | `6380` | Ferrite port |
| `similarityThreshold` | `number` | `0.85` | Min similarity for a hit |
| `ttl` | `number` | — | Entry TTL in seconds |
| `namespace` | `string` | `"lc_cache"` | Key prefix |
| `client` | `FerriteClient` | — | Pre-configured client |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `lookup(prompt, llmString)` | `Promise<Generation[] \| null>` | Look up cached generations |
| `update(prompt, llmString, generations)` | `Promise<void>` | Store generations |
| `clear()` | `Promise<void>` | Flush cache entries |

## OpenAI Wrapper

```typescript
import { cachedCompletion } from "@ferrite/ai";

const response = await cachedCompletion({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Explain quantum computing" }],
  threshold: 0.85,
  ttl: 3600,
});

console.log(response.choices[0].message.content);
console.log(response._cacheHit); // true on subsequent similar queries
```

### `cachedCompletion` Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | `"gpt-4o-mini"` | OpenAI model |
| `messages` | `Array<{role, content}>` | *required* | Chat messages |
| `temperature` | `number` | `0` | Sampling temperature |
| `threshold` | `number` | `0.85` | Similarity threshold |
| `ttl` | `number` | `3600` | Cache TTL in seconds |
| `host` | `string` | `"127.0.0.1"` | Ferrite host |
| `port` | `number` | `6380` | Ferrite port |
| `namespace` | `string` | `"openai_cache"` | Cache namespace |

Returns the standard OpenAI completion object with an extra `_cacheHit` boolean.

## Examples

Complete example scripts are available in the repository:

- [`examples/basic-caching.ts`](https://github.com/ferritelabs/ferrite/blob/main/sdk/typescript/examples/basic-caching.ts) — Simple semantic caching
- [`examples/langchain-integration.ts`](https://github.com/ferritelabs/ferrite/blob/main/sdk/typescript/examples/langchain-integration.ts) — Use with LangChain.js
- [`examples/openai-caching.ts`](https://github.com/ferritelabs/ferrite/blob/main/sdk/typescript/examples/openai-caching.ts) — Cache OpenAI API calls
