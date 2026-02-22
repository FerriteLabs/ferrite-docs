---
sidebar_position: 2
title: LlamaIndex Integration
description: Use Ferrite as a vector store, ingestion cache, and storage backend for LlamaIndex
keywords: [llamaindex, vector store, embeddings, rag, llm, ai, indexing]
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# LlamaIndex Integration

Ferrite provides native integration with [LlamaIndex](https://www.llamaindex.ai/), the data framework for LLM applications. Use Ferrite as your vector store, document store, index store, and caching layer.

## Why Ferrite for LlamaIndex?

| Feature | Benefit |
|---------|---------|
| **Unified Storage** | Vector store, document store, and index store in one |
| **Hybrid Search** | Combine vector and keyword search |
| **Persistence** | Durable storage with AOF/snapshots |
| **Performance** | Sub-millisecond retrieval latency |
| **Scalability** | Cluster mode for large datasets |

## Installation

```bash
pip install llama-index llama-index-vector-stores-ferrite ferrite-py
```

## Quick Start

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.vector_stores.ferrite import FerriteVectorStore

# Load documents
documents = SimpleDirectoryReader("data").load_data()

# Create Ferrite vector store
vector_store = FerriteVectorStore(
    url="ferrite://localhost:6379",
    index_name="my_documents"
)

# Build index
index = VectorStoreIndex.from_documents(
    documents,
    vector_store=vector_store
)

# Query
query_engine = index.as_query_engine()
response = query_engine.query("What is this document about?")
print(response)
```

## Vector Store

### Basic Setup

```python
from llama_index.vector_stores.ferrite import FerriteVectorStore
from llama_index.core import VectorStoreIndex, StorageContext

# Create vector store
vector_store = FerriteVectorStore(
    url="ferrite://localhost:6379",
    index_name="documents",
    # Vector configuration
    embedding_dimension=1536,
    distance_metric="cosine",  # cosine, l2, ip
)

# Create storage context
storage_context = StorageContext.from_defaults(
    vector_store=vector_store
)

# Build index from documents
index = VectorStoreIndex.from_documents(
    documents,
    storage_context=storage_context
)
```

### Advanced Configuration

```python
from llama_index.vector_stores.ferrite import FerriteVectorStore

vector_store = FerriteVectorStore(
    url="ferrite://localhost:6379",
    index_name="advanced_index",
    # Vector index settings
    embedding_dimension=1536,
    distance_metric="cosine",
    index_algorithm="hnsw",  # hnsw or flat
    hnsw_config={
        "m": 16,                  # Max connections per node
        "ef_construction": 200,   # Build-time quality
        "ef_runtime": 100,        # Query-time quality
    },
    # Storage settings
    namespace="production",
    ttl=None,  # No expiration
    # Connection settings
    connection_pool_size=10,
    timeout=30.0,
)
```

### Connecting to Existing Index

```python
from llama_index.core import VectorStoreIndex
from llama_index.vector_stores.ferrite import FerriteVectorStore

# Connect to existing vector store
vector_store = FerriteVectorStore(
    url="ferrite://localhost:6379",
    index_name="existing_index"
)

# Load existing index
index = VectorStoreIndex.from_vector_store(vector_store)

# Query
query_engine = index.as_query_engine()
response = query_engine.query("Your question here")
```

## Document Store

Store documents separately from vectors for efficient retrieval.

```python
from llama_index.storage.docstore.ferrite import FerriteDocumentStore
from llama_index.core import StorageContext

# Create document store
docstore = FerriteDocumentStore(
    url="ferrite://localhost:6379",
    namespace="docstore",
    ttl=None
)

# Create storage context
storage_context = StorageContext.from_defaults(
    vector_store=vector_store,
    docstore=docstore
)

# Build index
index = VectorStoreIndex.from_documents(
    documents,
    storage_context=storage_context
)
```

### Document Operations

```python
from llama_index.core.schema import Document

# Add documents
doc = Document(text="New document content", metadata={"source": "manual"})
docstore.add_documents([doc])

# Get document
retrieved = docstore.get_document(doc.doc_id)

# Delete document
docstore.delete_document(doc.doc_id)

# Get all document IDs
doc_ids = list(docstore.get_all_document_ids())
```

## Index Store

Persist index metadata for fast loading.

```python
from llama_index.storage.index_store.ferrite import FerriteIndexStore
from llama_index.core import StorageContext

# Create index store
index_store = FerriteIndexStore(
    url="ferrite://localhost:6379",
    namespace="index_store"
)

# Complete storage context
storage_context = StorageContext.from_defaults(
    vector_store=vector_store,
    docstore=docstore,
    index_store=index_store
)

# Build and persist index
index = VectorStoreIndex.from_documents(
    documents,
    storage_context=storage_context
)

# Later: reload index
storage_context = StorageContext.from_defaults(
    vector_store=vector_store,
    docstore=docstore,
    index_store=index_store
)
index = load_index_from_storage(storage_context)
```

## Ingestion Pipeline

Build efficient document processing pipelines with Ferrite caching.

### Basic Pipeline

```python
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.vector_stores.ferrite import FerriteVectorStore

# Create pipeline
pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=1024, chunk_overlap=200),
        OpenAIEmbedding(),
    ],
    vector_store=FerriteVectorStore(
        url="ferrite://localhost:6379",
        index_name="pipeline_index"
    )
)

# Run pipeline
nodes = pipeline.run(documents=documents)
```

### With Caching

```python
from llama_index.core.ingestion import IngestionPipeline, IngestionCache
from llama_index.storage.kvstore.ferrite import FerriteKVStore

# Create cache
cache = IngestionCache(
    cache=FerriteKVStore(
        url="ferrite://localhost:6379",
        namespace="ingestion_cache"
    ),
    collection="document_cache"
)

# Pipeline with cache
pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=1024, chunk_overlap=200),
        OpenAIEmbedding(),
    ],
    vector_store=vector_store,
    cache=cache
)

# First run - processes all documents
nodes = pipeline.run(documents=documents)

# Second run - uses cache for unchanged documents
nodes = pipeline.run(documents=documents)  # Much faster
```

### Parallel Processing

```python
from llama_index.core.ingestion import IngestionPipeline

pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=1024),
        OpenAIEmbedding(),
    ],
    vector_store=vector_store,
    cache=cache
)

# Process in parallel
nodes = pipeline.run(
    documents=documents,
    num_workers=4,
    show_progress=True
)
```

## Query Engine

### Basic Query

```python
from llama_index.core import VectorStoreIndex

index = VectorStoreIndex.from_vector_store(vector_store)
query_engine = index.as_query_engine()

response = query_engine.query("What is Ferrite?")
print(response.response)
print("Sources:", response.source_nodes)
```

### Configuring Retrieval

```python
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.postprocessor import SimilarityPostprocessor

# Custom retriever
retriever = VectorIndexRetriever(
    index=index,
    similarity_top_k=10,
)

# With post-processing
query_engine = RetrieverQueryEngine(
    retriever=retriever,
    node_postprocessors=[
        SimilarityPostprocessor(similarity_cutoff=0.7)
    ]
)

response = query_engine.query("Your question")
```

### Hybrid Search

```python
from llama_index.core.retrievers import QueryFusionRetriever
from llama_index.retrievers.ferrite import FerriteHybridRetriever

# Hybrid retriever combining vector and keyword search
hybrid_retriever = FerriteHybridRetriever(
    url="ferrite://localhost:6379",
    index_name="documents",
    vector_weight=0.7,
    keyword_weight=0.3,
    top_k=10
)

# Use in query engine
from llama_index.core.query_engine import RetrieverQueryEngine

query_engine = RetrieverQueryEngine(retriever=hybrid_retriever)
response = query_engine.query("database performance optimization")
```

### Streaming Response

```python
query_engine = index.as_query_engine(streaming=True)

streaming_response = query_engine.query("Explain Ferrite architecture")

for text in streaming_response.response_gen:
    print(text, end="", flush=True)
```

## Chat Engine

Build conversational interfaces with memory.

### Basic Chat

```python
from llama_index.core.memory import ChatMemoryBuffer

memory = ChatMemoryBuffer.from_defaults(token_limit=3900)

chat_engine = index.as_chat_engine(
    chat_mode="condense_plus_context",
    memory=memory,
    verbose=True
)

response = chat_engine.chat("What is Ferrite?")
print(response)

response = chat_engine.chat("How does it compare to Redis?")
print(response)
```

### With Ferrite Memory

```python
from llama_index.storage.chat_store.ferrite import FerriteChatStore
from llama_index.core.memory import ChatMemoryBuffer

# Persistent chat store
chat_store = FerriteChatStore(
    url="ferrite://localhost:6379",
    ttl=3600  # 1 hour session
)

memory = ChatMemoryBuffer.from_defaults(
    token_limit=3900,
    chat_store=chat_store,
    chat_store_key="user_123_session"
)

chat_engine = index.as_chat_engine(
    chat_mode="condense_plus_context",
    memory=memory
)

# Chat persists across sessions
response = chat_engine.chat("Hello!")
```

### Context Chat Engine

```python
from llama_index.core.chat_engine import ContextChatEngine
from llama_index.core.retrievers import VectorIndexRetriever

retriever = VectorIndexRetriever(index=index, similarity_top_k=5)

chat_engine = ContextChatEngine.from_defaults(
    retriever=retriever,
    memory=memory,
    system_prompt="You are a helpful assistant with access to a knowledge base."
)

response = chat_engine.chat("Tell me about vector databases")
```

## Agents

Build agents that use Ferrite-backed tools.

### Query Engine Tool

```python
from llama_index.core.tools import QueryEngineTool
from llama_index.core.agent import ReActAgent

# Create tools from indices
docs_tool = QueryEngineTool.from_defaults(
    query_engine=docs_index.as_query_engine(),
    name="documentation",
    description="Search the documentation for information"
)

api_tool = QueryEngineTool.from_defaults(
    query_engine=api_index.as_query_engine(),
    name="api_reference",
    description="Search the API reference"
)

# Create agent
agent = ReActAgent.from_tools(
    [docs_tool, api_tool],
    verbose=True
)

response = agent.chat("How do I use the vector search API?")
```

### Custom Ferrite Tool

```python
from llama_index.core.tools import FunctionTool
from ferrite import Ferrite

client = Ferrite(url="ferrite://localhost:6379")

def get_user_preferences(user_id: str) -> dict:
    """Get user preferences from Ferrite."""
    return client.hgetall(f"user:{user_id}:preferences")

def save_user_preference(user_id: str, key: str, value: str) -> str:
    """Save a user preference."""
    client.hset(f"user:{user_id}:preferences", key, value)
    return f"Saved {key}={value}"

# Create tools
get_prefs_tool = FunctionTool.from_defaults(fn=get_user_preferences)
save_pref_tool = FunctionTool.from_defaults(fn=save_user_preference)

# Add to agent
agent = ReActAgent.from_tools(
    [docs_tool, get_prefs_tool, save_pref_tool],
    verbose=True
)
```

## Multi-Modal

Handle images and other modalities.

```python
from llama_index.core import SimpleDirectoryReader
from llama_index.multi_modal_llms.openai import OpenAIMultiModal
from llama_index.core.indices import MultiModalVectorStoreIndex

# Load multi-modal documents
documents = SimpleDirectoryReader(
    input_dir="./mixed_data",
    required_exts=[".png", ".jpg", ".pdf", ".txt"]
).load_data()

# Create multi-modal index
index = MultiModalVectorStoreIndex.from_documents(
    documents,
    vector_store=FerriteVectorStore(
        url="ferrite://localhost:6379",
        index_name="multimodal"
    ),
    image_vector_store=FerriteVectorStore(
        url="ferrite://localhost:6379",
        index_name="images"
    )
)

# Query with multi-modal LLM
query_engine = index.as_query_engine(
    multi_modal_llm=OpenAIMultiModal(model="gpt-4-vision-preview")
)

response = query_engine.query("Describe what's in the images")
```

## Evaluation

Evaluate your RAG pipeline.

```python
from llama_index.core.evaluation import (
    FaithfulnessEvaluator,
    RelevancyEvaluator,
    BatchEvalRunner
)
from llama_index.llms.openai import OpenAI

# Create evaluators
faithfulness = FaithfulnessEvaluator(llm=OpenAI(model="gpt-4"))
relevancy = RelevancyEvaluator(llm=OpenAI(model="gpt-4"))

# Evaluate
query_engine = index.as_query_engine()

questions = [
    "What is Ferrite?",
    "How does vector search work?",
    "What are the performance characteristics?"
]

runner = BatchEvalRunner(
    {"faithfulness": faithfulness, "relevancy": relevancy},
    workers=4
)

results = await runner.aevaluate_queries(
    query_engine,
    queries=questions
)

# Print results
for query, result in zip(questions, results):
    print(f"Query: {query}")
    print(f"  Faithfulness: {result['faithfulness'].score}")
    print(f"  Relevancy: {result['relevancy'].score}")
```

## Production Patterns

### Multi-Tenant Setup

```python
class MultiTenantIndex:
    def __init__(self, ferrite_url: str):
        self.ferrite_url = ferrite_url
        self._indices = {}

    def get_index(self, tenant_id: str) -> VectorStoreIndex:
        if tenant_id not in self._indices:
            vector_store = FerriteVectorStore(
                url=self.ferrite_url,
                index_name=f"tenant_{tenant_id}"
            )
            self._indices[tenant_id] = VectorStoreIndex.from_vector_store(
                vector_store
            )
        return self._indices[tenant_id]

    def query(self, tenant_id: str, question: str):
        index = self.get_index(tenant_id)
        query_engine = index.as_query_engine()
        return query_engine.query(question)

# Usage
multi_tenant = MultiTenantIndex("ferrite://localhost:6379")

# Tenant A
response_a = multi_tenant.query("tenant_a", "What products do we offer?")

# Tenant B (isolated)
response_b = multi_tenant.query("tenant_b", "What products do we offer?")
```

### Async Operations

```python
import asyncio
from llama_index.vector_stores.ferrite import FerriteVectorStore

async def async_query(index, question):
    query_engine = index.as_query_engine()
    response = await query_engine.aquery(question)
    return response

async def batch_queries(index, questions):
    tasks = [async_query(index, q) for q in questions]
    responses = await asyncio.gather(*tasks)
    return responses

# Run async queries
questions = ["Question 1", "Question 2", "Question 3"]
responses = asyncio.run(batch_queries(index, questions))
```

### Monitoring

```python
from llama_index.core.callbacks import CallbackManager, LlamaDebugHandler
from llama_index.core import Settings

# Setup debugging
llama_debug = LlamaDebugHandler(print_trace_on_end=True)
callback_manager = CallbackManager([llama_debug])

Settings.callback_manager = callback_manager

# Your queries will now log detailed traces
response = query_engine.query("What is Ferrite?")

# View trace
print(llama_debug.get_event_pairs())
```

## Complete Example

```python
"""
Complete LlamaIndex + Ferrite RAG Application
"""

from llama_index.core import (
    VectorStoreIndex,
    StorageContext,
    SimpleDirectoryReader,
    Settings
)
from llama_index.vector_stores.ferrite import FerriteVectorStore
from llama_index.storage.docstore.ferrite import FerriteDocumentStore
from llama_index.storage.index_store.ferrite import FerriteIndexStore
from llama_index.storage.chat_store.ferrite import FerriteChatStore
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.ingestion import IngestionPipeline, IngestionCache
from llama_index.storage.kvstore.ferrite import FerriteKVStore
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI

# Configuration
FERRITE_URL = "ferrite://localhost:6379"

# Setup LLM and embeddings
Settings.llm = OpenAI(model="gpt-4")
Settings.embed_model = OpenAIEmbedding()

# Create Ferrite stores
vector_store = FerriteVectorStore(
    url=FERRITE_URL,
    index_name="knowledge_base"
)

docstore = FerriteDocumentStore(
    url=FERRITE_URL,
    namespace="docstore"
)

index_store = FerriteIndexStore(
    url=FERRITE_URL,
    namespace="index_store"
)

chat_store = FerriteChatStore(
    url=FERRITE_URL,
    ttl=3600
)

# Ingestion cache
ingestion_cache = IngestionCache(
    cache=FerriteKVStore(url=FERRITE_URL, namespace="ingestion"),
    collection="documents"
)

# Storage context
storage_context = StorageContext.from_defaults(
    vector_store=vector_store,
    docstore=docstore,
    index_store=index_store
)

def ingest_documents(directory: str):
    """Ingest documents from a directory."""
    # Load documents
    documents = SimpleDirectoryReader(directory).load_data()

    # Create pipeline
    pipeline = IngestionPipeline(
        transformations=[
            SentenceSplitter(chunk_size=1024, chunk_overlap=200),
            OpenAIEmbedding(),
        ],
        vector_store=vector_store,
        docstore=docstore,
        cache=ingestion_cache
    )

    # Run ingestion
    nodes = pipeline.run(documents=documents, show_progress=True)
    print(f"Ingested {len(nodes)} nodes")

def get_chat_engine(session_id: str):
    """Get a chat engine for a session."""
    # Load or create index
    index = VectorStoreIndex.from_vector_store(
        vector_store,
        storage_context=storage_context
    )

    # Create memory with persistence
    memory = ChatMemoryBuffer.from_defaults(
        token_limit=3900,
        chat_store=chat_store,
        chat_store_key=session_id
    )

    # Create chat engine
    return index.as_chat_engine(
        chat_mode="condense_plus_context",
        memory=memory,
        system_prompt="""You are a helpful assistant with access to a knowledge base.
        Answer questions based on the available information.
        If you don't know something, say so."""
    )

def main():
    # Ingest documents
    ingest_documents("./docs")

    # Start chat session
    chat_engine = get_chat_engine("user_123")

    print("Chat started. Type 'quit' to exit.")
    while True:
        user_input = input("You: ")
        if user_input.lower() == 'quit':
            break

        response = chat_engine.chat(user_input)
        print(f"Assistant: {response}")

if __name__ == "__main__":
    main()
```

## Next Steps

- [LangChain Integration](/docs/integrations/langchain) - Alternative LLM framework
- [Vector Search Guide](/docs/guides/vector-search) - Deep dive into vector capabilities
- [Python SDK](/docs/sdk/python) - Full Python client documentation
- [Build a RAG Chatbot](/docs/tutorials/build-rag-chatbot) - Advanced RAG techniques
