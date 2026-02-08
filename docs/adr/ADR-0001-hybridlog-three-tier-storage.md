# ADR-0001: HybridLog Three-Tier Storage Architecture

## Status

Accepted

## Context

Ferrite aims to be a high-performance Redis replacement that can handle datasets larger than available memory while maintaining sub-millisecond latency for hot data. Traditional approaches force a choice between:

1. **Pure in-memory stores** (like Redis): Fast but limited by RAM capacity and expensive at scale
2. **Disk-based stores**: Large capacity but high latency for all operations
3. **Simple caching layers**: Require complex invalidation logic and don't provide durability

We needed an architecture that could:
- Serve hot data with in-memory speed (sub-millisecond latency)
- Handle warm data efficiently without consuming RAM
- Store cold data on disk without blocking hot path operations
- Provide a unified API regardless of where data physically resides
- Support datasets 10-100x larger than available memory

Microsoft Research's FASTER paper demonstrated a novel "HybridLog" approach that addresses these requirements through a tiered log structure with different access patterns per tier.

## Decision

We adopt a **three-tier HybridLog storage architecture** inspired by Microsoft FASTER:

### Tier 1: Mutable Region (Hot Data)
- **Location**: In-memory, append-only log
- **Access**: Lock-free reads, in-place updates
- **Use case**: Recently written or frequently accessed data
- **Implementation**: `src/storage/hybridlog/mutable.rs`

### Tier 2: Read-Only Region (Warm Data)
- **Location**: Memory-mapped files (mmap)
- **Access**: Zero-copy reads, copy-on-write for updates
- **Use case**: Data that's read but rarely modified
- **Implementation**: `src/storage/hybridlog/readonly.rs`

### Tier 3: Disk Region (Cold Data)
- **Location**: On-disk files accessed via async I/O
- **Access**: Async reads via io_uring, updates trigger promotion
- **Use case**: Historical data, infrequently accessed
- **Implementation**: `src/storage/hybridlog/disk.rs`

### Data Flow
```
Write Path:
  Client → Mutable Region (memory) → [async flush] → Read-Only → Disk

Read Path:
  Client → Check Mutable → Check Read-Only (mmap) → Check Disk (async I/O)
                ↓                    ↓                      ↓
            Immediate            Zero-copy              Async fetch
```

### Key Design Elements
1. **Log-structured storage**: All writes append to the mutable region
2. **Epoch-based boundaries**: Clear demarcation between tiers based on logical time
3. **Lazy migration**: Data moves between tiers based on access patterns and memory pressure
4. **Hash index**: Separate index tracks current location of each key across tiers

## Consequences

### Positive
- **Tiered performance**: Hot data served at memory speed, cold data doesn't waste RAM
- **Cost efficiency**: Can use NVMe/SSD for 10-100x capacity at fraction of RAM cost
- **Predictable latency**: Hot path never blocked by cold data I/O
- **Zero-copy reads**: Warm tier uses mmap for efficient reads without serialization
- **Graceful degradation**: System remains responsive even under memory pressure

### Negative
- **Complexity**: Three tiers means more code paths and edge cases to handle
- **Update amplification**: Updating cold data requires read-modify-write cycle
- **Compaction overhead**: Log-structured storage requires background compaction
- **Memory mapping limits**: 32-bit systems have limited mmap address space (not a concern for target deployments)

### Trade-offs
- **Latency variance**: Cold data access is 100-1000x slower than hot data (by design)
- **Write amplification**: Updates to old data require copying to mutable region
- **Index memory**: Hash index must fit in memory for O(1) lookups

## Implementation Notes

Key files:
- `src/storage/hybridlog/mod.rs` - Core HybridLog implementation
- `src/storage/hybridlog/mutable.rs` - Mutable region management
- `src/storage/hybridlog/readonly.rs` - Memory-mapped read-only region
- `src/storage/hybridlog/disk.rs` - Disk tier with async I/O
- `src/storage/index.rs` - Hash index tracking key locations
- `src/storage/epoch.rs` - Epoch-based reclamation

Configuration options:
```toml
[storage.hybridlog]
mutable_size_mb = 256        # Size before flush to read-only
readonly_size_mb = 1024      # Size before migration to disk
flush_interval_ms = 100      # Background flush frequency
```

## References

- [FASTER: A Concurrent Key-Value Store with In-Place Updates](https://www.microsoft.com/en-us/research/uploads/prod/2018/03/faster-sigmod18.pdf) - Microsoft Research, SIGMOD 2018
- [Epoch-Based Reclamation](https://aturon.github.io/blog/2015/08/27/epoch/) - Aaron Turon
