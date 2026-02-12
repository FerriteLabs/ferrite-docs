---
sidebar_position: 23
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Trigger Commands

Commands for programmable event triggers.

## Overview

Trigger commands enable creating automated responses to data changes, executing code or sending notifications when specified conditions are met.

## Commands

### TRIGGER.CREATE

Create a new trigger.

```bash
TRIGGER.CREATE trigger_name
  ON pattern
  EVENTS event_types
  ACTION action_type action_config
  [CONDITION expression]
  [PRIORITY priority]
  [ENABLED true|false]
```

**Event Types:**
- `SET` - Key created or updated
- `DEL` - Key deleted
- `EXPIRE` - Key expired
- `RENAME` - Key renamed
- `HSET` - Hash field set
- `LPUSH`, `RPUSH` - List push
- `SADD` - Set add
- `ZADD` - Sorted set add

**Action Types:**
- `PUBLISH channel` - Publish to channel
- `HTTP url` - HTTP webhook
- `CALL function` - Call Lua/WASM function
- `EXEC commands` - Execute Redis commands
- `STREAM stream_name` - Append to stream

**Examples:**
```bash
# Publish on change
TRIGGER.CREATE notify_user_change
  ON "user:*"
  EVENTS SET DEL
  ACTION PUBLISH "user-events"

# HTTP webhook
TRIGGER.CREATE order_webhook
  ON "order:*"
  EVENTS SET
  ACTION HTTP "https://api.example.com/orders/webhook"
  CONDITION "value.status == 'completed'"

# Call function
TRIGGER.CREATE process_payment
  ON "payment:*"
  EVENTS SET
  ACTION CALL "validate_payment"
  CONDITION "value.amount > 1000"

# Execute commands
TRIGGER.CREATE update_stats
  ON "sale:*"
  EVENTS SET
  ACTION EXEC "HINCRBY stats:daily sales 1"
```

---

### TRIGGER.DELETE

Delete a trigger.

```bash
TRIGGER.DELETE trigger_name
```

---

### TRIGGER.LIST

List all triggers.

```bash
TRIGGER.LIST [PATTERN pattern]
```

**Examples:**
```bash
TRIGGER.LIST
# 1) "notify_user_change"
# 2) "order_webhook"
# 3) "process_payment"

TRIGGER.LIST PATTERN "order*"
# 1) "order_webhook"
```

---

### TRIGGER.INFO

Get trigger details.

```bash
TRIGGER.INFO trigger_name
```

**Examples:**
```bash
TRIGGER.INFO order_webhook
# {
#   "name": "order_webhook",
#   "pattern": "order:*",
#   "events": ["SET"],
#   "action": {"type": "HTTP", "url": "https://..."},
#   "condition": "value.status == 'completed'",
#   "enabled": true,
#   "executions": 1500,
#   "last_execution": "2024-01-15T10:30:00Z",
#   "errors": 5
# }
```

---

### TRIGGER.ENABLE

Enable a trigger.

```bash
TRIGGER.ENABLE trigger_name
```

---

### TRIGGER.DISABLE

Disable a trigger.

```bash
TRIGGER.DISABLE trigger_name
```

---

### TRIGGER.UPDATE

Update trigger configuration.

```bash
TRIGGER.UPDATE trigger_name
  [CONDITION expression]
  [PRIORITY priority]
  [ACTION action_type action_config]
```

---

### TRIGGER.TEST

Test trigger without executing.

```bash
TRIGGER.TEST trigger_name key value
```

**Examples:**
```bash
TRIGGER.TEST order_webhook order:123 '{"status": "completed", "amount": 99.99}'
# {
#   "would_trigger": true,
#   "condition_result": true,
#   "action": {"type": "HTTP", "url": "https://..."}
# }
```

---

### TRIGGER.LOG

Get trigger execution log.

```bash
TRIGGER.LOG trigger_name [COUNT count] [SINCE timestamp]
```

**Examples:**
```bash
TRIGGER.LOG order_webhook COUNT 10
# 1) {"timestamp": 1705320000, "key": "order:123", "result": "success"}
# 2) {"timestamp": 1705319900, "key": "order:122", "result": "success"}
```

---

### TRIGGER.STATS

Get trigger statistics.

```bash
TRIGGER.STATS [trigger_name]
```

**Examples:**
```bash
TRIGGER.STATS order_webhook
# {
#   "total_executions": 1500,
#   "successful": 1495,
#   "failed": 5,
#   "avg_latency_ms": 45,
#   "last_24h": 150
# }

TRIGGER.STATS
# Returns stats for all triggers
```

## Condition Expressions

### Variables

```bash
# Available in conditions:
# key - The key that triggered
# event - The event type (SET, DEL, etc.)
# value - The new value (for SET)
# old_value - The previous value
# ttl - TTL if set
```

### Operators

```bash
# Comparison
"value.status == 'active'"
"value.amount > 100"
"value.count >= 10"
"value.price != 0"

# Logical
"value.status == 'active' AND value.amount > 100"
"value.type == 'premium' OR value.amount > 1000"
"NOT value.test"

# String operations
"key MATCHES 'user:[0-9]+'"
"value.email CONTAINS '@example.com'"
"value.name STARTSWITH 'Admin'"

# Array operations
"value.tags CONTAINS 'urgent'"
"value.roles ANY ['admin', 'manager']"

# Null checks
"value.discount IS NOT NULL"
"old_value IS NULL"  # New key
```

## Action Examples

### PUBLISH Action

```bash
TRIGGER.CREATE user_events
  ON "user:*"
  EVENTS SET DEL
  ACTION PUBLISH "user-changes"

# Message format:
# {"event": "SET", "key": "user:123", "value": {...}}
```

### HTTP Action

```bash
TRIGGER.CREATE webhook
  ON "order:*"
  EVENTS SET
  ACTION HTTP "https://api.example.com/webhook"
    METHOD POST
    HEADERS "Authorization: Bearer token" "Content-Type: application/json"
    BODY '{"key": "{{key}}", "data": {{value}}}'
    TIMEOUT 5000
    RETRY 3
```

### CALL Action

```bash
# First, load function
WASM.LOAD validate /path/to/validate.wasm

# Then create trigger
TRIGGER.CREATE validate_order
  ON "order:*"
  EVENTS SET
  ACTION CALL "validate"
  CONDITION "value.status == 'pending'"
```

### EXEC Action

```bash
TRIGGER.CREATE update_index
  ON "product:*"
  EVENTS SET
  ACTION EXEC "
    SADD products:category:{{value.category}} {{key}}
    ZADD products:price {{value.price}} {{key}}
  "
```

### STREAM Action

```bash
TRIGGER.CREATE audit_log
  ON "*"
  EVENTS SET DEL
  ACTION STREAM "audit:changes"

# Creates stream entries with event details
```

## Use Cases

### Cache Invalidation

```bash
TRIGGER.CREATE invalidate_cache
  ON "product:*"
  EVENTS SET DEL
  ACTION HTTP "https://cdn.example.com/invalidate"
    METHOD DELETE
    BODY '{"key": "{{key}}"}'
```

### Real-Time Notifications

```bash
TRIGGER.CREATE notify_status
  ON "order:*"
  EVENTS SET
  ACTION PUBLISH "notifications"
  CONDITION "value.status != old_value.status"
```

### Data Validation

```bash
TRIGGER.CREATE validate_email
  ON "user:*"
  EVENTS SET
  ACTION CALL "validate_user_data"
  CONDITION "value.email IS NOT NULL"
```

### Denormalization

```bash
TRIGGER.CREATE update_user_orders
  ON "order:*"
  EVENTS SET
  ACTION EXEC "
    LPUSH user:{{value.user_id}}:orders {{key}}
    LTRIM user:{{value.user_id}}:orders 0 99
  "
```

### Metrics Collection

```bash
TRIGGER.CREATE collect_metrics
  ON "api:request:*"
  EVENTS SET
  ACTION EXEC "
    HINCRBY metrics:api:{{value.endpoint}} count 1
    HINCRBY metrics:api:{{value.endpoint}} total_ms {{value.duration}}
  "
```

## Rust API

```rust
use ferrite::Client;
use ferrite::trigger::{TriggerConfig, Action, Condition};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Create trigger
    client.trigger_create(
        "order_notification",
        TriggerConfig::new("order:*")
            .events(&["SET"])
            .action(Action::Publish("order-events".to_string()))
            .condition("value.status == 'completed'"),
    ).await?;

    // Create HTTP webhook trigger
    client.trigger_create(
        "order_webhook",
        TriggerConfig::new("order:*")
            .events(&["SET"])
            .action(Action::Http {
                url: "https://api.example.com/webhook".to_string(),
                method: "POST".to_string(),
                headers: vec![("Authorization".to_string(), "Bearer token".to_string())],
                timeout: 5000,
            })
            .condition("value.amount > 100"),
    ).await?;

    // List triggers
    let triggers = client.trigger_list(None).await?;

    // Get trigger info
    let info = client.trigger_info("order_notification").await?;

    // Disable/enable
    client.trigger_disable("order_notification").await?;
    client.trigger_enable("order_notification").await?;

    // Delete trigger
    client.trigger_delete("order_notification").await?;

    Ok(())
}
```

## Configuration

```toml
[triggers]
enabled = true
max_triggers = 1000
execution_timeout_ms = 5000
max_retries = 3
retry_backoff_ms = 1000

[triggers.http]
default_timeout_ms = 5000
max_concurrent = 100
```

## Related Commands

- [CDC Commands](/docs/reference/commands/cdc) - Change Data Capture
- [WASM Commands](/docs/reference/commands/wasm) - WebAssembly functions
- [Pub/Sub Commands](/docs/reference/commands/pubsub) - Pub/Sub messaging
- [Triggers Guide](/docs/event-driven/triggers) - Detailed guide
