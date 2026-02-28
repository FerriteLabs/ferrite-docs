# Changelog

All notable changes to Ferrite Documentation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-02-28

### Added
- Consolidated duplicate SDK sidebar entries (merged `sdk/` and `sdks/` into unified "Client SDKs" section)

## [0.1.0] - 2025-01-23

### Added
- **Documentation Site**: Docusaurus 3.9 with dark/light mode, Mermaid diagrams, and MDX support
- **Getting Started**: Installation, quick start, configuration, and client library guides
- **Core Concepts**: Architecture, data types, persistence model, and consistency model
- **Guides**: 9 guides covering embedded mode, server mode, persistence, transactions, vector search, semantic caching, pub/sub, Lua scripting, TTL/expiration
- **Data Models**: Document store, graph database, time-series, full-text search, CRDT documentation
- **AI & ML**: Overview, embeddings, vector indexes, semantic search, RAG pipeline, LLM caching
- **Command Reference**: 28 complete command reference pages covering all data types and Ferrite extensions (strings, lists, hashes, sets, sorted sets, streams, HyperLogLog, geo, bitmap, pub/sub, transactions, scripting, server, cluster, vector, semantic, temporal, document, graph, timeseries, search, CDC, trigger, WASM, CRDT, query, tenant)
- **Client SDKs**: Quick start guides (Python, Node.js, Go, Rust) and comprehensive language references (Rust, Python, TypeScript, Go, Java, C#, PHP, Ruby, Elixir, Swift)
- **AI SDKs**: Overview, Python AI SDK, TypeScript AI SDK
- **Tutorials**: 13 hands-on tutorials (chat app, leaderboard, session store, rate limiter, recommendation engine, semantic search, RAG chatbot, event sourcing, analytics dashboard, multi-tenant SaaS, semantic caching, FerriteQL, embedded IoT)
- **Operations**: Monitoring, observability, backup/restore, performance tuning, troubleshooting, audit logging
- **Deployment**: Docker, Kubernetes, cloud providers, high availability, capacity planning
- **Advanced**: Clustering, replication, security, encryption, RDMA, tiered storage
- **Comparisons**: vs Redis, vs Dragonfly, vs KeyDB, vs Memcached, vs dedicated databases
- **Internals**: HybridLog, epoch reclamation, io_uring, RESP protocol, testing
- **Formal Specifications**: TLA+ specs for 2PC, CRDT GCounter, cluster failover
- **CI/CD**: Automated builds, link checking (weekly + PRs), gitleaks secret scanning, GitHub Pages deployment

[Unreleased]: https://github.com/ferritelabs/ferrite-docs/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ferritelabs/ferrite-docs/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ferritelabs/ferrite-docs/releases/tag/v0.1.0
