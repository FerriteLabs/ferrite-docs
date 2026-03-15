---
sidebar_position: 5
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# RAG Pipeline

Build Retrieval-Augmented Generation (RAG) pipelines to give LLMs access to your data.

## Overview

RAG enhances LLM responses by retrieving relevant context from your documents:

```
┌─────────────────────────────────────────────────────────────┐
│                    RAG Pipeline                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Document Ingestion                                       │
│     ┌──────────┐     ┌──────────┐     ┌──────────┐         │
│     │ Document │ ──▶ │  Chunk   │ ──▶ │  Embed   │         │
│     └──────────┘     └──────────┘     └──────────┘         │
│                                              │               │
│                                              ▼               │
│  2. Storage                          ┌──────────────┐       │
│                                      │ Vector Store │       │
│                                      └──────────────┘       │
│                                              │               │
│  3. Query                                    ▼               │
│     ┌──────────┐     ┌──────────┐     ┌──────────┐         │
│     │  Query   │ ──▶ │ Retrieve │ ──▶ │ Context  │         │
│     └──────────┘     └──────────┘     └──────────┘         │
│                                              │               │
│                                              ▼               │
│  4. Generation                       ┌──────────────┐       │
│                                      │     LLM      │       │
│                                      └──────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Create a Pipeline

```bash
# Create with defaults
RAG.CREATE knowledge

# Create with options
RAG.CREATE docs EMBEDDING openai CHUNK_SIZE 512 CHUNK_OVERLAP 50 DIMENSION 1536
```

### Ingest Documents

```bash
# Single document
RAG.INGEST knowledge "Ferrite is a high-performance key-value store..."

# With metadata
RAG.INGEST knowledge "Document content..." METADATA '{"source": "docs", "title": "Overview"}'

# With custom ID
RAG.INGEST knowledge "Document content..." ID "doc-001"

# Batch ingest
RAG.INGESTBATCH knowledge '[
  {"content": "First document...", "metadata": {"source": "file1"}},
  {"content": "Second document...", "metadata": {"source": "file2"}}
]'
```

### Query

```bash
# Basic retrieval
RAG.RETRIEVE knowledge "What is Ferrite?" COUNT 5

# Get formatted context for LLM
RAG.CONTEXT knowledge "What is Ferrite?" TOKENS 4096 FORMAT markdown

# Advanced search with reranking
RAG.SEARCH knowledge "How do I configure clustering?" HYBRID 0.5 RERANK COUNT 10
```

## Chunking Strategies

### Fixed Size

Split documents into fixed-size chunks:

```bash
RAG.CREATE docs CHUNK_STRATEGY fixed CHUNK_SIZE 512 CHUNK_OVERLAP 50
```

**Pros**: Simple, predictable
**Cons**: May split sentences/paragraphs

### Sentence-Based

Group sentences together:

```bash
RAG.CREATE docs CHUNK_STRATEGY sentence MAX_SENTENCES 10
```

**Pros**: Preserves sentence boundaries
**Cons**: Variable chunk sizes

### Paragraph-Based

Group paragraphs:

```bash
RAG.CREATE docs CHUNK_STRATEGY paragraph MAX_PARAGRAPHS 3
```

**Pros**: Preserves logical structure
**Cons**: Large variation in size

### Recursive

Hierarchical splitting by separators:

```bash
RAG.CREATE docs CHUNK_STRATEGY recursive CHUNK_SIZE 256
```

Splits by: headers → paragraphs → sentences → words

**Pros**: Best structure preservation
**Cons**: More complex

### Semantic (Experimental)

Split by semantic similarity:

```bash
RAG.CREATE docs CHUNK_STRATEGY semantic SIMILARITY_THRESHOLD 0.8
```

**Pros**: Semantically coherent chunks
**Cons**: Requires embedding computation

## Embedding Configuration

### Providers

```bash
# OpenAI (default)
RAG.CREATE docs EMBEDDING openai

# Cohere
RAG.CREATE docs EMBEDDING cohere

# HuggingFace
RAG.CREATE docs EMBEDDING huggingface

# Local ONNX
RAG.CREATE docs EMBEDDING local

# Mock (for testing)
RAG.CREATE docs EMBEDDING mock
```

### Custom Dimensions

```bash
# OpenAI text-embedding-3-small (1536 dims)
RAG.CREATE docs EMBEDDING openai DIMENSION 1536

# Cohere embed-english-v3.0 (1024 dims)
RAG.CREATE docs EMBEDDING cohere DIMENSION 1024

# Local model (384 dims)
RAG.CREATE docs EMBEDDING local DIMENSION 384
```

## Retrieval Options

### Basic Retrieval

```bash
# Top 5 most relevant chunks
RAG.RETRIEVE knowledge "query" COUNT 5

# With minimum similarity threshold
RAG.RETRIEVE knowledge "query" COUNT 10 THRESHOLD 0.7
```

### Hybrid Search

Combine vector and keyword search:

```bash
# 50% vector, 50% keyword
RAG.SEARCH knowledge "query" HYBRID 0.5

# 70% vector, 30% keyword (for semantic queries)
RAG.SEARCH knowledge "query" HYBRID 0.7

# 30% vector, 70% keyword (for specific terms)
RAG.SEARCH knowledge "query" HYBRID 0.3
```

### Filtering

```bash
# Filter by metadata
RAG.SEARCH knowledge "query" FILTER '{"source": "documentation"}'

# Multiple filters
RAG.SEARCH knowledge "query" FILTER '{"category": "guides", "version": "2.0"}'
```

### Reranking

Rerank results for better relevance:

```bash
RAG.SEARCH knowledge "query" RERANK COUNT 20
# Retrieves 20 candidates, reranks to return top 10
```

## Context Assembly

### Format Options

```bash
# Plain text
RAG.CONTEXT knowledge "query" FORMAT plain

# Markdown (default)
RAG.CONTEXT knowledge "query" FORMAT markdown

# XML
RAG.CONTEXT knowledge "query" FORMAT xml

# JSON
RAG.CONTEXT knowledge "query" FORMAT json
```

### Example Outputs

**Markdown:**
```markdown
## Relevant Context

### Source: documentation (Score: 0.92)
Ferrite is a high-performance key-value store...

### Source: guides (Score: 0.88)
To configure Ferrite, create a ferrite.toml file...
```

**XML:**
```xml
<context>
  <chunk source="documentation" score="0.92">
    Ferrite is a high-performance key-value store...
  </chunk>
  <chunk source="guides" score="0.88">
    To configure Ferrite, create a ferrite.toml file...
  </chunk>
</context>
```

### Token Limits

```bash
# Limit context to 4096 tokens
RAG.CONTEXT knowledge "query" TOKENS 4096

# Limit number of chunks
RAG.CONTEXT knowledge "query" MAX_CHUNKS 5
```

## Rust API

```rust
use ferrite::rag::{RagPipeline, RagConfig, ChunkingStrategy};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create pipeline with config
    let config = RagConfig::accurate()
        .with_dimension(1536)
        .with_provider(EmbeddingProviderType::OpenAI);

    let pipeline = RagPipeline::new(config)?;

    // Ingest documents
    let doc_id = pipeline.ingest(Document {
        content: "Ferrite is a high-performance...".to_string(),
        metadata: Some(DocumentMetadata {
            source: Some("docs".to_string()),
            title: Some("Overview".to_string()),
            ..Default::default()
        }),
    }).await?;

    // Batch ingest
    let docs = vec![doc1, doc2, doc3];
    pipeline.ingest_batch(docs).await?;

    // Query
    let results = pipeline.query("What is Ferrite?").await?;

    // Query with options
    let results = pipeline.query_with_options(
        "What is Ferrite?",
        QueryOptions {
            k: 10,
            threshold: Some(0.7),
            filter: Some(SearchFilter::tag("documentation")),
            ..Default::default()
        }
    ).await?;

    // Get formatted context
    let context = pipeline.get_context(
        "What is Ferrite?",
        ContextConfig {
            max_tokens: 4096,
            format: ContextFormat::Markdown,
            include_citations: true,
            ..Default::default()
        }
    ).await?;

    println!("Context for LLM:\n{}", context.text);
    println!("Citations: {:?}", context.citations);

    Ok(())
}
```

## Configuration

```toml
[rag]
enabled = true

[rag.chunking]
strategy = "recursive"
chunk_size = 512
chunk_overlap = 50
min_chunk_size = 50
max_chunk_size = 2048
preserve_sentences = true

[rag.embedding]
provider = "openai"
model = "text-embedding-3-small"
dimension = 1536
batch_size = 100
cache_enabled = true
cache_size = 10000

[rag.retrieval]
default_k = 10
default_threshold = 0.7
enable_hybrid = true
hybrid_weight = 0.5
enable_rerank = false

[rag.context]
default_max_tokens = 4096
default_format = "markdown"
include_citations = true
deduplication_threshold = 0.9
```

## Pipeline Presets

### Fast

Optimized for low latency:

```rust
let config = RagConfig::fast();
// - Fixed-size 512-char chunks
// - Top-3 retrieval
// - Max 5 chunks in context
```

### Accurate

Optimized for quality:

```rust
let config = RagConfig::accurate();
// - Recursive chunking (256 chars)
// - Top-10 retrieval
// - Hybrid search enabled
// - Max 10 chunks in context
```

## Monitoring

### Pipeline Stats

```bash
RAG.STATS knowledge
# Returns:
# documents: 1000
# chunks: 5432
# embeddings_generated: 5432
# avg_chunk_size: 456
# queries: 10000
# avg_retrieval_time_ms: 12
```

### Info

```bash
RAG.INFO knowledge
# Returns:
# name: knowledge
# embedding_provider: openai
# dimension: 1536
# chunk_strategy: recursive
# chunk_size: 512
```

## Best Practices

### Document Preparation

1. **Clean your data** - Remove boilerplate, headers, footers
2. **Preserve structure** - Keep headings, lists, code blocks
3. **Add metadata** - Source, date, category for filtering
4. **Deduplicate** - Remove duplicate content before ingestion

### Chunking

1. **Match chunk size to content** - Larger for documentation, smaller for FAQ
2. **Use overlap** - 10-20% overlap preserves context
3. **Test different strategies** - Evaluate retrieval quality
4. **Consider your LLM's context window** - Smaller chunks = more chunks in context

### Retrieval

1. **Start with more, filter down** - Retrieve 20, rerank to 10
2. **Use hybrid search** - Better for mixed queries
3. **Set appropriate thresholds** - Balance precision vs. recall
4. **Filter by metadata** - Narrow scope when possible

### Context Assembly

1. **Respect token limits** - Leave room for query and response
2. **Order by relevance** - Most relevant first
3. **Include citations** - Help users verify information
4. **Deduplicate** - Remove near-duplicate chunks

## Troubleshooting

### Poor Retrieval Quality

- **Symptom**: Irrelevant chunks returned
- **Solutions**:
  - Increase chunk overlap
  - Try different chunking strategy
  - Lower similarity threshold
  - Enable hybrid search

### Slow Ingestion

- **Symptom**: Long ingestion times
- **Solutions**:
  - Use batch ingestion
  - Enable embedding caching
  - Reduce chunk size
  - Use faster embedding provider

### Context Too Large

- **Symptom**: Exceeds LLM token limit
- **Solutions**:
  - Reduce max_chunks
  - Increase deduplication threshold
  - Use smaller chunk sizes
  - Summarize chunks before assembly

## Next Steps

- [Embeddings](/docs/ai-ml/embeddings) - Configure embedding providers
- [Vector Indexes](/docs/ai-ml/vector-indexes) - Optimize vector search
- [LLM Caching](/docs/ai-ml/llm-caching) - Cache LLM responses
- [Build a RAG Chatbot](/docs/tutorials/build-rag-chatbot) - Complete tutorial
