---
sidebar_position: 4
maturity: experimental
---

# Webhooks

Send HTTP callbacks when events occur in Ferrite.

## Overview

Webhooks notify external services when data changes in Ferrite. Configure HTTP endpoints to receive real-time notifications for key operations, expirations, and custom events.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Ferrite   │────▶│   Webhook   │────▶│  External   │
│   Event     │     │   Manager   │     │   Service   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │   Retry &   │
                    │   Queue     │
                    └─────────────┘
```

## Quick Start

```bash
# Create webhook for key changes
WEBHOOK.CREATE order-updates https://api.example.com/webhook PATTERN 'order:*' EVENTS SET DEL

# Test the webhook
WEBHOOK.TEST order-updates

# List webhooks
WEBHOOK.LIST
```

## Creating Webhooks

### Basic Webhook

```bash
WEBHOOK.CREATE <name> <url> [OPTIONS]

# Simple webhook
WEBHOOK.CREATE my-webhook https://api.example.com/hook

# With key pattern
WEBHOOK.CREATE user-updates https://api.example.com/users PATTERN 'user:*'

# With event filter
WEBHOOK.CREATE changes https://api.example.com/changes EVENTS SET DEL EXPIRE
```

### Event Types

| Event | Description |
|-------|-------------|
| `SET` | Key was set or updated |
| `DEL` | Key was deleted |
| `EXPIRE` | Key expired |
| `RENAME` | Key was renamed |
| `LPUSH` | Item pushed to list |
| `RPUSH` | Item pushed to list |
| `HSET` | Hash field set |
| `SADD` | Set member added |
| `ZADD` | Sorted set member added |
| `XADD` | Stream entry added |

```bash
# Multiple events
WEBHOOK.CREATE all-changes https://example.com/hook EVENTS SET DEL EXPIRE RENAME
```

### Pattern Matching

```bash
# All user keys
WEBHOOK.CREATE users https://example.com/users PATTERN 'user:*'

# Specific key
WEBHOOK.CREATE config https://example.com/config PATTERN 'config:app'

# Complex pattern
WEBHOOK.CREATE orders https://example.com/orders PATTERN 'order:*:items'
```

### Authentication

```bash
# Bearer token
WEBHOOK.CREATE secure https://api.example.com/hook AUTH bearer mytoken123

# Basic auth
WEBHOOK.CREATE secure https://api.example.com/hook AUTH basic user:pass

# Custom header
WEBHOOK.CREATE secure https://api.example.com/hook HEADER X-API-Key mysecretkey
```

### Retry Configuration

```bash
WEBHOOK.CREATE reliable https://api.example.com/hook \
  RETRIES 5 \
  RETRY_DELAY 1000 \
  RETRY_BACKOFF exponential
```

## Webhook Payload

### Event Format

```json
{
  "id": "evt_1234567890",
  "timestamp": "2024-01-15T10:30:00Z",
  "event": "SET",
  "key": "user:123",
  "database": 0,
  "data": {
    "value": "Alice",
    "old_value": "Bob",
    "ttl": 3600
  },
  "metadata": {
    "client_id": "conn:456",
    "source_ip": "192.168.1.100"
  }
}
```

### Batch Format

```json
{
  "batch_id": "batch_1234567890",
  "timestamp": "2024-01-15T10:30:00Z",
  "events": [
    {"event": "SET", "key": "user:1", ...},
    {"event": "SET", "key": "user:2", ...},
    {"event": "DEL", "key": "user:3", ...}
  ],
  "count": 3
}
```

## Managing Webhooks

### List Webhooks

```bash
WEBHOOK.LIST
# Returns:
# 1) name: order-updates
#    url: https://api.example.com/webhook
#    pattern: order:*
#    events: [SET, DEL]
#    status: active
```

### Get Webhook Details

```bash
WEBHOOK.INFO order-updates
# Returns:
# name: order-updates
# url: https://api.example.com/webhook
# pattern: order:*
# events: [SET, DEL]
# status: active
# created_at: 2024-01-15T10:00:00Z
# deliveries: 1500
# failures: 3
# last_delivery: 2024-01-15T10:29:55Z
```

### Update Webhook

```bash
# Update URL
WEBHOOK.UPDATE order-updates URL https://new.example.com/webhook

# Update events
WEBHOOK.UPDATE order-updates EVENTS SET DEL EXPIRE

# Update pattern
WEBHOOK.UPDATE order-updates PATTERN 'order:v2:*'
```

### Delete Webhook

```bash
WEBHOOK.DELETE order-updates
```

### Enable/Disable

```bash
# Disable temporarily
WEBHOOK.DISABLE order-updates

# Re-enable
WEBHOOK.ENABLE order-updates
```

## Testing Webhooks

### Send Test Event

```bash
WEBHOOK.TEST order-updates
# Sends test payload to configured URL
# Returns: success or error details
```

### Verify Delivery

```bash
WEBHOOK.DELIVERIES order-updates COUNT 10
# Returns recent delivery attempts with status
```

## Configuration

```toml
[webhooks]
enabled = true
max_webhooks = 1000
max_batch_size = 100
batch_interval_ms = 1000

[webhooks.delivery]
timeout_ms = 5000
max_retries = 3
retry_delay_ms = 1000
backoff_multiplier = 2.0
max_retry_delay_ms = 60000

[webhooks.queue]
max_pending = 10000
persistence = true

[webhooks.security]
verify_ssl = true
allowed_hosts = []  # Empty = all allowed
```

## Rust API

```rust
use ferrite::webhooks::{WebhookManager, WebhookConfig, WebhookEvent};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manager = WebhookManager::new(WebhookConfig::default());

    // Create webhook
    manager.create(
        "order-updates",
        "https://api.example.com/webhook",
        WebhookOptions {
            pattern: Some("order:*".to_string()),
            events: vec![WebhookEvent::Set, WebhookEvent::Del],
            auth: Some(WebhookAuth::Bearer("token123".to_string())),
            retries: 3,
            ..Default::default()
        }
    ).await?;

    // Trigger webhook (called internally by Ferrite)
    manager.trigger(WebhookTrigger {
        event: WebhookEvent::Set,
        key: "order:123".to_string(),
        value: Some(b"order data".to_vec()),
        ..Default::default()
    }).await?;

    // Get statistics
    let stats = manager.stats("order-updates")?;
    println!("Deliveries: {}, Failures: {}", stats.deliveries, stats.failures);

    Ok(())
}
```

## Delivery Guarantees

### At-Least-Once Delivery

Webhooks are retried until successful or max retries reached:

```toml
[webhooks.delivery]
max_retries = 5
retry_delay_ms = 1000
backoff_multiplier = 2.0  # 1s, 2s, 4s, 8s, 16s
```

### Idempotency

Include event ID in your handler for deduplication:

```javascript
app.post('/webhook', (req, res) => {
  const eventId = req.body.id;

  // Check if already processed
  if (await isProcessed(eventId)) {
    return res.status(200).send('OK');
  }

  // Process event
  await processEvent(req.body);
  await markProcessed(eventId);

  res.status(200).send('OK');
});
```

### Ordering

Events are delivered in order per key, but may arrive out of order across keys. Use timestamps for ordering:

```javascript
const events = await receiveEvents();
events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
```

## Signature Verification

Ferrite signs webhook payloads for security:

```bash
WEBHOOK.CREATE secure https://api.example.com/hook SECRET mysecretkey
```

Verify the signature:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expected}`)
  );
}

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-ferrite-signature'];

  if (!verifySignature(req.body, signature, SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook...
});
```

## Use Cases

### Order Processing

```bash
WEBHOOK.CREATE order-created https://orders.example.com/new \
  PATTERN 'order:*' \
  EVENTS SET
```

```javascript
app.post('/new', async (req, res) => {
  const order = JSON.parse(req.body.data.value);
  await notifyWarehouse(order);
  await sendConfirmationEmail(order.customer_email);
  res.status(200).send('OK');
});
```

### Cache Invalidation

```bash
WEBHOOK.CREATE cache-invalidate https://cdn.example.com/purge \
  PATTERN 'content:*' \
  EVENTS SET DEL
```

### Real-time Notifications

```bash
WEBHOOK.CREATE live-updates https://websocket.example.com/push \
  PATTERN 'chat:*' \
  EVENTS SET LPUSH
```

### Audit Logging

```bash
WEBHOOK.CREATE audit-log https://audit.example.com/log \
  EVENTS SET DEL EXPIRE RENAME \
  BATCH true \
  BATCH_SIZE 100
```

## Monitoring

### Metrics

```bash
WEBHOOK.STATS
# Returns global webhook statistics:
# total_webhooks: 15
# active_webhooks: 14
# total_deliveries: 150000
# successful_deliveries: 149500
# failed_deliveries: 500
# pending_deliveries: 25
# avg_latency_ms: 150
```

### Alerts

Set up alerts for webhook failures:

```yaml
# prometheus rules
- alert: WebhookFailureRate
  expr: rate(ferrite_webhook_failures_total[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High webhook failure rate"
```

## Best Practices

1. **Respond quickly** - Return 200 within 5 seconds, process async
2. **Handle duplicates** - Implement idempotency using event IDs
3. **Verify signatures** - Always validate webhook signatures
4. **Use HTTPS** - Encrypt webhook traffic
5. **Monitor failures** - Alert on high failure rates
6. **Set timeouts** - Don't let slow endpoints block delivery
7. **Batch when possible** - Reduce HTTP overhead for high-volume events

## Next Steps

- [Triggers](/docs/event-driven/triggers) - Server-side event handlers
- [CDC](/docs/event-driven/cdc) - Change Data Capture to external systems
- [Streams](/docs/event-driven/streams) - Stream processing
