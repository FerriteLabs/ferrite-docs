# Time-Travel Queries

## Executive Summary

Expose Ferrite's HybridLog history as queryable temporal data, enabling point-in-time queries, historical debugging, and audit trails without external systems.

**Status**: Proposal
**Priority**: Medium-High
**Estimated Effort**: 6-8 weeks
**Target Release**: v0.4.0

---

## Problem Statement

### Current State

Traditional key-value stores (Redis included) are "present-only" - you can only query current values. Once a key is updated or deleted, previous values are lost forever.

### User Pain Points

1. **Debugging Production Issues**
   - "What was the value of `user:123:session` 2 hours ago when the bug occurred?"
   - Currently requires external logging/auditing systems

2. **Audit Compliance**
   - Financial services need historical data trails
   - Healthcare requires data lineage
   - GDPR "right to know" what data was stored

3. **Analytics on Historical State**
   - "How many users had premium status last month?"
   - Requires maintaining separate analytics infrastructure

4. **Accidental Data Loss Recovery**
   - "I accidentally DELeted the wrong key, can I recover it?"
   - Currently: No, unless you have RDB snapshots

### Why Ferrite is Uniquely Positioned

Ferrite's HybridLog architecture **already preserves history** as part of its design:

```
┌─────────────────────────────────────────────────────────────────┐
│                        HybridLog                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Mutable    │  │  Read-Only  │  │      On-Disk Log        │  │
│  │  (newest)   │──▶│   (older)   │──▶│      (oldest)           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                  │
│  Each entry has: key, value, timestamp, operation_type          │
│  History is naturally preserved as log grows                    │
└─────────────────────────────────────────────────────────────────┘
```

We're not adding a feature - we're **exposing capability that already exists**.

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Time-Travel Query Engine                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Query Parser                              │ │
│  │  GET key AS OF timestamp                                     │ │
│  │  SCAN ... AS OF timestamp                                    │ │
│  │  HISTORY key [FROM ts] [TO ts]                              │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Temporal Index                               │ │
│  │  key -> [(timestamp, log_offset), ...]                      │ │
│  │  Efficient lookup of value at any point in time             │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 HybridLog Reader                             │ │
│  │  Random access to historical log entries                    │ │
│  │  Handles mutable/read-only/disk tiers transparently         │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Core Data Structures

#### Temporal Index

```rust
/// Index for efficient temporal queries
/// Maps key -> sorted list of (timestamp, log_position)
pub struct TemporalIndex {
    /// Primary index: key -> version history
    index: DashMap<Bytes, VersionChain>,
    /// Retention policy
    retention: RetentionPolicy,
    /// Statistics
    stats: TemporalStats,
}

/// Chain of versions for a single key
pub struct VersionChain {
    /// Sorted by timestamp (newest first for faster recent queries)
    versions: Vec<VersionEntry>,
    /// Cached current version for fast present-time queries
    current: Option<VersionEntry>,
}

#[derive(Clone)]
pub struct VersionEntry {
    /// Timestamp of this version
    timestamp: SystemTime,
    /// Logical sequence number (for ordering within same millisecond)
    sequence: u64,
    /// Position in HybridLog
    log_offset: LogOffset,
    /// Operation type
    op: OperationType,
    /// TTL at time of write (if any)
    ttl: Option<Duration>,
}

pub enum OperationType {
    Set,
    Delete,
    Expire,
    // For complex types
    ListPush { direction: Direction },
    ListPop { direction: Direction },
    HashSet { field: Bytes },
    HashDel { field: Bytes },
    SetAdd,
    SetRem,
    // ... etc
}

/// Where in the log this version is stored
pub enum LogOffset {
    /// In mutable region (memory)
    Mutable(usize),
    /// In read-only region (mmap)
    ReadOnly { page: u32, offset: u32 },
    /// On disk
    Disk { file_id: u32, offset: u64 },
    /// In cloud storage
    Cloud { object_key: String, offset: u64 },
}
```

#### Retention Policy

```rust
pub struct RetentionPolicy {
    /// Maximum age for historical data
    max_age: Option<Duration>,
    /// Maximum versions to keep per key
    max_versions: Option<usize>,
    /// Minimum versions to always keep
    min_versions: usize,
    /// Keys matching these patterns have different policies
    overrides: Vec<(GlobPattern, RetentionOverride)>,
}

impl Default for RetentionPolicy {
    fn default() -> Self {
        Self {
            max_age: Some(Duration::from_secs(7 * 24 * 3600)), // 7 days
            max_versions: Some(1000),
            min_versions: 1,
            overrides: vec![],
        }
    }
}
```

### Query Resolution

```rust
impl TemporalIndex {
    /// Get value at a specific point in time
    pub async fn get_at(
        &self,
        key: &Bytes,
        timestamp: SystemTime,
        log: &HybridLog,
    ) -> Result<Option<Value>> {
        let chain = self.index.get(key).ok_or(KeyNotFound)?;

        // Binary search for the version active at `timestamp`
        let version = chain.version_at(timestamp)?;

        match version {
            Some(v) if v.op == OperationType::Delete => Ok(None),
            Some(v) => {
                // Read value from log at stored offset
                let value = log.read_at(v.log_offset).await?;
                Ok(Some(value))
            }
            None => Ok(None), // Key didn't exist at this time
        }
    }

    /// Get full history of a key
    pub async fn history(
        &self,
        key: &Bytes,
        from: Option<SystemTime>,
        to: Option<SystemTime>,
        limit: usize,
        log: &HybridLog,
    ) -> Result<Vec<HistoryEntry>> {
        let chain = self.index.get(key).ok_or(KeyNotFound)?;

        let entries: Vec<_> = chain.versions
            .iter()
            .filter(|v| {
                from.map_or(true, |f| v.timestamp >= f) &&
                to.map_or(true, |t| v.timestamp <= t)
            })
            .take(limit)
            .collect();

        // Batch read values from log
        let values = log.batch_read(
            entries.iter().map(|e| e.log_offset).collect()
        ).await?;

        Ok(entries.iter().zip(values).map(|(e, v)| {
            HistoryEntry {
                timestamp: e.timestamp,
                operation: e.op.clone(),
                value: v,
            }
        }).collect())
    }
}
```

---

## API Design

### Point-in-Time Queries

```redis
# Get value at specific timestamp
GET <key> AS OF <timestamp>
GET <key> AS OF "<ISO8601>"
GET <key> AS OF -<duration>          # Relative to now

# Examples
GET user:123:email AS OF 1702900000
GET user:123:email AS OF "2024-12-18T10:00:00Z"
GET user:123:email AS OF -1h         # 1 hour ago
GET user:123:email AS OF -7d         # 7 days ago

# Works with all read commands
HGET user:123 name AS OF -1h
LRANGE mylist 0 -1 AS OF "2024-12-01"
SMEMBERS myset AS OF -30m
ZRANGE leaderboard 0 9 AS OF -1d

# Scan with time travel
SCAN 0 MATCH user:* AS OF -1h
KEYS session:* AS OF "2024-12-18T00:00:00Z"
```

### History Queries

```redis
# Get full history of a key
HISTORY <key>
    [FROM <timestamp>]
    [TO <timestamp>]
    [LIMIT <count>]
    [ORDER ASC|DESC]
    [WITHVALUES]

# Examples
HISTORY user:123:status
# Returns:
# 1) 1702900000 SET "active"
# 2) 1702890000 SET "idle"
# 3) 1702880000 SET "active"
# 4) 1702870000 DEL

HISTORY user:123:cart FROM -7d LIMIT 100 WITHVALUES
HISTORY session:abc TO "2024-12-18T00:00:00Z" ORDER ASC

# Count versions
HISTORY.COUNT <key> [FROM <timestamp>] [TO <timestamp>]

# Get first/last version
HISTORY.FIRST <key>
HISTORY.LAST <key>
```

### Diff Queries

```redis
# Compare value at two points in time
DIFF <key> <timestamp1> <timestamp2>

# Example
DIFF user:123:profile -1d NOW
# Returns structured diff of JSON or field changes

# Diff for hash keys
HDIFF user:123 -1d NOW
# Returns: added fields, removed fields, changed fields
```

### Restore/Recovery

```redis
# Restore a key to a previous state
RESTORE.FROM <key> <timestamp>
    [NEWKEY <target_key>]

# Examples
RESTORE.FROM user:123:data -1h              # Restore in place
RESTORE.FROM user:123:data -1h NEWKEY user:123:data:backup
```

### Retention Management

```redis
# View retention policy
TEMPORAL.POLICY

# Set global retention
TEMPORAL.POLICY SET
    [MAXAGE <duration>]
    [MAXVERSIONS <count>]
    [MINVERSIONS <count>]

# Set per-key-pattern retention
TEMPORAL.POLICY PATTERN <pattern>
    [MAXAGE <duration>]
    [MAXVERSIONS <count>]

# Examples
TEMPORAL.POLICY SET MAXAGE 30d MAXVERSIONS 10000
TEMPORAL.POLICY PATTERN "audit:*" MAXAGE 7y     # 7 years for audit
TEMPORAL.POLICY PATTERN "cache:*" MAXAGE 1h     # 1 hour for cache

# Manually trigger cleanup
TEMPORAL.CLEANUP [DRY-RUN]

# View temporal storage usage
TEMPORAL.INFO
```

### Temporal Transactions

```redis
# Read multiple keys at consistent point in time
MULTI AS OF -1h
GET user:123:name
GET user:123:email
HGETALL user:123:profile
EXEC
# All reads see state at exactly 1 hour ago
```

---

## Implementation Plan

### Phase 1: Temporal Index Infrastructure (2 weeks)

#### Week 1: Core Index

- [ ] Define `TemporalIndex`, `VersionChain`, `VersionEntry` types
- [ ] Implement index population during log writes
- [ ] Add binary search for `version_at()` queries
- [ ] Unit tests for index operations

```rust
// Hook into existing write path
impl Store {
    pub fn set_with_history(&self, key: Bytes, value: Value) {
        let offset = self.log.append(key.clone(), value);
        let timestamp = SystemTime::now();

        self.temporal_index.record_version(
            key,
            VersionEntry {
                timestamp,
                sequence: self.next_sequence(),
                log_offset: offset,
                op: OperationType::Set,
                ttl: None,
            }
        );
    }
}
```

#### Week 2: Index Persistence

- [ ] Serialize temporal index to disk
- [ ] Load index on startup
- [ ] Incremental index updates (WAL-style)
- [ ] Recovery from log if index is stale/missing

### Phase 2: Point-in-Time Queries (2 weeks)

#### Week 3: Basic AS OF

- [ ] Parse `AS OF` syntax in command parser
- [ ] Implement `GET ... AS OF`
- [ ] Add timestamp parsing (Unix, ISO8601, relative)
- [ ] Integration tests with redis-cli

#### Week 4: Extended AS OF

- [ ] Implement AS OF for hash commands (HGET, HGETALL, etc.)
- [ ] Implement AS OF for list commands (LRANGE, LINDEX, etc.)
- [ ] Implement AS OF for set commands (SMEMBERS, SISMEMBER, etc.)
- [ ] Implement AS OF for sorted set commands (ZRANGE, ZSCORE, etc.)
- [ ] Implement SCAN/KEYS with AS OF

### Phase 3: History Queries (2 weeks)

#### Week 5: HISTORY Command

- [ ] Implement `HISTORY` command
- [ ] Add FROM/TO/LIMIT/ORDER options
- [ ] Optimize batch value retrieval
- [ ] Add `HISTORY.COUNT`, `HISTORY.FIRST`, `HISTORY.LAST`

#### Week 6: DIFF and RESTORE

- [ ] Implement `DIFF` command with structural diffing
- [ ] Add `HDIFF` for hash-specific diffs
- [ ] Implement `RESTORE.FROM` command
- [ ] Add safety checks (confirmation for in-place restore)

### Phase 4: Retention & Cleanup (2 weeks)

#### Week 7: Retention Policies

- [ ] Implement `RetentionPolicy` configuration
- [ ] Add per-pattern policy overrides
- [ ] Implement `TEMPORAL.POLICY` commands
- [ ] Background cleanup task

#### Week 8: Production Hardening

- [ ] Memory pressure handling
- [ ] Cleanup during compaction
- [ ] Metrics and observability
- [ ] Documentation and examples

---

## Data Structures

### Temporal Index File Format

```
┌─────────────────────────────────────────┐
│         Temporal Index File             │
├─────────────────────────────────────────┤
│ Magic: "FTMP" (4 bytes)                 │
│ Version: u32                            │
│ Entry Count: u64                        │
│ Min Timestamp: u64                      │
│ Max Timestamp: u64                      │
├─────────────────────────────────────────┤
│         Key Directory                   │
│ ┌─────────────────────────────────────┐ │
│ │ Key Length: u16                     │ │
│ │ Key Data: [u8; len]                 │ │
│ │ Version Count: u32                  │ │
│ │ Versions Offset: u64                │ │
│ └─────────────────────────────────────┘ │
│ ... repeat for each key ...             │
├─────────────────────────────────────────┤
│         Version Data                    │
│ ┌─────────────────────────────────────┐ │
│ │ Timestamp: u64 (micros since epoch) │ │
│ │ Sequence: u64                       │ │
│ │ Log Offset: LogOffset (encoded)     │ │
│ │ Operation: u8                       │ │
│ │ TTL: Option<u64>                    │ │
│ └─────────────────────────────────────┘ │
│ ... repeat for each version ...         │
└─────────────────────────────────────────┘
```

### Memory Optimization

```rust
/// Compact version entry for memory efficiency
#[repr(C, packed)]
pub struct CompactVersionEntry {
    /// Microseconds since epoch (good until year 586524)
    timestamp_micros: u64,
    /// Packed: tier (2 bits) + offset (62 bits)
    log_offset_packed: u64,
    /// Operation type
    op: u8,
}

impl CompactVersionEntry {
    pub fn size() -> usize {
        17 // bytes per version
    }
}

// For a key with 1000 versions: 17KB overhead
// For 1M keys with avg 100 versions: ~1.7GB index size
```

---

## Performance Considerations

### Query Performance Targets

| Query Type | Target Latency | Notes |
|------------|---------------|-------|
| GET AS OF (recent) | < 1ms | Index lookup + memory read |
| GET AS OF (old) | < 10ms | May require disk read |
| HISTORY (100 entries) | < 5ms | Batch read optimization |
| SCAN AS OF | < 100ms | Depends on match count |

### Optimization Strategies

1. **Index Caching**
   - Keep recent versions in memory
   - LRU eviction for older entries

2. **Bloom Filters**
   - Quick "key never existed at time T" checks
   - Avoid index lookups for non-existent keys

3. **Chunk-based History**
   - Store versions in time-based chunks
   - Enable efficient range scans

4. **Lazy Loading**
   - Don't load full history on startup
   - Load chunks on demand

### Space Overhead

```
Per version overhead: ~17 bytes
Per key overhead: ~50 bytes (chain metadata)

Example: 1M keys, avg 100 versions each
- Version data: 1M * 100 * 17 = 1.7 GB
- Key metadata: 1M * 50 = 50 MB
- Total index: ~1.75 GB

With retention (keep 7 days, prune to 100 versions):
- Much smaller in practice
```

---

## Configuration

### ferrite.toml

```toml
[temporal]
# Enable time-travel queries
enabled = true

# Default retention policy
max_age = "7d"
max_versions = 1000
min_versions = 1

# Index settings
index_path = "./data/temporal.idx"
index_cache_size = "256MB"

# Cleanup settings
cleanup_interval = "1h"
cleanup_batch_size = 10000

# Per-pattern overrides
[[temporal.patterns]]
pattern = "audit:*"
max_age = "7y"

[[temporal.patterns]]
pattern = "cache:*"
max_age = "1h"
max_versions = 10

[[temporal.patterns]]
pattern = "session:*"
max_age = "24h"
```

---

## Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_version_at_exact_match() {
        let chain = version_chain_with_entries(vec![
            (1000, OperationType::Set),
            (2000, OperationType::Set),
            (3000, OperationType::Delete),
        ]);

        assert_eq!(chain.version_at(1500).unwrap().timestamp, 1000);
        assert_eq!(chain.version_at(2500).unwrap().timestamp, 2000);
        assert!(chain.version_at(3500).unwrap().op == OperationType::Delete);
    }

    #[test]
    fn test_history_with_range() {
        // ...
    }

    #[test]
    fn test_retention_cleanup() {
        // ...
    }
}
```

### Integration Tests

- [ ] Point-in-time queries via redis-cli
- [ ] History queries with various filters
- [ ] Retention policy enforcement
- [ ] Recovery after restart
- [ ] Large-scale (1M keys, 100 versions each)

### Compatibility Tests

- [ ] Verify AS OF syntax doesn't break existing clients
- [ ] Test with redis-py, node-redis, jedis
- [ ] Ensure non-temporal queries unchanged

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Index size explosion | High | Medium | Retention policies, cleanup |
| Query performance degradation | High | Low | Caching, bloom filters |
| Log compaction conflicts | Medium | Medium | Coordinate with compaction |
| Clock skew issues | Medium | Low | Use logical sequence numbers |
| Recovery complexity | Medium | Medium | Index rebuild from log |

---

## Success Metrics

### Technical Metrics

- Point-in-time query latency < 10ms P99
- Index overhead < 20% of data size
- Cleanup keeps index bounded

### Business Metrics

- Feature mentioned in 50% of sales conversations
- 3+ customer case studies on debugging/compliance
- Reduces support tickets for "lost data" by 80%

---

## Future Enhancements

1. **Branching** - Create "branches" of data for what-if analysis
2. **Temporal Joins** - Query relationships at point in time
3. **Change Streams** - Subscribe to historical changes
4. **Temporal Aggregations** - COUNT/SUM over time ranges
5. **Bi-temporal** - Track both valid time and transaction time

---

## References

- [Temporal Data & The Relational Model](https://www.oreilly.com/library/view/temporal-data-and/9781558608559/)
- [CockroachDB AS OF SYSTEM TIME](https://www.cockroachlabs.com/docs/stable/as-of-system-time.html)
- [Datomic Temporal Model](https://docs.datomic.com/cloud/whatis/data-model.html)
- [Git Object Model](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects)
