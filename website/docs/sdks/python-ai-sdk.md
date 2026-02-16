---
title: Python AI SDK
description: Semantic caching for LangChain, LlamaIndex, and OpenAI with the Ferrite Python SDK.
sidebar_position: 6
maturity: experimental
---

# Python AI SDK

The `ferrite-ai` package provides semantic caching integrations for Python LLM frameworks.

## Installation

```bash
pip install ferrite-ai

# With framework extras
pip install ferrite-ai[langchain]
pip install ferrite-ai[llamaindex]
pip install ferrite-ai[openai]
pip install ferrite-ai[all]
```

## Core Client

```python
from ferrite_ai import FerriteClient

client = FerriteClient(host="127.0.0.1", port=6380)

# Store
client.semantic_set(
    "What is the capital of France?",
    "Paris is the capital of France.",
    metadata={"source": "geography"},
    ttl=3600,
)

# Retrieve (by meaning, not exact match)
result = client.semantic_get("France's capital city?", threshold=0.85)
if result:
    print(result.response)    # "Paris is the capital of France."
    print(result.similarity)  # 0.92

# Delete
client.semantic_delete("What is the capital of France?")

# Stats
stats = client.semantic_stats()
print(f"Hit rate: {stats.hit_rate:.1%}")
print(f"Entries:  {stats.entry_count}")
```

### API Reference

#### `FerriteClient(host, port, password?, db?, namespace?)`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `host` | `str` | `"127.0.0.1"` | Server hostname |
| `port` | `int` | `6380` | Server port |
| `password` | `str \| None` | `None` | Auth password |
| `db` | `int` | `0` | Database index |
| `namespace` | `str` | `"sem"` | Cache key prefix |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `semantic_set(query, response, metadata?, ttl?)` | `None` | Store a cache entry |
| `semantic_get(query, threshold=0.85)` | `SemanticResult \| None` | Look up by similarity |
| `semantic_delete(query)` | `int` | Delete an entry |
| `semantic_stats()` | `SemanticStats` | Hit rate, entry count, avg similarity |
| `ping()` | `bool` | Check connectivity |
| `close()` | `None` | Close connection |

#### `SemanticResult`

| Field | Type | Description |
|-------|------|-------------|
| `query` | `str` | Original cached query |
| `response` | `str` | Cached response |
| `similarity` | `float` | Cosine similarity score |
| `metadata` | `dict \| None` | Optional metadata |

## LangChain Integration

```python
from langchain.globals import set_llm_cache
from langchain_openai import ChatOpenAI
from ferrite_ai.langchain import FerriteSemanticCache

# Set Ferrite as the global LLM cache
set_llm_cache(FerriteSemanticCache(
    host="127.0.0.1",
    port=6380,
    similarity_threshold=0.85,
    ttl=3600,
    namespace="lc_cache",
))

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# First call → cache MISS → calls OpenAI
response1 = llm.invoke("What is the capital of France?")

# Second call → cache HIT → returns instantly
response2 = llm.invoke("France's capital city?")
```

### `FerriteSemanticCache` Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `host` | `str` | `"127.0.0.1"` | Ferrite host |
| `port` | `int` | `6380` | Ferrite port |
| `similarity_threshold` | `float` | `0.85` | Min similarity for a hit |
| `ttl` | `int \| None` | `None` | Entry TTL in seconds |
| `namespace` | `str` | `"lc_cache"` | Key prefix |
| `client` | `FerriteClient \| None` | `None` | Pre-configured client |

Implements `langchain_core.caches.BaseCache`:
- `lookup(prompt, llm_string)` → `list[Generation] | None`
- `update(prompt, llm_string, return_val)`
- `clear()`

## LlamaIndex Integration

```python
from ferrite_ai.llamaindex import FerriteSemanticCache

cache = FerriteSemanticCache(
    similarity_threshold=0.85,
    ttl=3600,
    namespace="li_cache",
)

# Store
cache.put("What is Ferrite?", "Ferrite is a high-performance KV store.")

# Retrieve
result = cache.get("Tell me about Ferrite")
print(result)  # "Ferrite is a high-performance KV store."

# Delete
cache.delete("What is Ferrite?")
```

### `FerriteSemanticCache` Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `get(query)` | `str \| None` | Retrieve cached response |
| `put(query, response, metadata?)` | `None` | Store a cache entry |
| `delete(query)` | `int` | Remove an entry |
| `clear()` | `None` | Flush namespace |

## OpenAI Wrapper

```python
from ferrite_ai.openai_wrapper import cached_completion

response = cached_completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Explain quantum computing"}],
    threshold=0.85,
    ttl=3600,
)

print(response["choices"][0]["message"]["content"])
print(response["_cache_hit"])  # True on subsequent similar queries
```

### `cached_completion` Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | `str` | `"gpt-4o-mini"` | OpenAI model |
| `messages` | `list[dict]` | *required* | Chat messages |
| `temperature` | `float` | `0` | Sampling temperature |
| `threshold` | `float` | `0.85` | Similarity threshold |
| `ttl` | `int \| None` | `3600` | Cache TTL in seconds |
| `ferrite_host` | `str` | `"127.0.0.1"` | Ferrite host |
| `ferrite_port` | `int` | `6380` | Ferrite port |
| `namespace` | `str` | `"openai_cache"` | Cache namespace |

Returns the standard OpenAI completion dict with an extra `_cache_hit` boolean.

## Examples

Complete example scripts are available in the repository:

- [`examples/basic_caching.py`](https://github.com/ferritelabs/ferrite/blob/main/sdk/python/examples/basic_caching.py) — Simple semantic caching
- [`examples/langchain_integration.py`](https://github.com/ferritelabs/ferrite/blob/main/sdk/python/examples/langchain_integration.py) — Use with LangChain
- [`examples/openai_caching.py`](https://github.com/ferritelabs/ferrite/blob/main/sdk/python/examples/openai_caching.py) — Cache OpenAI API calls
