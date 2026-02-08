# ADR-0010: Distributed Transactions with 2PC and MVCC

## Status

Accepted

## Context

Redis provides basic transaction support via MULTI/EXEC with optimistic locking (WATCH). However, in a distributed setting with data spread across shards, traditional Redis transactions have limitations:
- MULTI/EXEC only works on keys in the same slot
- No isolation between concurrent transactions
- No support for cross-shard atomicity

Modern applications often require:
- ACID transactions across multiple keys/shards
- Snapshot isolation for consistent reads
- Rollback capability on failure
- Conflict detection and resolution

Distributed transaction approaches:

1. **Two-Phase Commit (2PC)**
   - Classic protocol for distributed atomicity
   - Coordinator orchestrates prepare/commit
   - Handles failures with abort

2. **Saga Pattern**
   - Compensating transactions for rollback
   - Eventually consistent
   - Complex compensation logic

3. **Calvin/Deterministic Database**
   - Pre-order transactions, deterministic execution
   - High throughput but high latency

4. **MVCC (Multi-Version Concurrency Control)**
   - Each transaction sees consistent snapshot
   - Readers don't block writers
   - Enables snapshot isolation

## Decision

We implement **2PC for atomicity** combined with **MVCC for isolation**:

### Two-Phase Commit Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Transaction Flow                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Client                  Coordinator               Nodes    │
│     │                         │                       │      │
│     │── BEGIN ───────────────▶│                       │      │
│     │◀── txn_id ─────────────│                       │      │
│     │                         │                       │      │
│     │── SET key1 val1 ───────▶│───── PREPARE ───────▶│ A    │
│     │── SET key2 val2 ───────▶│───── PREPARE ───────▶│ B    │
│     │                         │◀──── VOTE YES ───────│ A    │
│     │                         │◀──── VOTE YES ───────│ B    │
│     │                         │                       │      │
│     │── COMMIT ──────────────▶│───── COMMIT ────────▶│ A    │
│     │                         │───── COMMIT ────────▶│ B    │
│     │◀── OK ─────────────────│◀──── ACK ────────────│ A,B  │
│     │                         │                       │      │
└─────────────────────────────────────────────────────────────┘
```

### MVCC Implementation
```rust
pub struct MvccStore {
    /// Version chain for each key
    versions: DashMap<Bytes, VersionChain>,

    /// Active transaction snapshots
    snapshots: DashMap<TxnId, Snapshot>,

    /// Current commit timestamp
    commit_ts: AtomicU64,
}

pub struct VersionChain {
    /// Linked list of versions, newest first
    versions: Vec<Version>,
}

pub struct Version {
    /// Transaction that created this version
    txn_id: TxnId,

    /// Commit timestamp (0 if uncommitted)
    commit_ts: u64,

    /// The actual value
    value: Option<Bytes>,

    /// Previous version pointer
    prev: Option<Box<Version>>,
}

pub struct Snapshot {
    /// Snapshot timestamp
    read_ts: u64,

    /// Visible committed transactions
    visible_txns: HashSet<TxnId>,
}
```

### Transaction Lifecycle
```rust
pub struct TransactionCoordinator {
    pending: DashMap<TxnId, PendingTransaction>,
    participants: Vec<Arc<dyn Participant>>,
}

pub struct PendingTransaction {
    id: TxnId,
    state: TxnState,
    writes: Vec<(Bytes, Bytes)>,
    participants: Vec<NodeId>,
    timeout: Instant,
}

pub enum TxnState {
    Active,
    Preparing,
    Prepared,
    Committing,
    Committed,
    Aborting,
    Aborted,
}

impl TransactionCoordinator {
    pub async fn commit(&self, txn_id: TxnId) -> Result<(), TxnError> {
        // Phase 1: Prepare
        let votes = self.prepare_all(&txn_id).await?;

        if votes.iter().all(|v| *v == Vote::Yes) {
            // Phase 2: Commit
            self.commit_all(&txn_id).await?;
            Ok(())
        } else {
            // Abort on any No vote
            self.abort_all(&txn_id).await?;
            Err(TxnError::Aborted)
        }
    }
}
```

### Isolation Levels
```rust
pub enum IsolationLevel {
    /// Read committed: see only committed data
    ReadCommitted,

    /// Repeatable read: consistent snapshot for entire txn
    RepeatableRead,

    /// Serializable: full isolation via conflict detection
    Serializable,
}
```

### Conflict Detection
```rust
pub struct ConflictDetector {
    /// Read set per transaction
    reads: DashMap<TxnId, HashSet<Bytes>>,

    /// Write set per transaction
    writes: DashMap<TxnId, HashSet<Bytes>>,
}

impl ConflictDetector {
    /// Check for write-write conflicts
    pub fn check_ww_conflict(&self, txn: TxnId, key: &Bytes) -> bool {
        self.writes.iter().any(|entry| {
            entry.key() != &txn && entry.value().contains(key)
        })
    }

    /// Check for read-write conflicts (for serializable)
    pub fn check_rw_conflict(&self, txn: TxnId, key: &Bytes) -> bool {
        self.reads.iter().any(|entry| {
            entry.key() != &txn && entry.value().contains(key)
        })
    }
}
```

## Consequences

### Positive
- **Cross-shard atomicity**: All-or-nothing across cluster
- **Snapshot isolation**: Consistent reads without locks
- **Conflict detection**: Prevent anomalies automatically
- **Rollback support**: Clean abort on failure
- **Standard protocol**: 2PC is well-understood

### Negative
- **Latency**: 2PC adds round-trips (2x for prepare/commit)
- **Coordinator dependency**: Single point of failure (mitigated by coordinator election)
- **Blocking**: Participants block during prepare
- **Storage overhead**: MVCC stores multiple versions
- **Garbage collection**: Old versions must be cleaned up

### Trade-offs
- **Availability vs consistency**: 2PC blocks on participant failure
- **Version retention**: Keep more versions for longer-running transactions
- **Conflict rate**: Strict isolation increases abort rate

## Implementation Notes

Key files:
- `src/transaction/mod.rs` - Transaction subsystem entry
- `src/transaction/coordinator.rs` - 2PC coordinator
- `src/transaction/participant.rs` - 2PC participant
- `src/transaction/mvcc.rs` - Multi-version storage
- `src/transaction/conflict.rs` - Conflict detection
- `src/transaction/recovery.rs` - Crash recovery

Command interface:
```
# Begin transaction
> MULTI [ISOLATION level]
OK

# Transactional operations
> SET key1 value1
QUEUED
> SET key2 value2
QUEUED

# Commit
> EXEC
1) OK
2) OK

# Or abort
> DISCARD
OK
```

Extended commands for distributed transactions:
```
# Explicit transaction with ID
> TXN.BEGIN
"txn_001"

> TXN.SET txn_001 key1 value1
OK

> TXN.COMMIT txn_001
OK
```

Recovery protocol:
```
On Coordinator Crash:
1. New coordinator elected
2. Query all participants for pending transactions
3. Resume or abort based on state

On Participant Crash:
1. Replay write-ahead log
2. Re-vote for pending prepares
3. Apply or discard based on coordinator decision
```

Configuration:
```toml
[transaction]
enabled = true
default_isolation = "repeatable_read"
timeout_ms = 30000
max_versions = 100

[transaction.coordinator]
election_timeout_ms = 5000
heartbeat_interval_ms = 1000

[transaction.gc]
interval_ms = 10000
retain_versions = 10
```

## Comparison with Redis

| Feature | Redis | Ferrite |
|---------|-------|---------|
| MULTI/EXEC | ✅ Single node | ✅ + Cross-shard |
| WATCH | ✅ Optimistic | ✅ + MVCC |
| Isolation | None | Snapshot/Serializable |
| Cross-slot txn | ❌ | ✅ |
| Abort/Rollback | ❌ | ✅ |

## References

- [Two-Phase Commit Protocol](https://en.wikipedia.org/wiki/Two-phase_commit_protocol)
- [MVCC Explained](https://www.postgresql.org/docs/current/mvcc.html)
- [Spanner: Google's Globally-Distributed Database](https://research.google/pubs/pub39966/)
- [A Critique of ANSI SQL Isolation Levels](https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/)
