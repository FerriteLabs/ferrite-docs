---
sidebar_position: 7
title: Edge & WASM Runtime
description: Planned Ferrite edge-runtime design for WebAssembly platforms. No supported full-server edge artifact is currently published.
keywords: [wasm, webassembly, edge, cloudflare, vercel, fastly, serverless, experimental]
maturity: experimental
---

:::caution[Experimental Feature]
This feature is in the **Experimental** tier (🔬). APIs will change and it is not recommended for production use. See the project ROADMAP for graduation criteria.
:::

# Edge & WASM Runtime

This page describes the planned Ferrite edge runtime. Ferrite does not ship a supported full-server WebAssembly artifact.

## Overview

The planned runtime embeds a local, in-memory key-value store directly in edge environments. The browser playground uses a TypeScript mock rather than a compiled Ferrite server, and the native Ferrite dependency graph does not yet compile for a supported WASM edge target.

**Design goals:**

- **Edge-local caching** — sub-millisecond access without origin round-trips
- **No infrastructure** — runs inside the edge runtime itself
- **Redis-compatible API subset** — use familiar commands (GET, SET, EXPIRE, INCR, etc.)
- **Small footprint target** — size must be measured after a dedicated edge-safe artifact exists

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

The intended design compiles a dedicated edge-safe crate to WebAssembly and instantiates it per isolate. It must not reuse the native server dependency graph until networking, TLS, and platform-specific dependencies are separated behind a verified WASM build.

## Supported Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| Cloudflare Workers | 🔬 Planned | Dedicated `wasm-bindgen` build required |
| Vercel Edge Functions | 🔬 Planned | Dedicated edge-safe build required |
| Fastly Compute@Edge | 🔬 Planned | Dedicated WASI build required |
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

**Planned command subset:** `GET`, `SET`, `DEL`, `EXISTS`, `EXPIRE`, `TTL`, `INCR`, `DECR`, `MGET`, `MSET`, `HGET`, `HSET`, `HGETALL`, `LPUSH`, `LPOP`, `RPUSH`, `RPOP`, `LRANGE`, `SADD`, `SMEMBERS`, `SISMEMBER`, `KEYS`, `DBSIZE`, `FLUSHDB`, `PING`.

## Build Instructions

There is no supported full-server WASM build command in this release line. `cargo build --target wasm32-wasip1 --features lite` still selects native networking and TLS dependencies and is expected to fail. Do not publish an edge artifact until CI contains a dedicated target that builds and exercises the exact output.

Ferrite's separate Forge function SDK supports WebAssembly user functions; see [Forge](/docs/moonshots/forge) for its verified module workflow.

## Non-Runnable Platform Design Sketches

:::warning[Design sketches only]
The following platform snippets are non-runnable architecture sketches. They reference artifacts and APIs such as `ferrite-optimized.wasm`, `./ferrite-wasm`, `@ferrite/edge`, and `ferrite_wasm::Cache` that are not shipped or supported. Do not use them as deployment instructions until CI publishes and tests the referenced artifact for that platform.
:::

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
Edge WASM support is **planned**, not a supported release artifact. The existing `ferrite-wasm` binary is a prototype placeholder, and the `wasm` feature flag enables the native Wasmtime plugin runtime rather than a verified edge-server target.

Tracked in [ADR-006](https://github.com/FerriteLabs/ferrite/blob/main/docs/adrs/adr-006-wasmtime-plugin-runtime.md).
:::

**What works today:**
- Browser documentation playground with mock responses
- Native Ferrite server deployments
- Forge WebAssembly user-function modules through their separate SDK and runtime

**In progress:**
- Official `@ferrite/edge` npm package for JS/TS bindings
- Dedicated edge-safe crate and CI build target
- Platform-specific integration guides with tested examples
- Memory usage profiling and optimization for edge constraints

## Next Steps

- [Docker Deployment](/docs/deployment/docker) — Run Ferrite in containers
- [Kubernetes Deployment](/docs/deployment/kubernetes) — Full cluster deployment
- [Kubernetes Sidecar](/docs/deployment/kubernetes-sidecar) — Per-pod sidecar caching
