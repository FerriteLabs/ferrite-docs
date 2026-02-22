---
sidebar_position: 3
title: Hugging Face Integration
description: Use Ferrite with Hugging Face Transformers for embeddings, vector search, and semantic caching
keywords: [huggingface, transformers, embeddings, vector store, sentence-transformers, ai, ml]
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Hugging Face Integration

Ferrite integrates seamlessly with [Hugging Face](https://huggingface.co/) Transformers and Sentence-Transformers for local embedding generation, model inference, and vector search.

## Why Ferrite for Hugging Face?

| Feature | Benefit |
|---------|---------|
| **Local Inference** | Run embedding models locally without API costs |
| **ONNX Support** | Optimized model inference with ONNX Runtime |
| **Model Caching** | Cache embeddings to avoid redundant computation |
| **Vector Search** | Native HNSW indexing for fast similarity search |
| **Unified Backend** | One database for vectors, cache, and application state |

## Installation

```bash
pip install ferrite-py sentence-transformers transformers torch
```

For optimized inference:

```bash
pip install onnx onnxruntime
```

## Quick Start

```python
from sentence_transformers import SentenceTransformer
from ferrite import Ferrite

# Load embedding model
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

# Connect to Ferrite
client = Ferrite('localhost', 6379)

# Create vector index
client.execute('VECTOR.CREATE', 'embeddings', 'DIMS', 384, 'METRIC', 'cosine')

# Generate and store embeddings
texts = ["Ferrite is a Redis-compatible database", "Hugging Face makes AI accessible"]
embeddings = model.encode(texts)

for i, (text, embedding) in enumerate(zip(texts, embeddings)):
    client.execute('VECTOR.ADD', 'embeddings', f'doc:{i}', *embedding.tolist())
    client.hset(f'doc:{i}:meta', mapping={'text': text})

# Search
query = "What is Ferrite?"
query_embedding = model.encode(query)
results = client.execute('VECTOR.SEARCH', 'embeddings', *query_embedding.tolist(), 'K', 5)
```

## Embedding Models

### Sentence-Transformers

The recommended approach for generating embeddings:

```python
from sentence_transformers import SentenceTransformer

# Popular models
models = {
    'all-MiniLM-L6-v2': 384,      # Fast, good quality
    'all-mpnet-base-v2': 768,     # Higher quality
    'multi-qa-MiniLM-L6-cos-v1': 384,  # Optimized for Q&A
    'paraphrase-multilingual-MiniLM-L12-v2': 384,  # Multilingual
}

# Load model
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

# Generate embeddings
embeddings = model.encode(
    sentences,
    batch_size=32,
    show_progress_bar=True,
    normalize_embeddings=True  # For cosine similarity
)
```

### Transformers Library

For custom models or more control:

```python
from transformers import AutoTokenizer, AutoModel
import torch

class HFEmbedder:
    def __init__(self, model_name: str):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name)
        self.model.eval()

    def encode(self, texts: list[str]) -> torch.Tensor:
        inputs = self.tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors='pt'
        )

        with torch.no_grad():
            outputs = self.model(**inputs)
            # Mean pooling
            embeddings = outputs.last_hidden_state.mean(dim=1)
            # Normalize
            embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)

        return embeddings

# Usage
embedder = HFEmbedder('sentence-transformers/all-MiniLM-L6-v2')
embeddings = embedder.encode(["Hello world", "How are you?"])
```

### ONNX Optimization

For production deployments, use ONNX for faster inference:

```python
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer
import numpy as np

class ONNXEmbedder:
    def __init__(self, model_name: str):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = ORTModelForFeatureExtraction.from_pretrained(
            model_name,
            export=True  # Convert to ONNX on first load
        )

    def encode(self, texts: list[str]) -> np.ndarray:
        inputs = self.tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors='pt'
        )

        outputs = self.model(**inputs)
        embeddings = outputs.last_hidden_state.mean(dim=1).numpy()
        # Normalize
        embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)

        return embeddings

# 2-3x faster inference
embedder = ONNXEmbedder('sentence-transformers/all-MiniLM-L6-v2')
```

## Vector Store

### Ferrite Vector Store Class

```python
from sentence_transformers import SentenceTransformer
from ferrite import Ferrite
from typing import Optional
import numpy as np

class FerriteVectorStore:
    def __init__(
        self,
        client: Ferrite,
        index_name: str,
        model_name: str = 'sentence-transformers/all-MiniLM-L6-v2',
        dimension: int = 384,
        metric: str = 'cosine'
    ):
        self.client = client
        self.index_name = index_name
        self.model = SentenceTransformer(model_name)
        self.dimension = dimension

        # Create index if not exists
        try:
            client.execute('VECTOR.CREATE', index_name,
                          'DIMS', dimension,
                          'METRIC', metric,
                          'INDEX', 'hnsw',
                          'M', 16,
                          'EF_CONSTRUCTION', 200)
        except Exception:
            pass  # Index already exists

    def add_texts(
        self,
        texts: list[str],
        metadatas: Optional[list[dict]] = None,
        ids: Optional[list[str]] = None
    ) -> list[str]:
        """Add texts with their embeddings to the vector store."""
        embeddings = self.model.encode(texts, normalize_embeddings=True)

        if ids is None:
            ids = [f"doc:{i}" for i in range(len(texts))]

        for i, (text, embedding, doc_id) in enumerate(zip(texts, embeddings, ids)):
            # Store vector
            self.client.execute('VECTOR.ADD', self.index_name, doc_id, *embedding.tolist())

            # Store metadata
            meta = {'text': text}
            if metadatas and i < len(metadatas):
                meta.update(metadatas[i])
            self.client.hset(f"{doc_id}:meta", mapping=meta)

        return ids

    def similarity_search(
        self,
        query: str,
        k: int = 5,
        filter: Optional[dict] = None
    ) -> list[dict]:
        """Search for similar documents."""
        query_embedding = self.model.encode([query], normalize_embeddings=True)[0]

        # Build search command
        cmd = ['VECTOR.SEARCH', self.index_name, *query_embedding.tolist(), 'K', k]
        if filter:
            cmd.extend(['FILTER', str(filter)])

        results = self.client.execute(*cmd)

        # Fetch metadata
        documents = []
        for doc_id, score in results:
            meta = self.client.hgetall(f"{doc_id}:meta")
            documents.append({
                'id': doc_id,
                'score': score,
                'text': meta.get('text', ''),
                'metadata': {k: v for k, v in meta.items() if k != 'text'}
            })

        return documents

    def delete(self, ids: list[str]):
        """Delete documents by ID."""
        for doc_id in ids:
            self.client.execute('VECTOR.DEL', self.index_name, doc_id)
            self.client.delete(f"{doc_id}:meta")

# Usage
client = Ferrite('localhost', 6379)
store = FerriteVectorStore(client, 'my_docs')

# Add documents
ids = store.add_texts(
    texts=["Document about AI", "Document about databases"],
    metadatas=[{"source": "ai.txt"}, {"source": "db.txt"}]
)

# Search
results = store.similarity_search("artificial intelligence", k=3)
for doc in results:
    print(f"Score: {doc['score']:.4f} - {doc['text']}")
```

### Batch Processing

```python
def batch_add_documents(store: FerriteVectorStore, documents: list[dict], batch_size: int = 100):
    """Add documents in batches for better performance."""
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i + batch_size]
        texts = [d['text'] for d in batch]
        metadatas = [d.get('metadata', {}) for d in batch]
        ids = [d.get('id') for d in batch if d.get('id')]

        store.add_texts(texts, metadatas, ids if ids else None)
        print(f"Processed {min(i + batch_size, len(documents))}/{len(documents)}")

# Usage
documents = [
    {"text": "First document", "metadata": {"category": "tech"}},
    {"text": "Second document", "metadata": {"category": "science"}},
    # ... thousands more
]

batch_add_documents(store, documents, batch_size=100)
```

## Semantic Caching

Cache expensive model inferences based on semantic similarity:

```python
from sentence_transformers import SentenceTransformer
from ferrite import Ferrite
import json

class SemanticCache:
    def __init__(
        self,
        client: Ferrite,
        model_name: str = 'sentence-transformers/all-MiniLM-L6-v2',
        threshold: float = 0.95,
        ttl: int = 3600
    ):
        self.client = client
        self.model = SentenceTransformer(model_name)
        self.threshold = threshold
        self.ttl = ttl
        self.index_name = "semantic_cache"

        # Create cache index
        try:
            client.execute('VECTOR.CREATE', self.index_name,
                          'DIMS', 384, 'METRIC', 'cosine',
                          'INDEX', 'hnsw', 'EF_RUNTIME', 50)
        except Exception:
            pass

    def get(self, query: str) -> Optional[str]:
        """Get cached response if similar query exists."""
        embedding = self.model.encode([query], normalize_embeddings=True)[0]

        results = self.client.execute(
            'VECTOR.SEARCH', self.index_name,
            *embedding.tolist(),
            'K', 1
        )

        if results and results[0][1] >= self.threshold:
            cache_key = results[0][0]
            cached = self.client.get(f"{cache_key}:response")
            if cached:
                return cached

        return None

    def set(self, query: str, response: str):
        """Cache a query-response pair."""
        embedding = self.model.encode([query], normalize_embeddings=True)[0]

        # Generate cache key
        cache_key = f"cache:{hash(query)}"

        # Store vector
        self.client.execute('VECTOR.ADD', self.index_name, cache_key, *embedding.tolist())

        # Store response with TTL
        self.client.setex(f"{cache_key}:response", self.ttl, response)

    def clear(self):
        """Clear all cached entries."""
        # Get all cache keys
        keys = self.client.keys("cache:*")
        if keys:
            self.client.delete(*keys)

# Usage with LLM
from transformers import pipeline

cache = SemanticCache(client, threshold=0.92)
generator = pipeline('text-generation', model='gpt2')

def generate_with_cache(prompt: str) -> str:
    # Check cache first
    cached = cache.get(prompt)
    if cached:
        print("Cache hit!")
        return cached

    # Generate new response
    print("Cache miss, generating...")
    response = generator(prompt, max_length=100)[0]['generated_text']

    # Cache for future
    cache.set(prompt, response)

    return response

# First call - cache miss
result1 = generate_with_cache("What is machine learning?")

# Similar query - cache hit
result2 = generate_with_cache("Explain machine learning")  # Returns cached response
```

## RAG Pipeline

Build a complete RAG pipeline with Hugging Face and Ferrite:

```python
from sentence_transformers import SentenceTransformer
from transformers import pipeline
from ferrite import Ferrite
from typing import Optional

class RAGPipeline:
    def __init__(
        self,
        ferrite_client: Ferrite,
        embedding_model: str = 'sentence-transformers/all-MiniLM-L6-v2',
        generator_model: str = 'google/flan-t5-base'
    ):
        self.client = ferrite_client
        self.embedder = SentenceTransformer(embedding_model)
        self.generator = pipeline(
            'text2text-generation',
            model=generator_model,
            max_length=512
        )
        self.index_name = "rag_documents"

        # Create index
        dim = self.embedder.get_sentence_embedding_dimension()
        try:
            self.client.execute('VECTOR.CREATE', self.index_name,
                              'DIMS', dim, 'METRIC', 'cosine',
                              'INDEX', 'hnsw')
        except Exception:
            pass

    def ingest(self, documents: list[dict]):
        """Ingest documents into the RAG pipeline."""
        texts = [d['text'] for d in documents]
        embeddings = self.embedder.encode(texts, normalize_embeddings=True)

        for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
            doc_id = doc.get('id', f'doc:{i}')
            self.client.execute('VECTOR.ADD', self.index_name, doc_id, *embedding.tolist())
            self.client.hset(f"{doc_id}:content", mapping={
                'text': doc['text'],
                'source': doc.get('source', 'unknown'),
                **doc.get('metadata', {})
            })

    def retrieve(self, query: str, k: int = 5) -> list[dict]:
        """Retrieve relevant documents."""
        embedding = self.embedder.encode([query], normalize_embeddings=True)[0]
        results = self.client.execute('VECTOR.SEARCH', self.index_name,
                                      *embedding.tolist(), 'K', k)

        documents = []
        for doc_id, score in results:
            content = self.client.hgetall(f"{doc_id}:content")
            documents.append({
                'id': doc_id,
                'score': score,
                **content
            })

        return documents

    def generate(self, query: str, context: str) -> str:
        """Generate answer based on context."""
        prompt = f"""Based on the following context, answer the question.

Context: {context}

Question: {query}

Answer:"""

        response = self.generator(prompt)[0]['generated_text']
        return response

    def query(self, question: str, k: int = 5) -> dict:
        """Full RAG query: retrieve and generate."""
        # Retrieve relevant documents
        docs = self.retrieve(question, k)

        # Build context
        context = "\n\n".join([d['text'] for d in docs])

        # Generate answer
        answer = self.generate(question, context)

        return {
            'answer': answer,
            'sources': [{'id': d['id'], 'score': d['score'], 'source': d.get('source')}
                       for d in docs]
        }

# Usage
client = Ferrite('localhost', 6379)
rag = RAGPipeline(client)

# Ingest documents
documents = [
    {"id": "doc1", "text": "Ferrite is a high-performance Redis alternative.", "source": "ferrite.md"},
    {"id": "doc2", "text": "Vector search enables semantic similarity queries.", "source": "vectors.md"},
    {"id": "doc3", "text": "Hugging Face provides thousands of pre-trained models.", "source": "hf.md"},
]
rag.ingest(documents)

# Query
result = rag.query("What is Ferrite?")
print(f"Answer: {result['answer']}")
print(f"Sources: {result['sources']}")
```

## Text Classification

Combine Ferrite caching with text classification:

```python
from transformers import pipeline
from ferrite import Ferrite

class CachedClassifier:
    def __init__(
        self,
        ferrite_client: Ferrite,
        model_name: str = 'distilbert-base-uncased-finetuned-sst-2-english',
        cache_ttl: int = 86400
    ):
        self.client = ferrite_client
        self.classifier = pipeline('text-classification', model=model_name)
        self.cache_ttl = cache_ttl

    def classify(self, text: str) -> dict:
        """Classify text with caching."""
        # Check cache
        cache_key = f"classify:{hash(text)}"
        cached = self.client.get(cache_key)

        if cached:
            import json
            return json.loads(cached)

        # Classify
        result = self.classifier(text)[0]

        # Cache result
        import json
        self.client.setex(cache_key, self.cache_ttl, json.dumps(result))

        return result

    def batch_classify(self, texts: list[str]) -> list[dict]:
        """Batch classify with partial cache hits."""
        results = []
        uncached_texts = []
        uncached_indices = []

        # Check cache for each text
        for i, text in enumerate(texts):
            cache_key = f"classify:{hash(text)}"
            cached = self.client.get(cache_key)

            if cached:
                import json
                results.append((i, json.loads(cached)))
            else:
                uncached_texts.append(text)
                uncached_indices.append(i)

        # Classify uncached texts
        if uncached_texts:
            new_results = self.classifier(uncached_texts)
            for idx, result in zip(uncached_indices, new_results):
                # Cache
                cache_key = f"classify:{hash(texts[idx])}"
                import json
                self.client.setex(cache_key, self.cache_ttl, json.dumps(result))
                results.append((idx, result))

        # Sort by original index
        results.sort(key=lambda x: x[0])
        return [r[1] for r in results]

# Usage
client = Ferrite('localhost', 6379)
classifier = CachedClassifier(client)

# First call - cache miss
result = classifier.classify("This movie was amazing!")
print(result)  # {'label': 'POSITIVE', 'score': 0.9998}

# Second call - cache hit
result = classifier.classify("This movie was amazing!")
print(result)  # Instant response from cache
```

## Zero-Shot Classification

```python
from transformers import pipeline
from ferrite import Ferrite

class ZeroShotClassifier:
    def __init__(self, ferrite_client: Ferrite):
        self.client = ferrite_client
        self.classifier = pipeline(
            'zero-shot-classification',
            model='facebook/bart-large-mnli'
        )

    def classify(
        self,
        text: str,
        labels: list[str],
        multi_label: bool = False
    ) -> dict:
        """Zero-shot classification with caching."""
        # Create cache key from text and labels
        cache_key = f"zsc:{hash(text)}:{hash(tuple(sorted(labels)))}"

        cached = self.client.get(cache_key)
        if cached:
            import json
            return json.loads(cached)

        result = self.classifier(text, labels, multi_label=multi_label)

        import json
        self.client.setex(cache_key, 3600, json.dumps(result))

        return result

# Usage
client = Ferrite('localhost', 6379)
zsc = ZeroShotClassifier(client)

result = zsc.classify(
    "Ferrite provides vector search and semantic caching",
    labels=["technology", "sports", "politics", "entertainment"]
)
print(f"Label: {result['labels'][0]}, Score: {result['scores'][0]:.4f}")
# Label: technology, Score: 0.9234
```

## Question Answering

```python
from transformers import pipeline
from ferrite import Ferrite

class QASystem:
    def __init__(self, ferrite_client: Ferrite):
        self.client = ferrite_client
        self.qa = pipeline(
            'question-answering',
            model='distilbert-base-cased-distilled-squad'
        )
        self.store = FerriteVectorStore(ferrite_client, 'qa_contexts')

    def add_context(self, context: str, source: str):
        """Add context document."""
        self.store.add_texts([context], metadatas=[{"source": source}])

    def answer(self, question: str, k: int = 3) -> dict:
        """Answer question using retrieved context."""
        # Retrieve relevant contexts
        docs = self.store.similarity_search(question, k=k)

        # Combine contexts
        context = " ".join([d['text'] for d in docs])

        # Answer question
        result = self.qa(question=question, context=context)

        return {
            'answer': result['answer'],
            'score': result['score'],
            'sources': [d['metadata'].get('source') for d in docs]
        }

# Usage
client = Ferrite('localhost', 6379)
qa = QASystem(client)

# Add contexts
qa.add_context(
    "Ferrite is a high-performance key-value store written in Rust. "
    "It is designed as a drop-in Redis replacement with tiered storage.",
    source="ferrite-intro.md"
)

# Ask questions
result = qa.answer("What language is Ferrite written in?")
print(f"Answer: {result['answer']}")  # "Rust"
print(f"Score: {result['score']:.4f}")
```

## Named Entity Recognition

```python
from transformers import pipeline
from ferrite import Ferrite
import json

class NERExtractor:
    def __init__(self, ferrite_client: Ferrite):
        self.client = ferrite_client
        self.ner = pipeline(
            'ner',
            model='dbmdz/bert-large-cased-finetuned-conll03-english',
            aggregation_strategy='simple'
        )

    def extract(self, text: str) -> list[dict]:
        """Extract named entities with caching."""
        cache_key = f"ner:{hash(text)}"

        cached = self.client.get(cache_key)
        if cached:
            return json.loads(cached)

        entities = self.ner(text)
        # Convert to serializable format
        entities = [{
            'entity': e['entity_group'],
            'word': e['word'],
            'score': float(e['score']),
            'start': e['start'],
            'end': e['end']
        } for e in entities]

        self.client.setex(cache_key, 3600, json.dumps(entities))

        return entities

    def index_entities(self, doc_id: str, text: str):
        """Extract and index entities for a document."""
        entities = self.extract(text)

        # Store in Ferrite for querying
        for entity in entities:
            # Add to entity set
            self.client.sadd(f"entity:{entity['entity']}", entity['word'])
            # Map entity to documents
            self.client.sadd(f"entity:{entity['word']}:docs", doc_id)

        # Store document entities
        self.client.set(f"doc:{doc_id}:entities", json.dumps(entities))

    def find_documents_by_entity(self, entity_word: str) -> list[str]:
        """Find documents containing a specific entity."""
        return list(self.client.smembers(f"entity:{entity_word}:docs"))

# Usage
client = Ferrite('localhost', 6379)
ner = NERExtractor(client)

# Extract and index
text = "Apple CEO Tim Cook announced new products in California."
ner.index_entities("news:123", text)

# Query
apple_docs = ner.find_documents_by_entity("Apple")
print(f"Documents mentioning Apple: {apple_docs}")
```

## Performance Tips

### Model Loading

```python
# Load model once, reuse for all requests
from sentence_transformers import SentenceTransformer

# Global model instance
_model = None

def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
    return _model
```

### Batch Processing

```python
# Process in batches for efficiency
def process_large_dataset(texts: list[str], batch_size: int = 64):
    model = get_model()
    all_embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        embeddings = model.encode(batch, show_progress_bar=False)
        all_embeddings.extend(embeddings)

    return all_embeddings
```

### GPU Acceleration

```python
import torch
from sentence_transformers import SentenceTransformer

# Use GPU if available
device = 'cuda' if torch.cuda.is_available() else 'cpu'
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2', device=device)

# For transformers
from transformers import pipeline
classifier = pipeline('text-classification', device=0 if torch.cuda.is_available() else -1)
```

### Connection Pooling

```python
from ferrite import FerritePool

# Create connection pool
pool = FerritePool(
    host='localhost',
    port=6379,
    max_connections=20,
    min_connections=5
)

# Use pool in your application
def process_request(text: str):
    with pool.get_connection() as client:
        # Use client
        pass
```

## Configuration

### Ferrite Configuration for HuggingFace Workloads

```toml
[server]
port = 6379
max_connections = 10000

[storage]
max_memory = 4294967296 # 4GB

[vector]
enabled = true
default_metric = "cosine"
default_index = "hnsw"

# HNSW settings for embedding models
hnsw_m = 16
hnsw_ef_construction = 200

[semantic]
cache_enabled = true
cache_similarity_threshold = 0.92
cache_max_entries = 100000
```

### Environment Variables

```bash
# Ferrite connection
export FERRITE_HOST=localhost
export FERRITE_PORT=6379

# Hugging Face
export HF_HOME=/path/to/cache
export TRANSFORMERS_CACHE=/path/to/cache
export SENTENCE_TRANSFORMERS_HOME=/path/to/cache

# GPU
export CUDA_VISIBLE_DEVICES=0
```

## Next Steps

- [LangChain Integration](/docs/integrations/langchain) - Use with LangChain framework
- [LlamaIndex Integration](/docs/integrations/llamaindex) - Use with LlamaIndex
- [Vector Search Guide](/docs/guides/vector-search) - Deep dive into vector capabilities
- [Embeddings](/docs/ai-ml/embeddings) - All embedding providers
- [Python SDK](/docs/sdk/python) - Full Python client documentation
