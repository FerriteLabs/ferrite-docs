---
sidebar_position: 1
title: LangChain Integration
description: Use Ferrite as a vector store, semantic cache, and memory backend for LangChain
keywords: [langchain, vector store, embeddings, semantic cache, llm, ai, rag]
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# LangChain Integration

Ferrite provides native integration with [LangChain](https://langchain.com/), the popular framework for building LLM-powered applications. Use Ferrite as your vector store, semantic cache, and conversation memory backend.

## Why Ferrite for LangChain?

| Feature | Benefit |
|---------|---------|
| **Vector Search** | Native HNSW indexing for fast similarity search |
| **Semantic Cache** | Cache LLM responses by semantic similarity |
| **Unified Backend** | One database for vectors, cache, and state |
| **Redis Compatible** | Works with existing Redis-based LangChain code |
| **High Performance** | Sub-millisecond latency for retrieval |

## Installation

```bash
pip install langchain langchain-community ferrite-py
```

## Quick Start

```python
from langchain_community.vectorstores import Ferrite
from langchain_openai import OpenAIEmbeddings

# Initialize embeddings
embeddings = OpenAIEmbeddings()

# Create Ferrite vector store
vectorstore = Ferrite.from_texts(
    texts=["Ferrite is a Redis-compatible database",
           "LangChain makes building LLM apps easy"],
    embedding=embeddings,
    ferrite_url="ferrite://localhost:6379",
    index_name="my_docs"
)

# Search
results = vectorstore.similarity_search("database", k=3)
```

## Vector Store

### Creating a Vector Store

```python
from langchain_community.vectorstores import Ferrite
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings()

# Method 1: From texts
vectorstore = Ferrite.from_texts(
    texts=["Document 1 content", "Document 2 content"],
    embedding=embeddings,
    ferrite_url="ferrite://localhost:6379",
    index_name="documents",
    metadatas=[{"source": "doc1"}, {"source": "doc2"}]
)

# Method 2: From documents
from langchain.schema import Document

docs = [
    Document(page_content="Content 1", metadata={"source": "file1.txt"}),
    Document(page_content="Content 2", metadata={"source": "file2.txt"}),
]

vectorstore = Ferrite.from_documents(
    documents=docs,
    embedding=embeddings,
    ferrite_url="ferrite://localhost:6379",
    index_name="documents"
)

# Method 3: Connect to existing index
vectorstore = Ferrite(
    embedding=embeddings,
    ferrite_url="ferrite://localhost:6379",
    index_name="existing_index"
)
```

### Index Configuration

```python
from langchain_community.vectorstores import Ferrite

vectorstore = Ferrite.from_texts(
    texts=texts,
    embedding=embeddings,
    ferrite_url="ferrite://localhost:6379",
    index_name="my_index",
    # Vector index settings
    vector_config={
        "algorithm": "HNSW",      # HNSW or FLAT
        "metric": "COSINE",       # COSINE, L2, or IP
        "dimensions": 1536,       # Must match embedding model
        "m": 16,                  # HNSW connectivity
        "ef_construction": 200,   # Build-time quality
        "ef_runtime": 100,        # Search-time quality
    }
)
```

### Similarity Search

```python
# Basic search
results = vectorstore.similarity_search(
    query="What is Ferrite?",
    k=5
)

for doc in results:
    print(f"Content: {doc.page_content}")
    print(f"Metadata: {doc.metadata}")
    print("---")

# Search with scores
results_with_scores = vectorstore.similarity_search_with_score(
    query="What is Ferrite?",
    k=5
)

for doc, score in results_with_scores:
    print(f"Score: {score:.4f}")
    print(f"Content: {doc.page_content}")
    print("---")

# Search with filter
results = vectorstore.similarity_search(
    query="database features",
    k=5,
    filter={"source": "documentation"}
)

# MMR search (diversity)
results = vectorstore.max_marginal_relevance_search(
    query="What is Ferrite?",
    k=5,
    fetch_k=20,
    lambda_mult=0.5  # 0 = max diversity, 1 = max relevance
)
```

### Adding Documents

```python
# Add texts
ids = vectorstore.add_texts(
    texts=["New document 1", "New document 2"],
    metadatas=[{"version": "2.0"}, {"version": "2.0"}]
)

# Add documents
from langchain.schema import Document

new_docs = [
    Document(page_content="New content", metadata={"type": "update"})
]
ids = vectorstore.add_documents(new_docs)

# Delete by ID
vectorstore.delete(ids=["doc_id_1", "doc_id_2"])

# Delete by filter
vectorstore.delete(filter={"version": "1.0"})
```

### As Retriever

```python
# Create retriever
retriever = vectorstore.as_retriever(
    search_type="similarity",  # or "mmr", "similarity_score_threshold"
    search_kwargs={
        "k": 5,
        "score_threshold": 0.8,  # for similarity_score_threshold
        "filter": {"type": "documentation"}
    }
)

# Use in chain
from langchain.chains import RetrievalQA
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4")

qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=retriever,
    return_source_documents=True
)

result = qa_chain.invoke({"query": "What are Ferrite's main features?"})
print(result["result"])
```

## Semantic Cache

Cache LLM responses based on semantic similarity of prompts.

### Setup

```python
from langchain.cache import FerriteSemanticCache
from langchain_openai import OpenAIEmbeddings
from langchain.globals import set_llm_cache

# Initialize semantic cache
set_llm_cache(FerriteSemanticCache(
    ferrite_url="ferrite://localhost:6379",
    embedding=OpenAIEmbeddings(),
    score_threshold=0.95,  # Similarity threshold for cache hit
    ttl=3600,              # Cache TTL in seconds
    prefix="llm_cache"     # Key prefix
))
```

### Usage

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4")

# First call - cache miss, calls OpenAI
response1 = llm.invoke("What is the capital of France?")
print(response1.content)  # "The capital of France is Paris."

# Second call - cache hit (semantically similar)
response2 = llm.invoke("Tell me the capital city of France")
print(response2.content)  # Returns cached response

# Different question - cache miss
response3 = llm.invoke("What is the capital of Germany?")
print(response3.content)  # Calls OpenAI
```

### Advanced Configuration

```python
from langchain.cache import FerriteSemanticCache

cache = FerriteSemanticCache(
    ferrite_url="ferrite://localhost:6379",
    embedding=OpenAIEmbeddings(),
    # Similarity settings
    score_threshold=0.92,     # Lower = more cache hits
    # Index settings
    index_name="semantic_cache",
    vector_config={
        "algorithm": "HNSW",
        "metric": "COSINE",
        "ef_runtime": 50,     # Lower for faster search
    },
    # Cache settings
    ttl=7200,                 # 2 hour TTL
    max_entries=10000,        # Max cached responses
    # Namespace for multi-tenant
    namespace="production"
)

set_llm_cache(cache)
```

### Cache Statistics

```python
# Get cache stats
stats = cache.get_stats()
print(f"Cache hits: {stats['hits']}")
print(f"Cache misses: {stats['misses']}")
print(f"Hit rate: {stats['hit_rate']:.2%}")
print(f"Entries: {stats['entries']}")

# Clear cache
cache.clear()

# Clear by pattern
cache.clear(pattern="production:*")
```

## Conversation Memory

Store conversation history in Ferrite for chatbots and agents.

### Chat Message History

```python
from langchain_community.chat_message_histories import FerriteChatMessageHistory

# Create message history
history = FerriteChatMessageHistory(
    session_id="user_123_session_456",
    url="ferrite://localhost:6379",
    ttl=3600,  # Session expires after 1 hour
    key_prefix="chat_history"
)

# Add messages
history.add_user_message("Hello!")
history.add_ai_message("Hi! How can I help you today?")
history.add_user_message("Tell me about Ferrite")

# Get messages
messages = history.messages
for msg in messages:
    print(f"{msg.type}: {msg.content}")

# Clear history
history.clear()
```

### With ConversationChain

```python
from langchain.chains import ConversationChain
from langchain.memory import ConversationBufferMemory
from langchain_community.chat_message_histories import FerriteChatMessageHistory
from langchain_openai import ChatOpenAI

# Create persistent memory
message_history = FerriteChatMessageHistory(
    session_id="user_123",
    url="ferrite://localhost:6379"
)

memory = ConversationBufferMemory(
    chat_memory=message_history,
    return_messages=True
)

# Create conversation chain
conversation = ConversationChain(
    llm=ChatOpenAI(model="gpt-4"),
    memory=memory,
    verbose=True
)

# Chat
response = conversation.predict(input="Hi, I'm Alice!")
print(response)

response = conversation.predict(input="What's my name?")
print(response)  # Should remember "Alice"
```

### With RunnableWithMessageHistory

```python
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI

# Define prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}")
])

# Create chain
chain = prompt | ChatOpenAI(model="gpt-4")

# Add message history
def get_session_history(session_id: str):
    return FerriteChatMessageHistory(
        session_id=session_id,
        url="ferrite://localhost:6379"
    )

chain_with_history = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history"
)

# Use with session
response = chain_with_history.invoke(
    {"input": "Hello!"},
    config={"configurable": {"session_id": "user_123"}}
)
```

### Entity Memory

```python
from langchain.memory import ConversationEntityMemory
from langchain_community.chat_message_histories import FerriteChatMessageHistory

# Create entity memory with Ferrite backend
entity_memory = ConversationEntityMemory(
    llm=ChatOpenAI(model="gpt-4"),
    chat_memory=FerriteChatMessageHistory(
        session_id="user_123",
        url="ferrite://localhost:6379"
    ),
    entity_store=FerriteEntityStore(
        url="ferrite://localhost:6379",
        key_prefix="entities"
    )
)

# Entities are automatically extracted and stored
conversation = ConversationChain(
    llm=ChatOpenAI(model="gpt-4"),
    memory=entity_memory
)

conversation.predict(input="My name is Alice and I work at Acme Corp")
conversation.predict(input="I'm working on a machine learning project")

# Access entities
print(entity_memory.entity_store.get("Alice"))
# {"name": "Alice", "workplace": "Acme Corp", "project": "machine learning"}
```

## RAG Pipeline

Build a complete Retrieval-Augmented Generation pipeline with Ferrite.

### Basic RAG

```python
from langchain_community.vectorstores import Ferrite
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import RetrievalQA
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader

# Load and split documents
loader = TextLoader("documentation.txt")
documents = loader.load()

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)
splits = text_splitter.split_documents(documents)

# Create vector store
embeddings = OpenAIEmbeddings()
vectorstore = Ferrite.from_documents(
    documents=splits,
    embedding=embeddings,
    ferrite_url="ferrite://localhost:6379",
    index_name="documentation"
)

# Create RAG chain
llm = ChatOpenAI(model="gpt-4")
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=vectorstore.as_retriever(search_kwargs={"k": 5}),
    return_source_documents=True
)

# Query
result = qa_chain.invoke({"query": "How do I configure Ferrite?"})
print(result["result"])
print("Sources:", [doc.metadata for doc in result["source_documents"]])
```

### Advanced RAG with LCEL

```python
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough

# Create prompt
template = """Answer the question based only on the following context:

{context}

Question: {question}

Answer:"""

prompt = ChatPromptTemplate.from_template(template)

# Create retriever
retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 5, "fetch_k": 20}
)

# Format documents
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

# Build chain
rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | ChatOpenAI(model="gpt-4")
    | StrOutputParser()
)

# Query
answer = rag_chain.invoke("What are Ferrite's key features?")
print(answer)
```

### RAG with Sources

```python
from langchain_core.runnables import RunnableParallel

# Chain that returns sources
rag_chain_with_sources = RunnableParallel(
    {"context": retriever, "question": RunnablePassthrough()}
).assign(
    answer=lambda x: (
        prompt.format(context=format_docs(x["context"]), question=x["question"])
        | ChatOpenAI(model="gpt-4")
        | StrOutputParser()
    )
)

result = rag_chain_with_sources.invoke("What is Ferrite?")
print("Answer:", result["answer"])
print("Sources:")
for doc in result["context"]:
    print(f"  - {doc.metadata.get('source', 'unknown')}")
```

### Hybrid Search RAG

```python
from langchain.retrievers import EnsembleRetriever
from langchain_community.retrievers import FerriteRetriever

# Vector retriever
vector_retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

# Keyword retriever (BM25-style)
keyword_retriever = FerriteRetriever(
    url="ferrite://localhost:6379",
    index_name="documentation",
    search_type="fulltext",
    search_kwargs={"k": 5}
)

# Ensemble (hybrid)
ensemble_retriever = EnsembleRetriever(
    retrievers=[vector_retriever, keyword_retriever],
    weights=[0.6, 0.4]  # 60% vector, 40% keyword
)

# Use in RAG
rag_chain = (
    {"context": ensemble_retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | ChatOpenAI(model="gpt-4")
    | StrOutputParser()
)
```

## Agents with Tools

Use Ferrite as a tool backend for LangChain agents.

### Custom Ferrite Tool

```python
from langchain.tools import Tool
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_openai import ChatOpenAI
from ferrite import Ferrite

# Initialize Ferrite client
ferrite = Ferrite(url="ferrite://localhost:6379")

# Create tools
def search_knowledge_base(query: str) -> str:
    """Search the knowledge base for relevant information."""
    results = vectorstore.similarity_search(query, k=3)
    return "\n".join([doc.page_content for doc in results])

def get_user_data(user_id: str) -> str:
    """Get user data from Ferrite."""
    data = ferrite.hgetall(f"user:{user_id}")
    return str(data) if data else "User not found"

def store_user_preference(user_id: str, key: str, value: str) -> str:
    """Store a user preference."""
    ferrite.hset(f"user:{user_id}", key, value)
    return f"Stored {key}={value} for user {user_id}"

tools = [
    Tool(
        name="search_knowledge",
        func=search_knowledge_base,
        description="Search the knowledge base for information"
    ),
    Tool(
        name="get_user_data",
        func=get_user_data,
        description="Get user profile data. Input: user_id"
    ),
    Tool(
        name="store_preference",
        func=store_user_preference,
        description="Store user preference. Input: user_id, key, value"
    )
]

# Create agent
llm = ChatOpenAI(model="gpt-4")
prompt = hub.pull("hwchase17/openai-functions-agent")
agent = create_openai_functions_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# Run agent
result = agent_executor.invoke({
    "input": "Find information about vector search and save it as my interest"
})
```

## Multi-Tenant Setup

Isolate data for different tenants/customers.

```python
class MultiTenantVectorStore:
    def __init__(self, ferrite_url: str, embedding):
        self.ferrite_url = ferrite_url
        self.embedding = embedding
        self._stores = {}

    def get_store(self, tenant_id: str) -> Ferrite:
        if tenant_id not in self._stores:
            self._stores[tenant_id] = Ferrite(
                embedding=self.embedding,
                ferrite_url=self.ferrite_url,
                index_name=f"tenant_{tenant_id}_vectors"
            )
        return self._stores[tenant_id]

    def add_documents(self, tenant_id: str, documents):
        store = self.get_store(tenant_id)
        return store.add_documents(documents)

    def search(self, tenant_id: str, query: str, k: int = 5):
        store = self.get_store(tenant_id)
        return store.similarity_search(query, k=k)

# Usage
multi_tenant = MultiTenantVectorStore(
    ferrite_url="ferrite://localhost:6379",
    embedding=OpenAIEmbeddings()
)

# Tenant A
multi_tenant.add_documents("tenant_a", docs_a)
results_a = multi_tenant.search("tenant_a", "query")

# Tenant B (isolated)
multi_tenant.add_documents("tenant_b", docs_b)
results_b = multi_tenant.search("tenant_b", "query")
```

## Performance Tips

### Batch Operations

```python
# Batch add documents
vectorstore.add_documents(
    documents,
    batch_size=100  # Process in batches
)

# Async operations
import asyncio

async def async_search():
    results = await vectorstore.asimilarity_search("query", k=5)
    return results

results = asyncio.run(async_search())
```

### Connection Pooling

```python
from ferrite import FerritePool

# Create connection pool
pool = FerritePool(
    url="ferrite://localhost:6379",
    max_connections=20,
    min_connections=5
)

# Use pool with LangChain
vectorstore = Ferrite(
    embedding=embeddings,
    ferrite_client=pool,
    index_name="documents"
)
```

### Caching Embeddings

```python
from langchain.embeddings import CacheBackedEmbeddings
from langchain.storage import FerriteStore

# Create embedding cache
underlying_embeddings = OpenAIEmbeddings()
store = FerriteStore(url="ferrite://localhost:6379", prefix="embeddings")

cached_embeddings = CacheBackedEmbeddings.from_bytes_store(
    underlying_embeddings,
    store,
    namespace=underlying_embeddings.model
)

# Use cached embeddings
vectorstore = Ferrite.from_documents(
    documents,
    embedding=cached_embeddings,
    ferrite_url="ferrite://localhost:6379"
)
```

## Complete Example

```python
"""
Complete LangChain + Ferrite RAG Application
"""

from langchain_community.vectorstores import Ferrite
from langchain_community.chat_message_histories import FerriteChatMessageHistory
from langchain.cache import FerriteSemanticCache
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain.globals import set_llm_cache

# Configuration
FERRITE_URL = "ferrite://localhost:6379"
embeddings = OpenAIEmbeddings()
llm = ChatOpenAI(model="gpt-4")

# Setup semantic cache
set_llm_cache(FerriteSemanticCache(
    ferrite_url=FERRITE_URL,
    embedding=embeddings,
    score_threshold=0.95
))

# Create vector store
vectorstore = Ferrite(
    embedding=embeddings,
    ferrite_url=FERRITE_URL,
    index_name="knowledge_base"
)

# RAG prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a helpful assistant. Use the following context to answer questions.

Context: {context}

If you don't know the answer, say so."""),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}")
])

# Create retriever
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

# Build chain with context and history
from langchain_core.runnables import RunnablePassthrough, RunnableLambda

def get_context(input_dict):
    docs = retriever.invoke(input_dict["input"])
    return format_docs(docs)

chain = (
    RunnablePassthrough.assign(context=RunnableLambda(get_context))
    | prompt
    | llm
)

# Add message history
def get_session_history(session_id: str):
    return FerriteChatMessageHistory(
        session_id=session_id,
        url=FERRITE_URL,
        ttl=3600
    )

rag_with_history = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history"
)

# Use the application
def chat(session_id: str, message: str) -> str:
    response = rag_with_history.invoke(
        {"input": message},
        config={"configurable": {"session_id": session_id}}
    )
    return response.content

# Example usage
if __name__ == "__main__":
    # Add documents to knowledge base
    from langchain_community.document_loaders import DirectoryLoader

    loader = DirectoryLoader("./docs", glob="**/*.md")
    documents = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    splits = text_splitter.split_documents(documents)
    vectorstore.add_documents(splits)

    # Chat
    print(chat("user_123", "What is Ferrite?"))
    print(chat("user_123", "What did I just ask about?"))
```

## Next Steps

- [LlamaIndex Integration](/docs/integrations/llamaindex) - Alternative LLM framework
- [Vector Search Guide](/docs/guides/vector-search) - Deep dive into vector capabilities
- [Semantic Caching Guide](/docs/guides/semantic-caching) - Advanced caching strategies
- [Python SDK](/docs/sdk/python) - Full Python client documentation
