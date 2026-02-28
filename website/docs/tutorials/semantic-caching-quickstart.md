---
title: "Semantic Caching Quickstart"
sidebar_label: Semantic Caching Quickstart
sidebar_position: 11
description: Get semantic caching running in 5 minutes – reduce LLM API costs with Ferrite.
keywords: [semantic caching, quickstart, tutorial, LLM, OpenAI, Python, Node.js]
maturity: experimental
---

# Semantic Caching Quickstart

Get Ferrite's semantic caching running in **5 minutes**. By the end, you'll have a working cache that deduplicates LLM API calls based on meaning, not exact strings.

## Prerequisites

- **Ferrite server** running locally ([installation guide](/docs/getting-started/installation))
- A Redis client library for your language (e.g., `redis-py`, `ioredis`)
- *(Optional)* An OpenAI API key for real embedding generation

:::tip No API Key? No Problem
Ferrite supports **local ONNX embeddings** out of the box. Build with `--features onnx` and skip the API key entirely.
:::

## Step 1: Start Ferrite with Semantic Caching

Add to your `ferrite.toml`:

```toml
[semantic]
enabled = true

[semantic.cache]
max_entries = 10000
default_threshold = 0.85
default_ttl_secs = 3600

[semantic.embedding]
provider = "openai"              # or "local" for ONNX
model = "text-embedding-3-small"
api_key = "${OPENAI_API_KEY}"
```

Start the server:

```bash
cargo run --release
# or with ONNX (no API key needed):
cargo run --release --features onnx
```

## Step 2: Store Your First Cached Response

Using `ferrite-cli` or any Redis client:

```bash
# Store a query-response pair (Ferrite auto-generates the embedding)
SEMANTIC.CACHE.SET "What is the capital of France?" "Paris is the capital of France."

# Retrieve it with an exact match
SEMANTIC.CACHE.GET "What is the capital of France?"
# → "Paris is the capital of France."

# Retrieve it with a rephrased query — semantic match!
SEMANTIC.CACHE.GET "capital of france?"
# → "Paris is the capital of France."

# Check the similarity score
SEMANTIC.CACHE.GET "Tell me France's capital city" WITHSCORE
# 1) "Paris is the capital of France."
# 2) "0.93"
```

## Step 3: Python Integration

```bash
pip install redis openai
```

```python
import redis
import openai
import time

r = redis.Redis(host="localhost", port=6379)

def ask_llm(prompt: str, threshold: float = 0.85) -> dict:
    """Query LLM with semantic caching — returns answer and metadata."""
    start = time.time()

    # 1. Check the semantic cache
    cached = r.execute_command(
        "SEMANTIC.CACHE.GET", prompt,
        "THRESHOLD", str(threshold),
        "WITHSCORE",
    )

    if cached:
        elapsed = (time.time() - start) * 1000
        return {
            "answer": cached[0].decode(),
            "score": float(cached[1]),
            "source": "cache",
            "latency_ms": round(elapsed, 2),
        }

    # 2. Cache miss — call the LLM
    response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )
    answer = response.choices[0].message.content
    elapsed = (time.time() - start) * 1000

    # 3. Store in cache with 1-hour TTL
    r.execute_command(
        "SEMANTIC.CACHE.SET", prompt, answer,
        "EX", "3600",
    )

    return {
        "answer": answer,
        "score": 1.0,
        "source": "llm",
        "latency_ms": round(elapsed, 2),
    }

# --- Try it ---
result1 = ask_llm("What is machine learning?")
print(f"[{result1['source']}] {result1['latency_ms']}ms — {result1['answer'][:80]}...")

result2 = ask_llm("Explain ML to me")  # Semantic match!
print(f"[{result2['source']}] {result2['latency_ms']}ms — score={result2['score']}")
```

Expected output:

```text
[llm] 823.45ms — Machine learning is a subset of artificial intelligence that enables...
[cache] 2.31ms — score=0.91
```

## Step 4: Node.js / TypeScript Integration

```bash
npm install ioredis openai
```

```typescript
import Redis from "ioredis";
import OpenAI from "openai";

const redis = new Redis();
const openai = new OpenAI();

interface CacheResult {
  answer: string;
  source: "cache" | "llm";
  score: number;
  latencyMs: number;
}

async function askLLM(
  prompt: string,
  threshold = 0.85,
): Promise<CacheResult> {
  const start = performance.now();

  // 1. Check semantic cache
  const cached = (await redis.call(
    "SEMANTIC.CACHE.GET", prompt,
    "THRESHOLD", String(threshold),
    "WITHSCORE",
  )) as [string, string] | null;

  if (cached) {
    return {
      answer: cached[0],
      source: "cache",
      score: parseFloat(cached[1]),
      latencyMs: Math.round(performance.now() - start),
    };
  }

  // 2. Cache miss — call LLM
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });
  const answer = completion.choices[0].message.content!;

  // 3. Store with 1-hour TTL
  await redis.call(
    "SEMANTIC.CACHE.SET", prompt, answer,
    "EX", "3600",
  );

  return {
    answer,
    source: "llm",
    score: 1.0,
    latencyMs: Math.round(performance.now() - start),
  };
}

// --- Try it ---
(async () => {
  const r1 = await askLLM("What is machine learning?");
  console.log(`[${r1.source}] ${r1.latencyMs}ms`);

  const r2 = await askLLM("Explain ML to me"); // Semantic hit!
  console.log(`[${r2.source}] ${r2.latencyMs}ms — score=${r2.score}`);

  await redis.quit();
})();
```

## Step 5: Measure Cache Hit Rates

Monitor your cache performance in real-time:

```bash
# Overall stats
SEMANTIC.CACHE.STATS
```

```text
entries: 1523
hits: 8472
misses: 2104
hit_rate: 0.801
avg_similarity: 0.912
evictions: 0
memory_bytes: 4521984
```

Key metrics to track:

| Metric | Target | Action if Below Target |
|---|---|---|
| `hit_rate` | > 60% | Lower threshold (e.g., 0.85 → 0.82) or increase TTL |
| `avg_similarity` | > threshold + 0.05 | Threshold is well-calibrated |
| `evictions` | ~0 | Increase `max_entries` or reduce TTL |

### Prometheus Integration

Ferrite exposes cache metrics at the `/metrics` endpoint:

```text
ferrite_semantic_cache_hits_total 8472
ferrite_semantic_cache_misses_total 2104
ferrite_semantic_cache_hit_rate 0.801
ferrite_semantic_cache_latency_seconds{quantile="0.5"} 0.000020
ferrite_semantic_cache_latency_seconds{quantile="0.99"} 0.000050
ferrite_semantic_cache_entries 1523
ferrite_semantic_cache_cost_savings_usd 16.94
```

## Run the Built-in Demo

Want to see semantic caching in action without any API keys? Run the bundled benchmark:

```bash
cd ferrite/
cargo run --example semantic_caching_demo
```

This simulates 1,000 LLM queries and outputs hit rates, latency percentiles, and cost savings.

## Next Steps

- 📖 [Semantic Caching Reference](/docs/features/semantic-caching) – Full feature documentation with architecture details
- 🔧 [Configuration Guide](/docs/getting-started/configuration) – All Ferrite configuration options
- 🤖 [LangChain Integration](/docs/integrations/langchain) – Use Ferrite as a LangChain cache backend
- 📊 [Monitoring](/docs/operations/monitoring) – Set up dashboards for cache metrics
- 🏗️ [Build a RAG Chatbot](/docs/tutorials/build-rag-chatbot) – End-to-end RAG tutorial with semantic caching
