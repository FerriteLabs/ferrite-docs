# Ferrite Multi-Model Database Features

Ferrite now supports five powerful multi-model database engines, making it a comprehensive data platform that goes beyond traditional key-value storage.

## Table of Contents

1. [Time-Series Engine](#time-series-engine)
2. [Full-Text Search Engine](#full-text-search-engine)
3. [Graph Database](#graph-database)
4. [JSON Document Store](#json-document-store)
5. [Stream Processing Engine](#stream-processing-engine)

---

## Time-Series Engine

Location: `src/timeseries/`

A Prometheus-compatible time-series database optimized for metrics and monitoring data.

### Features

- **Efficient Sample Storage**: Compressed storage optimized for time-series data
- **Label-based Organization**: Prometheus-style labels for flexible metric organization
- **PromQL-Compatible Queries**: Support for common PromQL operations
- **Downsampling**: Automatic data compaction for long-term storage
- **Retention Policies**: Configurable data retention by age or size

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Time Series Storage                          │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Samples   │  │   Labels    │  │   Series Index      │  │
│  │  (Chunks)   │  │  (Matchers) │  │  (Metric → Series)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                │                   │               │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌────────▼──────────┐   │
│  │ Compression │  │   Query     │  │   Aggregation     │   │
│  │  (Gorilla)  │  │   Engine    │  │   (sum,avg,etc)   │   │
│  └─────────────┘  └─────────────┘  └───────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Example Usage

```rust
use ferrite::timeseries::{TimeSeriesStorage, Sample, Labels};

// Create storage
let storage = TimeSeriesStorage::new();

// Write samples with labels
let labels = Labels::new()
    .add("__name__", "http_requests_total")
    .add("method", "GET")
    .add("status", "200");

storage.write(Sample::new(labels, 1234567890, 42.0))?;

// Query with PromQL-style syntax
let result = storage.query_builder("http_requests_total")
    .label_match("method", "GET")
    .range(start_time, end_time)
    .step(Duration::from_secs(60))
    .execute()?;
```

### Modules

| Module | Description |
|--------|-------------|
| `storage.rs` | Core storage engine with series management |
| `sample.rs` | Sample and value types |
| `series.rs` | Time series with labels |
| `labels.rs` | Label matchers and filtering |
| `query.rs` | PromQL-compatible query builder |
| `aggregation.rs` | Aggregation functions (sum, avg, rate, etc.) |
| `downsample.rs` | Data compaction and downsampling |
| `retention.rs` | Retention policy management |

---

## Full-Text Search Engine

Location: `src/search/`

An Elasticsearch-compatible full-text search engine with BM25 scoring.

### Features

- **Inverted Index**: Efficient term-to-document mapping
- **BM25 Scoring**: Industry-standard relevance scoring
- **Multiple Analyzers**: Standard, Whitespace, Keyword, N-gram analyzers
- **Faceted Search**: Aggregation and faceting support
- **Highlighting**: Search result highlighting
- **Boolean Queries**: AND, OR, NOT, phrase queries

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Search Engine                              │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Analyzer   │  │  Inverted   │  │     Scoring         │  │
│  │  Pipeline   │  │    Index    │  │   (BM25/TF-IDF)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                │                   │               │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌────────▼──────────┐   │
│  │  Tokenizer  │  │   Postings  │  │   Query Parser    │   │
│  │  + Filters  │  │    Lists    │  │   (Boolean/Phrase)│   │
│  └─────────────┘  └─────────────┘  └───────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Example Usage

```rust
use ferrite::search::{SearchEngine, IndexDocument};

// Create search engine
let engine = SearchEngine::new();

// Index documents
engine.index(IndexDocument {
    id: "1".to_string(),
    fields: vec![
        ("title".to_string(), "Introduction to Rust".to_string()),
        ("content".to_string(), "Rust is a systems programming language...".to_string()),
    ],
})?;

// Search with query
let results = engine.search(Query::boolean()
    .must(Query::term("content", "rust"))
    .should(Query::term("title", "introduction"))
    .build())?;
```

### Modules

| Module | Description |
|--------|-------------|
| `mod.rs` | Main search engine and configuration |
| `index.rs` | Document indexing and inverted index |
| `analyzer.rs` | Text analysis pipeline |
| `tokenizer.rs` | Text tokenization |
| `query.rs` | Query parsing and execution |
| `scorer.rs` | BM25 and TF-IDF scoring |
| `highlight.rs` | Search result highlighting |
| `facet.rs` | Faceted search and aggregations |

---

## Graph Database

Location: `src/graph/`

A Neo4j-compatible property graph database with traversal algorithms.

### Features

- **Property Graphs**: Vertices and edges with arbitrary properties
- **Labeled Elements**: Type classification via labels
- **Graph Traversals**: BFS, DFS, shortest path
- **Pattern Matching**: Cypher-like pattern queries
- **Graph Algorithms**: PageRank, connected components
- **Indexing**: Label and property indexes

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Graph Database Engine                      │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Vertices   │  │    Edges     │  │   Properties     │   │
│  │   (Nodes)    │──│  (Relations) │──│   (Key-Value)    │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│         │                 │                   │              │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌─────────▼─────────┐   │
│  │   Labels    │  │  Traversal  │  │     Indexing      │   │
│  │   (Types)   │  │ (BFS/DFS)   │  │   (Properties)    │   │
│  └─────────────┘  └─────────────┘  └───────────────────┘   │
│         │                 │                   │              │
│  ┌──────▼──────────────────────────────────────────────┐    │
│  │              Graph Query Engine                      │    │
│  │        (Pattern Matching, Pathfinding)               │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Example Usage

```rust
use ferrite::graph::{Graph, Vertex, Edge};

// Create graph
let mut graph = Graph::new();

// Add vertices
let alice = graph.add_vertex("Person")
    .property("name", "Alice")
    .property("age", 30)?;

let bob = graph.add_vertex("Person")
    .property("name", "Bob")
    .property("age", 25)?;

// Add edge
graph.add_edge(alice, bob, "KNOWS")
    .property("since", 2020)?;

// Traverse
let friends = graph.traverse(alice)
    .out("KNOWS")
    .has("age", Comparison::Gt, 20)
    .collect();

// Run PageRank
let ranks = graph.algorithm(PageRank::new())
    .damping(0.85)
    .iterations(20)
    .run()?;
```

### Modules

| Module | Description |
|--------|-------------|
| `mod.rs` | Main graph database and configuration |
| `vertex.rs` | Vertex types and operations |
| `edge.rs` | Edge types and operations |
| `storage.rs` | Adjacency list storage |
| `traversal.rs` | Graph traversal operations |
| `algorithm.rs` | Graph algorithms (PageRank, etc.) |
| `query.rs` | Query building and execution |
| `pattern.rs` | Pattern matching |
| `index.rs` | Graph indexing |

---

## JSON Document Store

Location: `src/document/`

A MongoDB-compatible document database with rich querying capabilities.

### Features

- **Schemaless Storage**: Flexible JSON document storage
- **Rich Query Language**: MongoDB-compatible operators
- **Secondary Indexes**: B-tree, compound, and text indexes
- **Aggregation Pipelines**: $match, $group, $sort, $lookup
- **JSON Schema Validation**: Document validation rules
- **Change Streams**: Real-time document change notifications

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Document Store Engine                       │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Documents   │  │ Collections  │  │     Indexes      │   │
│  │   (JSON)     │  │  (Grouped)   │  │   (B-tree/Text)  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│         │                 │                   │              │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌─────────▼─────────┐   │
│  │   Query     │  │ Aggregation │  │    Validation     │   │
│  │   Engine    │  │  Pipeline   │  │   (JSON Schema)   │   │
│  └─────────────┘  └─────────────┘  └───────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Example Usage

```rust
use ferrite::document::{DocumentStore, Document, Query};

// Create store
let store = DocumentStore::new();

// Create collection
let users = store.create_collection("users")?;

// Insert documents
users.insert_one(Document::new()
    .field("name", "Alice")
    .field("email", "alice@example.com")
    .field("age", 30)
    .field("tags", vec!["developer", "rust"]))?;

// Query with MongoDB-style operators
let results = users.find(Query::new()
    .eq("name", "Alice")
    .gt("age", 25)
    .in_array("tags", vec!["developer"]))?;

// Aggregation pipeline
let pipeline = users.aggregate()
    .match_query(Query::new().gt("age", 20))
    .group("$city", vec![("count", Accumulator::Sum(1))])
    .sort("count", -1)
    .limit(10)
    .execute()?;
```

### Modules

| Module | Description |
|--------|-------------|
| `mod.rs` | Main document store engine |
| `document.rs` | Document types and operations |
| `collection.rs` | Collection management |
| `query.rs` | MongoDB-compatible query language |
| `index.rs` | Document indexing |
| `aggregation.rs` | Aggregation pipeline |
| `projection.rs` | Field projection |
| `validation.rs` | JSON Schema validation |

---

## Stream Processing Engine

Location: `src/streaming/`

A Kafka Streams-compatible stream processing engine for real-time data.

### Features

- **Real-time Processing**: Process events as they arrive
- **Windowing**: Tumbling, sliding, session, and global windows
- **Stateful Operations**: Aggregations with state management
- **Exactly-Once Semantics**: Guaranteed processing guarantees
- **Watermarks**: Event-time processing with late data handling
- **Stream-Table Joins**: Enrich streams with lookup tables

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Stream Processing Engine                   │
├─────────────────────────────────────────────────────────────┤
│  Sources          Operators           Sinks                  │
│  ┌────────┐      ┌──────────┐       ┌────────┐              │
│  │ Kafka  │─────►│ Filter   │──────►│ Kafka  │              │
│  │ Redis  │      │ Map      │       │ Redis  │              │
│  │ File   │      │ FlatMap  │       │ File   │              │
│  │ HTTP   │      │ Aggregate│       │ HTTP   │              │
│  └────────┘      │ Join     │       └────────┘              │
│                  │ Window   │                                │
│                  └──────────┘                                │
├─────────────────────────────────────────────────────────────┤
│                    State Store                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Key-Value  │  │   Window    │  │   Session   │         │
│  │    Store    │  │    Store    │  │    Store    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Example Usage

```rust
use ferrite::streaming::{StreamBuilder, WindowType, Source, Sink};
use std::time::Duration;

// Build a streaming pipeline
let pipeline = StreamBuilder::new("click-analytics")
    .source(RedisSource::new("clicks"))
    .filter(|event| event.get_str("type") == Some("click"))
    .map(|event| {
        StreamEvent::new(
            event.get("page").cloned(),
            event.value,
        )
    })
    .window(WindowType::Tumbling(Duration::from_secs(60)))
    .aggregate(|acc, event| acc + 1)
    .sink(RedisSink::new("click-counts"))
    .build();

// Start the pipeline
pipeline.start().await?;
```

### Modules

| Module | Description |
|--------|-------------|
| `mod.rs` | Main streaming engine |
| `pipeline.rs` | Pipeline building and execution |
| `operator.rs` | Stream operators (filter, map, join) |
| `window.rs` | Windowing (tumbling, sliding, session) |
| `source.rs` | Data sources (Kafka, Redis, File) |
| `sink.rs` | Data sinks |
| `state.rs` | State management |
| `watermark.rs` | Watermarks and late data handling |

---

## Integration Examples

### Multi-Model Query Example

Ferrite allows you to combine multiple data models in a single application:

```rust
use ferrite::{
    timeseries::TimeSeriesStorage,
    search::SearchEngine,
    graph::Graph,
    document::DocumentStore,
    streaming::StreamEngine,
};

// Initialize all engines
let timeseries = TimeSeriesStorage::new();
let search = SearchEngine::new();
let graph = Graph::new();
let documents = DocumentStore::new();
let streaming = StreamEngine::new(StreamConfig::default());

// Example: Process events, store in multiple formats
streaming.register_pipeline(
    StreamBuilder::new("multi-model-pipeline")
        .source(KafkaSource::new("events"))
        .map(|event| {
            // Index in search engine
            search.index(event.to_search_doc());

            // Store time-series metrics
            timeseries.write(event.to_metric());

            // Update graph relationships
            graph.add_edge(event.user_id, event.item_id, "VIEWED");

            // Store full document
            documents.insert(event.to_document());

            event
        })
        .sink(MetricsSink::new())
        .build()
)?;
```

---

## Performance Considerations

### Time-Series
- Use appropriate downsampling for long-term storage
- Batch writes when possible
- Index frequently-queried label combinations

### Full-Text Search
- Choose appropriate analyzers for your use case
- Use filters before full-text queries
- Consider index refresh intervals

### Graph
- Use indexes for frequently-traversed paths
- Limit traversal depth for large graphs
- Batch property updates

### Documents
- Create indexes for query patterns
- Use projections to limit returned fields
- Consider compound indexes for multi-field queries

### Streaming
- Size windows appropriately
- Configure state store checkpointing
- Monitor watermark lag

---

## Future Enhancements

- Vector similarity search for AI/ML workloads
- Geospatial indexing and queries
- Machine learning model serving
- Distributed processing across nodes
- Real-time materialized views
