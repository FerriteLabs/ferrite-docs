---
sidebar_position: 1
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# AI & Machine Learning Overview

Ferrite provides native AI/ML capabilities, enabling you to build intelligent applications without external infrastructure.

## Capabilities

### Vector Search

Store and query high-dimensional vectors for similarity search:

- **Multiple index types** - HNSW, IVF, Flat
- **Similarity metrics** - Cosine, Euclidean, Dot Product
- **Hybrid search** - Combine vector and keyword search
- **Filtering** - Pre/post-filter by metadata

```bash
# Create vector index
VECTOR.CREATE products DIMS 384 METRIC cosine INDEX hnsw

# Add vectors
VECTOR.ADD products item1 [0.1, 0.2, 0.3, ...]

# Search similar items
VECTOR.SEARCH products [0.1, 0.2, 0.3, ...] K 10
```

See [Vector Indexes](/docs/ai-ml/vector-indexes) for details.

### Embedding Generation

Generate embeddings from text using built-in or external providers:

- **OpenAI** - text-embedding-3-small, text-embedding-ada-002
- **Cohere** - embed-english-v3.0
- **HuggingFace** - sentence-transformers models
- **Local ONNX** - Run models locally

```bash
# Generate embedding
SEMANTIC.EMBED "What is machine learning?"

# Cache embeddings automatically
SEMANTIC.CACHE.SET "query" "response" [0.1, 0.2, ...]
```

See [Embeddings](/docs/ai-ml/embeddings) for details.

### RAG Pipeline

Build Retrieval-Augmented Generation pipelines:

- **Document ingestion** - PDF, HTML, Markdown, plain text
- **Chunking strategies** - Fixed-size, sentence, semantic
- **Retrieval** - Vector similarity with reranking
- **Context assembly** - Format retrieved chunks for LLMs

```bash
# Create RAG pipeline
RAG.CREATE knowledge EMBEDDING openai CHUNK_SIZE 512

# Ingest documents
RAG.INGEST knowledge "Your document text here..."

# Retrieve relevant context
RAG.CONTEXT knowledge "What is Ferrite?" TOKENS 4096
```

See [RAG Pipeline](/docs/ai-ml/rag-pipeline) for details.

### Semantic Caching

Cache LLM responses based on semantic similarity:

- **Similarity matching** - Return cached responses for similar queries
- **Cost reduction** - Cut LLM API costs by 70-90%
- **Latency reduction** - Cache hits return in microseconds
- **TTL support** - Automatic expiration

```bash
# Check cache
SEMANTIC.CACHE.GET "How do I configure Ferrite?"
# Returns cached response if similar query exists

# Store response
SEMANTIC.CACHE.SET "How do I configure Ferrite?" "To configure Ferrite..."
```

See [LLM Caching](/docs/ai-ml/llm-caching) for details.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI/ML Layer                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Vector    │  │  Embedding  │  │    RAG      │         │
│  │   Store     │  │  Generation │  │  Pipeline   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                   │
│                   ┌──────┴──────┐                           │
│                   │  Semantic   │                           │
│                   │   Cache     │                           │
│                   └─────────────┘                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Ferrite Storage                            │
│            Vectors, Embeddings, Documents                    │
└─────────────────────────────────────────────────────────────┘
```

## Use Cases

### Semantic Search

Build search that understands meaning, not just keywords:

```python
# Traditional keyword search misses this
query = "affordable laptop for students"
# Wouldn't match "budget notebook for college"

# Semantic search finds it
results = client.semantic_search("affordable laptop for students", k=10)
# Returns relevant products even with different wording
```

### Recommendation Systems

Power recommendations with vector similarity:

```python
# Get user's interaction history embeddings
user_vector = client.get_user_embedding(user_id)

# Find similar items
recommendations = client.vector_search(
    index="products",
    vector=user_vector,
    k=20,
    filter={"category": "electronics", "in_stock": True}
)
```

### Question Answering

Build Q&A systems with RAG:

```python
# Ingest knowledge base
client.rag_ingest("knowledge", documents)

# Answer questions
context = client.rag_retrieve("knowledge", "What are Ferrite's features?")
answer = llm.generate(f"Based on: {context}\n\nAnswer: {question}")
```

### Chatbot Memory

Give chatbots long-term memory:

```python
# Store conversation context
client.semantic_cache_set(
    f"user:{user_id}:context",
    conversation_summary,
    embedding=summary_embedding
)

# Retrieve relevant past context
relevant_memories = client.semantic_search(
    f"user:{user_id}:*",
    current_message_embedding,
    k=5
)
```

### Content Moderation

Detect similar content for moderation:

```python
# Check if content is similar to known violations
similar = client.vector_search(
    index="violations",
    vector=content_embedding,
    k=1,
    threshold=0.95  # High similarity threshold
)

if similar:
    flag_for_review(content)
```

### Duplicate Detection

Find duplicate or near-duplicate content:

```python
# Check for duplicates before inserting
duplicates = client.vector_search(
    index="articles",
    vector=article_embedding,
    k=5,
    threshold=0.9
)

if not duplicates:
    client.insert_article(article)
else:
    merge_with_existing(article, duplicates[0])
```

## Performance

| Operation | Latency | Throughput |
|-----------|---------|------------|
| Vector insert | &lt;1ms | 10K/sec |
| Vector search (HNSW, 1M vectors) | &lt;10ms | 1K QPS |
| Embedding generation (cached) | &lt;1ms | - |
| Embedding generation (API) | 50-500ms | Provider limit |
| RAG retrieval | &lt;50ms | - |
| Semantic cache hit | &lt;1ms | - |

## Configuration

```toml
[vector]
enabled = true
default_metric = "cosine"
default_index = "hnsw"

[semantic]
enabled = true
embedding_provider = "openai"
embedding_model = "text-embedding-3-small"
embedding_dimension = 1536
cache_enabled = true
cache_similarity_threshold = 0.85

[rag]
enabled = true
default_chunk_size = 512
default_chunk_overlap = 50
default_retrieval_k = 10
```

## Embedding Provider Configuration

### OpenAI

```toml
[semantic.providers.openai]
api_key = "${OPENAI_API_KEY}"
model = "text-embedding-3-small"
batch_size = 2048
```

### Cohere

```toml
[semantic.providers.cohere]
api_key = "${COHERE_API_KEY}"
model = "embed-english-v3.0"
batch_size = 96
```

### Local ONNX

```toml
[semantic.providers.local]
model_path = "/models/all-MiniLM-L6-v2.onnx"
tokenizer_path = "/models/tokenizer.json"
```

## Best Practices

1. **Choose the right embedding model** - Balance quality vs. cost
2. **Use appropriate vector index** - HNSW for speed, IVF for memory
3. **Set similarity thresholds** - Tune for precision vs. recall
4. **Cache embeddings** - Avoid regenerating for same content
5. **Batch operations** - Group vector inserts and searches
6. **Monitor costs** - Track embedding API usage

## Next Steps

- [Embeddings](/docs/ai-ml/embeddings) - Configure embedding providers
- [Vector Indexes](/docs/ai-ml/vector-indexes) - Index types and tuning
- [Semantic Search](/docs/ai-ml/semantic-search) - Build search applications
- [RAG Pipeline](/docs/ai-ml/rag-pipeline) - Set up document retrieval
- [LLM Caching](/docs/ai-ml/llm-caching) - Reduce LLM costs
