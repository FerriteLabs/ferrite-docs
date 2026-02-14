---
sidebar_position: 7
title: Edge & WASM Runtime
description: Run Ferrite at the edge compiled to WebAssembly. Experimental support for Cloudflare Workers, Vercel Edge, and Fastly Compute@Edge.
keywords: [wasm, webassembly, edge, cloudflare, vercel, fastly, serverless, experimental]
maturity: experimental
---

# Edge & WASM Runtime

Run Ferrite at the edge as a WebAssembly module — lightweight, memory-only caching inside edge runtimes.

:::caution Experimental
Edge WASM support is **experimental**. APIs and capabilities may change. See [ADR-006](https://github.com/ferritelabs/ferrite/blob/main/docs/adr/006-edge-wasm-computing.md) for design rationale and status.
:::

## Overview

Ferrite can be compiled to WebAssembly (WASM) and embedded directly in edge runtime environments. This gives you a local, in-memory key-value store running at the edge — no external cache service required.

**Key benefits:**

- **Edge-local caching** — sub-millisecond access without origin round-trips
- **No infrastructure** — runs inside the edge runtime itself
- **Redis-compatible API subset** — use familiar commands (GET, SET, EXPIRE, INCR, etc.)
- **Tiny footprint** — compiled WASM binary under 2 MB

## How It Works

```
┌──────────────────────────────────────────────────┐
│               Edge Location (PoP)                │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │           Edge Worker / Function            │  │
│  │                                             │  │
│  │  ┌──────────────┐    ┌──────────────────┐   │  │
│  │  │ Application  │───▶│ Ferrite (WASM)   │   │  │
│  │  │   Logic      │    │ In-memory store  │   │  │
│  │  └──────────────┘    └──────────────────┘   │  │
│  │         │                                   │  │
│  └─────────┼───────────────────────────────────┘  │
│            │                                      │
│            ▼                                      │
│     ┌─────────────┐                               │
│     │   Origin    │                               │
│     │   Server    │                               │
│     └─────────────┘                               │
└──────────────────────────────────────────────────┘
```

Ferrite is compiled with the `lite` feature flag to `wasm32-wasi`, producing a compact binary that runs within the WASM sandbox. The edge runtime instantiates the module per-isolate, providing a fast in-memory cache without network calls.

## Supported Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| Cloudflare Workers | 🧪 Experimental | Via `wasm-bindgen`, memory-only |
| Vercel Edge Functions | 🧪 Experimental | WASI-compatible runtime |
| Fastly Compute@Edge | 🧪 Experimental | Native WASI support |
| Deno Deploy | 🔬 Planned | WASM import support |
| AWS Lambda@Edge | 🔬 Planned | Via custom runtime |

:::note
All platforms are currently experimental. Production use is not yet recommended.
:::

## Limitations

Running Ferrite as WASM in an edge runtime has inherent constraints compared to the native Rust binary:

| Feature | Native | WASM (Edge) |
|---------|--------|-------------|
| io_uring | ✅ | ❌ Not available |
| Disk persistence (AOF, checkpoints) | ✅ | ❌ No filesystem |
| Cluster / replication | ✅ | ❌ No outbound TCP |
| TLS termination | ✅ | ❌ Runtime handles TLS |
| Maximum memory | System RAM | Runtime-limited (typically 128 MB) |
| Lua/JS scripting | ✅ | ❌ No nested runtimes |
| Full command set | ✅ | ⚠️ Subset only |

**Available commands in WASM mode:** `GET`, `SET`, `DEL`, `EXISTS`, `EXPIRE`, `TTL`, `INCR`, `DECR`, `MGET`, `MSET`, `HGET`, `HSET`, `HGETALL`, `LPUSH`, `LPOP`, `RPUSH`, `RPOP`, `LRANGE`, `SADD`, `SMEMBERS`, `SISMEMBER`, `KEYS`, `DBSIZE`, `FLUSHDB`, `PING`.

## Build Instructions

### Prerequisites

- Rust 1.88+ with the `wasm32-wasi` target
- `wasm-opt` (from [binaryen](https://github.com/WebAssembly/binaryen)) for optimization

### Compile to WASM

```bash
# Add the WASM target
rustup target add wasm32-wasi

# Build with the lite feature flag (minimal dependencies, no io_uring)
cargo build --target wasm32-wasi --features lite --release

# The output binary
ls target/wasm32-wasi/release/ferrite.wasm
```

### Optimize the Binary

```bash
# Optimize for size (recommended for edge deployment)
wasm-opt -Os -o ferrite-optimized.wasm \
  target/wasm32-wasi/release/ferrite.wasm

# Check the size
ls -lh ferrite-optimized.wasm
# Typically ~1.5–2 MB
```

## Platform Guides

### Cloudflare Workers

#### Project Setup

```bash
npm create cloudflare@latest my-ferrite-edge
cd my-ferrite-edge
```

#### wrangler.toml

```toml
name = "my-ferrite-edge"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[wasm_modules]
FERRITE_WASM = "ferrite-optimized.wasm"
```

#### Worker Code (TypeScript)

```typescript
import initFerrite from "./ferrite-wasm";

interface Env {
  FERRITE_WASM: WebAssembly.Module;
}

let cache: FerriteCacheInstance | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Initialize Ferrite once per isolate
    if (!cache) {
      cache = await initFerrite(env.FERRITE_WASM, {
        maxMemory: "64mb",
        evictionPolicy: "allkeys-lru",
      });
    }

    const url = new URL(request.url);

    // Example: cache API responses
    const cacheKey = `page:${url.pathname}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: { "X-Cache": "HIT" },
      });
    }

    const response = await fetch(request);
    const body = await response.text();

    // Cache for 60 seconds
    cache.set(cacheKey, body, { ex: 60 });

    return new Response(body, {
      headers: { "X-Cache": "MISS" },
    });
  },
};
```

#### Deploy

```bash
npx wrangler deploy
```

### Vercel Edge Functions

```typescript
// api/cached-data.ts
import { initFerrite } from "@ferrite/edge";

export const config = { runtime: "edge" };

const cache = await initFerrite({ maxMemory: "32mb" });

export default async function handler(req: Request) {
  const key = new URL(req.url).searchParams.get("key");

  const cached = cache.get(key);
  if (cached) {
    return new Response(cached, { status: 200 });
  }

  const data = await fetchFromOrigin(key);
  cache.set(key, data, { ex: 120 });

  return new Response(data, { status: 200 });
}
```

### Fastly Compute@Edge

```rust
use fastly::{Request, Response};
use ferrite_wasm::Cache;

static CACHE: once_cell::sync::Lazy<Cache> = once_cell::sync::Lazy::new(|| {
    Cache::new(64 * 1024 * 1024) // 64 MB
});

#[fastly::main]
fn main(req: Request) -> Result<Response, fastly::Error> {
    let cache_key = format!("req:{}", req.get_path());

    if let Some(cached) = CACHE.get(&cache_key) {
        return Ok(Response::from_body(cached)
            .with_header("X-Cache", "HIT"));
    }

    let mut beresp = req.send("origin_backend")?;
    let body = beresp.take_body_str();

    CACHE.set(&cache_key, &body, Some(60));

    Ok(Response::from_body(body)
        .with_header("X-Cache", "MISS"))
}
```

## Use Cases

### Edge Caching

Cache origin responses at the edge to reduce latency and origin load:

```typescript
const html = cache.get(`page:${path}`);
if (!html) {
  const resp = await fetch(originUrl);
  cache.set(`page:${path}`, await resp.text(), { ex: 300 });
}
```

### Session Storage

Store lightweight session tokens at the edge for fast authentication checks:

```typescript
const session = cache.hgetall(`session:${token}`);
if (session?.userId) {
  // User is authenticated — proceed without origin call
}
```

### A/B Testing Data

Cache experiment assignments at the edge for consistent, low-latency bucketing:

```typescript
let variant = cache.get(`ab:${experimentId}:${userId}`);
if (!variant) {
  variant = assignVariant(experimentId, userId);
  cache.set(`ab:${experimentId}:${userId}`, variant, { ex: 3600 });
}
```

### Rate Limiting at the Edge

Enforce rate limits before requests ever reach your origin:

```typescript
const key = `rate:${clientIp}`;
const count = cache.incr(key);
if (count === 1) cache.expire(key, 60);
if (count > 100) {
  return new Response("Too Many Requests", { status: 429 });
}
```

## Current Status

:::info
Edge WASM support is in the **experimental** stage. The `wasm` feature flag is available in the Ferrite build system, but the API surface and platform integrations are still evolving.

Tracked in [ADR-006](https://github.com/ferritelabs/ferrite/blob/main/docs/adr/006-edge-wasm-computing.md).
:::

**What works today:**
- Compiling Ferrite to `wasm32-wasi` with `--features lite`
- Basic key-value operations (strings, hashes, lists, sets)
- TTL / expiration
- LRU eviction

**In progress:**
- Official `@ferrite/edge` npm package for JS/TS bindings
- Platform-specific integration guides with tested examples
- Memory usage profiling and optimization for edge constraints

## Next Steps

- [Docker Deployment](/docs/deployment/docker) — Run Ferrite in containers
- [Kubernetes Deployment](/docs/deployment/kubernetes) — Full cluster deployment
- [Kubernetes Sidecar](/docs/deployment/kubernetes-sidecar) — Per-pod sidecar caching
