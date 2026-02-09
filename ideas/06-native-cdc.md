# Native Change Data Capture (CDC)

## Executive Summary

First-class event streaming for data changes, enabling real-time integrations, event-driven architectures, and data synchronization without custom application logic.

**Status**: Proposal
**Priority**: High
**Estimated Effort**: 6-8 weeks
**Target Release**: v0.4.0

---

## Problem Statement

### The Event-Driven World

Modern architectures are event-driven:
- Microservices communicate via events
- Analytics pipelines consume change streams
- Search indexes sync from primary data stores
- Audit systems track all data modifications

### Current Redis Limitations

**Pub/Sub:**
- Fire-and-forget (no persistence)
- No replay capability
- No guaranteed delivery

**Streams:**
- Better, but requires application to dual-write
- No automatic capture of SET/HSET/etc. changes
- Complex consumer group management

**Keyspace Notifications:**
- Only key names, not values
- Fire-and-forget
- Significant performance impact

### What Users Want

```
Application writes: SET user:123:email "new@example.com"

CDC automatically emits:
{
  "op": "SET",
  "key": "user:123:email",
  "value": "new@example.com",
  "old_value": "old@example.com",  // Optional
  "timestamp": 1702900000000,
  "db": 0
}

→ Elasticsearch indexes it
→ Analytics pipeline processes it
→ Audit system logs it
→ Downstream service reacts to it
```

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CDC Engine                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Change Capture Layer                       │ │
│  │  Intercepts all write operations                            │ │
│  │  Captures: key, old_value (optional), new_value, op, ts    │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Change Log (WAL)                         │ │
│  │  Persistent, ordered stream of changes                      │ │
│  │  Supports replay from any position                          │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Subscription Manager                       │ │
│  │  Pattern-based subscriptions                                │ │
│  │  Consumer groups with offset tracking                       │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     Sink Connectors                         │ │
│  │  Kafka, Kinesis, Pub/Sub, HTTP webhooks                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Core Data Structures

#### Change Event

```rust
/// A single change event
#[derive(Clone, Serialize, Deserialize)]
pub struct ChangeEvent {
    /// Unique event ID (monotonically increasing)
    pub id: u64,
    /// Event timestamp
    pub timestamp: SystemTime,
    /// Database number
    pub db: u8,
    /// Operation type
    pub operation: Operation,
    /// Affected key
    pub key: Bytes,
    /// New value (for SET-like operations)
    pub value: Option<Bytes>,
    /// Old value (if capture_old_value enabled)
    pub old_value: Option<Bytes>,
    /// Additional metadata
    pub metadata: ChangeMetadata,
}

#[derive(Clone, Serialize, Deserialize)]
pub enum Operation {
    // String operations
    Set,
    SetEx { ttl_ms: u64 },
    Append,
    Incr { delta: i64 },
    IncrByFloat { delta: f64 },

    // Key operations
    Del,
    Expire { ttl_ms: u64 },
    Rename { new_key: Bytes },

    // Hash operations
    HSet { field: Bytes },
    HDel { field: Bytes },
    HIncrBy { field: Bytes, delta: i64 },

    // List operations
    LPush { values: Vec<Bytes> },
    RPush { values: Vec<Bytes> },
    LPop,
    RPop,
    LSet { index: i64 },
    LTrim { start: i64, stop: i64 },

    // Set operations
    SAdd { members: Vec<Bytes> },
    SRem { members: Vec<Bytes> },

    // Sorted set operations
    ZAdd { scores: Vec<(f64, Bytes)> },
    ZRem { members: Vec<Bytes> },
    ZIncrBy { member: Bytes, delta: f64 },

    // Stream operations
    XAdd { id: Bytes, fields: Vec<(Bytes, Bytes)> },
    XDel { ids: Vec<Bytes> },
    XTrim { strategy: String, threshold: i64 },

    // Other
    FlushDb,
    FlushAll,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ChangeMetadata {
    /// Client that made the change (if available)
    pub client_id: Option<String>,
    /// Client IP address
    pub client_addr: Option<String>,
    /// Original command
    pub command: String,
    /// Transaction ID (if in MULTI/EXEC)
    pub transaction_id: Option<u64>,
    /// Replication source (if replicated)
    pub source: ChangeSource,
}

#[derive(Clone, Serialize, Deserialize)]
pub enum ChangeSource {
    /// Local client operation
    Local,
    /// Replicated from primary
    Replication { source_id: String },
    /// Restored from backup
    Restore,
    /// Internal operation (expiry, eviction)
    Internal,
}
```

#### Change Log

```rust
/// Persistent change log
pub struct ChangeLog {
    /// Current segment file
    current_segment: RwLock<Segment>,
    /// Historical segments (read-only)
    segments: Vec<Segment>,
    /// Index: event_id -> (segment, offset)
    index: BTreeMap<u64, (SegmentId, u64)>,
    /// Next event ID
    next_id: AtomicU64,
    /// Configuration
    config: ChangeLogConfig,
}

pub struct Segment {
    id: SegmentId,
    file: File,
    start_id: u64,
    end_id: u64,
    size: u64,
}

#[derive(Clone)]
pub struct ChangeLogConfig {
    /// Maximum segment size before rotation
    max_segment_size: u64,
    /// Maximum age of segments to retain
    retention_time: Duration,
    /// Maximum total size of all segments
    max_total_size: u64,
    /// Compression codec
    compression: Compression,
    /// Sync mode
    sync_mode: SyncMode,
}

impl ChangeLog {
    /// Append a change event
    pub async fn append(&self, event: ChangeEvent) -> Result<u64> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let mut event = event;
        event.id = id;

        let mut segment = self.current_segment.write().await;
        let offset = segment.append(&event).await?;

        self.index.insert(id, (segment.id, offset));

        // Rotate if needed
        if segment.size >= self.config.max_segment_size {
            self.rotate_segment().await?;
        }

        Ok(id)
    }

    /// Read events from a position
    pub async fn read_from(&self, from_id: u64, limit: usize) -> Result<Vec<ChangeEvent>> {
        let mut events = Vec::with_capacity(limit);
        let mut current_id = from_id;

        while events.len() < limit {
            if let Some(&(segment_id, offset)) = self.index.get(&current_id) {
                let segment = self.get_segment(segment_id)?;
                let event = segment.read_at(offset).await?;
                events.push(event);
                current_id += 1;
            } else {
                break;
            }
        }

        Ok(events)
    }
}
```

#### Subscription

```rust
/// CDC subscription
pub struct Subscription {
    /// Subscription ID
    pub id: SubscriptionId,
    /// Name (for consumer groups)
    pub name: String,
    /// Key patterns to subscribe to
    pub patterns: Vec<GlobPattern>,
    /// Operations to capture
    pub operations: HashSet<OperationType>,
    /// Databases to monitor
    pub databases: HashSet<u8>,
    /// Current position in change log
    pub position: AtomicU64,
    /// Output format
    pub format: OutputFormat,
    /// Delivery mode
    pub delivery: DeliveryMode,
}

#[derive(Clone)]
pub enum OutputFormat {
    /// JSON format
    Json,
    /// Avro with schema registry
    Avro { schema_registry_url: String },
    /// Protocol Buffers
    Protobuf,
    /// RESP3 format (for Redis clients)
    Resp3,
}

#[derive(Clone)]
pub enum DeliveryMode {
    /// Push to connected client
    Push,
    /// Client polls for changes
    Poll,
    /// Forward to external sink
    Sink(SinkConfig),
}

#[derive(Clone)]
pub enum SinkConfig {
    Kafka {
        brokers: Vec<String>,
        topic: String,
        config: HashMap<String, String>,
    },
    Kinesis {
        stream_name: String,
        region: String,
    },
    PubSub {
        project: String,
        topic: String,
    },
    Http {
        url: String,
        headers: HashMap<String, String>,
        batch_size: usize,
        retry_config: RetryConfig,
    },
    S3 {
        bucket: String,
        prefix: String,
        format: FileFormat,
        partition_by: PartitionStrategy,
    },
}
```

### Change Capture Integration

```rust
/// Trait for intercepting changes
pub trait ChangeCapture: Send + Sync {
    /// Called before a write operation
    fn before_write(&self, key: &Bytes, db: u8) -> Option<Bytes>;

    /// Called after a write operation
    fn after_write(&self, event: ChangeEvent);
}

/// Default implementation that writes to change log
pub struct DefaultChangeCapture {
    log: Arc<ChangeLog>,
    subscriptions: Arc<SubscriptionManager>,
    config: CdcConfig,
}

impl ChangeCapture for DefaultChangeCapture {
    fn before_write(&self, key: &Bytes, db: u8) -> Option<Bytes> {
        if self.config.capture_old_value {
            // Read current value before write
            self.store.get(db, key)
        } else {
            None
        }
    }

    fn after_write(&self, mut event: ChangeEvent) {
        // Check if any subscription matches this event
        if !self.subscriptions.matches(&event) {
            return;
        }

        // Append to log
        let id = self.log.append(event.clone()).await;

        // Notify subscribers
        self.subscriptions.notify(event).await;
    }
}

// Integration point in Store
impl Store {
    pub fn set(&self, db: u8, key: Bytes, value: Bytes) {
        let old_value = self.cdc.before_write(&key, db);

        // Actual write
        self.database(db).set(key.clone(), Value::String(value.clone()));

        // Capture change
        self.cdc.after_write(ChangeEvent {
            operation: Operation::Set,
            key,
            value: Some(value),
            old_value,
            ..Default::default()
        });
    }
}
```

---

## API Design

### Subscription Management

```redis
# Create a subscription
CDC.SUBSCRIBE <name>
    [PATTERN <pattern> ...]
    [OPERATIONS <op> ...]
    [DB <db> ...]
    [FORMAT json|avro|protobuf|resp3]
    [FROM <position>|LATEST|EARLIEST]
    [WITH_OLD_VALUES]

# Examples
CDC.SUBSCRIBE all_changes PATTERN "*"
CDC.SUBSCRIBE user_changes PATTERN "user:*" OPERATIONS SET DEL EXPIRE
CDC.SUBSCRIBE orders PATTERN "order:*" DB 0 1 WITH_OLD_VALUES
CDC.SUBSCRIBE from_beginning PATTERN "*" FROM EARLIEST

# List subscriptions
CDC.SUBSCRIPTIONS

# Get subscription info
CDC.INFO <name>

# Delete subscription
CDC.UNSUBSCRIBE <name>

# Pause/resume subscription
CDC.PAUSE <name>
CDC.RESUME <name>
```

### Reading Changes

```redis
# Read changes (polling mode)
CDC.READ <name> [COUNT <count>] [BLOCK <ms>]
# Returns array of change events

# Example response:
# 1) 1) "id" 2) "12345"
#    3) "timestamp" 4) "1702900000000"
#    5) "op" 6) "SET"
#    7) "key" 8) "user:123:email"
#    9) "value" 10) "new@example.com"
#    11) "old_value" 12) "old@example.com"

# Acknowledge processed events (for consumer groups)
CDC.ACK <name> <id> [<id> ...]

# Get current position
CDC.POSITION <name>

# Seek to position
CDC.SEEK <name> <position>|LATEST|EARLIEST
```

### Push Mode (for connected clients)

```redis
# Enable push mode for current connection
CDC.PUSH <name>

# Changes are pushed as they occur:
# *CDC*
# ["change", {...event...}]

# Disable push mode
CDC.PUSH STOP
```

### Sink Configuration

```redis
# Create a sink connector
CDC.SINK CREATE <name> <type> <config_json>

# Examples
CDC.SINK CREATE to_kafka kafka '{
    "brokers": ["localhost:9092"],
    "topic": "ferrite-changes",
    "key": "$.key",
    "partition_by": "key"
}'

CDC.SINK CREATE to_kinesis kinesis '{
    "stream_name": "ferrite-cdc",
    "region": "us-east-1",
    "partition_key": "$.db"
}'

CDC.SINK CREATE to_s3 s3 '{
    "bucket": "my-data-lake",
    "prefix": "ferrite/changes/",
    "format": "parquet",
    "partition_by": "hour"
}'

CDC.SINK CREATE to_webhook http '{
    "url": "https://api.example.com/webhook",
    "headers": {"Authorization": "Bearer xxx"},
    "batch_size": 100,
    "retry": {"max_attempts": 3, "backoff_ms": 1000}
}'

# Connect subscription to sink
CDC.SINK ATTACH <subscription_name> <sink_name>

# Detach subscription from sink
CDC.SINK DETACH <subscription_name> <sink_name>

# List sinks
CDC.SINKS

# Get sink status
CDC.SINK STATUS <name>

# Delete sink
CDC.SINK DELETE <name>
```

### Change Log Management

```redis
# Get change log info
CDC.LOG INFO
# Returns: segments, size, retention, oldest/newest event

# Get range of events by ID
CDC.LOG RANGE <from_id> <to_id> [COUNT <count>]

# Get events by time range
CDC.LOG TIMERANGE <from_ts> <to_ts> [COUNT <count>]

# Trigger log compaction
CDC.LOG COMPACT

# Get log statistics
CDC.LOG STATS
```

---

## Output Formats

### JSON Format

```json
{
  "id": 12345,
  "timestamp": "2024-12-19T10:00:00.000Z",
  "timestamp_ms": 1702900000000,
  "db": 0,
  "operation": "SET",
  "key": "user:123:email",
  "value": "new@example.com",
  "old_value": "old@example.com",
  "metadata": {
    "client_addr": "192.168.1.100:52341",
    "command": "SET user:123:email new@example.com"
  }
}
```

### Avro Schema

```json
{
  "type": "record",
  "name": "ChangeEvent",
  "namespace": "io.ferrite.cdc",
  "fields": [
    {"name": "id", "type": "long"},
    {"name": "timestamp_ms", "type": "long"},
    {"name": "db", "type": "int"},
    {"name": "operation", "type": "string"},
    {"name": "key", "type": "bytes"},
    {"name": "value", "type": ["null", "bytes"]},
    {"name": "old_value", "type": ["null", "bytes"]},
    {"name": "metadata", "type": {
      "type": "record",
      "name": "Metadata",
      "fields": [
        {"name": "client_addr", "type": ["null", "string"]},
        {"name": "command", "type": "string"}
      ]
    }}
  ]
}
```

---

## Implementation Plan

### Phase 1: Change Capture (2 weeks)

#### Week 1: Event Generation

- [ ] Define `ChangeEvent` and `Operation` types
- [ ] Implement change capture hooks in Store
- [ ] Add before/after write interception
- [ ] Basic event serialization

#### Week 2: Change Log

- [ ] Implement `ChangeLog` with segmented files
- [ ] Add segment rotation and cleanup
- [ ] Implement read-from-position
- [ ] Add retention policies

### Phase 2: Subscriptions (2 weeks)

#### Week 3: Subscription Manager

- [ ] Implement `Subscription` and `SubscriptionManager`
- [ ] Add pattern matching for events
- [ ] Add operation filtering
- [ ] Consumer group offset tracking

#### Week 4: Client Integration

- [ ] Implement `CDC.SUBSCRIBE`, `CDC.READ` commands
- [ ] Add push mode for real-time streaming
- [ ] Implement acknowledgment and seeking
- [ ] Integration tests

### Phase 3: Sink Connectors (3 weeks)

#### Week 5: Kafka Connector

- [ ] Implement Kafka sink using rdkafka
- [ ] Add exactly-once semantics (transactions)
- [ ] Partitioning strategies
- [ ] Error handling and retries

#### Week 6: Other Connectors

- [ ] HTTP webhook connector
- [ ] AWS Kinesis connector
- [ ] Google Pub/Sub connector
- [ ] Basic S3/parquet sink

#### Week 7: Connector Management

- [ ] Implement sink CRUD commands
- [ ] Add monitoring and status
- [ ] Implement backpressure handling
- [ ] Dead letter queue

### Phase 4: Production Hardening (2 weeks)

#### Week 8: Performance & Reliability

- [ ] Benchmark throughput
- [ ] Add compression
- [ ] Implement checkpointing
- [ ] Handle edge cases (restart, failover)

#### Week 9: Documentation & Polish

- [ ] Documentation and examples
- [ ] Prometheus metrics
- [ ] TUI integration
- [ ] Security review

---

## Configuration

### ferrite.toml

```toml
[cdc]
# Enable CDC
enabled = true

# Capture old values (before write)
capture_old_values = false

# Change log settings
[cdc.log]
# Directory for change log segments
directory = "./data/cdc"
# Maximum segment size
max_segment_size = "128MB"
# Segment retention
retention = "7d"
# Total size limit
max_total_size = "10GB"
# Compression
compression = "lz4"  # or "none", "zstd"
# Sync mode
sync = "async"  # or "sync", "fsync"

# Default subscription settings
[cdc.defaults]
format = "json"
batch_size = 100
max_batch_delay_ms = 100

# Kafka connector defaults
[cdc.kafka]
default_brokers = ["localhost:9092"]
producer_config = { "acks" = "all" }

# HTTP connector defaults
[cdc.http]
timeout_ms = 5000
retry_max_attempts = 3
retry_backoff_ms = 1000
```

---

## Performance Considerations

### Throughput Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Event capture | < 10μs overhead | Per write operation |
| Log append | > 100K events/sec | Sequential writes |
| Fan-out | > 50K events/sec | Per subscription |
| Kafka sink | > 50K events/sec | Batched |

### Optimization Strategies

1. **Async Capture**
   - Don't block writes on CDC
   - Buffer events, batch persist

2. **Zero-Copy Where Possible**
   - Reuse value bytes from write
   - Memory-mapped log segments

3. **Efficient Serialization**
   - Pre-compute serialized format
   - Use binary formats for high volume

4. **Batching**
   - Batch events to sinks
   - Amortize network overhead

---

## Testing Strategy

### Unit Tests

```rust
#[test]
fn test_change_capture_set() {
    let (store, cdc) = setup_with_cdc();
    store.set(0, "key", "value");

    let events = cdc.read_from(0, 10);
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].operation, Operation::Set);
    assert_eq!(events[0].key, "key");
    assert_eq!(events[0].value, Some("value"));
}

#[test]
fn test_subscription_pattern_match() {
    // Test that patterns correctly filter events
}

#[test]
fn test_change_log_replay() {
    // Test reading from beginning
}
```

### Integration Tests

- [ ] End-to-end with Kafka
- [ ] Consumer group coordination
- [ ] Restart and replay
- [ ] High-volume stress test

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Write path overhead | High | Medium | Async capture, benchmarking |
| Log storage growth | Medium | High | Retention, compaction |
| Sink failures | Medium | Medium | DLQ, retry logic |
| Ordering guarantees | High | Low | Per-key ordering, sequence numbers |

---

## Success Metrics

### Technical Metrics

- < 5% overhead on write path
- 99.9% delivery success rate
- < 1s end-to-end latency (to sink)

### Business Metrics

- 30% of users enable CDC
- 3+ sink connector integrations used
- Featured in event-driven architecture blogs

---

## Future Enhancements

1. **Schema Evolution** - Handle value schema changes
2. **Exactly-Once Delivery** - Transactional sinks
3. **CDC from Replicas** - Reduce primary load
4. **Filtering/Transform** - In-stream data transformation
5. **Debezium Compatibility** - Standard CDC format

---

## References

- [Debezium](https://debezium.io/)
- [Kafka Connect](https://kafka.apache.org/documentation/#connect)
- [AWS DMS](https://aws.amazon.com/dms/)
- [Change Data Capture Patterns](https://martinfowler.com/articles/patterns-of-distributed-systems/change-data-capture.html)
- [Redis Keyspace Notifications](https://redis.io/docs/manual/keyspace-notifications/)
