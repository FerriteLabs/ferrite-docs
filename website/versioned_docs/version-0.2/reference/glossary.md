---
maturity: stable
---

# Glossary

Definitions of terms used throughout the Ferrite documentation.

## A

### ACL (Access Control List)
Security feature that defines permissions for users. Controls which commands users can execute and which keys they can access.

### AOF (Append-Only File)
Persistence mechanism that logs every write operation. Provides durability by replaying the log on restart.

### Async I/O
Non-blocking input/output operations that allow processing multiple requests without waiting for each to complete.

## B

### BM25
Ranking function used in full-text search. Calculates relevance based on term frequency and document length.

### Bucket
- In hash indexes: group of entries that hash to the same location
- In time series: time interval for aggregating samples

## C

### CDC (Change Data Capture)
Feature that streams data changes to external systems. Enables real-time data synchronization.

### Checkpoint
Point-in-time snapshot of the database. Used for faster recovery than replaying entire AOF.

### Cluster
Group of Ferrite nodes working together. Provides horizontal scaling and high availability.

### Cold Tier
Lowest tier in HybridLog. Data accessed via disk I/O using io_uring.

### Cosine Similarity
Distance metric for vectors. Measures angle between vectors, commonly used for embeddings.

### CRDT (Conflict-free Replicated Data Type)
Data structures that can be replicated across nodes without coordination. Automatically resolve conflicts.

## D

### Distance Metric
Function measuring similarity between vectors. Common metrics: cosine, L2 (Euclidean), dot product.

### Downsampling
Reducing data resolution by aggregating samples. Used in time series to reduce storage.

## E

### Embedding
Dense vector representation of data (text, images). Created by ML models for semantic similarity.

### Epoch
Time period in epoch-based reclamation. Used for safe memory management without locks.

### Epoch-Based Reclamation (EBR)
Memory management technique that defers deallocation until all threads have passed a "safe point."

### Eviction
Automatic removal of data when memory is full. Controlled by eviction policies (LRU, LFU, etc.).

## F

### Failover
Process of promoting a replica to primary when the current primary fails.

### FerriteQL
SQL-like query language for complex operations across multiple keys.

### Follower
See [Replica](#replica).

### fsync
System call that flushes data to disk. Ensures durability at the cost of performance.

## G

### Guard
Object that "pins" an epoch. Prevents reclamation while guard is held.

## H

### Hash Slot
In clustering, the 16384 slots that keys are mapped to. Each node owns a subset of slots.

### Hash Tag
Curly braces in key names that control slot assignment: `{user}:1` and `{user}:2` go to same slot.

### HNSW (Hierarchical Navigable Small World)
Graph-based algorithm for approximate nearest neighbor search. Fast and accurate for vector search.

### Hot Tier
Top tier in HybridLog. Data in memory for fastest access.

### HybridLog
Ferrite's storage engine based on Microsoft FASTER. Combines log-structured storage with hash indexing.

## I

### Index
Data structure for fast lookups. Types include hash index, HNSW (vectors), inverted index (full-text).

### Inverted Index
Index mapping terms to documents. Used for full-text search.

### io_uring
Linux kernel interface for async I/O. Provides high performance by minimizing system calls.

### IVF (Inverted File)
Vector index algorithm that clusters vectors. Good for very large datasets with high recall.

## J

### JSON Path
Query syntax for accessing nested JSON values: `$.user.address.city`.

## K

### Key
Unique identifier for data in Ferrite. Binary-safe string up to 512MB.

### Keyspace
The set of all keys in a database. Each database (0-15) has its own keyspace.

### Keyspace Notification
Event published when keys change. Enables monitoring key operations.

## L

### Latency
Time between sending request and receiving response. Often measured as P50, P99, P99.9.

### Leader
See [Primary](#primary).

### LFU (Least Frequently Used)
Eviction policy that removes keys accessed least often.

### LRU (Least Recently Used)
Eviction policy that removes keys not accessed for longest time.

### Lua
Scripting language supported in Ferrite. Scripts execute atomically on the server.

## M

### Materialized View
Pre-computed query results stored for fast access. Automatically refreshed.

### mmap (Memory-Mapped Files)
Technique that maps files to memory addresses. Used for warm tier access.

### MULTI/EXEC
Transaction commands. MULTI starts transaction, EXEC executes atomically.

### Multi-Tenancy
Feature allowing multiple isolated tenants on shared infrastructure.

## N

### Node
Single Ferrite server instance. In cluster mode, nodes coordinate to provide distributed storage.

## O

### ONNX
Open Neural Network Exchange format. Used for running embedding models locally.

### Ops/sec
Operations per second. Common throughput metric.

## P

### P99 (99th Percentile)
Latency value that 99% of requests are faster than. Important for tail latency.

### Pipeline
Sending multiple commands without waiting for responses. Reduces round-trip overhead.

### Primary
Node that handles writes in a replication group. Also called leader or master.

### Property Graph
Graph model with typed vertices, edges, and properties on both.

### Pub/Sub
Publish/Subscribe messaging pattern. Publishers send to channels, subscribers receive.

## Q

### Quorum
Minimum nodes needed for consensus. Typically majority (N/2 + 1).

## R

### Raft
Consensus algorithm for leader election and replication. Provides strong consistency.

### Read-Through Cache
Pattern where cache fetches from database on miss.

### Replica
Node that receives data from primary. Also called follower or slave.

### Replication
Copying data from primary to replicas. Provides redundancy and read scaling.

### RESP (Redis Serialization Protocol)
Wire protocol used by Ferrite. RESP2 and RESP3 versions supported.

### Retention Policy
Rules for how long time series data is kept before deletion.

## S

### Semantic Caching
Caching that matches by meaning (embeddings) rather than exact key.

### Sentinel
External process for monitoring and failover. Ferrite uses built-in Raft instead.

### Shard
Subset of data in a distributed system. Ferrite uses hash slots for sharding.

### Slot
See [Hash Slot](#hash-slot).

### Slow Log
Record of commands that exceeded a time threshold. Used for debugging performance.

### SQPOLL
io_uring mode where kernel polls submission queue. Eliminates syscalls for submissions.

### Stream
Append-only log data structure. Supports consumer groups for reliable processing.

## T

### Tenant
Isolated unit in multi-tenant system. Has own namespace and resource quotas.

### Throughput
Number of operations completed per unit time. Often measured in ops/sec.

### Tiered Storage
Storage architecture with multiple tiers (memory, mmap, disk). Data moves based on access patterns.

### Trigger
Code that executes in response to events. Can call webhooks, publish messages, etc.

### TTL (Time To Live)
Expiration time for keys. After TTL expires, key is automatically deleted.

## U

### UDF (User-Defined Function)
Custom function loaded into Ferrite. Can be Lua or WebAssembly.

## V

### Vector
Array of floating-point numbers. Used for semantic similarity search.

### Vector Index
Data structure for efficient nearest neighbor search. Types: HNSW, IVF, Flat.

## W

### Warm Tier
Middle tier in HybridLog. Data accessed via memory-mapped files.

### WASM (WebAssembly)
Binary instruction format for sandboxed code execution. Used for UDFs.

### WATCH
Command that monitors keys for changes. Used for optimistic locking.

### Write-Behind
Caching pattern where writes are batched before persisting.

### Write-Through
Caching pattern where writes immediately go to both cache and database.

## X

### XADD
Command to add entries to a stream.

### XREAD
Command to read entries from streams.

## Z

### Zero-Copy
Optimization avoiding data copies. Used in mmap and buffer sharing.

### ZADD
Command to add members to a sorted set.

### ZRANGE
Command to get range of members from sorted set.
