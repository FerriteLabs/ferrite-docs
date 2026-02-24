---
title: "Why We Built Ferrite: A Redis Replacement That Doesn't Require All Your RAM"
date: 2026-02-22
author: Jose David Baena
tags: [ferrite, redis, rust, database, announcement]
---

# Why We Built Ferrite

Redis is brilliant. It's fast, simple, and ubiquitous. But after running Redis
in production for years, three problems kept coming up:

## Problem 1: Everything Must Fit in RAM

Redis stores everything in memory. For a 100GB dataset, you need 100GB of RAM
— at $5-10/GB/month on cloud providers. When you hit the memory wall, your
options are: shard more (complexity), evict data (data loss), or upgrade
instances (expensive).

Ferrite solves this with **tiered storage**: hot data in memory, warm data in
mmap files, cold data on disk or S3. An ML-driven advisor learns access
patterns and moves keys automatically. You get 10x dataset capacity at a
fraction of the cost.

## Problem 2: Redis Can't Query

Want to find all active users older than 25? In Redis, you write Lua scripts
or pull everything to the application. Ferrite adds **FerriteQL** — SQL for
key-value data:

```sql
SELECT u.name, u.email
FROM users:* AS u
WHERE u.status = 'active' AND u.age > 25
ORDER BY u.name
LIMIT 50
```

## Problem 3: You Need 5 Databases

Ferrite includes vector search (HNSW/IVF), full-text search (BM25), graph
(Cypher), time-series, JSON documents, and event streaming — all in one binary,
all through the Redis protocol.

## Why Rust?

Thread-per-core with epoch-based reclamation. No GC pauses. io_uring for async
disk I/O. Memory safety without runtime overhead. Single binary, no
dependencies.

## Getting Started

```bash
docker run -p 6379:6379 ferritelabs/ferrite
redis-cli SET hello ferrite
redis-cli GET hello
```

451K lines of Rust. 6,200+ tests. Apache-2.0 license. 20 good-first-issues
ready for contributors.

[GitHub](https://github.com/ferritelabs/ferrite) ·
[Docs](https://docs.ferrite.dev) ·
[Playground](https://play.ferrite.dev)
