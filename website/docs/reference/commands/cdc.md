---
sidebar_position: 22
maturity: beta
---

:::info Beta Feature
This feature is in **beta**. It is feature-complete but still undergoing testing. APIs may change in minor ways before stabilization.
:::

# CDC Commands

Commands for Change Data Capture - tracking and streaming data changes.

## Overview

CDC commands enable subscribing to data changes and streaming them to external systems like Kafka, Kinesis, or webhooks.

## Commands

### CDC.SUBSCRIBE

Subscribe to key changes.

```bash
CDC.SUBSCRIBE pattern
  [EVENTS types]
  [SINCE timestamp]
```

**Event Types:**
- `SET` - Key set/updated
- `DEL` - Key deleted
- `EXPIRE` - Key expired
- `RENAME` - Key renamed
- `ALL` - All events

**Examples:**
```bash
# Subscribe to all user changes
CDC.SUBSCRIBE "user:*"

# Subscribe to specific events
CDC.SUBSCRIBE "order:*" EVENTS SET DEL

# Subscribe from specific time
CDC.SUBSCRIBE "product:*" SINCE 1705320000000
```

---

### CDC.UNSUBSCRIBE

Unsubscribe from pattern.

```bash
CDC.UNSUBSCRIBE pattern
```

---

### CDC.POLL

Poll for changes (non-blocking client).

```bash
CDC.POLL [COUNT count] [BLOCK timeout]
```

**Examples:**
```bash
CDC.POLL COUNT 100 BLOCK 5000
# Returns up to 100 changes, blocking for 5 seconds if none available
```

---

### CDC.SINK.CREATE

Create output sink for changes.

```bash
CDC.SINK.CREATE sink_name TYPE sink_type
  PATTERN pattern
  [CONFIG key value ...]
  [EVENTS types]
  [FILTER expression]
  [TRANSFORM template]
```

**Sink Types:**
- `kafka` - Apache Kafka
- `kinesis` - AWS Kinesis
- `pubsub` - Google Cloud Pub/Sub
- `http` - HTTP webhook
- `s3` - AWS S3
- `redis` - Another Redis/Ferrite instance

**Examples:**
```bash
# Kafka sink
CDC.SINK.CREATE user_events TYPE kafka
  PATTERN "user:*"
  CONFIG
    bootstrap_servers "kafka:9092"
    topic "user-events"
    compression "snappy"

# HTTP webhook
CDC.SINK.CREATE order_webhook TYPE http
  PATTERN "order:*"
  EVENTS SET DEL
  CONFIG
    url "https://api.example.com/webhooks/orders"
    method "POST"
    headers "Authorization: Bearer token123"
  TRANSFORM '{"event": "{{event}}", "key": "{{key}}", "value": {{value}}}'

# S3 for archival
CDC.SINK.CREATE audit_logs TYPE s3
  PATTERN "*"
  CONFIG
    bucket "ferrite-audit-logs"
    region "us-east-1"
    prefix "changes/"
    format "json"
    batch_size 1000
    flush_interval 60
```

---

### CDC.SINK.LIST

List configured sinks.

```bash
CDC.SINK.LIST
```

---

### CDC.SINK.INFO

Get sink details.

```bash
CDC.SINK.INFO sink_name
```

**Examples:**
```bash
CDC.SINK.INFO user_events
# {
#   "name": "user_events",
#   "type": "kafka",
#   "pattern": "user:*",
#   "status": "active",
#   "messages_sent": 150000,
#   "last_error": null,
#   "lag": 0
# }
```

---

### CDC.SINK.PAUSE

Pause a sink.

```bash
CDC.SINK.PAUSE sink_name
```

---

### CDC.SINK.RESUME

Resume a paused sink.

```bash
CDC.SINK.RESUME sink_name
```

---

### CDC.SINK.DELETE

Delete a sink.

```bash
CDC.SINK.DELETE sink_name
```

---

### CDC.SINK.RESET

Reset sink offset.

```bash
CDC.SINK.RESET sink_name [TO timestamp]
```

**Examples:**
```bash
# Reset to beginning
CDC.SINK.RESET user_events

# Reset to specific time
CDC.SINK.RESET user_events TO 1705320000000
```

---

### CDC.STATUS

Get CDC system status.

```bash
CDC.STATUS
```

**Examples:**
```bash
CDC.STATUS
# {
#   "enabled": true,
#   "subscriptions": 5,
#   "sinks": 3,
#   "events_processed": 1000000,
#   "events_pending": 150,
#   "buffer_size": "10MB",
#   "retention": "86400s"
# }
```

---

### CDC.STREAM

Get change stream.

```bash
CDC.STREAM pattern
  [COUNT count]
  [BLOCK timeout]
  [SINCE timestamp]
```

**Examples:**
```bash
# Stream changes
CDC.STREAM "user:*" COUNT 100 BLOCK 5000

# Returns:
# 1) 1) "1705320000001"
#    2) "SET"
#    3) "user:1"
#    4) '{"name": "Alice"}'
# 2) 1) "1705320000002"
#    2) "DEL"
#    3) "user:2"
#    4) (nil)
```

## Change Event Format

```json
{
  "timestamp": 1705320000001,
  "event": "SET",
  "key": "user:1",
  "value": {"name": "Alice", "age": 30},
  "old_value": {"name": "Alice", "age": 29},
  "ttl": 3600,
  "source": {
    "node": "node-1",
    "db": 0
  }
}
```

## Use Cases

### Event Sourcing

```bash
# Create Kafka sink for all events
CDC.SINK.CREATE events TYPE kafka
  PATTERN "*"
  CONFIG
    bootstrap_servers "kafka:9092"
    topic "ferrite-events"
    key_field "key"

# Consumer rebuilds state from events
```

### Real-Time Analytics

```bash
# Stream to analytics pipeline
CDC.SINK.CREATE analytics TYPE kinesis
  PATTERN "order:*"
  EVENTS SET
  CONFIG
    stream_name "order-analytics"
    region "us-east-1"
  TRANSFORM '{
    "order_id": "{{key}}",
    "timestamp": {{timestamp}},
    "data": {{value}}
  }'
```

### Cache Invalidation

```bash
# Webhook for cache invalidation
CDC.SINK.CREATE cache_invalidate TYPE http
  PATTERN "product:*"
  EVENTS SET DEL EXPIRE
  CONFIG
    url "https://cdn.example.com/invalidate"
    method "POST"
    batch_size 100
    batch_interval 1000
```

### Audit Logging

```bash
# S3 for compliance/audit
CDC.SINK.CREATE audit TYPE s3
  PATTERN "*"
  CONFIG
    bucket "audit-logs"
    prefix "ferrite/{{date}}/"
    format "json-lines"
    compression "gzip"
    batch_size 10000
    flush_interval 300
```

### Data Replication

```bash
# Replicate to another Ferrite instance
CDC.SINK.CREATE replica TYPE redis
  PATTERN "*"
  CONFIG
    host "replica.example.com"
    port 6379
    password "secret"
  FILTER "NOT key MATCHES 'temp:*'"
```

## Rust API

```rust
use ferrite::Client;
use ferrite::cdc::{SinkType, SinkConfig, ChangeEvent};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Create Kafka sink
    client.cdc_sink_create(
        "user_events",
        SinkType::Kafka,
        "user:*",
        SinkConfig::kafka()
            .bootstrap_servers("kafka:9092")
            .topic("user-events")
            .compression("snappy"),
    ).await?;

    // Subscribe and poll for changes
    client.cdc_subscribe("order:*", &["SET", "DEL"]).await?;

    loop {
        let changes: Vec<ChangeEvent> = client.cdc_poll(100, Some(5000)).await?;

        for change in changes {
            println!(
                "{}: {} {} = {:?}",
                change.timestamp,
                change.event,
                change.key,
                change.value
            );
        }
    }

    // Stream changes
    let mut stream = client.cdc_stream("user:*").await?;
    while let Some(event) = stream.next().await? {
        process_event(event)?;
    }

    Ok(())
}
```

## Configuration

```toml
[cdc]
enabled = true
buffer_size = "100MB"
retention = "24h"
batch_size = 1000
flush_interval_ms = 100

[cdc.kafka]
default_bootstrap_servers = "kafka:9092"
producer_config = { "acks" = "all", "retries" = "3" }

[cdc.http]
timeout_ms = 5000
max_retries = 3
retry_backoff_ms = 1000
```

## Related Commands

- [Stream Commands](/docs/reference/commands/streams) - Redis Streams
- [Pub/Sub Commands](/docs/reference/commands/pubsub) - Pub/Sub messaging
- [Trigger Commands](/docs/reference/commands/trigger) - Event triggers
- [CDC Guide](/docs/event-driven/cdc) - Detailed guide
