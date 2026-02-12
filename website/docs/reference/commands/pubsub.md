---
sidebar_position: 10
maturity: stable
---

# Pub/Sub Commands

Commands for publish/subscribe messaging.

## Overview

Pub/Sub enables real-time message broadcasting. Publishers send messages to channels, and all subscribers to those channels receive them.

## Commands

### SUBSCRIBE

Subscribe to channels.

```bash
SUBSCRIBE channel [channel ...]
```

**Time Complexity:** O(N) where N is the number of channels

**Examples:**
```bash
SUBSCRIBE news weather sports
# Reading messages from: news weather sports

# Received messages format:
# 1) "message"
# 2) "news"
# 3) "Breaking: ..."
```

---

### UNSUBSCRIBE

Unsubscribe from channels.

```bash
UNSUBSCRIBE [channel [channel ...]]
```

**Time Complexity:** O(N)

**Examples:**
```bash
# Unsubscribe from specific channels
UNSUBSCRIBE news weather

# Unsubscribe from all
UNSUBSCRIBE
```

---

### PSUBSCRIBE

Subscribe using patterns.

```bash
PSUBSCRIBE pattern [pattern ...]
```

**Patterns:**
- `*` - Matches any sequence of characters
- `?` - Matches any single character
- `[...]` - Matches character class

**Time Complexity:** O(N)

**Examples:**
```bash
# Subscribe to all news channels
PSUBSCRIBE news.*

# Subscribe to user events
PSUBSCRIBE user:*:events

# Multiple patterns
PSUBSCRIBE news.* weather.* sports.*
```

---

### PUNSUBSCRIBE

Unsubscribe from patterns.

```bash
PUNSUBSCRIBE [pattern [pattern ...]]
```

**Time Complexity:** O(N)

---

### PUBLISH

Publish message to channel.

```bash
PUBLISH channel message
```

**Time Complexity:** O(N+M) where N is subscribers and M is pattern subscribers

**Returns:** Number of clients that received the message.

**Examples:**
```bash
PUBLISH news "Breaking: Major event occurred"
# 3

PUBLISH user:1000:notifications "You have a new message"
# 1
```

---

### PUBSUB

Introspection commands.

```bash
PUBSUB CHANNELS [pattern]
PUBSUB NUMSUB [channel [channel ...]]
PUBSUB NUMPAT
PUBSUB SHARDCHANNELS [pattern]
PUBSUB SHARDNUMSUB [channel [channel ...]]
```

**Examples:**
```bash
# List all active channels
PUBSUB CHANNELS
# 1) "news"
# 2) "weather"

# List channels matching pattern
PUBSUB CHANNELS news.*
# 1) "news.sports"
# 2) "news.tech"

# Count subscribers per channel
PUBSUB NUMSUB news weather
# 1) "news"
# 2) "5"
# 3) "weather"
# 4) "2"

# Count pattern subscriptions
PUBSUB NUMPAT
# 3
```

---

### SSUBSCRIBE

Subscribe to sharded channels (cluster mode).

```bash
SSUBSCRIBE channel [channel ...]
```

**Time Complexity:** O(N)

---

### SUNSUBSCRIBE

Unsubscribe from sharded channels.

```bash
SUNSUBSCRIBE [channel [channel ...]]
```

---

### SPUBLISH

Publish to sharded channel.

```bash
SPUBLISH channel message
```

**Time Complexity:** O(N)

## Use Cases

### Real-Time Notifications

```bash
# Publisher (backend)
PUBLISH user:1000:notifications '{"type":"message","from":"user:2000"}'

# Subscriber (client)
SUBSCRIBE user:1000:notifications
# Receives: {"type":"message","from":"user:2000"}
```

### Chat Application

```bash
# Join chat room
SUBSCRIBE room:general room:tech

# Send message
PUBLISH room:general '{"user":"alice","text":"Hello everyone!"}'

# Private messages
PUBLISH user:1000:dm '{"from":"bob","text":"Hey!"}'
```

### Event Broadcasting

```bash
# Subscribe to events
PSUBSCRIBE events.*

# Publish events
PUBLISH events.user.login '{"user_id":1000,"ip":"192.168.1.1"}'
PUBLISH events.order.created '{"order_id":"12345","amount":99.99}'
PUBLISH events.payment.completed '{"order_id":"12345"}'
```

### Live Updates

```bash
# Client subscribes to updates
PSUBSCRIBE updates:product:*

# Backend publishes changes
PUBLISH updates:product:sku123 '{"price":29.99,"stock":50}'
```

### Cache Invalidation

```bash
# Cache nodes subscribe
SUBSCRIBE cache:invalidate

# When data changes
PUBLISH cache:invalidate '{"key":"user:1000","action":"delete"}'

# All cache nodes receive and invalidate
```

### System Monitoring

```bash
# Subscribe to system events
PSUBSCRIBE system.*

# Publish metrics
PUBLISH system.cpu '{"usage":75.5,"server":"web1"}'
PUBLISH system.memory '{"used":8.5,"total":16,"server":"web1"}'
PUBLISH system.alert '{"level":"warning","message":"High CPU"}'
```

## Message Format

```
# Subscription confirmation
1) "subscribe"
2) "channel_name"
3) (integer) subscription_count

# Message received
1) "message"
2) "channel_name"
3) "message_content"

# Pattern message received
1) "pmessage"
2) "pattern"
3) "channel_name"
4) "message_content"

# Unsubscribe confirmation
1) "unsubscribe"
2) "channel_name"
3) (integer) remaining_subscriptions
```

## Rust API

```rust
use ferrite::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Publisher
    let recipients = client.publish("news", "Breaking news!").await?;
    println!("Message sent to {} subscribers", recipients);

    // Subscriber
    let mut pubsub = client.subscribe(&["news", "weather"]).await?;

    while let Some(msg) = pubsub.next_message().await? {
        println!("Channel: {}, Message: {}", msg.channel, msg.payload);
    }

    // Pattern subscriber
    let mut pubsub = client.psubscribe(&["events.*"]).await?;

    while let Some(msg) = pubsub.next_message().await? {
        println!(
            "Pattern: {}, Channel: {}, Message: {}",
            msg.pattern, msg.channel, msg.payload
        );
    }

    // Introspection
    let channels = client.pubsub_channels("*").await?;
    let numsub = client.pubsub_numsub(&["news"]).await?;

    Ok(())
}
```

## Async Subscriber Pattern

```rust
use ferrite::Client;
use tokio::select;

async fn subscribe_with_timeout() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;
    let mut pubsub = client.subscribe(&["events"]).await?;

    loop {
        select! {
            msg = pubsub.next_message() => {
                match msg? {
                    Some(message) => {
                        println!("Received: {}", message.payload);
                    }
                    None => break,
                }
            }
            _ = tokio::time::sleep(Duration::from_secs(30)) => {
                println!("No message for 30 seconds");
            }
        }
    }

    Ok(())
}
```

## Considerations

### Reliability
- Messages are fire-and-forget
- No persistence - subscribers must be connected
- Consider Streams for guaranteed delivery

### Scalability
- Each message goes to all subscribers
- Pattern matching adds overhead
- Use sharded pub/sub in cluster mode for scaling

### Best Practices
1. Keep messages small
2. Use structured formats (JSON)
3. Handle reconnection in clients
4. Use patterns sparingly (performance impact)
5. Consider Streams for message history

## Related Commands

- [Stream Commands](/docs/reference/commands/streams) - For persistent messaging
- [List Commands](/docs/reference/commands/lists) - For simple queues
- [CDC Commands](/docs/reference/commands/cdc) - For data change events
