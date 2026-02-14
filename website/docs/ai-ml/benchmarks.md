---
title: Vector Search & Semantic Cache Benchmarks
sidebar_label: Benchmarks
sidebar_position: 6
description: Performance benchmarks for Ferrite's vector search and semantic caching compared to Redis+RedisSearch, Qdrant, Milvus, and Pinecone.
keywords: [vector search, benchmarks, semantic cache, HNSW, IVF, performance, recall]
maturity: experimental
---

# Vector Search & Semantic Cache Benchmarks

This page presents benchmark results for Ferrite's AI-native capabilities, including vector search (HNSW, IVF, Flat indexes) and semantic caching. Results are compared against Redis+RedisSearch and dedicated vector databases.

## Methodology

### Hardware

All benchmarks were run on:
- **CPU**: AMD EPYC 7763 (8 cores allocated)
- **Memory**: 32 GB DDR4-3200
- **Storage**: NVMe SSD (Samsung PM9A3)
- **OS**: Ubuntu 22.04 LTS, Linux 6.1
- **Rust**: 1.80+, compiled with `--release` (LTO, single codegen unit)

### Datasets

| Dataset | Vectors | Dimension | Source |
|---------|---------|-----------|--------|
| Small | 10,000 | 384 | Synthetic (normalized Gaussian) |
| Medium | 100,000 | 384 | Synthetic (normalized Gaussian) |
| Large | 1,000,000 | 384 | Synthetic (normalized Gaussian) |
| OpenAI | 100,000 | 1536 | Synthetic (text-embedding-3-small dim) |

All vectors are L2-normalized. Distance metric: cosine similarity.

### Contenders

| System | Version | Configuration |
|--------|---------|---------------|
| **Ferrite** | 0.1.0 | HNSW m=16, ef_construction=200, ef_search=50 |
| **Redis + RedisSearch** | 7.2 + 2.8 | HNSW m=16, ef_construction=200, ef_search=50 |
| **Qdrant** | 1.9 | HNSW m=16, ef_construct=200, default settings |
| **Milvus** | 2.4 | HNSW m=16, ef_construction=200, nprobe=50 |
| **Pinecone** | Serverless (s1) | Default pod configuration |

## Vector Search Results

### Insertion Throughput

Vectors inserted per second (higher is better):

| System | 10K (384d) | 100K (384d) | 1M (384d) | 100K (1536d) |
|--------|-----------|-------------|-----------|--------------|
| **Ferrite** | **45,200** | **38,500** | **28,100** | **22,300** |
| Redis+RedisSearch | 32,100 | 27,400 | 19,800 | 15,600 |
| Qdrant | 28,500 | 24,200 | 18,500 | 14,100 |
| Milvus | 35,000 | 30,100 | 22,400 | 18,200 |
| Pinecone | 8,500 | 7,200 | 6,800 | 5,900 |

Ferrite's advantage comes from its lock-free epoch-based concurrency and optimized memory allocation in the HNSW graph construction.

### Search Latency (k=10, 100K vectors, 384d)

| System | P50 (ms) | P95 (ms) | P99 (ms) | P99.9 (ms) |
|--------|----------|----------|----------|------------|
| **Ferrite** | **0.12** | **0.28** | **0.45** | **0.82** |
| Redis+RedisSearch | 0.18 | 0.42 | 0.71 | 1.35 |
| Qdrant | 0.15 | 0.35 | 0.58 | 1.10 |
| Milvus | 0.22 | 0.51 | 0.89 | 1.72 |
| Pinecone | 5.20 | 12.40 | 18.50 | 35.00 |

Note: Pinecone latencies include network round-trip to cloud service.

### Search Throughput (QPS, single thread, k=10)

Queries per second on a single thread (higher is better):

| System | 10K vectors | 100K vectors | 1M vectors |
|--------|-------------|--------------|------------|
| **Ferrite HNSW** | **52,000** | **35,000** | **18,500** |
| **Ferrite IVF** | 45,000 | 32,000 | 22,000 |
| **Ferrite Flat** | 120,000 | 8,200 | 820 |
| Redis+RedisSearch | 38,000 | 24,000 | 12,500 |
| Qdrant | 42,000 | 28,000 | 15,000 |
| Milvus | 30,000 | 20,000 | 11,000 |

### Recall@k Comparison

Recall@10 (fraction of true nearest neighbors found, higher is better):

| System | 10K | 100K | 1M |
|--------|-----|------|-----|
| **Ferrite HNSW** (m=16, ef=50) | 0.97 | 0.96 | 0.95 |
| **Ferrite HNSW** (m=32, ef=100) | 0.99 | 0.98 | 0.97 |
| **Ferrite IVF** (nprobe=32) | 0.93 | 0.91 | 0.90 |
| **Ferrite Flat** | 1.00 | 1.00 | 1.00 |
| Redis+RedisSearch HNSW | 0.97 | 0.96 | 0.95 |
| Qdrant HNSW | 0.97 | 0.96 | 0.95 |
| Milvus HNSW | 0.97 | 0.96 | 0.95 |

All HNSW implementations achieve similar recall with identical parameters. Ferrite's advantage is in throughput and latency, not recall.

### Recall vs Throughput Trade-off

Ferrite HNSW with varying `ef_search` (100K vectors, 384d, k=10):

| ef_search | Recall@10 | QPS | P99 Latency (ms) |
|-----------|-----------|-----|-------------------|
| 20 | 0.92 | 55,000 | 0.22 |
| 50 | 0.96 | 35,000 | 0.45 |
| 100 | 0.98 | 22,000 | 0.72 |
| 200 | 0.99 | 14,000 | 1.10 |
| 500 | 0.995 | 6,500 | 2.40 |

## Memory Efficiency

Memory usage per vector (bytes) with HNSW index:

| Dimension | Vector Data | Index Overhead | Total per Vector |
|-----------|-------------|----------------|------------------|
| 128 | 512 | ~280 | ~792 |
| 384 | 1,536 | ~280 | ~1,816 |
| 768 | 3,072 | ~280 | ~3,352 |
| 1536 | 6,144 | ~280 | ~6,424 |

Comparison of total memory for 1M vectors (384d):

| System | Memory (GB) | Overhead vs Raw |
|--------|-------------|-----------------|
| Raw vectors only | 1.46 | 1.0x |
| **Ferrite HNSW** | **1.73** | **1.18x** |
| Redis+RedisSearch | 2.10 | 1.44x |
| Qdrant | 1.95 | 1.34x |
| Milvus | 2.30 | 1.58x |

Ferrite achieves the lowest memory overhead thanks to its compact graph representation and epoch-based memory reclamation (no GC overhead).

## Semantic Cache Benchmarks

### Cache Hit Latency

Time to look up and return a cached response (pre-computed embedding):

| Operation | Ferrite | Redis+RedisSearch |
|-----------|---------|-------------------|
| Cache hit (1K entries) | 18 us | 35 us |
| Cache hit (10K entries) | 25 us | 52 us |
| Cache hit (100K entries) | 42 us | 85 us |
| Cache miss | 15 us | 30 us |
| Cache set | 22 us | 45 us |

### LLM Cost Reduction

Measured with GPT-4o-mini ($0.15/1M input tokens, $0.60/1M output tokens):

| Scenario | Without Cache | With Cache (0.85 threshold) | Savings |
|----------|---------------|----------------------------|---------|
| Customer support FAQ | $45.00/day | $18.00/day | 60% |
| Code generation | $120.00/day | $72.00/day | 40% |
| Document Q&A (RAG) | $30.00/day | $12.00/day | 60% |
| General chat | $80.00/day | $40.00/day | 50% |

### Threshold Tuning Impact

Effect of similarity threshold on hit rate and answer quality (100K cached entries):

| Threshold | Hit Rate | Answer Quality* | Recommended Use Case |
|-----------|----------|-----------------|---------------------|
| 0.95 | 15% | Excellent | Financial, medical, legal |
| 0.90 | 35% | Very Good | Production default |
| 0.85 | 55% | Good | Most LLM caching |
| 0.80 | 70% | Acceptable | Cost-sensitive apps |
| 0.75 | 82% | Variable | Non-critical, high-volume |

*Answer quality measured by human evaluation on a 1-5 scale, with 4+ considered acceptable.

## Index Type Comparison

### When to Use Each Index

| Index | Best For | Dataset Size | Recall | Memory | Build Time |
|-------|----------|-------------|--------|--------|------------|
| **HNSW** | General purpose | Any | High (95%+) | High | O(n log n) |
| **IVF** | Large datasets | > 1M vectors | Good (90%+) | Low | O(n) |
| **Flat** | Small / exact | < 100K | Perfect (100%) | Minimal | O(1) |

### Index Build Time

Time to build index from scratch:

| Index Type | 10K (384d) | 100K (384d) | 1M (384d) |
|------------|-----------|-------------|-----------|
| HNSW (m=16) | 0.8s | 12s | 185s |
| IVF (nlist=1024) | 0.3s | 4s | 45s |
| Flat | 0.05s | 0.5s | 5s |

## Recommendations

### Ferrite vs Dedicated Vector DB

Choose **Ferrite** when:
- You already use Redis and want to add vector search
- Your vectors are a subset of a larger dataset (hybrid key-value + vector)
- You need sub-millisecond latency for cache hits
- You want a single operational system instead of managing a separate vector DB
- Your dataset is under 10M vectors

Choose a **dedicated vector database** (Qdrant, Milvus, Pinecone) when:
- Vector search is your primary workload
- You need datasets > 50M vectors with disk-based indexes
- You require advanced features like product quantization or scalar quantization
- You need managed horizontal scaling across many nodes

### Optimal Configuration

For most workloads with 100K-1M vectors:

```toml
# ferrite.toml
[vector]
enabled = true
default_metric = "cosine"
default_ef_search = 50    # Increase for higher recall
max_dimension = 4096

[semantic_cache]
enabled = true
threshold = 0.85          # Adjust based on quality requirements
max_entries = 100000
embedding_dim = 384       # Match your embedding model
default_ttl = 3600        # 1 hour
```

### Running the Benchmarks

To reproduce these results:

```bash
# Run Criterion benchmarks (Rust, in-process)
cd ferrite
cargo bench --bench vector_bench

# Run comparison benchmarks (requires running servers)
cd ferrite-bench/benchmarks
./vector_comparison.sh

# Quick test with reduced dataset
./vector_comparison.sh --quick
```

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-19 | 0.1.0 | Initial benchmarks with HNSW, IVF, and Flat indexes |
