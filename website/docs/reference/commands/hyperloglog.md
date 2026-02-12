---
sidebar_position: 7
maturity: stable
---

# HyperLogLog Commands

Commands for probabilistic cardinality estimation.

## Overview

HyperLogLog is a probabilistic data structure for counting unique elements. It uses very little memory (~12KB) regardless of the number of elements counted, with a standard error of 0.81%.

## Commands

### PFADD

Add elements to HyperLogLog.

```bash
PFADD key element [element ...]
```

**Time Complexity:** O(1) per element

**Returns:** 1 if the cardinality estimate changed, 0 otherwise.

**Examples:**
```bash
PFADD visitors "user1" "user2" "user3"
# 1

PFADD visitors "user1"
# 0 (already counted)

PFCOUNT visitors
# 3
```

---

### PFCOUNT

Get estimated cardinality.

```bash
PFCOUNT key [key ...]
```

**Time Complexity:** O(1) for single key, O(N) for multiple keys

**Returns:** Estimated number of unique elements.

**Examples:**
```bash
PFADD hll1 "a" "b" "c"
PFADD hll2 "c" "d" "e"

PFCOUNT hll1
# 3

PFCOUNT hll1 hll2
# 5 (union cardinality)
```

---

### PFMERGE

Merge multiple HyperLogLogs.

```bash
PFMERGE destkey sourcekey [sourcekey ...]
```

**Time Complexity:** O(N) where N is the number of keys

**Examples:**
```bash
PFADD hll1 "a" "b" "c"
PFADD hll2 "c" "d" "e"

PFMERGE merged hll1 hll2

PFCOUNT merged
# 5
```

## Use Cases

### Unique Visitors

```bash
# Track unique visitors per day
PFADD visitors:2024-01-15 "user1" "user2"
PFADD visitors:2024-01-15 "user1" "user3"  # user1 not counted again

# Get unique count
PFCOUNT visitors:2024-01-15
# 3

# Weekly unique visitors
PFMERGE visitors:week1 visitors:2024-01-15 visitors:2024-01-16 visitors:2024-01-17
PFCOUNT visitors:week1
```

### Unique Events

```bash
# Track unique event types per user
PFADD user:1:events "click" "scroll" "purchase"
PFADD user:1:events "click" "view"

PFCOUNT user:1:events
# 4
```

### IP Tracking

```bash
# Track unique IPs accessing an endpoint
PFADD api:/users:ips "192.168.1.1" "10.0.0.1" "192.168.1.2"

# Estimate unique IPs
PFCOUNT api:/users:ips
```

### Search Queries

```bash
# Track unique search queries
PFADD search:queries "how to" "redis tutorial" "hll algorithm"

# Get unique query count
PFCOUNT search:queries
```

## Memory Efficiency

```bash
# Standard set approach for 1 million unique items:
# ~40 MB (assuming 40 bytes per entry)

# HyperLogLog for same:
# ~12 KB (fixed size)

# Memory savings: 99.97%
```

## Accuracy

HyperLogLog provides estimates with:
- Standard error: 0.81%
- Memory usage: ~12 KB per key

For 1,000,000 unique elements:
- True count: 1,000,000
- HLL estimate: 991,900 - 1,008,100 (±0.81%)

## Rust API

```rust
use ferrite::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Add elements
    let changed: bool = client.pfadd("visitors", &["user1", "user2", "user3"]).await?;

    // Get cardinality
    let count: i64 = client.pfcount(&["visitors"]).await?;
    println!("Unique visitors: {}", count);

    // Merge HLLs
    client.pfadd("hll1", &["a", "b", "c"]).await?;
    client.pfadd("hll2", &["c", "d", "e"]).await?;
    client.pfmerge("merged", &["hll1", "hll2"]).await?;

    let union_count: i64 = client.pfcount(&["merged"]).await?;
    println!("Union cardinality: {}", union_count);

    Ok(())
}
```

## Comparison with Sets

| Feature | SET | HyperLogLog |
|---------|-----|-------------|
| Memory | O(N) | O(1) ~12KB |
| Add | O(1) | O(1) |
| Count | O(1) | O(1) |
| Accuracy | Exact | ~0.81% error |
| Get elements | Yes | No |
| Remove elements | Yes | No |

Use HyperLogLog when:
- You only need cardinality (count), not the actual elements
- Memory efficiency is important
- Approximate counts are acceptable

Use Sets when:
- You need exact counts
- You need to retrieve individual elements
- You need to check membership

## Related Commands

- [Set Commands](/docs/reference/commands/sets) - For exact unique counts
- [Bitmap Commands](/docs/reference/commands/bitmap) - For binary flags
- [CRDT Commands](/docs/reference/commands/crdt) - For distributed counting
