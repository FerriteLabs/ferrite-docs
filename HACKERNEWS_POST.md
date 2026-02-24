# Hacker News Launch Post

## Title (80 chars max)

Show HN: Ferrite – A Redis replacement in Rust with tiered storage and SQL queries

## Body

Ferrite is an open-source (Apache-2.0), Redis-compatible key-value store built
in Rust. It's designed for teams that have outgrown Redis's memory-only model
but don't want to give up the Redis API.

Key differences from Redis:

- **Tiered storage**: Data moves automatically between memory → mmap → disk → S3.
  You can handle datasets 10x larger than RAM without OOM crashes. An ML-driven
  advisor optimizes placement based on access patterns.

- **FerriteQL**: SQL-like query language for key-value data. JOINs across key
  patterns, aggregations, materialized views. No more Lua scripts for complex
  queries.

- **Multi-model**: Built-in vector search (HNSW/IVF), full-text search
  (BM25+semantic hybrid), graph (Cypher), time-series, JSON documents, and event
  streaming. One binary instead of Redis + Elasticsearch + Pinecone + Neo4j.

- **Distributed ACID**: Real distributed transactions with 2PC + MVCC, Raft
  consensus for cluster coordination. Not just single-node MULTI/EXEC.

It's written in Rust with a thread-per-core architecture, epoch-based memory
reclamation, and io_uring on Linux. 451K lines of Rust, 6,200+ tests passing.

Quick start:
```
docker run -p 6379:6379 ferritelabs/ferrite
redis-cli SET hello ferrite
redis-cli GET hello
redis-cli QUERY "SELECT * FROM user:* WHERE status = 'active' LIMIT 10"
```

Works with existing Redis clients (ioredis, redis-py, Jedis, go-redis).

This is v0.2.0. We're looking for early adopters and contributors — 20
good-first-issues tagged if you want to get involved.

GitHub: https://github.com/ferritelabs/ferrite
Docs: https://docs.ferrite.dev
Playground: https://play.ferrite.dev

Happy to answer any questions about the architecture or design decisions.


## Posting Notes

- Submit at ~9am EST Tuesday or Wednesday (peak HN traffic)
- Title should start with "Show HN:"
- Don't ask for upvotes
- Be ready to answer questions for the first 2-3 hours
- Common questions to prepare for:
  - "How does it compare to Dragonfly/Valkey?"
  - "What's the Redis compatibility percentage?"
  - "Is it production-ready?"
  - "Why Rust instead of C/C++?"
  - "How does tiered storage affect latency?"
