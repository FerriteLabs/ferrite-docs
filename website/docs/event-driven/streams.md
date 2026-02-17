---
sidebar_position: 3
maturity: beta
---

# Streams

Process real-time data with Redis Streams and Ferrite's stream processing engine.

## Overview

Ferrite implements Redis Streams with an additional stream processing engine for complex event processing, windowing, and stateful operations.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Producers  │────▶│   Stream    │────▶│  Consumers  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Processor  │
                    │  Pipeline   │
                    └─────────────┘
```

## Redis Streams Commands

### Adding Entries

```bash
# Add entry with auto-generated ID
XADD mystream * field1 value1 field2 value2
# Returns: "1234567890123-0"

# Add with specific ID
XADD mystream 1234567890123-0 field1 value1

# Add with max length limit
XADD mystream MAXLEN ~ 1000 * field1 value1

# Add with minimum ID
XADD mystream MINID ~ 1234567890000-0 * field1 value1
```

### Reading Entries

```bash
# Read from beginning
XRANGE mystream - +

# Read with count limit
XRANGE mystream - + COUNT 10

# Read specific range
XRANGE mystream 1234567890000-0 1234567899999-0

# Reverse order
XREVRANGE mystream + - COUNT 10

# Read from multiple streams
XREAD STREAMS mystream otherstream 0-0 0-0

# Blocking read
XREAD BLOCK 5000 STREAMS mystream $
```

### Stream Information

```bash
# Get stream length
XLEN mystream

# Get stream info
XINFO STREAM mystream

# Get consumer groups info
XINFO GROUPS mystream

# Get consumers info
XINFO CONSUMERS mystream mygroup
```

### Consumer Groups

```bash
# Create consumer group
XGROUP CREATE mystream mygroup 0 MKSTREAM

# Create from latest
XGROUP CREATE mystream mygroup $ MKSTREAM

# Read as consumer group
XREADGROUP GROUP mygroup consumer1 STREAMS mystream >

# Blocking read
XREADGROUP GROUP mygroup consumer1 BLOCK 5000 STREAMS mystream >

# Acknowledge processed
XACK mystream mygroup 1234567890123-0

# Get pending entries
XPENDING mystream mygroup

# Claim pending entries
XCLAIM mystream mygroup consumer2 3600000 1234567890123-0
```

### Trimming

```bash
# Trim to max length
XTRIM mystream MAXLEN 1000

# Approximate trim (faster)
XTRIM mystream MAXLEN ~ 1000

# Trim by minimum ID
XTRIM mystream MINID ~ 1234567890000-0

# Delete specific entries
XDEL mystream 1234567890123-0
```

## Stream Processing Engine

### Pipeline Builder

```rust
use ferrite::streaming::{Pipeline, PipelineBuilder, StreamConfig};

let pipeline = PipelineBuilder::new("click-analytics", config)
    .source(RedisSource::new("clicks"))
    .operator(FilterOperator::new(|e| e.get_str("type") == Some("click")))
    .operator(MapOperator::new(|e| transform(e)))
    .operator(WindowOperator::tumbling(Duration::from_secs(60)))
    .operator(AggregateOperator::count("page_views"))
    .sink(RedisSink::new("page_view_counts"))
    .build();

pipeline.start().await?;
```

### Configuration

```toml
[streaming]
enabled = true
application_id = "my-app"
num_threads = 4
commit_interval_ms = 1000
state_dir = "/var/lib/ferrite/state"
processing_guarantee = "exactly_once"  # or "at_least_once", "at_most_once"

[streaming.buffering]
max_buffer_size = 10000
buffer_timeout_ms = 100
enable_batching = true
batch_size = 100
```

### Stream Events

```rust
pub struct StreamEvent {
    pub key: Option<String>,
    pub value: serde_json::Value,
    pub timestamp: u64,
    pub headers: HashMap<String, String>,
    pub partition: Option<u32>,
    pub offset: Option<u64>,
}

// Create event
let event = StreamEvent::new(
    Some("user:123".to_string()),
    json!({"action": "click", "page": "/home"})
)
.with_timestamp(1705312800000)
.with_header("source", "web");
```

### Operators

#### Filter

```rust
// Keep only matching events
let filter = FilterOperator::new(|event| {
    event.get_str("type") == Some("purchase")
});
```

#### Map

```rust
// Transform events 1:1
let map = MapOperator::new(|mut event| {
    let amount = event.get_i64("amount").unwrap_or(0);
    event.value["amount_cents"] = (amount * 100).into();
    event
});
```

#### FlatMap

```rust
// Transform events 1:N
let flat_map = FlatMapOperator::new(|event| {
    // Can return 0, 1, or many events
    let items = event.value["items"].as_array().unwrap_or(&vec![]);
    items.iter().map(|item| {
        StreamEvent::new(None, item.clone())
    }).collect()
});
```

#### Aggregate

```rust
// Aggregate by key
let aggregate = AggregateOperator::new(
    |event| event.key.clone().unwrap_or_default(),  // Key extractor
    |acc, event| {
        // Aggregation logic
        let count = acc.as_i64().unwrap_or(0);
        (count + 1).into()
    },
    json!(0)  // Initial value
);
```

### Windowing

#### Tumbling Windows

Fixed, non-overlapping time windows:

```rust
let window = TumblingWindowAssigner::new(Duration::from_secs(60));

// Events are assigned to windows:
// [00:00-01:00) [01:00-02:00) [02:00-03:00) ...
```

#### Sliding Windows

Overlapping time windows:

```rust
let window = SlidingWindowAssigner::new(
    Duration::from_secs(300),  // 5 minute window
    Duration::from_secs(60),   // Slide every 1 minute
);

// Events can be in multiple windows:
// [00:00-05:00) [01:00-06:00) [02:00-07:00) ...
```

#### Session Windows

Gap-based windows:

```rust
let window = SessionWindowAssigner::new(Duration::from_secs(1800));  // 30 min gap

// Window closes after 30 minutes of inactivity
```

#### Count Windows

Fixed number of events:

```rust
let window = CountWindowAssigner::new(100);  // Every 100 events
```

### State Management

```rust
let pipeline = PipelineBuilder::new("stateful", config)
    .source(source)
    .state_store("user_sessions")
    .operator(StatefulOperator::new(|event, state| {
        // Access state store
        let session = state.get(&event.key)?;
        // Update state
        state.put(&event.key, new_session)?;
        Ok(vec![event])
    }))
    .build();
```

### Sources

```rust
// Redis Stream source
let source = RedisSource::new("mystream")
    .with_group("mygroup")
    .with_consumer("consumer1")
    .with_batch_size(100);

// Memory source (for testing)
let source = MemorySource::new(vec![event1, event2, event3]);
```

### Sinks

```rust
// Redis Stream sink
let sink = RedisSink::new("output_stream");

// Redis Hash sink (keyed)
let sink = RedisHashSink::new("results");

// Memory sink (for testing)
let sink = MemorySink::new();
```

## Rust API

```rust
use ferrite::streaming::{StreamEngine, StreamConfig, Pipeline};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create stream engine
    let config = StreamConfig {
        application_id: "my-app".to_string(),
        processing_guarantee: ProcessingGuarantee::ExactlyOnce,
        ..Default::default()
    };
    let engine = StreamEngine::new(config);

    // Build pipeline
    let pipeline = engine.builder("click-counter")
        .source(RedisSource::new("clicks"))
        .operator(FilterOperator::new(|e| e.get_str("type") == Some("click")))
        .operator(WindowOperator::tumbling(Duration::from_secs(60)))
        .operator(AggregateOperator::count("clicks"))
        .sink(RedisSink::new("click_counts"))
        .build();

    // Register and start
    engine.register_pipeline(pipeline).await?;
    engine.start().await?;

    // Monitor metrics
    loop {
        let metrics = engine.metrics().await;
        println!("Processed: {} events, Lag: {}",
            metrics.events_processed,
            metrics.lag
        );
        tokio::time::sleep(Duration::from_secs(10)).await;
    }
}
```

## Metrics

```rust
pub struct StreamMetrics {
    pub events_received: u64,
    pub events_processed: u64,
    pub events_emitted: u64,
    pub events_failed: u64,
    pub processing_latency_ms: f64,
    pub bytes_received: u64,
    pub bytes_emitted: u64,
    pub state_store_size: u64,
    pub current_watermark: u64,
    pub lag: u64,
}
```

## Use Cases

### Real-time Analytics

```rust
let pipeline = PipelineBuilder::new("page-views", config)
    .source(RedisSource::new("page_events"))
    .operator(FilterOperator::new(|e| e.get_str("event") == Some("view")))
    .operator(MapOperator::new(|e| {
        // Extract page path
        StreamEvent::new(
            e.get_str("page").map(String::from),
            json!({"count": 1})
        )
    }))
    .operator(WindowOperator::tumbling(Duration::from_secs(60)))
    .operator(AggregateOperator::sum("count"))
    .sink(TimeSeriesSink::new("page_views_per_minute"))
    .build();
```

### Fraud Detection

```rust
let pipeline = PipelineBuilder::new("fraud-detection", config)
    .source(RedisSource::new("transactions"))
    .operator(WindowOperator::sliding(
        Duration::from_secs(3600),  // 1 hour window
        Duration::from_secs(60),   // Check every minute
    ))
    .operator(AggregateOperator::new(
        |e| e.get_str("user_id").unwrap().to_string(),
        |acc, e| {
            // Sum transaction amounts per user
            let total = acc.as_f64().unwrap_or(0.0);
            let amount = e.get_f64("amount").unwrap_or(0.0);
            (total + amount).into()
        },
        json!(0.0)
    ))
    .operator(FilterOperator::new(|e| {
        // Flag if total > $10,000 in 1 hour
        e.value.as_f64().unwrap_or(0.0) > 10000.0
    }))
    .sink(AlertSink::new("fraud_alerts"))
    .build();
```

### Event Aggregation

```rust
let pipeline = PipelineBuilder::new("session-aggregation", config)
    .source(RedisSource::new("user_events"))
    .operator(WindowOperator::session(Duration::from_secs(1800)))  // 30 min sessions
    .operator(AggregateOperator::new(
        |e| e.get_str("session_id").unwrap().to_string(),
        |acc, e| {
            // Build session summary
            let mut events = acc["events"].as_array().cloned().unwrap_or_default();
            events.push(e.value.clone());
            json!({
                "events": events,
                "event_count": events.len(),
                "duration_ms": calculate_duration(&events)
            })
        },
        json!({"events": [], "event_count": 0, "duration_ms": 0})
    ))
    .sink(RedisSink::new("session_summaries"))
    .build();
```

## Best Practices

1. **Use consumer groups** - Enable parallel processing and fault tolerance
2. **Acknowledge messages** - Prevent message loss
3. **Set appropriate MAXLEN** - Prevent unbounded stream growth
4. **Monitor lag** - Alert when consumers fall behind
5. **Use exactly-once** - For financial or critical data
6. **Checkpoint state** - Enable recovery after failures
7. **Tune batch sizes** - Balance latency vs. throughput

## Next Steps

- [CDC](/docs/event-driven/cdc) - Change Data Capture
- [Triggers](/docs/event-driven/triggers) - Event-driven functions
- [Webhooks](/docs/event-driven/webhooks) - HTTP callbacks
