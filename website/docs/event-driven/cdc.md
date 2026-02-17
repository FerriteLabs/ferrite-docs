---
sidebar_position: 1
maturity: beta
---

# Change Data Capture (CDC)

Ferrite provides first-class Change Data Capture for streaming data changes to external systems.

## Overview

CDC captures every data mutation and streams it to configured sinks:

```
┌─────────────────────────────────────────────────────────────┐
│                    Change Data Capture                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   Write     │ ──▶ │   Capture   │ ──▶ │    Log      │   │
│  │   (SET)     │     │   Event     │     │   (Buffer)  │   │
│  └─────────────┘     └─────────────┘     └─────────────┘   │
│                                                 │            │
│                              ┌──────────────────┼──────────┐│
│                              ▼                  ▼          ▼││
│                       ┌──────────┐       ┌──────────┐  ┌───┴┴┐
│                       │  Kafka   │       │  HTTP    │  │ S3  │
│                       └──────────┘       └──────────┘  └─────┘
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Create a Subscription

```bash
# Subscribe to all changes
CDC.SUBSCRIBE mysubscription PATTERN "*"

# Subscribe to specific keys
CDC.SUBSCRIBE user_changes PATTERN "user:*"

# Subscribe to specific operations
CDC.SUBSCRIBE writes PATTERN "*" OPERATIONS SET HSET LPUSH
```

### Read Changes

```bash
# Read pending changes
CDC.READ mysubscription COUNT 100
# Returns: [[event_id, {event_data}], ...]

# Push mode (blocking)
CDC.PUSH mysubscription
# Blocks until events available
```

### List Subscriptions

```bash
# List all subscriptions
CDC.LIST

# Get subscription info
CDC.INFO mysubscription
```

## Event Format

Each change event contains:

```json
{
  "id": 12345,
  "timestamp": "2024-01-15T10:30:00.123Z",
  "db": 0,
  "operation": "SET",
  "key": "user:123",
  "value": "{\"name\": \"Alice\"}",
  "old_value": "{\"name\": \"Bob\"}",
  "metadata": {
    "source": "client",
    "client_id": "conn:456",
    "ttl": 3600,
    "command": "SET user:123 {...}"
  }
}
```

### Event Fields

| Field | Description |
|-------|-------------|
| `id` | Unique event ID (monotonically increasing) |
| `timestamp` | ISO 8601 timestamp |
| `db` | Database number (0-15) |
| `operation` | Operation type (SET, DEL, HSET, etc.) |
| `key` | Affected key |
| `value` | New value (if applicable) |
| `old_value` | Previous value (if enabled) |
| `metadata` | Additional context |

### Captured Operations

| Operation | Trigger |
|-----------|---------|
| `SET` | String set operations |
| `DEL` | Key deletion |
| `EXPIRE` | TTL set explicitly |
| `EXPIRED` | Key expired (internal) |
| `EVICTED` | Key evicted (internal) |
| `HSET` | Hash field set |
| `HDEL` | Hash field delete |
| `LPUSH` | List push left |
| `RPUSH` | List push right |
| `LPOP` | List pop left |
| `RPOP` | List pop right |
| `SADD` | Set add |
| `SREM` | Set remove |
| `ZADD` | Sorted set add |
| `ZREM` | Sorted set remove |
| `XADD` | Stream append |

## Sinks

### Kafka

Stream changes to Apache Kafka:

```bash
# Create Kafka sink
CDC.SINK.CREATE kafka_sink KAFKA '{
  "brokers": ["kafka:9092"],
  "topic": "ferrite-changes",
  "partition_key": "key",
  "batch_size": 100,
  "batch_timeout_ms": 1000
}'

# Attach to subscription
CDC.SINK.ATTACH mysubscription kafka_sink
```

### Kinesis

Stream to AWS Kinesis:

```bash
CDC.SINK.CREATE kinesis_sink KINESIS '{
  "stream_name": "ferrite-changes",
  "region": "us-east-1",
  "partition_key": "key"
}'
```

### HTTP Webhook

Send to HTTP endpoints:

```bash
CDC.SINK.CREATE webhook HTTP '{
  "url": "https://api.example.com/webhooks/ferrite",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer token123"
  },
  "batch_size": 50,
  "timeout_ms": 5000,
  "retry_count": 3,
  "retry_delay_ms": 1000
}'
```

### Google Cloud Pub/Sub

```bash
CDC.SINK.CREATE pubsub_sink PUBSUB '{
  "project_id": "my-project",
  "topic": "ferrite-changes"
}'
```

### Amazon S3

Archive changes to S3:

```bash
CDC.SINK.CREATE s3_sink S3 '{
  "bucket": "my-bucket",
  "prefix": "cdc/ferrite/",
  "region": "us-east-1",
  "format": "jsonlines",
  "partition_strategy": "hourly"
}'
```

### Sink Management

```bash
# List sinks
CDC.SINK.LIST

# Get sink info
CDC.SINK.INFO kafka_sink

# Pause sink
CDC.SINK.PAUSE kafka_sink

# Resume sink
CDC.SINK.RESUME kafka_sink

# Delete sink
CDC.SINK.DELETE kafka_sink

# Detach from subscription
CDC.SINK.DETACH mysubscription kafka_sink
```

## Output Formats

```bash
# JSON (default)
CDC.SUBSCRIBE events PATTERN "*" FORMAT json

# Avro
CDC.SUBSCRIBE events PATTERN "*" FORMAT avro

# Protobuf
CDC.SUBSCRIBE events PATTERN "*" FORMAT protobuf

# RESP3 (Redis protocol)
CDC.SUBSCRIBE events PATTERN "*" FORMAT resp3
```

## Filtering

### By Pattern

```bash
# All keys
CDC.SUBSCRIBE all PATTERN "*"

# Specific prefix
CDC.SUBSCRIBE users PATTERN "user:*"

# Multiple patterns (any match)
CDC.SUBSCRIBE mixed PATTERN "user:*" PATTERN "order:*"
```

### By Operation

```bash
# Only writes
CDC.SUBSCRIBE writes PATTERN "*" OPERATIONS SET HSET ZADD

# Only deletes
CDC.SUBSCRIBE deletes PATTERN "*" OPERATIONS DEL EXPIRED EVICTED
```

### By Database

```bash
# Only database 0
CDC.SUBSCRIBE db0 PATTERN "*" DB 0

# Multiple databases
CDC.SUBSCRIBE multi PATTERN "*" DB 0 DB 1
```

## Old Value Capture

Capture previous values for updates:

```bash
# Enable old value capture
CDC.SUBSCRIBE changes PATTERN "*" OLDVALUE

# Event includes old_value field
{
  "operation": "SET",
  "key": "user:123",
  "value": "{\"name\": \"Bob\"}",
  "old_value": "{\"name\": \"Alice\"}"
}
```

## Change Log

The persistent change log provides durability and replay:

### Configuration

```toml
[cdc]
enabled = true
log_enabled = true
log_path = "/data/ferrite/cdc"
log_segment_size = "128MB"
log_retention_time = "7d"
log_retention_size = "10GB"
log_compression = "lz4"  # none, lz4, zstd
log_sync_mode = "async"  # async, sync, fsync
```

### Replay

```bash
# Read from specific offset
CDC.READ mysubscription FROM 12345 COUNT 100

# Read time range
CDC.READ mysubscription FROM_TIME "2024-01-15T00:00:00Z" TO_TIME "2024-01-16T00:00:00Z"
```

### Compaction

```bash
# Trigger log compaction
CDC.LOG.COMPACT

# Log stats
CDC.LOG.INFO
# Returns: segments, size, oldest_event, newest_event
```

## Rust API

```rust
use ferrite::cdc::{CdcEngine, CdcConfig, Subscription, Sink};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create CDC engine
    let config = CdcConfig::default();
    let engine = CdcEngine::new(config)?;

    // Create subscription
    let subscription = engine.subscribe(Subscription {
        name: "user_changes".to_string(),
        pattern: "user:*".to_string(),
        operations: Some(vec!["SET", "DEL"]),
        capture_old_value: true,
        ..Default::default()
    })?;

    // Create Kafka sink
    let sink = engine.create_sink(Sink::Kafka(KafkaSinkConfig {
        brokers: vec!["kafka:9092".to_string()],
        topic: "ferrite-changes".to_string(),
        ..Default::default()
    }))?;

    // Attach sink to subscription
    engine.attach_sink(&subscription.name, &sink.name)?;

    // Manual reading
    let events = engine.read(&subscription.name, 100)?;
    for event in events {
        println!("{}: {} {}", event.id, event.operation, event.key);
    }

    // Stream processing
    let mut stream = engine.stream(&subscription.name)?;
    while let Some(event) = stream.next().await {
        process_event(event)?;
    }

    Ok(())
}
```

## Use Cases

### Event Sourcing

```
Ferrite (CDC) ──▶ Kafka ──▶ Event Store
                           ──▶ Projections
                           ──▶ Analytics
```

### Real-Time Sync

```
Ferrite (CDC) ──▶ HTTP ──▶ External API
                 ──▶ Elasticsearch
                 ──▶ Data Warehouse
```

### Audit Logging

```
Ferrite (CDC) ──▶ S3 ──▶ Compliance Archive
              ──▶ SIEM System
```

### Cache Invalidation

```
Ferrite (CDC) ──▶ HTTP ──▶ Application
                          └──▶ Invalidate local cache
```

## Monitoring

### Metrics

```bash
CDC.STATS
# Returns:
# events_captured: 1000000
# events_delivered: 999500
# events_pending: 500
# subscriptions: 3
# sinks: 2
```

### Sink Health

```bash
CDC.SINK.HEALTH kafka_sink
# Returns:
# status: active
# lag: 100
# last_delivery: "2024-01-15T10:30:00Z"
# errors: 0
```

### Alerts

```yaml
# Prometheus alerts
- alert: CDCLagHigh
  expr: ferrite_cdc_lag > 10000
  for: 5m

- alert: CDCSinkError
  expr: ferrite_cdc_sink_errors_total > 0
  for: 1m
```

## Configuration Reference

```toml
[cdc]
enabled = true
capture_old_values = false
max_subscriptions = 100
max_sinks_per_subscription = 5

[cdc.log]
enabled = true
path = "/data/ferrite/cdc"
segment_size = "128MB"
retention_time = "7d"
retention_size = "10GB"
compression = "lz4"
sync_mode = "async"

[cdc.delivery]
batch_size = 100
batch_timeout_ms = 1000
retry_count = 3
retry_delay_ms = 1000
max_retry_delay_ms = 30000
```

## Best Practices

1. **Use specific patterns** - Avoid `*` in production; be precise
2. **Configure retention** - Match log retention to your recovery needs
3. **Monitor lag** - Alert on high lag before it becomes a problem
4. **Use batching** - Better throughput than single-event delivery
5. **Handle idempotency** - Consumers should handle duplicate events
6. **Test failure scenarios** - Verify behavior when sinks are down

## Next Steps

- [Triggers](/docs/event-driven/triggers) - React to changes programmatically
- [Streams](/docs/event-driven/streams) - Redis Streams for event processing
- [Webhooks](/docs/event-driven/webhooks) - HTTP-based event delivery
