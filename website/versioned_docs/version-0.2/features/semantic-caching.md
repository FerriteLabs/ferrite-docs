---
title: Semantic Caching
sidebar_label: Semantic Caching
sidebar_position: 1
description: Reduce LLM API costs by up to 80% with Ferrite's semantic caching – cache responses by meaning, not exact strings.
keywords: [semantic caching, LLM, vector search, cosine similarity, embeddings, cost savings]
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Semantic Caching

Cache LLM responses by **meaning** instead of exact string matching, so differently-worded questions that ask the same thing return a cached answer instantly.

## Why Semantic Caching?

Traditional caches key on the exact request string. Two queries that mean the same thing but are worded differently both trigger expensive LLM calls:

| Approach | "What is Python?" | "Tell me about Python" | Hit? |
|---|---|---|---|
| Exact-match cache | ✅ cached | ❌ miss | No |
| Semantic cache | ✅ cached | ✅ **hit** (93 % similar) | **Yes** |

With semantic caching, Ferrite converts each query into a vector embedding, stores it alongside the response, and uses cosine similarity to find matches above a configurable threshold.

```
User query
   │
   ▼
┌────────────────┐
│ Generate        │
│ Embedding       │
└───────┬────────┘
        │
        ▼
┌────────────────┐   similarity ≥ threshold?
│ Vector Search   │──────────────────────┐
└───────┬────────┘                       │
   No   │                          Yes   │
        ▼                                ▼
┌────────────────┐            ┌────────────────┐
│ Call LLM API   │            │ Return cached   │
│ ($$$, ~500 ms) │            │ response        │
└───────┬────────┘            │ (free, <5 ms)   │
        │                     └────────────────┘
        ▼
┌────────────────┐
│ Cache response  │
│ + embedding     │
└────────────────┘
```

## How It Differs from Exact-Match Caching

| Feature | Exact-Match | Semantic Cache |
|---|---|---|
| Key type | String hash | Vector embedding |
| Match criteria | Byte-identical key | Cosine similarity ≥ threshold |
| Rephrase tolerance | None | High – captures intent |
| Typical hit rate | 20–30 % | **60–80 %** |
| Overhead per lookup | O(1) hash | O(log n) HNSW search |
| Storage | Key → value | Key + embedding → value |

## Configuration

### `ferrite.toml`

```toml
[semantic]
enabled = true

[semantic.cache]
max_entries = 100000         # Maximum cached responses
default_threshold = 0.85     # Cosine-similarity threshold (0.0–1.0)
default_ttl_secs = 3600      # TTL per entry (seconds, 0 = no expiry)

[semantic.index]
type = "hnsw"                # "hnsw" | "flat" | "ivf"
dimensions = 384             # Must match embedding model output
metric = "cosine"            # "cosine" | "euclidean" | "dot"

[semantic.embedding]
provider = "openai"          # "openai" | "cohere" | "local" (ONNX)
model = "text-embedding-3-small"
api_key = "${OPENAI_API_KEY}"
```

### Similarity Threshold Tuning

| Threshold | Behaviour | Recommended For |
|---|---|---|
| 0.95+ | Very strict – near-identical phrasing only | Medical / legal accuracy |
| 0.90 | Strict – minor rephrases allowed | Production default |
| 0.85 | Balanced – good recall, rare false positives | General LLM caching |
| 0.80 | Loose – aggressive caching | Cost-sensitive workloads |

## Cost Savings Analysis

Assuming **GPT-4o-mini** pricing ($0.002 / 1K tokens) and an average of 500 tokens per query:

| Metric | No Cache | Exact Cache | Semantic Cache |
|---|---|---|---|
| Queries | 100,000 | 100,000 | 100,000 |
| API calls | 100,000 | 70,000 | 20,000 |
| Hit rate | 0 % | 30 % | **80 %** |
| API cost | $100.00 | $70.00 | **$20.00** |
| **Savings** | — | $30 (30 %) | **$80 (80 %)** |

> Run the bundled demo to reproduce these numbers on your machine:
>
> ```bash
> cd ferrite/
> cargo run --example semantic_caching_demo
> ```

## API Reference

### SEMANTIC.CACHE.SET

Store a query-response pair with its embedding.

```bash
SEMANTIC.CACHE.SET <query> <response> [EMBEDDING <vector>] [EX <seconds>] [THRESHOLD <0.0-1.0>]
```

```bash
# Auto-embed (requires configured provider)
SEMANTIC.CACHE.SET "What is the capital of France?" "Paris is the capital of France."

# With explicit TTL
SEMANTIC.CACHE.SET "Explain machine learning" "Machine learning is…" EX 3600

# Pre-computed embedding
SEMANTIC.CACHE.SET "What is Rust?" "Rust is a systems language…" EMBEDDING [0.12, -0.03, …]
```

### SEMANTIC.CACHE.GET

Retrieve the best-matching cached response.

```bash
SEMANTIC.CACHE.GET <query> [THRESHOLD <0.0-1.0>] [WITHSCORE]
```

```bash
SEMANTIC.CACHE.GET "What's France's capital city?"
# → "Paris is the capital of France."

SEMANTIC.CACHE.GET "capital of france" WITHSCORE
# 1) "Paris is the capital of France."
# 2) "0.94"
```

### SEMANTIC.CACHE.DEL / CLEAR / INFO / STATS

```bash
SEMANTIC.CACHE.DEL <query>            # Delete specific entry
SEMANTIC.CACHE.CLEAR                  # Flush entire cache
SEMANTIC.CACHE.INFO                   # Configuration summary
SEMANTIC.CACHE.STATS                  # Hit rate, entries, memory
```

## Integration Patterns

### Python

```python
import redis, openai, json

r = redis.Redis()

def cached_llm(prompt: str, threshold: float = 0.85) -> str:
    """Cache-aside pattern with Ferrite semantic cache."""
    # 1. Check cache
    cached = r.execute_command(
        "SEMANTIC.CACHE.GET", prompt,
        "THRESHOLD", str(threshold),
    )
    if cached:
        return cached.decode()

    # 2. Cache miss → call LLM
    resp = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )
    answer = resp.choices[0].message.content

    # 3. Store in semantic cache (auto-embeds)
    r.execute_command(
        "SEMANTIC.CACHE.SET", prompt, answer,
        "EX", "3600",
    )
    return answer
```

#### LangChain Integration

```python
from langchain.cache import BaseCache
from langchain.globals import set_llm_cache

class FerriteSemanticCache(BaseCache):
    def __init__(self, redis_client, threshold=0.85):
        self.r = redis_client
        self.threshold = threshold

    def lookup(self, prompt, llm_string):
        return self.r.execute_command(
            "SEMANTIC.CACHE.GET", prompt,
            "THRESHOLD", str(self.threshold),
        )

    def update(self, prompt, llm_string, response):
        self.r.execute_command(
            "SEMANTIC.CACHE.SET", prompt,
            response[0].text, "EX", "3600",
        )

set_llm_cache(FerriteSemanticCache(redis.Redis()))
```

### Node.js / TypeScript

```typescript
import Redis from "ioredis";
import OpenAI from "openai";

const redis = new Redis();
const openai = new OpenAI();

async function cachedLLM(prompt: string, threshold = 0.85): Promise<string> {
  // 1. Check semantic cache
  const cached = await redis.call(
    "SEMANTIC.CACHE.GET", prompt,
    "THRESHOLD", String(threshold),
  ) as string | null;

  if (cached) return cached;

  // 2. Cache miss → call LLM
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });
  const answer = completion.choices[0].message.content!;

  // 3. Store response (1-hour TTL)
  await redis.call(
    "SEMANTIC.CACHE.SET", prompt, answer,
    "EX", "3600",
  );

  return answer;
}
```

## LlamaIndex Integration

```python
from llama_index.core.llms import CustomLLM
from llama_index.core import Settings
import redis

r = redis.Redis()

class FerriteCache:
    """Drop-in cache for LlamaIndex query pipelines."""
    def __init__(self, threshold=0.85, ttl=3600):
        self.r = r
        self.threshold = threshold
        self.ttl = ttl

    def get(self, query: str) -> str | None:
        result = self.r.execute_command(
            "SEMANTIC.CACHE.GET", query,
            "THRESHOLD", str(self.threshold),
        )
        return result.decode() if result else None

    def put(self, query: str, response: str):
        self.r.execute_command(
            "SEMANTIC.CACHE.SET", query, response,
            "EX", str(self.ttl),
        )

# Use in a RAG pipeline
cache = FerriteCache()

def query_with_cache(query_engine, query: str) -> str:
    cached = cache.get(query)
    if cached:
        return cached
    response = query_engine.query(query)
    cache.put(query, str(response))
    return str(response)
```

## Performance Characteristics

Benchmarked on a 4-core Intel Xeon with 32 GB RAM and NVMe storage:

| Operation | Embedding Source | P50 Latency | P99 Latency | Throughput |
|---|---|---|---|---|
| Cache hit | Pre-embedded (client-side) | 20 µs | 50 µs | 40,000 ops/s |
| Cache hit | Local ONNX (all-MiniLM-L6-v2) | 0.5 ms | 2 ms | 1,000 ops/s |
| Cache hit | OpenAI API (text-embedding-3-small) | 5 ms | 20 ms | 100 ops/s |
| Cache set | Pre-embedded | 30 µs | 80 µs | 25,000 ops/s |
| Cache set | Local ONNX | 0.8 ms | 3 ms | 800 ops/s |
| Cache set | OpenAI API | 8 ms | 25 ms | 80 ops/s |

**Index scaling (HNSW, 384-dim, cosine similarity):**

| Cache Entries | Search P50 | Search P99 | Memory |
|---|---|---|---|
| 10,000 | 18 µs | 45 µs | ~28 MB |
| 100,000 | 22 µs | 60 µs | ~280 MB |
| 1,000,000 | 30 µs | 95 µs | ~2.8 GB |

> Latency scales as O(log n) with HNSW, so even 10× more entries barely affects lookup times.

## Best Practices & Tuning Guide

### Choosing a Similarity Threshold

Start at **0.85** and adjust based on your use case:

- **Too high (> 0.95)**: Very few cache hits – most rephrased queries miss. Use only when incorrect cached answers have severe consequences (medical, legal, financial).
- **Just right (0.85–0.92)**: Best balance of hit rate and accuracy for most LLM applications.
- **Too low (< 0.80)**: High hit rate but risk of returning semantically wrong answers. Monitor false-positive rate.

**Tip:** Use `SEMANTIC.CACHE.GET ... WITHSCORE` during development to inspect similarity scores and calibrate your threshold.

### Embedding Provider Selection

| Provider | Dimensions | Speed | Quality | Cost |
|---|---|---|---|---|
| Local ONNX (MiniLM-L6) | 384 | Fast (~1 ms) | Good | Free |
| OpenAI (text-embedding-3-small) | 1536 | Medium (~10 ms) | Excellent | $0.02/1M tokens |
| Cohere (embed-english-v3.0) | 1024 | Medium (~8 ms) | Excellent | $0.10/1M tokens |
| Custom endpoint | Varies | Varies | Varies | Varies |

**Recommendation:** Start with **local ONNX** for development and testing. Switch to **OpenAI** or **Cohere** in production for higher semantic accuracy, or stay with ONNX if latency and cost are priorities.

### TTL Strategy

- **Factual/static content** (e.g., "What is the capital of France?"): Long TTL (24–72 hours) or no expiry.
- **Dynamic content** (e.g., "What's the weather today?"): Short TTL (5–15 minutes) or skip caching.
- **Mixed workloads**: Use per-entry TTL via `SEMANTIC.CACHE.SET ... EX <seconds>`.

### Memory Management

- Set `max_entries` based on available memory. Each 384-dim entry uses ~1.5 KB (embedding) + response size.
- LRU eviction automatically removes the least-recently-used entries when the cache is full.
- Monitor with `SEMANTIC.CACHE.STATS` to track memory usage and eviction rates.

### Monitoring Cache Quality

```bash
# Check overall cache health
SEMANTIC.CACHE.STATS

# Key metrics to monitor:
#   hit_rate     – target > 60% for well-tuned caches
#   avg_score    – average similarity of hits; if < threshold + 0.05, threshold may be too low
#   evictions    – if high, increase max_entries or reduce TTL
#   entries      – current cache size
```

## Comparison with Alternatives

| Feature | Ferrite Semantic Cache | GPTCache | Redis + vector plugin |
|---|---|---|---|
| **Deployment** | Built-in, zero config | Separate Python service | Redis + RediSearch module |
| **Embedding support** | ONNX, OpenAI, Cohere, custom | OpenAI, HuggingFace, ONNX | External only |
| **Index type** | HNSW (built-in) | FAISS, Milvus (external) | HNSW (RediSearch) |
| **Cache eviction** | LRU + TTL (native) | Manual / custom | TTL only |
| **Protocol** | Redis-compatible (RESP) | Python SDK only | Redis protocol |
| **Latency (cache hit)** | 20–50 µs (pre-embedded) | 1–5 ms | 50–200 µs |
| **Cost tracking** | Built-in metrics | Manual | None |
| **Production resilience** | Circuit breaker, retry, bulkhead | Basic retry | None |
| **Observability** | Prometheus metrics built-in | Limited | RedisInsight |
| **Language support** | Any Redis client | Python only | Any Redis client |

**Key advantages of Ferrite:**

1. **Zero-infrastructure overhead** – No sidecar services, no external vector DBs.
2. **Redis protocol compatible** – Works with any existing Redis client library.
3. **Production-grade resilience** – Built-in circuit breaker, retry with backoff, and bulkhead patterns.
4. **Sub-millisecond lookups** – HNSW index directly in the data path, no network hop to a separate vector store.

## Demo Example

A self-contained benchmark ships with Ferrite that simulates 1,000 LLM queries through a semantic cache and reports hit rate, latency percentiles, and projected cost savings – **no API keys or ONNX runtime required**:

```bash
cargo run --example semantic_caching_demo
```

Sample output:

```
┌──────────────────────────────────────────────────────────────┐
│                        Results                               │
├──────────────────────────────────────────────────────────────┤
│  Total queries        :     1000                             │
│  Cache hits           :      748  (74.8%)                    │
│  Cache misses         :      252  (25.2%)                    │
│  Latency (cache hit)  P50:    2.1 µs   P99:   18.4 µs       │
│  Latency (API call)   P50:  200.3 ms   P99:  201.1 ms       │
├──────────────────────────────────────────────────────────────┤
│  Cost savings         : $0.75 of $1.00  (74.8%)             │
└──────────────────────────────────────────────────────────────┘
```

[View source →](https://github.com/ferritelabs/ferrite/blob/main/examples/semantic_caching_demo.rs)

## Related

- [Semantic Caching Quickstart](/docs/tutorials/semantic-caching-quickstart) – 5-minute getting-started guide
- [LLM Caching](/docs/ai-ml/llm-caching) – full LLM caching guide
- [Semantic Search](/docs/ai-ml/semantic-search) – vector similarity search
- [Vector Indexes](/docs/ai-ml/vector-indexes) – HNSW / IVF index tuning
- [Semantic Commands](/docs/reference/commands/semantic) – complete command reference
- [RAG Pipeline](/docs/ai-ml/rag-pipeline) – retrieval-augmented generation
