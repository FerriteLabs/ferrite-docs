---
slug: year-in-review-2025
title: "Ferrite 2025: A Year in Review"
authors: [ferrite-team]
tags: [announcement, community, roadmap]
description: A look back at Ferrite's first year -- major features shipped, performance milestones, community growth, and a preview of what is coming in 2026.
---

One year ago, we open-sourced Ferrite with a bold thesis: a Redis-compatible database could offer tiered storage, native vector search, and embedded mode without sacrificing the sub-microsecond latency that developers expect. Twelve months later, we are proud of how far the project has come.

<!-- truncate -->

## Major Milestones

### Features Shipped

Looking back at the blog posts throughout this year tells the story of the features we delivered:

- **February** -- [First-class OpenTelemetry support](/blog/opentelemetry-observability). Traces, metrics, and structured logs via OTLP with under 2% throughput overhead.
- **April** -- [WebAssembly user-defined functions](/blog/wasm-udf-runtime). Server-side logic in any language that compiles to WASM, with a capability-based sandbox that eliminates the security concerns of Lua scripting.
- **June** -- [AI-native caching with vector search](/blog/ai-native-caching). HNSW and IVF indexes for semantic caching, with out-of-the-box LangChain and LlamaIndex integration.
- **August** -- [Embedded mode and the `lite` feature flag](/blog/edge-embedded-mode). A 5.8 MB binary for edge and IoT deployments, with a library API that eliminates network overhead entirely.
- **September** -- Time-travel queries. Query any key at any historical point in time using the HybridLog's immutable log structure. Invaluable for debugging and auditing.
- **October** -- [Streams and consumer groups](/blog/streams-event-driven). Full Redis Streams compatibility with tiered storage, enabling streams that grow beyond memory.
- **November** -- TLS support with automatic certificate rotation via ACME, making secure deployments the default rather than an afterthought.

### Performance Improvements

Performance is a moving target, and we pushed it forward at every release:

| Metric | January 2025 | December 2025 | Improvement |
|--------|-------------|---------------|-------------|
| GET throughput (hot) | 11.8M ops/s | 14.2M ops/s | +20% |
| SET throughput | 2.6M ops/s | 3.1M ops/s | +19% |
| Vector search (k=10) | 45K ops/s | 68K ops/s | +51% |
| Cold-tier read P99 | 85 us | 52 us | -39% |
| Binary size (lite) | 7.2 MB | 5.8 MB | -19% |

The GET throughput improvement came from optimizing the DashMap shard selection path and reducing allocations in the RESP parser. Vector search gained a 51% boost through SIMD-accelerated distance calculations on x86_64 and ARM NEON.

The cold-tier latency reduction was the result of io_uring submission batching and registered buffer support, which eliminated memory copies on the kernel boundary.

## Community Growth

The numbers speak for themselves:

- **GitHub stars**: 0 to 4,200
- **Contributors**: 3 (founding team) to 47
- **Discord members**: 1,100+
- **Docker pulls**: 28,000+
- **npm downloads** (VS Code extension): 3,400+

We are especially grateful for contributions from the community in areas we did not anticipate:

- **FreeBSD support** was contributed by a community member who needed Ferrite for a network appliance. This led us to improve our platform abstraction layer.
- **Redis Cluster protocol** implementation was driven by three contributors who needed Ferrite in their existing cluster topologies.
- **Prometheus endpoint** (in addition to OTLP) was a popular request that arrived as a clean, well-tested pull request.

## Lessons Learned

**Compatibility matters more than features.** Our most impactful decision was maintaining byte-level compatibility with the Redis RESP protocol. Every Redis client library, every monitoring tool, every migration guide just works. Feature velocity means nothing if users cannot adopt the software.

**Compile-time feature flags pay dividends.** The Cargo feature flag system let us ship a 5.8 MB binary for embedded use and a 42 MB binary with everything included, from the same codebase. Users only pay for what they use.

**Documentation is a feature.** Our most starred GitHub issue in Q1 was "docs are incomplete." We invested heavily in the Docusaurus site, API reference, and tutorials throughout the year. Support questions on Discord dropped by 60% after the documentation rewrite in Q3.

## Roadmap Preview: 2026

Here is what we are working on for the year ahead:

- **Ferrite Cluster GA.** Full Redis Cluster protocol support with automatic slot migration, currently in beta.
- **Multi-model queries.** Combine key-value, vector, graph, and time-series operations in a single query pipeline.
- **Cloud-native tiering.** Automatic offload of cold data to S3, GCS, or Azure Blob Storage.
- **Kubernetes Operator.** Declarative CRD-based management with auto-scaling, backup, and restore.
- **Edge sync protocol.** Replicate embedded Ferrite instances to a centralized cluster for hub-and-spoke architectures.
- **Built-in embedding models.** Generate vector embeddings on the server without an external API call.

## Thank You

Open source is a collaborative effort, and Ferrite would not be where it is without our contributors, early adopters, and the broader Rust community.

To everyone who filed an issue, opened a pull request, answered a question on Discord, or simply gave us a star on GitHub: thank you. You shaped this project in ways we could not have planned.

Here is to an even bigger 2026. If you want to get involved, check out our [good first issues](https://github.com/ferrite-rs/ferrite/labels/good%20first%20issue), join us on [Discord](https://discord.gg/ferrite), or just try Ferrite in your next project and tell us what you think.

---

*The speed of memory, the capacity of disk, the economics of cloud.*
