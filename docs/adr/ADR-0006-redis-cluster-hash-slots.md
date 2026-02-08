# ADR-0006: Redis Cluster Compatible Hash Slot Distribution

## Status

Accepted

## Context

As datasets grow beyond single-machine capacity, Ferrite needs horizontal scaling. Distributing data across multiple nodes requires:
- **Deterministic key routing**: Clients must know which node owns each key
- **Balanced distribution**: Data should spread evenly across nodes
- **Resharding support**: Adding/removing nodes without full data migration
- **Client compatibility**: Existing tools should work

Sharding approaches considered:

1. **Consistent hashing (Dynamo-style)**
   - Virtual nodes on hash ring
   - Minimal data movement on topology changes
   - Complex to implement correctly

2. **Modulo sharding (key % N)**
   - Simple but resharding moves ~all data
   - Not suitable for dynamic clusters

3. **Range-based sharding**
   - Good for range queries
   - Hot spots if key distribution uneven

4. **Redis Cluster hash slots**
   - 16384 fixed slots mapped to nodes
   - CRC16(key) % 16384 determines slot
   - Industry standard, client support exists

## Decision

We implement **Redis Cluster's 16384 hash slot model**:

### Slot Assignment
```
┌─────────────────────────────────────────────────────────────┐
│                    16384 Hash Slots                          │
├─────────┬─────────┬─────────┬─────────┬─────────┬──────────┤
│ 0-5460  │5461-10922│10923-16383│         │         │          │
│ Node A  │ Node B  │ Node C  │  ...    │  ...    │  ...     │
│ Primary │ Primary │ Primary │         │         │          │
└─────────┴─────────┴─────────┴─────────┴─────────┴──────────┘
```

### Key Routing
```rust
/// Calculate slot for a key using CRC16
pub fn key_slot(key: &[u8]) -> u16 {
    // Check for hash tag: {tag}rest → hash only "tag"
    let hash_key = extract_hash_tag(key).unwrap_or(key);
    crc16(hash_key) % CLUSTER_SLOTS  // 16384
}

fn extract_hash_tag(key: &[u8]) -> Option<&[u8]> {
    // Find {...} and return content between braces
    let start = key.iter().position(|&b| b == b'{')?;
    let end = key[start..].iter().position(|&b| b == b'}')?;
    if end > 1 {
        Some(&key[start + 1..start + end])
    } else {
        None
    }
}
```

### Cluster State
```rust
pub struct ClusterState {
    /// Slot to node mapping
    slots: [Option<NodeId>; 16384],

    /// Known nodes
    nodes: HashMap<NodeId, ClusterNode>,

    /// Current node's ID
    myself: NodeId,

    /// Epoch for consistency
    current_epoch: u64,
}

pub struct ClusterNode {
    id: NodeId,
    address: SocketAddr,
    role: NodeRole,  // Primary or Replica
    slots: RangeSet<u16>,
    primary_id: Option<NodeId>,
    flags: NodeFlags,
}
```

### Hash Tags for Co-location
```
user:{123}:profile  → slot = crc16("123") % 16384
user:{123}:settings → slot = crc16("123") % 16384
user:{123}:session  → slot = crc16("123") % 16384

All three keys land on the same slot/node, enabling multi-key operations.
```

### Resharding Flow
```
1. Mark slots as MIGRATING on source node
2. Mark slots as IMPORTING on target node
3. For each key in migrating slots:
   - MIGRATE key to target
   - Delete from source
4. Update slot ownership in cluster state
5. Propagate via gossip protocol
```

## Consequences

### Positive
- **Client compatibility**: All Redis Cluster clients work out of box
- **Predictable routing**: O(1) slot calculation from key
- **Granular resharding**: Move individual slots, not entire nodes
- **Hash tags**: Co-locate related keys for multi-key operations
- **Tooling**: redis-cli, Redis Cluster management tools all work
- **Proven at scale**: Used by Redis, KeyDB, Dragonfly

### Negative
- **Fixed slot count**: 16384 slots limits minimum node count flexibility
- **No range queries**: Slot-based routing breaks range scans
- **Cross-slot limitations**: Multi-key commands require same slot
- **Migration complexity**: Live resharding is operationally complex

### Trade-offs
- **16384 slots**: Good balance between granularity and overhead
- **CRC16 vs xxHash**: CRC16 for Redis compat, xxHash would be faster
- **Hash tags vs transparent routing**: Explicit control at cost of complexity

## Implementation Notes

Key files:
- `src/cluster/mod.rs` - Cluster subsystem entry point
- `src/cluster/slots.rs` - Slot calculation and management
- `src/cluster/state.rs` - Cluster state machine
- `src/cluster/gossip.rs` - Node discovery and failure detection
- `src/cluster/migration.rs` - Slot migration logic

Commands implemented:
- `CLUSTER SLOTS` - Get slot-node mapping
- `CLUSTER NODES` - Get cluster topology
- `CLUSTER INFO` - Cluster health status
- `CLUSTER KEYSLOT <key>` - Calculate slot for key
- `CLUSTER ADDSLOTS` - Assign slots to node
- `CLUSTER SETSLOT` - Mark slot migrating/importing

Redirection responses:
```
-MOVED 3999 127.0.0.1:6381   # Permanent redirect
-ASK 3999 127.0.0.1:6381     # One-time redirect (during migration)
```

Configuration:
```toml
[cluster]
enabled = true
node_timeout_ms = 15000
replica_validity_factor = 10
migration_barrier = 1
```

## Topology Example

3-node cluster with replicas:
```
┌─────────────────────────────────────────────────────────────┐
│                      Ferrite Cluster                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Node A    │    │   Node B    │    │   Node C    │     │
│  │  (Primary)  │    │  (Primary)  │    │  (Primary)  │     │
│  │ Slots 0-5460│    │Slots 5461-  │    │Slots 10923- │     │
│  │             │    │   10922     │    │   16383     │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                   │                   │           │
│         ▼                   ▼                   ▼           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Node A'    │    │   Node B'   │    │   Node C'   │     │
│  │  (Replica)  │    │  (Replica)  │    │  (Replica)  │     │
│  │ Replicates A│    │ Replicates B│    │ Replicates C│     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## References

- [Redis Cluster Specification](https://redis.io/docs/reference/cluster-spec/)
- [Redis Cluster Tutorial](https://redis.io/docs/manual/scaling/)
- [CRC16-CCITT Implementation](https://redis.io/docs/reference/cluster-spec/#appendix-a-crc16-reference-implementation-in-ansi-c)
