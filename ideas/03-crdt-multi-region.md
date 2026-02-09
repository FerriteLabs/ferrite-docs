# CRDT-Native Multi-Region

## Executive Summary

Built-in Conflict-free Replicated Data Types (CRDTs) for geo-distributed deployments without coordination overhead. Enables true multi-master replication with automatic conflict resolution.

**Status**: Proposal
**Priority**: High
**Estimated Effort**: 3-4 months
**Target Release**: v0.6.0

---

## Problem Statement

### The Multi-Region Challenge

Modern applications require global deployment:
- Users expect low latency regardless of location
- Regulations require data to stay in region (GDPR, data sovereignty)
- Business continuity requires disaster recovery across regions

### Current Solutions Are Painful

| Solution | Problem |
|----------|---------|
| **Redis Cluster** | Single-region only. Cross-region = high latency |
| **Redis Enterprise Active-Active** | Expensive ($$$), proprietary CRDT implementation |
| **Application-level sync** | Complex, error-prone, inconsistent |
| **Read replicas** | Writes still go to single region |

### Why CRDTs?

CRDTs are data structures that can be replicated across nodes, updated independently, and merged automatically without conflicts.

```
┌─────────────────┐                    ┌─────────────────┐
│   US-East       │                    │   EU-West       │
│   Ferrite       │◄──── Async ───────►│   Ferrite       │
│                 │      Sync          │                 │
│  INCR counter   │                    │  INCR counter   │
│  +1 → 5         │                    │  +1 → 5         │
└─────────────────┘                    └─────────────────┘
        │                                      │
        ▼                                      ▼
     Merge: 5 + 5 - 4 (base) = 6     ◄─── Correct!

Traditional counter would give: 5 (last-write-wins) ◄─── Wrong!
```

---

## Technical Design

### CRDT Types Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CRDT Type Hierarchy                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Counters              Registers           Sets                  │
│  ─────────             ──────────          ─────                 │
│  • G-Counter           • LWW-Register      • G-Set               │
│  • PN-Counter          • MV-Register       • 2P-Set              │
│                                            • OR-Set              │
│                                            • LWW-Element-Set     │
│                                                                  │
│  Maps                  Sequences           Flags                 │
│  ─────                 ──────────          ──────                │
│  • LWW-Map             • RGA               • Enable-Wins         │
│  • OR-Map              • Logoot            • Disable-Wins        │
│  • Counter-Map                                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Core CRDT Trait

```rust
/// Base trait for all CRDT types
pub trait Crdt: Clone + Send + Sync {
    /// The state type that can be serialized and sent to other replicas
    type State: Serialize + DeserializeOwned + Clone;

    /// The operation type for operation-based CRDTs
    type Op: Serialize + DeserializeOwned + Clone;

    /// Merge another replica's state into this one
    fn merge(&mut self, other: &Self::State);

    /// Apply a local operation
    fn apply(&mut self, op: Self::Op);

    /// Get the current state for transmission
    fn state(&self) -> Self::State;

    /// Get the value for reading
    fn value(&self) -> Self::Value;
}

/// Unique identifier for a replica/site
#[derive(Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SiteId(pub u64);

/// Vector clock for causality tracking
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct VectorClock {
    clocks: HashMap<SiteId, u64>,
}

impl VectorClock {
    pub fn increment(&mut self, site: SiteId) {
        *self.clocks.entry(site).or_insert(0) += 1;
    }

    pub fn merge(&mut self, other: &VectorClock) {
        for (site, &clock) in &other.clocks {
            let entry = self.clocks.entry(*site).or_insert(0);
            *entry = (*entry).max(clock);
        }
    }

    pub fn happened_before(&self, other: &VectorClock) -> bool {
        self.clocks.iter().all(|(site, &clock)| {
            other.clocks.get(site).copied().unwrap_or(0) >= clock
        }) && self.clocks != other.clocks
    }
}
```

### CRDT Implementations

#### G-Counter (Grow-Only Counter)

```rust
/// Grow-only counter - can only increment
#[derive(Clone, Serialize, Deserialize)]
pub struct GCounter {
    /// Per-site increment counts
    counts: HashMap<SiteId, u64>,
}

impl GCounter {
    pub fn new() -> Self {
        Self { counts: HashMap::new() }
    }

    pub fn increment(&mut self, site: SiteId, delta: u64) {
        *self.counts.entry(site).or_insert(0) += delta;
    }

    pub fn value(&self) -> u64 {
        self.counts.values().sum()
    }

    pub fn merge(&mut self, other: &GCounter) {
        for (site, &count) in &other.counts {
            let entry = self.counts.entry(*site).or_insert(0);
            *entry = (*entry).max(count);
        }
    }
}
```

#### PN-Counter (Positive-Negative Counter)

```rust
/// Counter supporting both increment and decrement
#[derive(Clone, Serialize, Deserialize)]
pub struct PNCounter {
    positive: GCounter,
    negative: GCounter,
}

impl PNCounter {
    pub fn increment(&mut self, site: SiteId, delta: i64) {
        if delta >= 0 {
            self.positive.increment(site, delta as u64);
        } else {
            self.negative.increment(site, (-delta) as u64);
        }
    }

    pub fn value(&self) -> i64 {
        self.positive.value() as i64 - self.negative.value() as i64
    }

    pub fn merge(&mut self, other: &PNCounter) {
        self.positive.merge(&other.positive);
        self.negative.merge(&other.negative);
    }
}
```

#### LWW-Register (Last-Writer-Wins Register)

```rust
/// Register with last-writer-wins semantics
#[derive(Clone, Serialize, Deserialize)]
pub struct LwwRegister<T> {
    value: Option<T>,
    timestamp: HybridTimestamp,
    site: SiteId,
}

/// Hybrid Logical Clock timestamp
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct HybridTimestamp {
    /// Physical time (wall clock)
    physical: u64,
    /// Logical counter for same physical time
    logical: u32,
    /// Site ID for tie-breaking
    site: SiteId,
}

impl<T: Clone> LwwRegister<T> {
    pub fn set(&mut self, value: T, timestamp: HybridTimestamp) {
        if timestamp > self.timestamp {
            self.value = Some(value);
            self.timestamp = timestamp;
        }
    }

    pub fn merge(&mut self, other: &LwwRegister<T>) {
        if other.timestamp > self.timestamp {
            self.value = other.value.clone();
            self.timestamp = other.timestamp;
        }
    }

    pub fn value(&self) -> Option<&T> {
        self.value.as_ref()
    }
}
```

#### MV-Register (Multi-Value Register)

```rust
/// Register that preserves concurrent writes (for manual resolution)
#[derive(Clone, Serialize, Deserialize)]
pub struct MvRegister<T> {
    values: Vec<(T, VectorClock)>,
}

impl<T: Clone + PartialEq> MvRegister<T> {
    pub fn set(&mut self, value: T, clock: VectorClock) {
        // Remove values that this write supersedes
        self.values.retain(|(_, vc)| !vc.happened_before(&clock));

        // Add new value if not superseded by existing
        if !self.values.iter().any(|(_, vc)| clock.happened_before(vc)) {
            self.values.push((value, clock));
        }
    }

    pub fn merge(&mut self, other: &MvRegister<T>) {
        for (val, clock) in &other.values {
            self.set(val.clone(), clock.clone());
        }
    }

    /// Returns all concurrent values (for conflict resolution)
    pub fn values(&self) -> Vec<&T> {
        self.values.iter().map(|(v, _)| v).collect()
    }
}
```

#### OR-Set (Observed-Remove Set)

```rust
/// Set with add-wins semantics on concurrent add/remove
#[derive(Clone, Serialize, Deserialize)]
pub struct OrSet<T: Hash + Eq + Clone> {
    /// Element -> set of unique tags (site + counter)
    elements: HashMap<T, HashSet<UniqueTag>>,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UniqueTag {
    site: SiteId,
    counter: u64,
}

impl<T: Hash + Eq + Clone> OrSet<T> {
    pub fn add(&mut self, element: T, site: SiteId, counter: u64) {
        let tag = UniqueTag { site, counter };
        self.elements.entry(element).or_default().insert(tag);
    }

    pub fn remove(&mut self, element: &T) {
        // Only removes currently observed tags
        self.elements.remove(element);
    }

    pub fn contains(&self, element: &T) -> bool {
        self.elements.get(element).map_or(false, |tags| !tags.is_empty())
    }

    pub fn merge(&mut self, other: &OrSet<T>) {
        for (elem, tags) in &other.elements {
            self.elements
                .entry(elem.clone())
                .or_default()
                .extend(tags.iter().copied());
        }
    }

    pub fn members(&self) -> impl Iterator<Item = &T> {
        self.elements.keys()
    }
}
```

#### LWW-Element-Set (Sorted Set CRDT)

```rust
/// Sorted set with LWW semantics per element (for ZADD/ZREM)
#[derive(Clone, Serialize, Deserialize)]
pub struct LwwElementSet {
    /// Element -> (score, add_time, remove_time)
    elements: HashMap<Bytes, LwwElementEntry>,
}

#[derive(Clone, Serialize, Deserialize)]
struct LwwElementEntry {
    score: f64,
    add_time: HybridTimestamp,
    remove_time: Option<HybridTimestamp>,
}

impl LwwElementSet {
    pub fn add(&mut self, element: Bytes, score: f64, timestamp: HybridTimestamp) {
        let entry = self.elements.entry(element).or_insert(LwwElementEntry {
            score,
            add_time: timestamp,
            remove_time: None,
        });

        if timestamp > entry.add_time {
            entry.score = score;
            entry.add_time = timestamp;
        }
    }

    pub fn remove(&mut self, element: &Bytes, timestamp: HybridTimestamp) {
        if let Some(entry) = self.elements.get_mut(element) {
            if entry.remove_time.map_or(true, |t| timestamp > t) {
                entry.remove_time = Some(timestamp);
            }
        }
    }

    pub fn score(&self, element: &Bytes) -> Option<f64> {
        self.elements.get(element).and_then(|e| {
            // Element exists if add_time > remove_time
            if e.remove_time.map_or(true, |rt| e.add_time > rt) {
                Some(e.score)
            } else {
                None
            }
        })
    }

    pub fn merge(&mut self, other: &LwwElementSet) {
        for (elem, other_entry) in &other.elements {
            let entry = self.elements.entry(elem.clone()).or_insert(other_entry.clone());

            if other_entry.add_time > entry.add_time {
                entry.score = other_entry.score;
                entry.add_time = other_entry.add_time;
            }

            if let Some(other_rt) = other_entry.remove_time {
                if entry.remove_time.map_or(true, |rt| other_rt > rt) {
                    entry.remove_time = Some(other_rt);
                }
            }
        }
    }
}
```

### Replication Layer

```rust
/// Multi-region replication manager
pub struct ReplicationManager {
    /// Local site identifier
    site_id: SiteId,
    /// Known peer sites
    peers: RwLock<HashMap<SiteId, PeerConnection>>,
    /// Pending operations to replicate
    outbound_queue: Queue<ReplicationMessage>,
    /// Hybrid logical clock
    clock: RwLock<HybridClock>,
    /// Replication log
    replication_log: ReplicationLog,
}

#[derive(Serialize, Deserialize)]
pub enum ReplicationMessage {
    /// Full state sync (initial or recovery)
    StateSync {
        site: SiteId,
        keys: HashMap<Bytes, CrdtState>,
        clock: VectorClock,
    },
    /// Incremental operation
    Operation {
        site: SiteId,
        key: Bytes,
        op: CrdtOperation,
        timestamp: HybridTimestamp,
        vector_clock: VectorClock,
    },
    /// Acknowledgment
    Ack {
        site: SiteId,
        clock: VectorClock,
    },
}

impl ReplicationManager {
    /// Broadcast operation to all peers
    pub async fn broadcast(&self, key: Bytes, op: CrdtOperation) {
        let timestamp = self.clock.write().now();
        let vector_clock = self.get_vector_clock();

        let msg = ReplicationMessage::Operation {
            site: self.site_id,
            key,
            op,
            timestamp,
            vector_clock,
        };

        // Persist to local replication log first
        self.replication_log.append(&msg).await;

        // Then send to peers
        for peer in self.peers.read().values() {
            peer.send(msg.clone()).await;
        }
    }

    /// Handle incoming replication message
    pub async fn receive(&self, msg: ReplicationMessage, store: &Store) {
        match msg {
            ReplicationMessage::Operation { key, op, .. } => {
                // Apply operation to local CRDT
                store.apply_crdt_op(&key, op).await;
            }
            ReplicationMessage::StateSync { keys, clock, .. } => {
                // Merge full state
                for (key, state) in keys {
                    store.merge_crdt_state(&key, state).await;
                }
                self.clock.write().merge(&clock);
            }
            ReplicationMessage::Ack { site, clock } => {
                // Update peer's known state
                self.update_peer_clock(site, clock);
            }
        }
    }
}
```

---

## API Design

### CRDT Commands

```redis
# ============ Counter Commands ============

# Increment CRDT counter
CRDT.INCR <key> [BY <amount>] [SITE <site_id>]
CRDT.INCRBY <key> <amount> [SITE <site_id>]

# Decrement CRDT counter
CRDT.DECR <key> [BY <amount>] [SITE <site_id>]
CRDT.DECRBY <key> <amount> [SITE <site_id>]

# Get counter value
CRDT.GET <key>

# Examples
CRDT.INCR page:views SITE us-east-1
CRDT.GET page:views
# → (integer) 42

# ============ Register Commands ============

# Set LWW register
CRDT.SET <key> <value> [SITE <site_id>]

# Set MV register (multi-value, tracks conflicts)
CRDT.MVSET <key> <value> [SITE <site_id>]

# Get register value
CRDT.GET <key>

# Get all concurrent values (for MV-Register)
CRDT.MVGET <key>
# → ["value1", "value2"]  (concurrent writes)

# ============ Set Commands ============

# Add to OR-Set
CRDT.SADD <key> <member> [<member> ...] [SITE <site_id>]

# Remove from OR-Set
CRDT.SREM <key> <member> [<member> ...]

# Check membership
CRDT.SISMEMBER <key> <member>

# Get all members
CRDT.SMEMBERS <key>

# Set cardinality
CRDT.SCARD <key>

# ============ Sorted Set Commands ============

# Add to LWW-Element sorted set
CRDT.ZADD <key> <score> <member> [<score> <member> ...] [SITE <site_id>]

# Remove from sorted set
CRDT.ZREM <key> <member> [<member> ...]

# Get score
CRDT.ZSCORE <key> <member>

# Range queries (same as Redis)
CRDT.ZRANGE <key> <start> <stop> [WITHSCORES]
CRDT.ZRANGEBYSCORE <key> <min> <max> [WITHSCORES]

# ============ Map/Hash Commands ============

# Set hash field
CRDT.HSET <key> <field> <value> [SITE <site_id>]

# Get hash field
CRDT.HGET <key> <field>

# Get all fields
CRDT.HGETALL <key>

# Increment hash field (counter)
CRDT.HINCRBY <key> <field> <amount> [SITE <site_id>]

# Delete hash field
CRDT.HDEL <key> <field>

# ============ Flag Commands ============

# Enable-wins flag
CRDT.ENABLE <key> [SITE <site_id>]
CRDT.DISABLE <key> [SITE <site_id>]
CRDT.ISENABLED <key>
```

### Replication Commands

```redis
# ============ Site Management ============

# Get local site ID
CRDT.SITE

# List all known sites
CRDT.SITES

# Add replication peer
CRDT.PEER ADD <host>:<port> [SITE <site_id>]

# Remove peer
CRDT.PEER REMOVE <site_id>

# List peers
CRDT.PEERS

# ============ Sync Commands ============

# Force full sync with peer
CRDT.SYNC <site_id>

# Get replication lag
CRDT.LAG [<site_id>]

# Get vector clock
CRDT.CLOCK

# ============ Debug/Info ============

# Get CRDT type and metadata
CRDT.TYPE <key>
# → "pn-counter" / "lww-register" / "or-set" / etc.

# Get full CRDT state (for debugging)
CRDT.DEBUG STATE <key>

# Get operation history
CRDT.DEBUG OPS <key> [LIMIT <count>]

# Replication stats
CRDT.INFO
```

### Configuration

```toml
[crdt]
# Enable CRDT support
enabled = true

# Local site identifier (must be unique across all sites)
site_id = "us-east-1"

# Replication mode
mode = "async"  # or "sync" for synchronous replication

# Peers for replication
[[crdt.peers]]
host = "eu-west-1.ferrite.example.com"
port = 6379
site_id = "eu-west-1"

[[crdt.peers]]
host = "ap-south-1.ferrite.example.com"
port = 6379
site_id = "ap-south-1"

# Replication settings
[crdt.replication]
# How often to sync with peers
sync_interval = "100ms"
# Batch size for sync
batch_size = 1000
# Timeout for sync operations
timeout = "5s"
# Retry settings
retry_attempts = 3
retry_delay = "1s"

# Conflict resolution
[crdt.conflict]
# For LWW types, add random jitter to timestamps to reduce ties
timestamp_jitter = "1us"
# Log conflicts for debugging
log_conflicts = true
```

---

## Implementation Plan

### Phase 1: Core CRDT Types (4 weeks)

#### Week 1-2: Counter and Register Types

- [ ] Implement `GCounter`
- [ ] Implement `PNCounter`
- [ ] Implement `LwwRegister`
- [ ] Implement `MvRegister`
- [ ] Implement `HybridTimestamp` and `VectorClock`
- [ ] Unit tests for all types

#### Week 3-4: Collection Types

- [ ] Implement `OrSet`
- [ ] Implement `LwwElementSet` (sorted set)
- [ ] Implement `OrMap` (hash)
- [ ] Merge and conflict resolution tests

### Phase 2: Storage Integration (3 weeks)

#### Week 5-6: CRDT Storage Layer

- [ ] Create `CrdtValue` enum wrapping all CRDT types
- [ ] Integrate with Store for CRDT-typed keys
- [ ] Add serialization/deserialization
- [ ] Persistence support (RDB/AOF)

#### Week 7: Command Implementation

- [ ] Add CRDT.* commands to parser
- [ ] Implement command handlers
- [ ] Error handling and validation
- [ ] Integration tests with redis-cli

### Phase 3: Replication (4 weeks)

#### Week 8-9: Peer Communication

- [ ] Implement `ReplicationManager`
- [ ] TCP connection to peers
- [ ] Message serialization (Protocol Buffers or MessagePack)
- [ ] Heartbeat and failure detection

#### Week 10-11: Sync Protocol

- [ ] Full state sync on connection
- [ ] Incremental operation streaming
- [ ] Vector clock management
- [ ] Conflict logging and metrics

### Phase 4: Production Hardening (3 weeks)

#### Week 12: Resilience

- [ ] Network partition handling
- [ ] Reconnection logic
- [ ] Replication log for durability
- [ ] Bounded queues with backpressure

#### Week 13-14: Operations

- [ ] Metrics and monitoring (replication lag, conflicts/sec)
- [ ] Admin commands for debugging
- [ ] Documentation and runbooks
- [ ] Performance optimization

---

## Performance Considerations

### Overhead Analysis

| CRDT Type | Storage Overhead | Merge Cost |
|-----------|-----------------|------------|
| G-Counter | 8 bytes/site | O(sites) |
| PN-Counter | 16 bytes/site | O(sites) |
| LWW-Register | 16 bytes | O(1) |
| MV-Register | Variable | O(concurrent writes) |
| OR-Set | ~16 bytes/element | O(elements) |

### Optimization Strategies

1. **Delta-State CRDTs**
   - Only send changes, not full state
   - Reduces bandwidth significantly

2. **Compression**
   - Compress replication messages
   - Delta encoding for vector clocks

3. **Batching**
   - Batch operations for bulk transfer
   - Reduce network round trips

4. **Lazy Merge**
   - Merge on read, not on receive
   - Reduce CPU for write-heavy workloads

### Latency Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Local write | < 0.5ms | Same as regular Redis |
| Cross-region replication | < 200ms | Async, depends on RTT |
| Merge | < 1ms | Per key |
| Full sync (1M keys) | < 30s | Initial connection |

---

## Testing Strategy

### Unit Tests

```rust
#[test]
fn test_pn_counter_merge() {
    let site1 = SiteId(1);
    let site2 = SiteId(2);

    let mut counter1 = PNCounter::new();
    counter1.increment(site1, 5);

    let mut counter2 = PNCounter::new();
    counter2.increment(site2, 3);
    counter2.increment(site2, -1);

    counter1.merge(&counter2);
    assert_eq!(counter1.value(), 7); // 5 + 3 - 1
}

#[test]
fn test_or_set_concurrent_add_remove() {
    // Site 1 adds element, Site 2 removes it concurrently
    // Add should win (add-wins semantics)
    let mut set1 = OrSet::new();
    let mut set2 = set1.clone();

    set1.add("x", SiteId(1), 1);
    set2.remove(&"x");

    set1.merge(&set2);
    set2.merge(&set1);

    assert!(set1.contains(&"x")); // Add wins
    assert!(set2.contains(&"x"));
}
```

### Integration Tests

- [ ] Multi-node cluster setup
- [ ] Concurrent writes from different nodes
- [ ] Network partition simulation
- [ ] Convergence verification after partition heals

### Chaos Testing

- [ ] Random network partitions
- [ ] Message delays and reordering
- [ ] Node crashes and recovery
- [ ] Clock skew simulation

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Unbounded CRDT growth | High | Medium | Garbage collection, tombstone expiry |
| Network partition divergence | High | Medium | Conflict logging, manual resolution |
| Clock skew issues | Medium | Low | Hybrid logical clocks |
| Complexity for users | Medium | Medium | Good defaults, clear docs |
| Performance overhead | Medium | Low | Delta-state, batching |

---

## Success Metrics

### Technical Metrics

- Convergence within 1s of network recovery
- < 5% throughput overhead vs. non-CRDT
- < 1% conflict rate in typical workloads
- Replication lag < 500ms P99

### Business Metrics

- Enterprise customers requesting multi-region
- Competitive advantage vs. Redis Enterprise
- Featured in multi-region architecture discussions

---

## Future Enhancements

1. **Causal Consistency** - Ensure causal ordering across operations
2. **Transactions** - CRDT-aware transactions
3. **Custom Merge Functions** - User-defined conflict resolution
4. **Tombstone GC** - Automatic cleanup of deleted elements
5. **Read Repair** - Heal inconsistencies on read

---

## References

- [A Comprehensive Study of CRDTs](https://hal.inria.fr/inria-00555588/document)
- [CRDTs: The Hard Parts](https://martin.kleppmann.com/2020/07/06/crdt-hard-parts-hydra.html)
- [Redis Enterprise CRDTs](https://redis.com/redis-enterprise/technology/active-active-geo-distribution/)
- [Riak CRDT Implementation](https://riak.com/posts/technical/distributed-data-types-riak-2-0/)
- [Automerge](https://automerge.org/)
