# Ferrite Example Configurations

This document provides production-ready configuration templates for common deployment scenarios.

> Note: These templates include optional sections that are ignored by the
> current parser. Supported keys match `docs/CONFIGURATION.md` and
> `ferrite.example.toml`; supported size fields use raw bytes so the runnable
> portions parse cleanly (optional sections may still show human-readable sizes).

## Table of Contents

1. [AI/ML Workloads](#aiml-workloads)
2. [Multi-Tenant SaaS](#multi-tenant-saas)
3. [Edge Deployment](#edge-deployment)
4. [High-Throughput Caching](#high-throughput-caching)
5. [Event-Driven Architecture](#event-driven-architecture)
6. [Time-Series Analytics](#time-series-analytics)
7. [Geo-Distributed Deployment](#geo-distributed-deployment)

---

## AI/ML Workloads

Optimized for vector search, semantic caching, and LLM application support.

```toml
# ferrite-ai-ml.toml
# Optimized for AI/ML workloads: vector search, semantic caching, RAG pipelines

[server]
bind = "0.0.0.0"
port = 6379
max_connections = 5000
worker_threads = 8  # Match CPU cores for embedding computation

[storage]
databases = 4
max_memory = 17179869184  # 16GB
eviction_policy = "lfu"  # LFU works better for embedding caches

[persistence]
data_dir = "/var/lib/ferrite/data"
aof_enabled = true
aof_sync = "everysec"
checkpoint_enabled = true
checkpoint_interval = 600  # 10 minutes

# Vector Search Configuration
[vector]
enabled = true
default_index_type = "hnsw"  # Best balance of speed and recall
max_vectors_per_index = 10000000  # 10M vectors
default_dimensions = 384  # Common for sentence-transformers

[vector.hnsw]
m = 16                    # Number of connections per layer
ef_construction = 200     # Build-time search width (higher = better recall, slower build)
ef_search = 100           # Query-time search width (higher = better recall, slower query)

[vector.ivf]
nlist = 1024              # Number of clusters
nprobe = 32               # Clusters to search (higher = better recall)

# Semantic Caching Configuration
[semantic]
enabled = true
default_similarity_threshold = 0.85  # 85% similarity for cache hits
cache_ttl = 3600                     # 1 hour default TTL
max_cache_entries = 1000000          # 1M cached responses

[semantic.embeddings]
provider = "onnx"         # Local ONNX for low latency
model_path = "/var/lib/ferrite/models/all-MiniLM-L6-v2.onnx"
# Alternative: Use OpenAI for higher quality embeddings
# provider = "openai"
# api_key = "${OPENAI_API_KEY}"
# model = "text-embedding-3-small"

# RAG Pipeline Configuration
[rag]
enabled = true
default_chunk_size = 512
default_chunk_overlap = 50
default_top_k = 5

[rag.reranking]
enabled = true
model = "cross-encoder"   # Rerank results for better relevance

# Memory allocation for AI workloads
[memory]
vector_index_memory = "4GB"      # Dedicated memory for vector indexes
embedding_cache_memory = "2GB"   # Cache for computed embeddings
semantic_cache_memory = "4GB"    # Semantic cache storage

[metrics]
enabled = true
port = 9090
# Track AI-specific metrics
include_vector_metrics = true
include_semantic_metrics = true

[logging]
level = "info"
format = "json"
file = "/var/log/ferrite/ferrite.log"
```

### Usage Example

```bash
# Start server with AI/ML config
ferrite --config ferrite-ai-ml.toml

# Create a vector index for document embeddings
VECTOR.CREATE documents DIM 384 DISTANCE cosine INDEX hnsw

# Add documents with embeddings
VECTOR.ADD documents doc:1 [0.1, 0.2, ...] '{"title": "Introduction to ML", "content": "..."}'

# Semantic search
VECTOR.SEARCH documents [0.15, 0.22, ...] TOP 10

# Semantic caching for LLM responses
SEMANTIC.SET "What is machine learning?" "Machine learning is a subset of AI..."
SEMANTIC.GET "Explain ML to me" 0.85  # Returns cached response if similar enough
```

---

## Multi-Tenant SaaS

Isolated tenants with resource quotas, rate limiting, and billing metrics.

```toml
# ferrite-multi-tenant.toml
# Optimized for multi-tenant SaaS applications

[server]
bind = "0.0.0.0"
port = 6379
max_connections = 50000   # High connection count for many tenants
worker_threads = 16
tcp_keepalive = 60

[storage]
databases = 1             # Single DB, tenants isolated by prefix
max_memory = 68719476736  # 64GB
eviction_policy = "volatile-lru"  # Only evict keys with TTL

[persistence]
data_dir = "/var/lib/ferrite/data"
aof_enabled = true
aof_sync = "everysec"
checkpoint_enabled = true
checkpoint_interval = 300

# Multi-Tenancy Configuration
[tenancy]
enabled = true
isolation_mode = "prefix"         # Keys prefixed with tenant ID
default_key_prefix = "tenant:"    # tenant:acme:mykey

[tenancy.defaults]
max_memory = 1073741824            # 1GB default per-tenant memory limit
max_keys = 100000                 # Default per-tenant key limit
max_connections = 100             # Default per-tenant connection limit
ops_per_second = 10000            # Default rate limit

[tenancy.tiers]
# Define tenant tiers with different limits
[tenancy.tiers.free]
max_memory = 268435456             # 256MB
max_keys = 10000
max_connections = 10
ops_per_second = 1000
features = ["basic"]

[tenancy.tiers.starter]
max_memory = 1073741824            # 1GB
max_keys = 100000
max_connections = 50
ops_per_second = 10000
features = ["basic", "persistence"]

[tenancy.tiers.pro]
max_memory = 8589934592            # 8GB
max_keys = 1000000
max_connections = 500
ops_per_second = 100000
features = ["basic", "persistence", "vector", "semantic"]

[tenancy.tiers.enterprise]
max_memory = 1099511627776         # 1TB (effectively unlimited)
max_keys = 1000000000              # 1B keys
max_connections = 5000
ops_per_second = 1000000
features = ["all"]

# Billing and Metering
[tenancy.billing]
enabled = true
metrics_export_interval = 60      # Export billing metrics every minute
export_endpoint = "https://billing.example.com/ingest"

# Track these metrics per tenant
metrics = [
    "commands_total",
    "bytes_in",
    "bytes_out",
    "memory_used",
    "keys_count",
    "connections_peak"
]

# ACL Configuration for Tenants
[acl]
enabled = true
acl_file = "/etc/ferrite/tenants.acl"

[tls]
enabled = true
port = 6380
cert_file = "/etc/ferrite/tls/server.crt"
key_file = "/etc/ferrite/tls/server.key"

[metrics]
enabled = true
port = 9090
per_tenant_metrics = true         # Expose metrics per tenant

[logging]
level = "info"
format = "json"
per_tenant_logging = true         # Separate log streams per tenant
```

### Tenant ACL File Example

```
# /etc/ferrite/tenants.acl
# Each tenant gets their own user with access only to their keys

user default off

# Admin user for management
user admin on >admin_secret_password ~* &* +@all

# Tenant users - can only access their prefixed keys
user tenant_acme on >acme_password ~tenant:acme:* +@all -@admin -@dangerous
user tenant_globex on >globex_password ~tenant:globex:* +@all -@admin -@dangerous
user tenant_initech on >initech_password ~tenant:initech:* +@all -@admin -@dangerous
```

### Usage Example

```bash
# Create a tenant
TENANT CREATE acme TIER pro

# Switch to tenant context
TENANT USE acme

# Operations are automatically prefixed
SET mykey "value"           # Actually stores: tenant:acme:mykey
GET mykey                   # Reads from: tenant:acme:mykey

# Check tenant stats
TENANT STATS acme
# Returns: memory_used, keys_count, ops_per_second, etc.

# Migrate tenant to different tier
TENANT UPDATE acme TIER enterprise

# Export tenant data for migration
TENANT EXPORT acme --format rdb --output /backup/acme.rdb
```

---

## Edge Deployment

Minimal footprint for IoT, embedded systems, and edge computing.

```toml
# ferrite-edge.toml
# Optimized for edge deployment: minimal memory, local-first

[server]
bind = "127.0.0.1"        # Local only for security
port = 6379
max_connections = 100      # Limited connections
worker_threads = 2         # Minimal CPU usage

[storage]
databases = 1
max_memory = 268435456       # 256MB
eviction_policy = "allkeys-lru"

[persistence]
data_dir = "/var/lib/ferrite/data"
aof_enabled = true
aof_sync = "everysec"
checkpoint_enabled = true
checkpoint_interval = 1800  # 30 minutes

# Tiered storage for edge - use disk aggressively
[tiering]
enabled = true
hot_tier_size = "64MB"     # Keep only hot data in memory
warm_tier_size = "128MB"   # mmap for warm data
cold_tier_path = "/var/lib/ferrite/cold"

# Compression for storage efficiency
[compression]
enabled = true
algorithm = "lz4"          # Fast compression
min_size = 100             # Compress values > 100 bytes

# Sync configuration for edge-to-cloud
[sync]
enabled = true
mode = "eventual"          # Eventual consistency with cloud
cloud_endpoint = "https://ferrite-cloud.example.com"
sync_interval = 300        # Sync every 5 minutes
offline_queue_size = 10000 # Queue commands when offline

# CDC for edge events
[cdc]
enabled = true
buffer_size = 1000
local_persistence = true   # Persist CDC events locally

[metrics]
enabled = true
port = 9090
minimal_mode = true        # Reduced metric cardinality

[logging]
level = "warn"             # Minimal logging
format = "text"
file = "/var/log/ferrite/ferrite.log"
max_size = "10MB"
max_backups = 2
```

### Embedded Library Usage

For applications that embed Ferrite directly:

```rust
// Cargo.toml
// [dependencies]
// ferrite = { version = "0.1", default-features = false, features = ["embedded"] }

use ferrite::embedded::{Database, Config};

fn main() -> anyhow::Result<()> {
    // Configure for embedded use
    let config = Config::builder()
        .data_dir("./app_data")
        .max_memory("128MB")
        .persistence(true)
        .build()?;

    // Open database
    let db = Database::open_with_config(config)?;

    // Use directly - no network overhead
    db.set("device:sensor1:temp", "23.5")?;
    db.set("device:sensor1:humidity", "65")?;

    // Batch operations
    db.mset(&[
        ("config:interval", "60"),
        ("config:threshold", "30"),
    ])?;

    // Time-series for sensor data
    db.ts_add("ts:sensor1:temp", None, 23.5)?;

    // Local vector search for anomaly detection
    db.vector_add("anomalies", "reading:1", &embedding, None)?;

    // Sync to cloud when connected
    if network_available() {
        db.sync_to_cloud().await?;
    }

    Ok(())
}
```

---

## High-Throughput Caching

Maximum performance for caching workloads with minimal durability requirements.

```toml
# ferrite-cache.toml
# Optimized for high-throughput caching: maximum speed, relaxed durability

[server]
bind = "0.0.0.0"
port = 6379
max_connections = 100000
worker_threads = 0         # Auto-detect (use all cores)
tcp_nodelay = true         # Disable Nagle for lower latency
tcp_keepalive = 30

[storage]
databases = 1
max_memory = 34359738368  # 32GB
eviction_policy = "allkeys-lfu"  # LFU for cache workloads
lazyfree_lazy_eviction = true    # Async eviction

[persistence]
# Minimal persistence for cache
aof_enabled = false        # No AOF for maximum speed
checkpoint_enabled = true
checkpoint_interval = 3600 # Hourly snapshots only

# Keep everything in memory for cache
[tiering]
enabled = false            # No tiering - all in memory

# Connection pooling
[connection]
read_buffer_size = "64KB"
write_buffer_size = "64KB"
pipeline_max = 1000        # Support deep pipelines

# Memory optimization
[memory]
hash_max_listpack_entries = 512
hash_max_listpack_value = 64
list_max_listpack_size = -2
set_max_intset_entries = 512
zset_max_listpack_entries = 128
zset_max_listpack_value = 64

# Disable features not needed for caching
[features]
lua_scripting = false
cluster_mode = false
pubsub = false

[metrics]
enabled = true
port = 9090

[logging]
level = "warn"
format = "json"
```

---

## Event-Driven Architecture

Optimized for CDC, triggers, streaming, and real-time event processing.

```toml
# ferrite-events.toml
# Optimized for event-driven architecture: CDC, triggers, streaming

[server]
bind = "0.0.0.0"
port = 6379
max_connections = 20000
worker_threads = 8

[storage]
databases = 16
max_memory = 17179869184  # 16GB
eviction_policy = "volatile-lru"

[persistence]
data_dir = "/var/lib/ferrite/data"
aof_enabled = true
aof_sync = "always"        # Strong durability for events
checkpoint_enabled = true
checkpoint_interval = 300

# Change Data Capture Configuration
[cdc]
enabled = true
buffer_size = 100000       # Large buffer for burst handling
persistence_enabled = true # Persist CDC log for replay
retention_hours = 168      # Keep 7 days of CDC history

[cdc.formats]
default = "json"
available = ["json", "avro", "protobuf", "resp3"]

# CDC Sinks
[[cdc.sinks]]
name = "kafka-main"
type = "kafka"
brokers = ["kafka1:9092", "kafka2:9092", "kafka3:9092"]
topic_prefix = "ferrite-cdc"
batch_size = 1000
linger_ms = 10

[[cdc.sinks]]
name = "webhook"
type = "http"
endpoint = "https://api.example.com/events"
batch_size = 100
retry_attempts = 3
retry_delay_ms = 1000

# Programmable Triggers
[triggers]
enabled = true
max_triggers = 1000
execution_timeout_ms = 5000
max_concurrent = 100

# WASM runtime for custom trigger logic
[wasm]
enabled = true
module_dir = "/var/lib/ferrite/wasm"
memory_limit = "64MB"
fuel_limit = 1000000       # CPU instruction limit

# Stream Processing
[streaming]
enabled = true
checkpoint_interval = 10000  # Checkpoint every 10K events
state_backend = "rocksdb"
state_dir = "/var/lib/ferrite/streaming-state"

[streaming.windowing]
allowed_lateness_ms = 60000  # 1 minute late event tolerance
watermark_interval_ms = 1000

# Pub/Sub for real-time events
[pubsub]
enabled = true
max_channels = 100000
max_subscribers_per_channel = 10000
message_buffer_size = 1000

[metrics]
enabled = true
port = 9090
include_cdc_metrics = true
include_trigger_metrics = true
include_streaming_metrics = true

[logging]
level = "info"
format = "json"
include_event_logs = true
```

### Trigger Examples

```bash
# Create a trigger for order processing
TRIGGER.CREATE process_order ON SET orders:* DO
  -- Extract order data
  LOCAL order = JSON.DECODE($VALUE)

  -- Update inventory
  HINCRBY inventory:${order.product_id} quantity -${order.quantity}

  -- Publish event
  PUBLISH order_events $VALUE

  -- Send webhook
  HTTP.POST "https://api.example.com/orders" $VALUE
END

# Create a WASM-based validation trigger
WASM.LOAD validate_order /var/lib/ferrite/wasm/validate_order.wasm
TRIGGER.CREATE validate ON SET orders:* WASM validate_order BEFORE

# Create a CDC subscription
CDC.SUBSCRIBE users:* --format json --sink kafka-main --filter '$.active = true'
```

---

## Time-Series Analytics

Optimized for time-series data ingestion and analysis.

```toml
# ferrite-timeseries.toml
# Optimized for time-series workloads: metrics, IoT, monitoring

[server]
bind = "0.0.0.0"
port = 6379
max_connections = 10000
worker_threads = 8

[storage]
databases = 1
max_memory = 34359738368  # 32GB
eviction_policy = "volatile-ttl"  # Evict oldest data first

[persistence]
data_dir = "/var/lib/ferrite/data"
aof_enabled = true
aof_sync = "everysec"
checkpoint_enabled = true
checkpoint_interval = 600

# Time-Series Configuration
[timeseries]
enabled = true
default_retention = "30d"         # Default 30-day retention
default_chunk_size = "4KB"        # Compress in 4KB chunks

[timeseries.compression]
enabled = true
algorithm = "gorilla"             # Gorilla compression for timestamps
double_delta = true               # Double-delta for values

[timeseries.downsampling]
enabled = true
rules = [
    # Keep raw data for 7 days
    { retention = "7d", aggregation = "none" },
    # Downsample to 1-minute for 30 days
    { retention = "30d", aggregation = "avg", bucket = "1m" },
    # Downsample to 1-hour for 1 year
    { retention = "365d", aggregation = "avg", bucket = "1h" },
]

# Automatic compaction
[timeseries.compaction]
enabled = true
schedule = "0 2 * * *"            # Run at 2 AM daily
threshold_mb = 100                # Compact chunks > 100MB

# Query optimization
[timeseries.query]
max_datapoints = 10000            # Limit points per query
auto_downsample = true            # Auto-downsample large ranges
parallel_queries = 4              # Parallel query execution

# Time-travel for debugging
[temporal]
enabled = true
history_retention = "7d"

[metrics]
enabled = true
port = 9090
include_timeseries_metrics = true

[logging]
level = "info"
format = "json"
```

### Usage Example

```bash
# Create a time-series key
TS.CREATE sensor:temp:1 RETENTION 2592000000 LABELS device_id 1 location warehouse

# Add data points
TS.ADD sensor:temp:1 * 23.5
TS.ADD sensor:temp:1 * 23.7
TS.MADD sensor:temp:1 * 23.6 sensor:humidity:1 * 65

# Query with aggregation
TS.RANGE sensor:temp:1 - + AGGREGATION avg 60000  # 1-minute averages

# Query multiple series
TS.MRANGE - + FILTER device_id=1 AGGREGATION max 3600000  # Hourly max

# Create downsampling rule
TS.CREATERULE sensor:temp:1 sensor:temp:1:hourly AGGREGATION avg 3600000
```

---

## Geo-Distributed Deployment

Multi-region deployment with CRDT-based replication.

```toml
# ferrite-geo.toml
# Optimized for geo-distributed deployment: CRDTs, eventual consistency

[server]
bind = "0.0.0.0"
port = 6379
max_connections = 10000
worker_threads = 8

[storage]
databases = 1
max_memory = 17179869184  # 16GB
eviction_policy = "volatile-lru"

[persistence]
data_dir = "/var/lib/ferrite/data"
aof_enabled = true
aof_sync = "everysec"
checkpoint_enabled = true

# CRDT Configuration
[crdt]
enabled = true
node_id = "${FERRITE_NODE_ID}"    # Unique node identifier
datacenter = "${FERRITE_DC}"       # us-east, eu-west, ap-south

# Hybrid Logical Clock for ordering
[crdt.clock]
type = "hlc"
max_drift_ms = 1000               # Max clock drift tolerance

# Default CRDT types for different key patterns
[crdt.type_mappings]
"counter:*" = "pn-counter"        # Counters use PN-Counter
"set:*" = "or-set"                # Sets use OR-Set
"user:*" = "lww-register"         # User data uses LWW
"cart:*" = "or-map"               # Shopping carts use OR-Map

# Geo-Replication
[replication]
mode = "multi-master"             # All nodes accept writes

[[replication.peers]]
name = "us-east-1"
endpoint = "ferrite-us-east.example.com:6379"
datacenter = "us-east"

[[replication.peers]]
name = "eu-west-1"
endpoint = "ferrite-eu-west.example.com:6379"
datacenter = "eu-west"

[[replication.peers]]
name = "ap-south-1"
endpoint = "ferrite-ap-south.example.com:6379"
datacenter = "ap-south"

[replication.sync]
mode = "async"                    # Async for geo-distribution
batch_size = 1000
sync_interval_ms = 100
compression = true

# Conflict resolution
[replication.conflicts]
strategy = "crdt"                 # Use CRDT semantics
fallback = "last-write-wins"      # For non-CRDT keys
log_conflicts = true

# Read/Write routing
[routing]
read_preference = "local"         # Read from local datacenter
write_concern = "local"           # Write locally, replicate async

# Cross-datacenter latency configuration
[latency]
us-east_to_eu-west = 80           # Approximate RTT in ms
us-east_to_ap-south = 200
eu-west_to_ap-south = 150

[tls]
enabled = true
cert_file = "/etc/ferrite/tls/server.crt"
key_file = "/etc/ferrite/tls/server.key"
ca_file = "/etc/ferrite/tls/ca.crt"

[metrics]
enabled = true
port = 9090
include_replication_metrics = true
include_crdt_metrics = true
per_datacenter_metrics = true

[logging]
level = "info"
format = "json"
include_replication_logs = true
```

### Usage Example

```bash
# Use CRDT counter (automatically replicated and merged)
CRDT.GCOUNTER page_views INCR 1

# Use CRDT set (add/remove operations merge correctly)
CRDT.ORSET user:123:tags ADD "premium"
CRDT.ORSET user:123:tags ADD "verified"
CRDT.ORSET user:123:tags REM "trial"

# Use LWW register for user profile (last write wins across regions)
CRDT.LWWREGISTER user:123:profile SET '{"name": "Alice", "email": "alice@example.com"}'

# Check replication status
REPLICATION STATUS
# Returns: peers, lag_ms, conflicts_resolved, etc.

# Force sync with specific peer
REPLICATION SYNC eu-west-1

# View conflict log
REPLICATION CONFLICTS --last 100
```

---

## Configuration Best Practices

### Memory Planning

```
Total Memory = Hot Tier + Warm Tier + Overhead

Overhead includes:
- Connection buffers: ~1KB per connection
- Index structures: ~10-20% of data size
- Replication buffers: backlog_size * num_replicas
- WASM runtime: fuel_limit dependent
```

### Security Checklist

- [ ] Enable TLS for all production deployments
- [ ] Use ACLs to restrict access
- [ ] Bind to specific interfaces, not 0.0.0.0
- [ ] Use strong passwords (min 16 characters)
- [ ] Rotate TLS certificates regularly
- [ ] Enable audit logging for compliance
- [ ] Restrict WASM capabilities

### Monitoring Recommendations

Essential metrics to monitor:
- `ferrite_memory_used_bytes` / `ferrite_memory_max_bytes`
- `ferrite_commands_duration_seconds` (P99)
- `ferrite_connections_current`
- `ferrite_replication_lag_seconds`
- `ferrite_evicted_keys_total`
- `ferrite_rejected_connections_total`

### Testing Configuration Changes

```bash
# Validate configuration syntax
ferrite --config ferrite.toml --test-config

# Start in dry-run mode
ferrite --config ferrite.toml --dry-run

# Test with reduced memory to validate eviction
ferrite --config ferrite.toml --max-memory 100MB
```
