# Adaptive Cost-Aware Tiering

## Executive Summary

Intelligent data tiering that optimizes for cost, not just recency. Automatically balances storage costs, access patterns, and latency requirements to minimize total cost of ownership while meeting SLA targets.

**Status**: Proposal
**Priority**: High (Aligns with core value proposition)
**Estimated Effort**: 6-8 weeks
**Target Release**: v0.3.0

---

## Problem Statement

### The Cost Reality

| Storage Tier | Cost/GB/Month | Latency | Notes |
|--------------|---------------|---------|-------|
| RAM (Redis) | $5-10 | <1ms | Current Redis model |
| RAM (Ferrite) | $5-10 | <1ms | Hot tier |
| NVMe SSD | $0.10-0.20 | 1-5ms | Warm tier |
| Cloud Object (S3) | $0.02-0.03 | 50-200ms | Cold tier |
| S3 Glacier | $0.004 | Hours | Archive |

**A 1TB dataset costs:**
- 100% in RAM: **$10,000/month**
- 10% RAM + 90% SSD: **$1,180/month** (88% savings)
- 10% RAM + 30% SSD + 60% S3: **$1,072/month** (89% savings)

### Current Tiering Limitations

Most tiering systems use simple LRU (Least Recently Used):
- Recently accessed → hot tier
- Not accessed recently → cold tier

**Problems with LRU:**

1. **Ignores Access Patterns**
   - A key accessed once/day might be more valuable than one accessed 10x yesterday
   - Periodic batch jobs can pollute hot tier

2. **Ignores Key Size**
   - 1KB key and 1MB key treated equally
   - Large rarely-accessed keys waste expensive RAM

3. **Ignores Business Value**
   - User session (latency-critical) treated same as analytics data
   - No way to express "this key is worth keeping hot"

4. **No Cost Awareness**
   - Doesn't know S3 GET costs $0.0004/1000 requests
   - High-read cold keys may cost more than keeping them warm

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   Cost-Aware Tiering Engine                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Access Pattern Analyzer                   │ │
│  │  • Frequency tracking (reads/writes per key)                │ │
│  │  • Recency tracking (last access time)                      │ │
│  │  • Size tracking (bytes per key)                            │ │
│  │  • Pattern detection (periodic, burst, steady)              │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      Cost Calculator                        │ │
│  │  • Storage cost per tier                                    │ │
│  │  • Access cost per tier (GET/PUT operations)                │ │
│  │  • Network transfer costs                                   │ │
│  │  • Predicted cost over time horizon                         │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Placement Optimizer                       │ │
│  │  • Per-key optimal tier selection                           │ │
│  │  • Capacity constraints                                     │ │
│  │  • SLA/latency requirements                                 │ │
│  │  • Migration scheduling                                     │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Migration Executor                        │ │
│  │  • Background data movement                                 │ │
│  │  • Rate limiting                                            │ │
│  │  • Consistency guarantees                                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Core Data Structures

#### Access Statistics

```rust
/// Access statistics for a single key
#[derive(Clone, Serialize, Deserialize)]
pub struct KeyAccessStats {
    /// Key identifier
    key_hash: u64,
    /// Key size in bytes
    size: u32,
    /// Current tier
    tier: StorageTier,
    /// Access counts per time window
    access_counts: AccessCounts,
    /// Last access timestamp
    last_access: Instant,
    /// Last write timestamp
    last_write: Instant,
    /// Custom priority (user-defined)
    priority: Priority,
}

/// Rolling access counts
#[derive(Clone, Serialize, Deserialize)]
pub struct AccessCounts {
    /// Reads in last minute
    reads_1m: u32,
    /// Reads in last hour
    reads_1h: u32,
    /// Reads in last day
    reads_1d: u32,
    /// Writes in last minute
    writes_1m: u32,
    /// Writes in last hour
    writes_1h: u32,
    /// Writes in last day
    writes_1d: u32,
}

#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StorageTier {
    Memory,   // Fastest, most expensive
    Mmap,     // Read-only memory-mapped
    Ssd,      // Local SSD
    Cloud,    // S3/GCS/Azure Blob
    Archive,  // Glacier/Archive storage
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Priority {
    /// Never tier down (always in memory)
    Critical,
    /// Prefer memory, reluctant to tier
    High,
    /// Normal tiering behavior
    Normal,
    /// Eager to tier to cheaper storage
    Low,
    /// Archive as soon as possible
    Archive,
}
```

#### Cost Model

```rust
/// Cost configuration for each tier
#[derive(Clone, Serialize, Deserialize)]
pub struct TierCostConfig {
    pub memory: TierCost,
    pub ssd: TierCost,
    pub cloud: TierCost,
    pub archive: TierCost,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct TierCost {
    /// Storage cost per GB per month
    pub storage_per_gb_month: f64,
    /// Cost per 1000 read operations
    pub read_per_1k: f64,
    /// Cost per 1000 write operations
    pub write_per_1k: f64,
    /// Network egress per GB (for cloud tiers)
    pub egress_per_gb: f64,
    /// Typical read latency (ms)
    pub read_latency_ms: f64,
    /// Typical write latency (ms)
    pub write_latency_ms: f64,
}

impl Default for TierCostConfig {
    fn default() -> Self {
        Self {
            memory: TierCost {
                storage_per_gb_month: 10.0,
                read_per_1k: 0.0,
                write_per_1k: 0.0,
                egress_per_gb: 0.0,
                read_latency_ms: 0.1,
                write_latency_ms: 0.1,
            },
            ssd: TierCost {
                storage_per_gb_month: 0.15,
                read_per_1k: 0.0,
                write_per_1k: 0.0,
                egress_per_gb: 0.0,
                read_latency_ms: 1.0,
                write_latency_ms: 2.0,
            },
            cloud: TierCost {
                storage_per_gb_month: 0.023,  // S3 Standard
                read_per_1k: 0.0004,          // S3 GET
                write_per_1k: 0.005,          // S3 PUT
                egress_per_gb: 0.09,
                read_latency_ms: 50.0,
                write_latency_ms: 100.0,
            },
            archive: TierCost {
                storage_per_gb_month: 0.004,  // S3 Glacier
                read_per_1k: 0.01,
                write_per_1k: 0.05,
                egress_per_gb: 0.09,
                read_latency_ms: 3600000.0,   // Hours
                write_latency_ms: 1000.0,
            },
        }
    }
}
```

### Cost Calculation

```rust
impl TieringEngine {
    /// Calculate monthly cost of keeping a key in a specific tier
    pub fn calculate_monthly_cost(
        &self,
        stats: &KeyAccessStats,
        tier: StorageTier,
    ) -> TierCostBreakdown {
        let tier_cost = self.config.cost_for_tier(tier);
        let size_gb = stats.size as f64 / (1024.0 * 1024.0 * 1024.0);

        // Extrapolate daily access to monthly
        let monthly_reads = stats.access_counts.reads_1d as f64 * 30.0;
        let monthly_writes = stats.access_counts.writes_1d as f64 * 30.0;

        // Storage cost
        let storage_cost = size_gb * tier_cost.storage_per_gb_month;

        // Access costs (for cloud tiers)
        let read_cost = (monthly_reads / 1000.0) * tier_cost.read_per_1k;
        let write_cost = (monthly_writes / 1000.0) * tier_cost.write_per_1k;

        // Egress cost (assuming each read transfers the full value)
        let egress_cost = if tier == StorageTier::Cloud || tier == StorageTier::Archive {
            size_gb * monthly_reads * tier_cost.egress_per_gb
        } else {
            0.0
        };

        TierCostBreakdown {
            tier,
            storage_cost,
            read_cost,
            write_cost,
            egress_cost,
            total: storage_cost + read_cost + write_cost + egress_cost,
            latency_impact: tier_cost.read_latency_ms,
        }
    }

    /// Find optimal tier for a key
    pub fn optimal_tier(
        &self,
        stats: &KeyAccessStats,
        constraints: &PlacementConstraints,
    ) -> StorageTier {
        // Check priority overrides
        match stats.priority {
            Priority::Critical => return StorageTier::Memory,
            Priority::Archive => return StorageTier::Archive,
            _ => {}
        }

        // Calculate cost for each tier
        let costs: Vec<(StorageTier, TierCostBreakdown)> = StorageTier::all()
            .iter()
            .map(|&tier| (tier, self.calculate_monthly_cost(stats, tier)))
            .collect();

        // Filter by latency SLA
        let viable: Vec<_> = costs
            .into_iter()
            .filter(|(_, cost)| cost.latency_impact <= constraints.max_latency_ms)
            .collect();

        // Return cheapest viable tier
        viable
            .into_iter()
            .min_by(|a, b| a.1.total.partial_cmp(&b.1.total).unwrap())
            .map(|(tier, _)| tier)
            .unwrap_or(StorageTier::Memory)
    }
}
```

### Access Pattern Detection

```rust
/// Detect access patterns for smarter tiering
pub enum AccessPattern {
    /// Steady stream of accesses
    Steady { avg_per_hour: f64 },
    /// Periodic bursts (e.g., daily batch job)
    Periodic { period_hours: u32, burst_size: u32 },
    /// Declining access (candidate for archival)
    Declining { half_life_hours: f64 },
    /// Recently created, pattern unknown
    New,
    /// No recent access
    Cold,
}

impl AccessPatternAnalyzer {
    /// Analyze access history to detect pattern
    pub fn detect_pattern(&self, stats: &KeyAccessStats) -> AccessPattern {
        let reads_1h = stats.access_counts.reads_1h as f64;
        let reads_1d = stats.access_counts.reads_1d as f64;

        // No recent access
        if reads_1d == 0.0 {
            return AccessPattern::Cold;
        }

        // Check for periodicity (hourly pattern repeats)
        if self.is_periodic(&stats.access_history) {
            return AccessPattern::Periodic {
                period_hours: self.detect_period(&stats.access_history),
                burst_size: self.detect_burst_size(&stats.access_history),
            };
        }

        // Check for declining trend
        if reads_1h * 24.0 < reads_1d * 0.5 {
            return AccessPattern::Declining {
                half_life_hours: self.calculate_half_life(&stats.access_history),
            };
        }

        // Default to steady
        AccessPattern::Steady {
            avg_per_hour: reads_1d / 24.0,
        }
    }
}
```

---

## API Design

### Cost Configuration

```redis
# View current cost configuration
TIERING.COSTS

# Set tier costs
TIERING.COSTS SET <tier> <json>

# Examples
TIERING.COSTS SET memory '{"storage_per_gb_month": 10.0}'
TIERING.COSTS SET cloud '{"storage_per_gb_month": 0.023, "read_per_1k": 0.0004}'

# Import costs from cloud provider
TIERING.COSTS IMPORT aws us-east-1
TIERING.COSTS IMPORT gcp us-central1
TIERING.COSTS IMPORT azure eastus
```

### Tiering Policy

```redis
# View current policy
TIERING.POLICY

# Set optimization target
TIERING.POLICY SET OPTIMIZE <cost|latency|balanced>

# Set global constraints
TIERING.POLICY SET MAX_LATENCY <ms>
TIERING.POLICY SET MEMORY_BUDGET <bytes>

# Set per-pattern policies
TIERING.POLICY PATTERN <glob> PRIORITY <critical|high|normal|low|archive>
TIERING.POLICY PATTERN <glob> MAX_TIER <memory|ssd|cloud|archive>
TIERING.POLICY PATTERN <glob> MIN_TIER <memory|ssd|cloud|archive>

# Examples
TIERING.POLICY PATTERN "session:*" PRIORITY critical
TIERING.POLICY PATTERN "cache:*" MAX_TIER ssd
TIERING.POLICY PATTERN "analytics:*" PRIORITY low
TIERING.POLICY PATTERN "logs:*" PRIORITY archive

# Clear pattern policy
TIERING.POLICY PATTERN <glob> CLEAR
```

### Cost Analysis

```redis
# Get cost breakdown for a key
TIERING.COST <key>
# Returns:
# {
#   "key": "user:123:profile",
#   "size_bytes": 4096,
#   "current_tier": "memory",
#   "current_cost_monthly": 0.00004,
#   "access_pattern": "steady",
#   "reads_per_day": 150,
#   "writes_per_day": 2,
#   "optimal_tier": "ssd",
#   "optimal_cost_monthly": 0.000006,
#   "potential_savings": "85%",
#   "tier_breakdown": [
#     {"tier": "memory", "cost": 0.00004, "latency_ms": 0.1},
#     {"tier": "ssd", "cost": 0.000006, "latency_ms": 1.0},
#     {"tier": "cloud", "cost": 0.00008, "latency_ms": 50.0}
#   ]
# }

# Get cost summary for pattern
TIERING.COST PATTERN <glob>
# Aggregates costs for all matching keys

# Get total cost breakdown
TIERING.COST TOTAL
# Returns monthly cost breakdown by tier

# Simulate cost for different configurations
TIERING.COST SIMULATE <config_json>
```

### Dashboard Commands

```redis
# Real-time cost metrics
TIERING.INFO
# Returns:
# {
#   "total_keys": 1000000,
#   "total_size_gb": 50.5,
#   "monthly_cost_current": 523.45,
#   "monthly_cost_optimal": 312.20,
#   "potential_savings_pct": 40.3,
#   "tier_distribution": {
#     "memory": {"keys": 100000, "size_gb": 5.0, "cost": 50.0},
#     "ssd": {"keys": 500000, "size_gb": 25.0, "cost": 3.75},
#     "cloud": {"keys": 400000, "size_gb": 20.5, "cost": 0.47}
#   },
#   "migrations_pending": 1523,
#   "migrations_rate_per_sec": 100
# }

# Top costly keys
TIERING.TOP COST [LIMIT <count>]

# Top savings opportunities
TIERING.TOP SAVINGS [LIMIT <count>]

# Keys with suboptimal placement
TIERING.SUBOPTIMAL [LIMIT <count>]
```

### Key-Level Control

```redis
# Get key's current tier
TIERING.TIER <key>

# Pin key to specific tier (override automatic tiering)
TIERING.PIN <key> <tier>

# Unpin key (return to automatic tiering)
TIERING.UNPIN <key>

# Force immediate migration
TIERING.MIGRATE <key> <tier>

# Set key priority
TIERING.PRIORITY <key> <critical|high|normal|low|archive>

# Get access stats for key
TIERING.STATS <key>
```

---

## Implementation Plan

### Phase 1: Access Tracking (2 weeks)

#### Week 1: Statistics Collection

- [ ] Implement `KeyAccessStats` structure
- [ ] Add access counting to read/write paths
- [ ] Rolling window counters (1m, 1h, 1d)
- [ ] Efficient storage of stats (sampling for high-volume keys)

#### Week 2: Persistence and Aggregation

- [ ] Persist access stats across restarts
- [ ] Background aggregation task
- [ ] Memory-efficient stats storage (HyperLogLog for unique accessors)

### Phase 2: Cost Model (2 weeks)

#### Week 3: Cost Configuration

- [ ] Implement `TierCostConfig` structure
- [ ] Add `TIERING.COSTS` commands
- [ ] Cloud provider cost import (AWS, GCP, Azure)
- [ ] Default cost profiles

#### Week 4: Cost Calculator

- [ ] Implement per-key cost calculation
- [ ] Per-tier cost breakdown
- [ ] Monthly cost projection
- [ ] Unit tests with realistic scenarios

### Phase 3: Optimization Engine (3 weeks)

#### Week 5: Optimal Tier Selection

- [ ] Implement `optimal_tier()` logic
- [ ] Priority handling
- [ ] Latency constraint filtering
- [ ] Access pattern detection basics

#### Week 6: Batch Optimization

- [ ] Optimize tier placement across all keys
- [ ] Respect memory budget constraints
- [ ] Handle conflicting requirements
- [ ] Generate migration plan

#### Week 7: Migration Execution

- [ ] Background migration worker
- [ ] Rate limiting
- [ ] Progress tracking
- [ ] Rollback capability

### Phase 4: Dashboard & Polish (2 weeks)

#### Week 8: API Implementation

- [ ] Implement all `TIERING.*` commands
- [ ] Cost reporting
- [ ] Top N queries
- [ ] Integration with existing TUI

#### Week 9: Production Readiness

- [ ] Metrics and alerting
- [ ] Documentation
- [ ] Performance testing
- [ ] Cost validation against real cloud bills

---

## Dashboard Integration

### TUI Cost Dashboard

```
┌────────────────────────────────────────────────────────────────────────┐
│ Ferrite Cost Dashboard                                    [Cost] [Keys]│
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Monthly Cost: $523.45 (Optimal: $312.20, Savings: 40%)               │
│  ────────────────────────────────────────────────────────              │
│                                                                        │
│  Tier Distribution:                                                    │
│  ┌─────────────┬──────────┬──────────┬──────────┬─────────────────────┐│
│  │ Tier        │ Keys     │ Size     │ Cost/mo  │ Distribution        ││
│  ├─────────────┼──────────┼──────────┼──────────┼─────────────────────┤│
│  │ Memory      │ 100,000  │ 5.0 GB   │ $50.00   │ ████████░░░░░ 10%   ││
│  │ SSD         │ 500,000  │ 25.0 GB  │ $3.75    │ ████████████░ 50%   ││
│  │ Cloud       │ 400,000  │ 20.5 GB  │ $0.47    │ ████████░░░░░ 40%   ││
│  └─────────────┴──────────┴──────────┴──────────┴─────────────────────┘│
│                                                                        │
│  Top Savings Opportunities:                                            │
│  ┌─────────────────────────────┬───────────┬────────────┬─────────────┐│
│  │ Key                         │ Current   │ Optimal    │ Save/mo     ││
│  ├─────────────────────────────┼───────────┼────────────┼─────────────┤│
│  │ analytics:daily:2024*       │ Memory    │ Cloud      │ $12.50      ││
│  │ cache:rendered:*            │ Memory    │ SSD        │ $8.20       ││
│  │ session:expired:*           │ SSD       │ Archive    │ $3.15       ││
│  └─────────────────────────────┴───────────┴────────────┴─────────────┘│
│                                                                        │
│  Migrations: 1,523 pending │ Rate: 100/sec │ ETA: 15 min              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Prometheus Metrics

```
# HELP ferrite_tiering_monthly_cost_dollars Current monthly cost
# TYPE ferrite_tiering_monthly_cost_dollars gauge
ferrite_tiering_monthly_cost_dollars{tier="memory"} 50.00
ferrite_tiering_monthly_cost_dollars{tier="ssd"} 3.75
ferrite_tiering_monthly_cost_dollars{tier="cloud"} 0.47

# HELP ferrite_tiering_optimal_cost_dollars Optimal monthly cost
# TYPE ferrite_tiering_optimal_cost_dollars gauge
ferrite_tiering_optimal_cost_dollars 312.20

# HELP ferrite_tiering_keys_total Total keys per tier
# TYPE ferrite_tiering_keys_total gauge
ferrite_tiering_keys_total{tier="memory"} 100000
ferrite_tiering_keys_total{tier="ssd"} 500000
ferrite_tiering_keys_total{tier="cloud"} 400000

# HELP ferrite_tiering_migrations_pending Pending migrations
# TYPE ferrite_tiering_migrations_pending gauge
ferrite_tiering_migrations_pending 1523

# HELP ferrite_tiering_migrations_total Total completed migrations
# TYPE ferrite_tiering_migrations_total counter
ferrite_tiering_migrations_total{direction="demote"} 50000
ferrite_tiering_migrations_total{direction="promote"} 12000
```

---

## Configuration

### ferrite.toml

```toml
[tiering]
# Enable cost-aware tiering
enabled = true

# Optimization target: "cost", "latency", or "balanced"
optimize_for = "balanced"

# Global constraints
max_latency_ms = 10.0
memory_budget = "8GB"

# Cost calculation settings
cost_calculation_interval = "5m"
migration_rate_limit = "100/s"

# Default costs (can be overridden at runtime)
[tiering.costs.memory]
storage_per_gb_month = 10.0

[tiering.costs.ssd]
storage_per_gb_month = 0.15

[tiering.costs.cloud]
storage_per_gb_month = 0.023
read_per_1k = 0.0004
write_per_1k = 0.005
egress_per_gb = 0.09

# Pattern-based policies
[[tiering.patterns]]
pattern = "session:*"
priority = "critical"

[[tiering.patterns]]
pattern = "cache:*"
max_tier = "ssd"
priority = "normal"

[[tiering.patterns]]
pattern = "analytics:*"
priority = "low"

[[tiering.patterns]]
pattern = "logs:archive:*"
priority = "archive"
min_tier = "cloud"
```

---

## Testing Strategy

### Unit Tests

```rust
#[test]
fn test_cost_calculation_memory_vs_cloud() {
    let config = TierCostConfig::default();
    let stats = KeyAccessStats {
        size: 1024,              // 1KB
        reads_1d: 100,           // 100 reads/day
        writes_1d: 1,            // 1 write/day
        ..Default::default()
    };

    let memory_cost = calculate_monthly_cost(&stats, StorageTier::Memory, &config);
    let cloud_cost = calculate_monthly_cost(&stats, StorageTier::Cloud, &config);

    // Memory: storage only (small key, cheap)
    // Cloud: storage + read operations + egress
    // For high-read key, memory might be cheaper despite storage cost
}

#[test]
fn test_optimal_tier_with_latency_constraint() {
    // Ensure latency-critical keys stay in fast tiers
}

#[test]
fn test_priority_override() {
    // Ensure critical priority stays in memory regardless of cost
}
```

### Integration Tests

- [ ] End-to-end cost reporting
- [ ] Migration execution
- [ ] Policy enforcement
- [ ] Constraint satisfaction

### Validation Tests

- [ ] Compare calculated costs with actual cloud bills
- [ ] Verify savings claims with real workloads

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Cost model inaccuracies | High | Medium | Validate against real bills, allow overrides |
| Thrashing (frequent migrations) | Medium | Medium | Hysteresis, migration cooldown |
| Access tracking overhead | Medium | Low | Sampling for high-volume keys |
| Complex configuration | Medium | Medium | Good defaults, guided setup |

---

## Success Metrics

### Technical Metrics

- Cost prediction within 10% of actual
- Migration latency < 100ms P99
- < 1% overhead for access tracking

### Business Metrics

- Customers achieve 50%+ cost savings vs. Redis
- Cost dashboard viewed daily by operators
- Featured in cost optimization case studies

---

## Future Enhancements

1. **ML-Based Prediction** - Predict access patterns using ML
2. **Budget Alerts** - Warn when approaching budget limits
3. **Spot Instance Integration** - Use spot pricing for compute
4. **Multi-Cloud Arbitrage** - Move data to cheapest cloud
5. **Reserved Capacity Planning** - Recommend reserved instance purchases

---

## References

- [AWS S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [GCP Cloud Storage Pricing](https://cloud.google.com/storage/pricing)
- [Azure Blob Storage Pricing](https://azure.microsoft.com/en-us/pricing/details/storage/blobs/)
- [Garnet Tiered Storage](https://github.com/microsoft/garnet)
- [FASTER Paper](https://www.microsoft.com/en-us/research/publication/faster-a-concurrent-key-value-store-with-in-place-updates/)
