---
sidebar_position: 6
maturity: beta
---

# Stream Commands

Commands for managing Redis Streams - append-only log data structures.

## Overview

Streams are append-only logs that support consumer groups, making them ideal for event streaming and message queues.

## Commands

### XADD

Append entry to stream.

```bash
XADD key [NOMKSTREAM] [MAXLEN | MINID [= | ~] threshold] [LIMIT count] * | id field value [field value ...]
```

**Options:**
- `NOMKSTREAM` - Don't create stream if it doesn't exist
- `MAXLEN` - Trim stream by count
- `MINID` - Trim stream by minimum ID
- `~` - Approximate trimming (faster)
- `*` - Auto-generate ID

**Time Complexity:** O(1) for adding, O(N) for trimming

**Examples:**
```bash
XADD mystream * name "John" action "login"
# "1705320000000-0"

XADD mystream * name "Jane" action "purchase"
# "1705320000001-0"

XADD mystream MAXLEN ~ 1000 * event "click"
# "1705320000002-0"
```

---

### XREAD

Read entries from streams.

```bash
XREAD [COUNT count] [BLOCK milliseconds] STREAMS key [key ...] id [id ...]
```

**Time Complexity:** O(N) with N being the number of entries

**Examples:**
```bash
# Read new entries
XREAD COUNT 2 STREAMS mystream 0

# Blocking read
XREAD BLOCK 5000 STREAMS mystream $

# Read from multiple streams
XREAD STREAMS stream1 stream2 0 0
```

---

### XREADGROUP

Read entries as part of consumer group.

```bash
XREADGROUP GROUP group consumer [COUNT count] [BLOCK milliseconds] [NOACK] STREAMS key [key ...] id [id ...]
```

**Examples:**
```bash
# Create consumer group first
XGROUP CREATE mystream mygroup $ MKSTREAM

# Read as consumer
XREADGROUP GROUP mygroup consumer1 COUNT 10 STREAMS mystream >

# Blocking read
XREADGROUP GROUP mygroup consumer1 BLOCK 5000 STREAMS mystream >
```

---

### XRANGE

Get entries in ID range.

```bash
XRANGE key start end [COUNT count]
```

**Time Complexity:** O(N) with N being the number of entries

**Examples:**
```bash
# Get all entries
XRANGE mystream - +

# Get specific range
XRANGE mystream 1705320000000 1705320001000

# Limit results
XRANGE mystream - + COUNT 10
```

---

### XREVRANGE

Get entries in reverse ID order.

```bash
XREVRANGE key end start [COUNT count]
```

**Examples:**
```bash
# Get last 10 entries
XREVRANGE mystream + - COUNT 10
```

---

### XLEN

Get stream length.

```bash
XLEN key
```

**Time Complexity:** O(1)

---

### XINFO

Get stream information.

```bash
XINFO STREAM key [FULL [COUNT count]]
XINFO GROUPS key
XINFO CONSUMERS key group
```

**Examples:**
```bash
XINFO STREAM mystream
# Returns stream metadata

XINFO GROUPS mystream
# Returns consumer groups

XINFO CONSUMERS mystream mygroup
# Returns consumers in group
```

---

### XGROUP

Manage consumer groups.

```bash
XGROUP CREATE key group id [MKSTREAM] [ENTRIESREAD n]
XGROUP DESTROY key group
XGROUP CREATECONSUMER key group consumer
XGROUP DELCONSUMER key group consumer
XGROUP SETID key group id [ENTRIESREAD n]
```

**Examples:**
```bash
# Create group starting from beginning
XGROUP CREATE mystream mygroup 0 MKSTREAM

# Create group starting from new entries only
XGROUP CREATE mystream mygroup $ MKSTREAM

# Delete group
XGROUP DESTROY mystream mygroup

# Set last delivered ID
XGROUP SETID mystream mygroup 1705320000000-0
```

---

### XACK

Acknowledge entries.

```bash
XACK key group id [id ...]
```

**Time Complexity:** O(1) per ID

**Examples:**
```bash
XACK mystream mygroup 1705320000000-0 1705320000001-0
# 2
```

---

### XCLAIM

Claim pending entries.

```bash
XCLAIM key group consumer min-idle-time id [id ...] [IDLE ms] [TIME unix-time-ms] [RETRYCOUNT count] [FORCE] [JUSTID]
```

**Time Complexity:** O(N)

**Examples:**
```bash
# Claim entries idle for 60 seconds
XCLAIM mystream mygroup consumer2 60000 1705320000000-0

# Claim and reset idle time
XCLAIM mystream mygroup consumer2 60000 1705320000000-0 IDLE 0
```

---

### XAUTOCLAIM

Automatically claim idle entries.

```bash
XAUTOCLAIM key group consumer min-idle-time start [COUNT count] [JUSTID]
```

**Time Complexity:** O(1)

**Examples:**
```bash
# Claim up to 10 entries idle for 60 seconds
XAUTOCLAIM mystream mygroup consumer2 60000 0-0 COUNT 10
```

---

### XPENDING

Get pending entries information.

```bash
XPENDING key group [[IDLE min-idle-time] start end count [consumer]]
```

**Examples:**
```bash
# Get summary
XPENDING mystream mygroup

# Get detailed list
XPENDING mystream mygroup - + 10

# Get for specific consumer
XPENDING mystream mygroup - + 10 consumer1

# Get only entries idle for 60 seconds
XPENDING mystream mygroup IDLE 60000 - + 10
```

---

### XTRIM

Trim stream.

```bash
XTRIM key MAXLEN | MINID [= | ~] threshold [LIMIT count]
```

**Time Complexity:** O(N)

**Examples:**
```bash
# Trim to 1000 entries
XTRIM mystream MAXLEN 1000

# Approximate trim (faster)
XTRIM mystream MAXLEN ~ 1000

# Trim entries older than ID
XTRIM mystream MINID 1705320000000-0
```

---

### XDEL

Delete specific entries.

```bash
XDEL key id [id ...]
```

**Time Complexity:** O(1) per ID

---

### XSETID

Set stream last ID.

```bash
XSETID key last-id [ENTRIESADDED entries-added] [MAXDELETEDID max-deleted-id]
```

## Use Cases

### Event Sourcing

```bash
# Log events
XADD orders * order_id "12345" action "created" amount "99.99"
XADD orders * order_id "12345" action "paid"
XADD orders * order_id "12345" action "shipped"

# Replay events
XRANGE orders - +
```

### Message Queue

```bash
# Producer
XADD tasks * type "email" to "user@example.com" subject "Welcome"

# Consumer group
XGROUP CREATE tasks workers 0 MKSTREAM

# Worker 1
XREADGROUP GROUP workers worker1 BLOCK 5000 STREAMS tasks >

# Acknowledge processing
XACK tasks workers <message-id>
```

### Real-Time Feed

```bash
# Add to feed
XADD user:1:feed MAXLEN ~ 1000 * post_id "abc" content "Hello!"

# Read feed
XRANGE user:1:feed - + COUNT 20

# Real-time updates
XREAD BLOCK 0 STREAMS user:1:feed $
```

### Activity Log

```bash
# Log activity
XADD activity:user:1 * action "login" ip "192.168.1.1"
XADD activity:user:1 * action "view_page" page "/products"

# Get recent activity
XREVRANGE activity:user:1 + - COUNT 50
```

### Distributed Task Queue

```bash
# Create stream and consumer group
XGROUP CREATE job_queue processors 0 MKSTREAM

# Producer adds jobs
XADD job_queue * job_type "image_resize" image_id "12345"

# Multiple workers process
# Worker 1:
XREADGROUP GROUP processors worker1 COUNT 1 BLOCK 5000 STREAMS job_queue >

# Worker 2:
XREADGROUP GROUP processors worker2 COUNT 1 BLOCK 5000 STREAMS job_queue >

# Handle failed jobs
XAUTOCLAIM job_queue processors worker3 300000 0-0 COUNT 10
```

## Rust API

```rust
use ferrite::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Add entry
    let id = client.xadd("mystream", "*", &[
        ("name", "John"),
        ("action", "login"),
    ]).await?;

    // Add with max length
    let id = client.xadd_maxlen("mystream", 1000, "*", &[
        ("event", "click"),
    ]).await?;

    // Read entries
    let entries = client.xrange("mystream", "-", "+").await?;

    // Create consumer group
    client.xgroup_create("mystream", "mygroup", "$", true).await?;

    // Read as consumer
    let messages = client.xreadgroup(
        "mygroup",
        "consumer1",
        &["mystream"],
        &[">"],
        Some(10),
        Some(5000),
    ).await?;

    // Acknowledge
    for msg in &messages {
        client.xack("mystream", "mygroup", &[&msg.id]).await?;
    }

    // Get stream info
    let info = client.xinfo_stream("mystream").await?;
    println!("Length: {}", info.length);

    Ok(())
}
```

## Related Commands

- [Pub/Sub Commands](/docs/reference/commands/pubsub) - For broadcast messaging
- [List Commands](/docs/reference/commands/lists) - Simple queues
- [CDC Commands](/docs/reference/commands/cdc) - Change Data Capture
