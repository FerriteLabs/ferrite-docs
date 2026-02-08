---
sidebar_position: 1
title: Client SDKs Overview
description: How to connect to Ferrite from any language using existing Redis client libraries, plus thin wrappers for Ferrite-specific extensions.
keywords: [ferrite sdk, redis client, client libraries, wire compatibility, RESP protocol]
---

# Client SDKs Overview

Ferrite speaks the Redis wire protocol (RESP2/RESP3), so **any Redis client library works out of the box** for standard commands like `GET`, `SET`, `HSET`, `LPUSH`, `ZADD`, and more.

No special driver is required.

## When Do You Need a Wrapper?

Ferrite extends Redis with commands that standard clients don't have built-in methods for:

| Command Family | Prefix | Status | Description |
|---------------|--------|--------|-------------|
| Vector Search | `VECTOR.*` | **Stable** | HNSW/IVF index creation, vector add/search |
| Semantic Cache | `SEMANTIC.*` | **Stable** | Meaning-based caching with auto-embedding |
| CRDT Operations | `CRDT.*` | Experimental | Conflict-free replicated data types |
| Change Data Capture | `CDC.*` | Experimental | Subscribe to data change streams |
| FerriteQL | `FERRITEQL.*` | Experimental | SQL-like query language |
| Document Store | `DOC.*` | Experimental | JSON document storage and queries |
| Graph | `GRAPH.*` | Experimental | Vertex/edge graph operations |
| Time Series | `TS.*` | Experimental | Time series data ingestion and queries |

For these extension commands, you can either:

1. **Use raw command execution** — Every Redis client supports sending arbitrary commands (e.g., `execute_command()` in redis-py, `call()` in ioredis, `Do()` in go-redis).
2. **Use a thin wrapper** — A lightweight helper class that wraps a standard Redis client and provides typed methods for Ferrite-specific commands.

The guides in this section show both approaches for each language.

## Recommended Client Libraries

| Language | Recommended Client | Package |
|----------|-------------------|---------|
| Python | redis-py | `pip install redis` |
| Node.js | ioredis | `npm install ioredis` |
| Go | go-redis | `go get github.com/redis/go-redis/v9` |
| Rust | See [Rust SDK](/docs/sdk/rust) | `ferrite-client` crate |
| Java | Jedis or Lettuce | `io.lettuce:lettuce-core` |
| C# / .NET | StackExchange.Redis | `dotnet add package StackExchange.Redis` |
| Ruby | redis-rb | `gem install redis` |
| PHP | phpredis or Predis | `composer require predis/predis` |

### Official Redis Client Docs

- [redis-py](https://redis-py.readthedocs.io/) — Python
- [ioredis](https://github.com/redis/ioredis) — Node.js
- [go-redis](https://redis.uptrace.dev/) — Go
- [Jedis](https://github.com/redis/jedis) — Java
- [Lettuce](https://lettuce.io/) — Java (async)
- [StackExchange.Redis](https://stackexchange.github.io/StackExchange.Redis/) — C# / .NET

## Architecture: Thin Client Pattern

```
┌─────────────────────────────────┐
│         Your Application        │
├─────────────────────────────────┤
│   FerriteClient (thin wrapper)  │  ← Typed methods for VECTOR.*, SEMANTIC.*, etc.
├─────────────────────────────────┤
│   Standard Redis Client Lib     │  ← redis-py / ioredis / go-redis
├─────────────────────────────────┤
│      RESP2/RESP3 Protocol       │
├─────────────────────────────────┤
│         Ferrite Server          │
└─────────────────────────────────┘
```

The thin wrapper adds **zero overhead** — it simply translates method calls into the correct `execute_command()` invocations on the underlying Redis client. You retain full access to the Redis client for standard operations.

## Language Guides

- [Python](/docs/sdks/python) — redis-py + FerriteClient wrapper
- [Node.js](/docs/sdks/nodejs) — ioredis + FerriteClient wrapper
- [Go](/docs/sdks/go) — go-redis + FerriteClient wrapper

## Command Reference

For the full list of Ferrite-specific commands and their arguments, see:

- [Vector Commands](/docs/reference/commands/vector)
- [Semantic Commands](/docs/reference/commands/semantic)
- [CRDT Commands](/docs/reference/commands/crdt)
- [CDC Commands](/docs/reference/commands/cdc)
- [FerriteQL](/docs/query/ferriteql)
- [Document Commands](/docs/reference/commands/document)
- [Graph Commands](/docs/reference/commands/graph)
- [Time Series Commands](/docs/reference/commands/timeseries)
