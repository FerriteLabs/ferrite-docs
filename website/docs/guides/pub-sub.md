---
maturity: stable
---

# Pub/Sub Messaging

Ferrite provides Redis-compatible Pub/Sub (Publish/Subscribe) messaging for building real-time applications. Messages are delivered to all subscribers instantly with at-most-once semantics.

## Overview

Pub/Sub enables real-time communication between publishers and subscribers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Pub/Sub Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Publishers                         Subscribers            │
│  ┌──────────┐                       ┌──────────┐           │
│  │ Service A├───┐               ┌───┤ Client 1 │           │
│  └──────────┘   │               │   └──────────┘           │
│  ┌──────────┐   │  ┌─────────┐  │   ┌──────────┐           │
│  │ Service B├───┼──┤ Channel ├──┼───┤ Client 2 │           │
│  └──────────┘   │  └─────────┘  │   └──────────┘           │
│  ┌──────────┐   │               │   ┌──────────┐           │
│  │ Service C├───┘               └───┤ Client 3 │           │
│  └──────────┘                       └──────────┘           │
│                                                             │
│   - Fire and forget                 - Real-time delivery   │
│   - No persistence                  - No message history   │
│   - High throughput                 - Pattern matching     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Publishing Messages

```bash
# Connect to Ferrite
ferrite-cli

# Publish to a channel
PUBLISH notifications "New user signed up!"
# Returns: (integer) 3  # Number of subscribers who received it

# Publish JSON
PUBLISH events '{"type":"order","id":"12345","status":"completed"}'
```

### Subscribing to Channels

```bash
# Subscribe to specific channels
SUBSCRIBE notifications events alerts

# Receive messages (blocking)
# 1) "subscribe"
# 2) "notifications"
# 3) (integer) 1

# When a message arrives:
# 1) "message"
# 2) "notifications"
# 3) "New user signed up!"
```

### Pattern Subscriptions

```bash
# Subscribe to all channels matching a pattern
PSUBSCRIBE events:*
# Matches: events:user, events:order, events:payment

PSUBSCRIBE user:*:notifications
# Matches: user:123:notifications, user:456:notifications
```

## Rust Usage

### Publisher

```rust
use ferrite::Client;

let client = Client::connect("localhost:6380").await?;

// Publish message
let subscribers = client.publish("notifications", "Hello World!").await?;
println!("Message sent to {} subscribers", subscribers);

// Publish structured data
#[derive(Serialize)]
struct Event {
    event_type: String,
    data: serde_json::Value,
    timestamp: i64,
}

let event = Event {
    event_type: "user_signup".to_string(),
    data: json!({ "user_id": "123", "email": "user@example.com" }),
    timestamp: chrono::Utc::now().timestamp(),
};

client.publish("events", serde_json::to_string(&event)?).await?;
```

### Subscriber

```rust
use ferrite::Client;
use futures::StreamExt;

let client = Client::connect("localhost:6380").await?;
let mut pubsub = client.subscribe(&["notifications", "alerts"]).await?;

// Process messages
while let Some(msg) = pubsub.next().await {
    match msg {
        Ok(message) => {
            println!("Channel: {}", message.channel);
            println!("Payload: {}", message.payload);
        }
        Err(e) => eprintln!("Error: {}", e),
    }
}
```

### Pattern Subscriber

```rust
let mut pubsub = client.psubscribe(&["events:*", "user:*:activity"]).await?;

while let Some(msg) = pubsub.next().await {
    let message = msg?;
    println!("Pattern: {:?}", message.pattern);
    println!("Channel: {}", message.channel);
    println!("Payload: {}", message.payload);
}
```

### Non-Blocking with Tokio

```rust
use tokio::select;

let mut pubsub = client.subscribe(&["events"]).await?;
let mut shutdown = tokio::signal::ctrl_c();

loop {
    select! {
        msg = pubsub.next() => {
            if let Some(Ok(message)) = msg {
                process_message(message).await?;
            }
        }
        _ = &mut shutdown => {
            println!("Shutting down...");
            break;
        }
    }
}
```

## Python Usage

### Publisher

```python
from ferrite import Ferrite

client = Ferrite(host="localhost", port=6380)

# Publish message
subscribers = client.publish("notifications", "Hello World!")
print(f"Message sent to {subscribers} subscribers")

# Publish JSON
import json

event = {
    "type": "user_signup",
    "data": {"user_id": "123"},
    "timestamp": time.time()
}
client.publish("events", json.dumps(event))
```

### Subscriber

```python
from ferrite import Ferrite

client = Ferrite(host="localhost", port=6380)
pubsub = client.pubsub()

# Subscribe to channels
pubsub.subscribe("notifications", "alerts")

# Process messages
for message in pubsub.listen():
    if message["type"] == "message":
        print(f"Channel: {message['channel']}")
        print(f"Data: {message['data']}")
```

### Pattern Subscriber

```python
pubsub = client.pubsub()
pubsub.psubscribe("events:*")

for message in pubsub.listen():
    if message["type"] == "pmessage":
        print(f"Pattern: {message['pattern']}")
        print(f"Channel: {message['channel']}")
        print(f"Data: {message['data']}")
```

### Async Subscriber

```python
import asyncio
from ferrite import AsyncFerrite

async def subscriber():
    client = await AsyncFerrite.connect(host="localhost", port=6380)
    pubsub = client.pubsub()

    await pubsub.subscribe("events")

    async for message in pubsub.listen():
        print(f"Received: {message}")

asyncio.run(subscriber())
```

## TypeScript Usage

### Publisher

```typescript
import { Ferrite } from "@ferrite/client";

const client = new Ferrite({ host: "localhost", port: 6380 });
await client.connect();

// Publish message
const subscribers = await client.publish("notifications", "Hello World!");
console.log(`Message sent to ${subscribers} subscribers`);

// Publish JSON
const event = {
  type: "user_signup",
  data: { userId: "123" },
  timestamp: Date.now(),
};
await client.publish("events", JSON.stringify(event));
```

### Subscriber

```typescript
const pubsub = client.pubsub();

// Subscribe to channels
await pubsub.subscribe("notifications", "alerts");

// Event-based handling
pubsub.on("message", (channel, message) => {
  console.log(`Channel ${channel}: ${message}`);
});

// Or async iterator
for await (const message of pubsub) {
  if (message.type === "message") {
    console.log(`${message.channel}: ${message.data}`);
  }
}
```

## Common Patterns

### Chat Application

```rust
// Chat room structure
// Channels: chat:room:{room_id}

async fn join_room(client: &Client, user_id: &str, room_id: &str) -> Result<()> {
    // Subscribe to room channel
    let channel = format!("chat:room:{}", room_id);
    let mut pubsub = client.subscribe(&[&channel]).await?;

    // Announce join
    client.publish(&channel, json!({
        "type": "user_joined",
        "user_id": user_id,
        "timestamp": Utc::now().timestamp()
    }).to_string()).await?;

    // Listen for messages
    while let Some(msg) = pubsub.next().await {
        let message = msg?;
        let event: ChatEvent = serde_json::from_str(&message.payload)?;
        handle_chat_event(event).await?;
    }

    Ok(())
}

async fn send_message(client: &Client, room_id: &str, user_id: &str, text: &str) {
    let channel = format!("chat:room:{}", room_id);
    client.publish(&channel, json!({
        "type": "message",
        "user_id": user_id,
        "text": text,
        "timestamp": Utc::now().timestamp()
    }).to_string()).await?;
}
```

### Real-Time Notifications

```rust
// Per-user notification channels
// Channels: notifications:user:{user_id}

struct NotificationService {
    client: Client,
}

impl NotificationService {
    // Send notification to specific user
    async fn notify_user(&self, user_id: &str, notification: &Notification) {
        let channel = format!("notifications:user:{}", user_id);
        self.client.publish(&channel, notification.to_json()).await?;
    }

    // Broadcast to all users
    async fn broadcast(&self, notification: &Notification) {
        self.client.publish("notifications:broadcast", notification.to_json()).await?;
    }

    // Subscribe to user's notifications
    async fn subscribe_user(&self, user_id: &str) -> impl Stream<Item = Notification> {
        let channels = vec![
            format!("notifications:user:{}", user_id),
            "notifications:broadcast".to_string(),
        ];
        self.client.subscribe(&channels).await?
    }
}
```

### Event Bus

```rust
// Microservices event bus
// Channels: events:{service}:{event_type}

struct EventBus {
    client: Client,
    service_name: String,
}

impl EventBus {
    // Emit event
    async fn emit(&self, event_type: &str, payload: Value) {
        let channel = format!("events:{}:{}", self.service_name, event_type);
        let event = json!({
            "source": self.service_name,
            "type": event_type,
            "payload": payload,
            "timestamp": Utc::now().timestamp_millis(),
            "id": Uuid::new_v4().to_string(),
        });
        self.client.publish(&channel, event.to_string()).await?;
    }

    // Subscribe to events from specific service
    async fn subscribe_service(&self, service: &str) -> PubSub {
        let pattern = format!("events:{}:*", service);
        self.client.psubscribe(&[&pattern]).await?
    }

    // Subscribe to specific event type from all services
    async fn subscribe_event(&self, event_type: &str) -> PubSub {
        let pattern = format!("events:*:{}", event_type);
        self.client.psubscribe(&[&pattern]).await?
    }
}

// Usage
let bus = EventBus::new(client, "order-service");

// Emit event
bus.emit("order_created", json!({
    "order_id": "12345",
    "customer_id": "67890",
    "total": 99.99
})).await?;

// Subscribe to all payment events
let mut sub = bus.subscribe_event("payment_*").await?;
while let Some(msg) = sub.next().await {
    handle_payment_event(msg?).await?;
}
```

### Live Dashboard Updates

```rust
// Real-time metrics dashboard
// Channels: metrics:{metric_type}

struct MetricsPublisher {
    client: Client,
}

impl MetricsPublisher {
    async fn publish_metrics(&self) {
        loop {
            // Collect metrics
            let cpu = get_cpu_usage();
            let memory = get_memory_usage();
            let requests = get_request_count();

            // Publish each metric type
            self.client.publish("metrics:cpu", cpu.to_string()).await?;
            self.client.publish("metrics:memory", memory.to_string()).await?;
            self.client.publish("metrics:requests", requests.to_string()).await?;

            // Also publish combined snapshot
            self.client.publish("metrics:snapshot", json!({
                "cpu": cpu,
                "memory": memory,
                "requests": requests,
                "timestamp": Utc::now().timestamp()
            }).to_string()).await?;

            tokio::time::sleep(Duration::from_secs(1)).await;
        }
    }
}

// Dashboard subscriber
async fn dashboard_subscriber(client: Client) {
    let mut pubsub = client.psubscribe(&["metrics:*"]).await?;

    while let Some(msg) = pubsub.next().await {
        let message = msg?;
        update_dashboard(&message.channel, &message.payload);
    }
}
```

## Advanced Features

### Sharded Pub/Sub (Cluster Mode)

```bash
# Publish to sharded channel (more scalable)
SPUBLISH notifications "message"

# Subscribe to sharded channel
SSUBSCRIBE notifications
```

```rust
// Sharded pub/sub for better cluster performance
let subscribers = client.spublish("notifications", "message").await?;

let mut pubsub = client.ssubscribe(&["notifications"]).await?;
```

### Client-Side Filtering

```rust
// Subscribe to broad pattern, filter client-side
let mut pubsub = client.psubscribe(&["events:*"]).await?;

while let Some(msg) = pubsub.next().await {
    let message = msg?;

    // Parse and filter
    let event: Event = serde_json::from_str(&message.payload)?;

    if event.priority == Priority::High {
        handle_high_priority(event).await?;
    }
}
```

### Pub/Sub with Redis Streams Hybrid

```rust
// Use Pub/Sub for real-time + Streams for persistence
struct HybridMessaging {
    client: Client,
}

impl HybridMessaging {
    async fn publish(&self, channel: &str, message: &str) {
        // Publish for real-time subscribers
        self.client.publish(channel, message).await?;

        // Also add to stream for persistence
        let stream_key = format!("stream:{}", channel);
        self.client.xadd(&stream_key, "*", &[("data", message)]).await?;
    }

    // Real-time subscriber
    async fn subscribe_realtime(&self, channel: &str) -> PubSub {
        self.client.subscribe(&[channel]).await?
    }

    // Historical subscriber (gets missed messages)
    async fn subscribe_with_history(&self, channel: &str, since: &str) -> Vec<Message> {
        let stream_key = format!("stream:{}", channel);

        // Get historical messages
        let messages = self.client.xrange(&stream_key, since, "+").await?;

        // Then subscribe for real-time
        let pubsub = self.client.subscribe(&[channel]).await?;

        // Return both
        (messages, pubsub)
    }
}
```

## Best Practices

### 1. Use Specific Channel Names

```rust
// Bad - too broad
client.publish("events", message).await?;

// Good - specific and hierarchical
client.publish("events:orders:created", message).await?;
client.publish("events:users:updated", message).await?;
```

### 2. Handle Reconnection

```rust
loop {
    let mut pubsub = match client.subscribe(&channels).await {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Subscribe failed: {}", e);
            tokio::time::sleep(Duration::from_secs(1)).await;
            continue;
        }
    };

    while let Some(msg) = pubsub.next().await {
        match msg {
            Ok(message) => process_message(message).await,
            Err(e) => {
                eprintln!("Connection lost: {}", e);
                break; // Reconnect
            }
        }
    }
}
```

### 3. Keep Messages Small

```rust
// Bad - large message
client.publish("files", large_binary_data).await?;

// Good - reference to data
client.publish("files", json!({
    "file_id": "abc123",
    "storage_key": "s3://bucket/key",
    "size": 1048576
}).to_string()).await?;
```

### 4. Monitor Subscriber Count

```rust
let subscribers = client.publish("notifications", message).await?;

if subscribers == 0 {
    tracing::warn!("No subscribers for notifications channel");
    // Maybe queue the message for later
    client.lpush("notifications:queue", message).await?;
}
```

## Limitations

- **No persistence** - Messages are not stored; if no subscriber is connected, messages are lost
- **At-most-once delivery** - Messages may be dropped on network issues
- **No acknowledgment** - Publishers don't know if message was processed
- **No replay** - Subscribers can't get historical messages

For guaranteed delivery, consider using [Streams](/docs/event-driven/streams) instead.

## Related Topics

- [Streams](/docs/event-driven/streams) - Persistent message streaming
- [CDC](/docs/event-driven/cdc) - Change data capture
- [Triggers](/docs/event-driven/triggers) - Event-driven triggers
- [Triggers](/docs/event-driven/triggers) - Event-driven automation
