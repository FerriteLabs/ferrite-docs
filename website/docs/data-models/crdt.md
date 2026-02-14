---
sidebar_position: 5
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# CRDTs (Conflict-Free Replicated Data Types)

Ferrite includes built-in CRDTs for building distributed applications with automatic conflict resolution and eventual consistency.

## Overview

CRDTs (Conflict-Free Replicated Data Types) are data structures that can be replicated across multiple nodes and modified independently, with guaranteed eventual consistency without coordination.

Ferrite provides:
- **G-Counter** - Grow-only counter
- **PN-Counter** - Positive-negative counter (increment/decrement)
- **LWW-Register** - Last-writer-wins register
- **MV-Register** - Multi-value register (preserves concurrent writes)
- **OR-Set** - Observed-remove set (add-wins semantics)
- **LWW-Element-Set** - Last-writer-wins per-element set
- **OR-Map** - Observed-remove map

## Why CRDTs?

Traditional databases require coordination (locks, consensus) to handle concurrent writes. CRDTs allow:
- **No coordination** - Each replica can accept writes independently
- **Low latency** - No waiting for remote acknowledgment
- **Partition tolerance** - Continues working during network splits
- **Automatic merge** - Replicas converge to same state

## G-Counter (Grow-Only Counter)

A counter that can only be incremented, useful for tracking counts across distributed systems.

```bash
# Increment counter
CRDT.GCOUNTER INCR page_views 1
CRDT.GCOUNTER INCR page_views 5

# Get current value
CRDT.GCOUNTER GET page_views
# Returns: 6

# Get info
CRDT.GCOUNTER INFO page_views
# Returns: {"type": "GCounter", "value": 6, "sites": 1}

# Merge from another replica
CRDT.GCOUNTER MERGE page_views '{"site1": 10, "site2": 5}'
```

### Rust API

```rust
use ferrite::crdt::GCounter;

let mut counter = GCounter::new();

// Increment on this site
counter.increment("site1");
counter.increment("site1");

// Get total value
assert_eq!(counter.value(), 2);

// Merge from another replica
let mut remote = GCounter::new();
remote.increment("site2");
remote.increment("site2");

counter.merge(&remote);
assert_eq!(counter.value(), 4);
```

### Use Cases
- Page view counters
- Like counts
- Event tracking
- Distributed analytics

## PN-Counter (Positive-Negative Counter)

A counter that supports both increment and decrement operations.

```bash
# Increment
CRDT.PNCOUNTER INCR inventory:item123 10

# Decrement
CRDT.PNCOUNTER DECR inventory:item123 3

# Get value
CRDT.PNCOUNTER GET inventory:item123
# Returns: 7

# Info shows both positive and negative components
CRDT.PNCOUNTER INFO inventory:item123
```

### Rust API

```rust
use ferrite::crdt::PNCounter;

let mut counter = PNCounter::new();

// Increment
counter.increment("site1");
counter.increment("site1");

// Decrement
counter.decrement("site1");

assert_eq!(counter.value(), 1);

// Apply delta
counter.apply("site1", 5);   // +5
counter.apply("site1", -3);  // -3
assert_eq!(counter.value(), 3);
```

### Use Cases
- Inventory tracking
- Account balances
- Vote counts (upvote/downvote)
- Resource quotas

## LWW-Register (Last-Writer-Wins Register)

A register where the value with the highest timestamp wins.

```bash
# Set value (timestamp auto-generated)
CRDT.LWWREG SET user:123:name "Alice"

# Get value
CRDT.LWWREG GET user:123:name
# Returns: "Alice"

# Merge with remote state
CRDT.LWWREG MERGE user:123:name '{"value": "Bob", "timestamp": 1705312900000}'

# Value with higher timestamp wins
CRDT.LWWREG GET user:123:name
```

### Rust API

```rust
use ferrite::crdt::LwwRegister;

let mut register = LwwRegister::<String>::new();

// Set value
register.set("Alice".to_string(), 1000);

// Later write wins
register.set("Bob".to_string(), 2000);
assert_eq!(register.value(), Some(&"Bob".to_string()));

// Earlier write is ignored
register.set("Carol".to_string(), 1500);
assert_eq!(register.value(), Some(&"Bob".to_string()));

// Clear value
register.clear(3000);
assert_eq!(register.value(), None);
```

### Use Cases
- User profiles
- Settings/preferences
- Single-value configuration
- Status fields

## MV-Register (Multi-Value Register)

A register that preserves all concurrent writes, allowing application-level conflict resolution.

```bash
# Set value
CRDT.MVREG SET document:123:title "Draft v1"

# Concurrent writes from different sites create multiple values
# After merge, both values are preserved

CRDT.MVREG GET document:123:title
# Returns: ["Draft v1", "Draft v2"]  (if concurrent writes)
```

### Rust API

```rust
use ferrite::crdt::MvRegister;

let mut register = MvRegister::<String>::new();

// Set value on site1
register.set("Version A".to_string(), "site1");

// Concurrent write on site2
let mut remote = MvRegister::<String>::new();
remote.set("Version B".to_string(), "site2");

// After merge, both values are preserved
register.merge(&remote);

if register.has_conflict() {
    let values = register.values();
    // Application decides how to resolve: ["Version A", "Version B"]

    // Resolve conflict
    register.resolve("Merged Version".to_string(), "site1");
}
```

### Use Cases
- Collaborative editing
- Shopping carts
- Comment threads
- Any scenario where conflicts should be visible

## OR-Set (Observed-Remove Set)

A set with add-wins semantics - concurrent add and remove of same element results in the element being present.

```bash
# Add elements
CRDT.ORSET ADD user:123:tags "premium"
CRDT.ORSET ADD user:123:tags "verified"

# Remove element
CRDT.ORSET REMOVE user:123:tags "verified"

# Check membership
CRDT.ORSET CONTAINS user:123:tags "premium"
# Returns: 1 (true)

# List members
CRDT.ORSET MEMBERS user:123:tags
# Returns: ["premium"]

# Cardinality
CRDT.ORSET CARD user:123:tags
# Returns: 1
```

### Rust API

```rust
use ferrite::crdt::OrSet;

let mut set = OrSet::<String>::new();

// Add elements with unique tags
set.add("apple".to_string(), "site1");
set.add("banana".to_string(), "site1");

assert!(set.contains(&"apple".to_string()));

// Remove - only removes currently observed tags
set.remove(&"apple".to_string());
assert!(!set.contains(&"apple".to_string()));

// Concurrent add on another site
let mut remote = OrSet::new();
remote.add("apple".to_string(), "site2");

// Merge - add wins over remove from different sites
set.merge(&remote);
assert!(set.contains(&"apple".to_string())); // Re-added by site2
```

### Use Cases
- Tags and labels
- Group memberships
- Feature flags
- Distributed sets

## LWW-Element-Set

A set where each element has its own last-writer-wins timestamp, plus support for scores (like sorted sets).

```rust
use ferrite::crdt::LwwElementSet;

let mut set = LwwElementSet::<String>::new();

// Add with score
set.add("player1".to_string(), 100.0);
set.add("player2".to_string(), 150.0);

// Update score
set.add("player1".to_string(), 120.0);

// Get score
assert_eq!(set.score(&"player1".to_string()), Some(120.0));

// Get members by score
let leaderboard = set.members_by_score(true); // descending
// [("player2", 150.0), ("player1", 120.0)]

// Range by score
let top_players = set.range_by_score(100.0, 200.0);

// Remove (with timestamp)
set.remove("player1".to_string());
```

### Use Cases
- Leaderboards
- Priority queues
- Sorted collections
- Rankings

## OR-Map (Observed-Remove Map)

A map with add-wins semantics for field-level conflict resolution.

```rust
use ferrite::crdt::OrMap;

let mut map = OrMap::<String>::new();

// Set fields
map.set("name".to_string(), "Alice".to_string(), "site1");
map.set("email".to_string(), "alice@example.com".to_string(), "site1");

// Get field
assert_eq!(map.get(&"name".to_string()), Some(&"Alice".to_string()));

// Delete field
map.delete(&"email".to_string());

// Concurrent modification of same field
let mut remote = OrMap::new();
remote.set("name".to_string(), "Bob".to_string(), "site2");

// Merge - timestamp determines winner for each field
map.merge(&remote);
```

### Use Cases
- User profiles
- Document fields
- Configuration objects
- Nested structures

## Counter-Map

A map where each value is a PN-Counter.

```rust
use ferrite::crdt::CounterMap;

let mut map = CounterMap::new();

// Increment field
map.increment("likes".to_string(), "site1");
map.increment("likes".to_string(), "site1");
map.decrement("dislikes".to_string(), "site1");

// Get counter value
assert_eq!(map.get(&"likes".to_string()), 2);

// Get all entries
for (field, count) in map.entries() {
    println!("{}: {}", field, count);
}
```

### Use Cases
- Multi-field analytics
- Per-category counters
- Distributed voting systems

## Clock Types

### Hybrid Logical Clock

Ferrite uses hybrid logical clocks for ordering:

```rust
use ferrite::crdt::{HybridClock, HybridTimestamp};

let mut clock = HybridClock::new("site1");

// Generate timestamp
let ts1 = clock.now();

// Receive timestamp from remote (advances clock if needed)
let remote_ts = HybridTimestamp::now("site2");
clock.receive(&remote_ts);

// Next timestamp is guaranteed to be greater
let ts2 = clock.now();
assert!(ts2 > ts1);
assert!(ts2 > remote_ts);
```

### Vector Clock

For tracking causality:

```rust
use ferrite::crdt::VectorClock;

let mut clock = VectorClock::new();

// Increment local site
clock.increment("site1");

// Check ordering
let clock2 = VectorClock::new();
clock2.increment("site2");

if clock.concurrent(&clock2) {
    println!("Events are concurrent");
}

// Merge clocks
clock.merge(&clock2);
```

## Configuration

```toml
[crdt]
enabled = true
site_id = "datacenter-us-east-1"
mode = "async"  # or "sync"
sync_interval_ms = 1000
batch_size = 100
log_conflicts = false
```

### Replication Modes

| Mode | Description |
|------|-------------|
| `async` | Fire-and-forget replication (lower latency) |
| `sync` | Wait for peer acknowledgment (stronger consistency) |

## Best Practices

1. **Choose the right CRDT** - Match data structure to use case
2. **Use meaningful site IDs** - Include datacenter/region
3. **Handle conflicts** - MV-Register conflicts need resolution
4. **Monitor merge frequency** - High merge rates may indicate issues
5. **Batch sync operations** - Reduce network overhead
6. **Test partition scenarios** - Verify behavior during splits

## CRDT Selection Guide

| Use Case | Recommended CRDT |
|----------|-----------------|
| Page views, likes | G-Counter |
| Inventory, balance | PN-Counter |
| User profile fields | LWW-Register |
| Collaborative edits | MV-Register |
| Tags, memberships | OR-Set |
| Leaderboards | LWW-Element-Set |
| Document fields | OR-Map |

## Next Steps

- [Replication](/docs/advanced/replication) - Multi-region setup
- [Clustering](/docs/advanced/clustering) - Distributed deployment
- [Consistency Model](/docs/core-concepts/consistency-model) - Consistency guarantees
