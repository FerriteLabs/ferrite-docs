---
sidebar_position: 2
maturity: experimental
---

# Triggers

Ferrite triggers are event-driven functions that execute automatically when data changes, similar to Firebase Cloud Functions.

## Overview

Triggers react to data mutations and execute actions:

```
┌─────────────────────────────────────────────────────────────┐
│                       Trigger Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   Write     │ ──▶ │   Match     │ ──▶ │   Execute   │   │
│  │   (SET)     │     │  Condition  │     │   Action    │   │
│  └─────────────┘     └─────────────┘     └─────────────┘   │
│                                                 │            │
│                              ┌──────────────────┼──────────┐│
│                              ▼                  ▼          ▼││
│                       ┌──────────┐       ┌──────────┐  ┌───┴┴┐
│                       │ PUBLISH  │       │   HTTP   │  │WASM │
│                       └──────────┘       └──────────┘  └─────┘
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Create a Trigger

```bash
# Publish to channel when user is created
TRIGGER.CREATE user_created ON SET user:* DO PUBLISH user_events '$KEY created'

# HTTP webhook on order changes
TRIGGER.CREATE order_webhook ON SET order:* DO HTTP POST https://api.example.com/webhooks/orders '$VALUE'

# Log deletions
TRIGGER.CREATE log_deletes ON DELETE * DO LOG INFO 'Key deleted: $KEY'
```

### Manage Triggers

```bash
# List all triggers
TRIGGER.LIST

# Get trigger info
TRIGGER.INFO user_created

# Enable/disable
TRIGGER.ENABLE user_created
TRIGGER.DISABLE user_created

# Delete trigger
TRIGGER.DELETE user_created
```

## Event Types

| Event | Description | Triggers On |
|-------|-------------|-------------|
| `SET` | String value set | SET, SETEX, SETNX, MSET |
| `DELETE` | Key deleted | DEL, UNLINK |
| `EXPIRE` | TTL set | EXPIRE, EXPIREAT, PEXPIRE |
| `LIST` | List operations | LPUSH, RPUSH, LPOP, RPOP |
| `HASH` | Hash operations | HSET, HDEL |
| `SET` | Set operations | SADD, SREM |
| `ZSET` | Sorted set operations | ZADD, ZREM |
| `STREAM` | Stream operations | XADD |
| `WRITE` | Any write operation | All writes |
| `READ` | Any read operation | GET, HGET, etc. |
| `ANY` | Any operation | All operations |

## Pattern Matching

### Glob Patterns

```bash
# All user keys
TRIGGER.CREATE t1 ON SET user:* DO ...

# Specific user attribute
TRIGGER.CREATE t2 ON SET user:*:email DO ...

# Single character wildcard
TRIGGER.CREATE t3 ON SET user:??? DO ...  # 3-digit IDs
```

### Exact Match

```bash
TRIGGER.CREATE t4 ON SET config:app DO ...
```

### Prefix/Suffix

```bash
# Prefix match
TRIGGER.CREATE t5 ON SET PREFIX user: DO ...

# Suffix match
TRIGGER.CREATE t6 ON SET SUFFIX :cache DO ...
```

### Regex

```bash
TRIGGER.CREATE t7 ON SET REGEX "user:[0-9]+:profile" DO ...
```

## Actions

### PUBLISH

Publish to a Pub/Sub channel:

```bash
TRIGGER.CREATE notify ON SET user:* DO PUBLISH user_changes '$KEY updated to $VALUE'
```

### HTTP

Send HTTP request:

```bash
# POST request
TRIGGER.CREATE webhook ON SET order:* DO HTTP POST https://api.example.com/orders '$VALUE'

# With headers
TRIGGER.CREATE webhook2 ON SET user:* DO HTTP POST https://api.example.com/users '$VALUE' HEADERS '{"Authorization": "Bearer token"}'

# GET request
TRIGGER.CREATE fetch ON SET cache:* DO HTTP GET https://api.example.com/refresh?key=$KEY
```

### LOG

Write to server log:

```bash
# Log levels: DEBUG, INFO, WARN, ERROR
TRIGGER.CREATE audit ON DELETE * DO LOG WARN 'Key deleted: $KEY by $CLIENT'
```

### SET

Set another key:

```bash
# Mirror to another key
TRIGGER.CREATE mirror ON SET primary:* DO SET backup:* '$VALUE'

# With TTL
TRIGGER.CREATE cache ON SET data:* DO SET cache:* '$VALUE' TTL 3600
```

### DELETE

Delete keys:

```bash
# Cascade delete
TRIGGER.CREATE cascade ON DELETE user:* DO DELETE user:*:sessions
```

### INCREMENT

Increment a counter:

```bash
TRIGGER.CREATE count ON SET order:* DO INCREMENT order_count
```

### LIST_PUSH

Add to a list:

```bash
# Audit trail
TRIGGER.CREATE audit ON SET user:* DO LIST_PUSH audit:user LEFT '$TIMESTAMP: $KEY updated'
```

### SET_ADD

Add to a set:

```bash
# Track modified keys
TRIGGER.CREATE track ON SET * DO SET_ADD modified_keys '$KEY'
```

### WASM

Execute WebAssembly function:

```bash
TRIGGER.CREATE custom ON SET data:* DO WASM my_function '$KEY' '$VALUE'
```

## Template Variables

| Variable | Description |
|----------|-------------|
| `$KEY` | The affected key |
| `$VALUE` | New value |
| `$OLD_VALUE` | Previous value |
| `$DB` | Database number |
| `$TIMESTAMP` | Event timestamp |
| `$TYPE` | Value type |
| `$TTL` | Key TTL (if set) |
| `$CLIENT` | Client ID |

## Filters

### Value Matching

```bash
# Only trigger for specific values
TRIGGER.CREATE premium ON SET user:*:tier DO PUBLISH upgrades '$KEY' WHEN VALUE_MATCHES "premium"
```

### Type Filtering

```bash
# Only for string values
TRIGGER.CREATE strings_only ON SET * DO ... WHEN VALUE_TYPE string
```

### TTL Conditions

```bash
# Only keys with TTL
TRIGGER.CREATE expiring ON SET * DO ... WHEN HAS_TTL

# TTL range
TRIGGER.CREATE short_ttl ON SET * DO ... WHEN TTL_RANGE 0 3600
```

### Logical Operators

```bash
# AND condition
TRIGGER.CREATE complex ON SET user:* DO ... WHEN VALUE_MATCHES "active" AND HAS_TTL

# OR condition
TRIGGER.CREATE multi ON SET * DO ... WHEN VALUE_TYPE string OR VALUE_TYPE hash

# NOT condition
TRIGGER.CREATE not_cached ON SET * DO ... WHEN NOT VALUE_MATCHES "*cache*"
```

## Action Chains

Execute multiple actions:

```bash
TRIGGER.CREATE multi_action ON SET order:* DO CHAIN [
  PUBLISH order_events '$KEY created',
  HTTP POST https://api.example.com/orders '$VALUE',
  INCREMENT order_count,
  LOG INFO 'Order created: $KEY'
]
```

## Conditional Actions

```bash
TRIGGER.CREATE conditional ON SET user:*:status DO CONDITIONAL
  WHEN VALUE_MATCHES "premium" THEN PUBLISH premium_users '$KEY'
  WHEN VALUE_MATCHES "trial" THEN HTTP POST https://api.example.com/trials '$KEY'
  ELSE LOG INFO 'User status changed: $KEY'
END
```

## Priority

Control execution order:

```bash
# Higher priority executes first
TRIGGER.CREATE high_priority ON SET * DO ... PRIORITY 100
TRIGGER.CREATE low_priority ON SET * DO ... PRIORITY 1
```

## Configuration

```toml
[triggers]
enabled = true
max_triggers = 1000
max_actions_per_trigger = 10
default_timeout_ms = 5000
max_concurrent_executions = 100
async_execution = true

[triggers.http]
timeout_ms = 10000
max_retries = 3
retry_delay_ms = 1000

[triggers.logging]
enabled = true
log_executions = false  # Log every trigger execution
```

## Rust API

```rust
use ferrite::triggers::{TriggerRegistry, Trigger, EventType, Pattern, Action};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let registry = TriggerRegistry::new(TriggerConfig::default());

    // Create trigger
    let trigger = Trigger {
        name: "user_created".to_string(),
        condition: Condition {
            event_type: EventType::Set,
            pattern: Pattern::Glob("user:*".to_string()),
            filter: None,
        },
        actions: vec![
            Action::Publish(PublishAction {
                channel: "user_events".to_string(),
                message: "$KEY created".to_string(),
            }),
            Action::Http(HttpAction {
                url: "https://api.example.com/webhooks".to_string(),
                method: HttpMethod::Post,
                body: Some("$VALUE".to_string()),
                ..Default::default()
            }),
        ],
        enabled: true,
        priority: 10,
    };

    registry.register(trigger)?;

    // Fire manually (for testing)
    registry.fire("user:123", Some("value"), None)?;

    // Get stats
    let stats = registry.stats();
    println!("Executions: {}", stats.total_executions);

    Ok(())
}
```

## Monitoring

### Stats

```bash
TRIGGER.STATS
# Returns:
# triggers_total: 10
# triggers_enabled: 8
# executions_total: 100000
# executions_successful: 99900
# executions_failed: 100
# avg_execution_time_us: 150
```

### Info

```bash
TRIGGER.INFO my_trigger
# Returns:
# name: my_trigger
# event_type: SET
# pattern: user:*
# actions: [PUBLISH, HTTP]
# enabled: true
# priority: 10
# created_at: 2024-01-15T00:00:00Z
# last_executed: 2024-01-15T10:30:00Z
# execution_count: 1000
```

## Best Practices

1. **Be specific with patterns** - Avoid `*` to prevent unintended triggers
2. **Use async execution** - Don't block write operations
3. **Handle failures gracefully** - Configure retries for HTTP actions
4. **Monitor execution times** - Slow triggers affect write latency
5. **Test with FIRE** - Manually test triggers before enabling
6. **Use priorities** - Ensure correct execution order
7. **Log judiciously** - Too much logging impacts performance

## Use Cases

### Cache Invalidation

```bash
TRIGGER.CREATE invalidate ON SET products:* DO HTTP POST https://cdn.example.com/purge '$KEY'
```

### Real-Time Notifications

```bash
TRIGGER.CREATE notify ON SET messages:*:* DO PUBLISH notifications '$KEY has new message'
```

### Audit Trail

```bash
TRIGGER.CREATE audit ON WRITE * DO LIST_PUSH audit_log LEFT '{"time":"$TIMESTAMP","key":"$KEY","op":"$EVENT"}'
```

### Cascading Deletes

```bash
TRIGGER.CREATE cascade ON DELETE user:* DO CHAIN [
  DELETE user:*:sessions,
  DELETE user:*:preferences,
  DELETE user:*:cache
]
```

### Data Validation

```bash
TRIGGER.CREATE validate ON SET user:*:email DO WASM validate_email '$VALUE'
```

## Next Steps

- [CDC](/docs/event-driven/cdc) - Change Data Capture
- [WASM Functions](/docs/extensibility/wasm-functions) - Custom trigger logic
- [Streams](/docs/event-driven/streams) - Event streaming
