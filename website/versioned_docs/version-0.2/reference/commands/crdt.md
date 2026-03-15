---
sidebar_position: 25
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# CRDT Commands

Commands for Conflict-free Replicated Data Types.

## Overview

CRDT commands provide distributed data structures that automatically resolve conflicts in multi-master setups without coordination.

## Commands

### G-Counter (Grow-only Counter)

#### CRDT.GCOUNTER.INCR

Increment G-Counter.

```bash
CRDT.GCOUNTER.INCR key [increment]
```

**Examples:**
```bash
CRDT.GCOUNTER.INCR page_views
# (integer) 1

CRDT.GCOUNTER.INCR page_views 10
# (integer) 11
```

---

#### CRDT.GCOUNTER.GET

Get G-Counter value.

```bash
CRDT.GCOUNTER.GET key
```

**Examples:**
```bash
CRDT.GCOUNTER.GET page_views
# (integer) 11
```

---

### PN-Counter (Positive-Negative Counter)

#### CRDT.PNCOUNTER.INCR

Increment PN-Counter.

```bash
CRDT.PNCOUNTER.INCR key [increment]
```

**Examples:**
```bash
CRDT.PNCOUNTER.INCR balance 100
# (integer) 100
```

---

#### CRDT.PNCOUNTER.DECR

Decrement PN-Counter.

```bash
CRDT.PNCOUNTER.DECR key [decrement]
```

**Examples:**
```bash
CRDT.PNCOUNTER.DECR balance 30
# (integer) 70
```

---

#### CRDT.PNCOUNTER.GET

Get PN-Counter value.

```bash
CRDT.PNCOUNTER.GET key
```

---

### OR-Set (Observed-Remove Set)

#### CRDT.ORSET.ADD

Add element to OR-Set.

```bash
CRDT.ORSET.ADD key element [element ...]
```

**Examples:**
```bash
CRDT.ORSET.ADD cart:user:1 "item:laptop" "item:mouse"
# (integer) 2
```

---

#### CRDT.ORSET.REM

Remove element from OR-Set.

```bash
CRDT.ORSET.REM key element [element ...]
```

**Examples:**
```bash
CRDT.ORSET.REM cart:user:1 "item:mouse"
# (integer) 1
```

---

#### CRDT.ORSET.CONTAINS

Check if element exists.

```bash
CRDT.ORSET.CONTAINS key element
```

**Examples:**
```bash
CRDT.ORSET.CONTAINS cart:user:1 "item:laptop"
# (integer) 1
```

---

#### CRDT.ORSET.MEMBERS

Get all elements.

```bash
CRDT.ORSET.MEMBERS key
```

**Examples:**
```bash
CRDT.ORSET.MEMBERS cart:user:1
# 1) "item:laptop"
```

---

#### CRDT.ORSET.SIZE

Get set size.

```bash
CRDT.ORSET.SIZE key
```

---

### LWW-Register (Last-Writer-Wins Register)

#### CRDT.LWW.SET

Set value with timestamp.

```bash
CRDT.LWW.SET key value [TIMESTAMP ts]
```

**Examples:**
```bash
CRDT.LWW.SET user:1:email "alice@example.com"
# OK

CRDT.LWW.SET user:1:email "alice@new.com" TIMESTAMP 1705320000000
# OK
```

---

#### CRDT.LWW.GET

Get current value.

```bash
CRDT.LWW.GET key
```

**Examples:**
```bash
CRDT.LWW.GET user:1:email
# "alice@new.com"
```

---

#### CRDT.LWW.GETFULL

Get value with timestamp.

```bash
CRDT.LWW.GETFULL key
```

**Examples:**
```bash
CRDT.LWW.GETFULL user:1:email
# 1) "alice@new.com"
# 2) "1705320000000"
```

---

### MV-Register (Multi-Value Register)

#### CRDT.MV.SET

Set value (may create concurrent values).

```bash
CRDT.MV.SET key value
```

---

#### CRDT.MV.GET

Get all concurrent values.

```bash
CRDT.MV.GET key
```

**Examples:**
```bash
# After concurrent writes on different replicas
CRDT.MV.GET config:setting
# 1) "value_a"
# 2) "value_b"
```

---

#### CRDT.MV.RESOLVE

Resolve to single value.

```bash
CRDT.MV.RESOLVE key value
```

---

### OR-Map (Observed-Remove Map)

#### CRDT.ORMAP.SET

Set field in map.

```bash
CRDT.ORMAP.SET key field value
```

**Examples:**
```bash
CRDT.ORMAP.SET user:1 name "Alice"
CRDT.ORMAP.SET user:1 age "30"
```

---

#### CRDT.ORMAP.GET

Get field value.

```bash
CRDT.ORMAP.GET key field
```

---

#### CRDT.ORMAP.DEL

Delete field.

```bash
CRDT.ORMAP.DEL key field
```

---

#### CRDT.ORMAP.GETALL

Get all fields and values.

```bash
CRDT.ORMAP.GETALL key
```

---

#### CRDT.ORMAP.FIELDS

Get all field names.

```bash
CRDT.ORMAP.FIELDS key
```

---

### RGA (Replicated Growable Array)

#### CRDT.RGA.APPEND

Append element.

```bash
CRDT.RGA.APPEND key element
```

---

#### CRDT.RGA.PREPEND

Prepend element.

```bash
CRDT.RGA.PREPEND key element
```

---

#### CRDT.RGA.INSERT

Insert after position.

```bash
CRDT.RGA.INSERT key index element
```

---

#### CRDT.RGA.REMOVE

Remove at position.

```bash
CRDT.RGA.REMOVE key index
```

---

#### CRDT.RGA.GET

Get all elements.

```bash
CRDT.RGA.GET key
```

---

### Utility Commands

#### CRDT.TYPE

Get CRDT type.

```bash
CRDT.TYPE key
```

**Examples:**
```bash
CRDT.TYPE page_views
# "gcounter"

CRDT.TYPE cart:user:1
# "orset"
```

---

#### CRDT.STATE

Get internal CRDT state (for debugging/sync).

```bash
CRDT.STATE key
```

---

#### CRDT.MERGE

Merge states from replicas.

```bash
CRDT.MERGE key state
```

## Use Cases

### Distributed Counters

```bash
# Page views across multiple datacenters
# Each DC increments locally
CRDT.GCOUNTER.INCR page:home:views
CRDT.GCOUNTER.INCR page:home:views
CRDT.GCOUNTER.INCR page:home:views

# Get total (eventually consistent)
CRDT.GCOUNTER.GET page:home:views
# 3 (locally) - will merge with other DCs
```

### Shopping Cart

```bash
# User adds items on different devices/regions
# Device 1:
CRDT.ORSET.ADD cart:user:1 "product:laptop"

# Device 2 (concurrent):
CRDT.ORSET.ADD cart:user:1 "product:mouse"

# Both items appear after merge
CRDT.ORSET.MEMBERS cart:user:1
# 1) "product:laptop"
# 2) "product:mouse"

# Remove item
CRDT.ORSET.REM cart:user:1 "product:mouse"
```

### User Profile

```bash
# Update profile across regions
# Region A:
CRDT.ORMAP.SET profile:user:1 name "Alice Smith"
CRDT.ORMAP.SET profile:user:1 city "New York"

# Region B (concurrent):
CRDT.ORMAP.SET profile:user:1 email "alice@example.com"

# After merge, all fields present
CRDT.ORMAP.GETALL profile:user:1
```

### Inventory Management

```bash
# Track stock across warehouses
CRDT.PNCOUNTER.INCR stock:product:123 100  # Warehouse A receives
CRDT.PNCOUNTER.DECR stock:product:123 5    # Warehouse B ships

CRDT.PNCOUNTER.GET stock:product:123
# 95
```

### Collaborative Text (Simplified)

```bash
# Using RGA for collaborative document
CRDT.RGA.APPEND doc:1 "Hello"
CRDT.RGA.APPEND doc:1 " "
CRDT.RGA.APPEND doc:1 "World"

CRDT.RGA.GET doc:1
# ["Hello", " ", "World"]
```

## Rust API

```rust
use ferrite::Client;
use ferrite::crdt::{GCounter, PnCounter, OrSet, LwwRegister};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // G-Counter
    client.gcounter_incr("page_views", 1).await?;
    let views: i64 = client.gcounter_get("page_views").await?;

    // PN-Counter
    client.pncounter_incr("balance", 100).await?;
    client.pncounter_decr("balance", 30).await?;
    let balance: i64 = client.pncounter_get("balance").await?;

    // OR-Set
    client.orset_add("cart:1", &["item:a", "item:b"]).await?;
    client.orset_rem("cart:1", &["item:b"]).await?;
    let items: Vec<String> = client.orset_members("cart:1").await?;

    // LWW-Register
    client.lww_set("config", "value1", None).await?;
    let value: String = client.lww_get("config").await?;

    // OR-Map
    client.ormap_set("user:1", "name", "Alice").await?;
    client.ormap_set("user:1", "email", "alice@example.com").await?;
    let profile: HashMap<String, String> = client.ormap_getall("user:1").await?;

    Ok(())
}
```

## Configuration

```toml
[crdt]
enabled = true
sync_interval_ms = 1000
max_clock_drift_ms = 5000

[crdt.replication]
# Gossip-based sync between nodes
gossip_interval_ms = 100
gossip_fanout = 3
```

## Conflict Resolution

| CRDT Type | Resolution Strategy |
|-----------|---------------------|
| G-Counter | Sum of all increments |
| PN-Counter | Sum of increments - decrements |
| OR-Set | Add wins over remove (for same element) |
| LWW-Register | Highest timestamp wins |
| MV-Register | Preserve all concurrent values |
| OR-Map | Per-field OR-Set semantics |
| RGA | Interleave based on position + ID |

## Related Commands

- [Set Commands](/docs/reference/commands/sets) - Standard sets
- [Hash Commands](/docs/reference/commands/hashes) - Standard hashes
- [CRDT Guide](/docs/data-models/crdt) - Detailed guide
