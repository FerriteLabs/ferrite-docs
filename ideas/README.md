# Ferrite Innovation Roadmap

This directory contains detailed plans for innovative features that could differentiate Ferrite from other Redis alternatives.

## Overview

| # | Feature | Priority | Effort | Description |
|---|---------|----------|--------|-------------|
| 1 | [Vector Search Native](01-vector-search-native.md) | High | 3-4 months | Built-in HNSW/IVF indexes for AI/ML workloads |
| 2 | [Time-Travel Queries](02-time-travel-queries.md) | Medium-High | 6-8 weeks | Query data at any point in time |
| 3 | [CRDT Multi-Region](03-crdt-multi-region.md) | High | 3-4 months | Conflict-free geo-distributed replication |
| 4 | [WebAssembly Functions](04-webassembly-functions.md) | Medium | 2-3 months | Polyglot serverless functions at data layer |
| 5 | [Cost-Aware Tiering](05-cost-aware-tiering.md) | High | 6-8 weeks | Intelligent cost-optimized data placement |
| 6 | [Native CDC](06-native-cdc.md) | High | 6-8 weeks | Change Data Capture for event-driven architectures |
| 7 | [Embedded Mode](07-embedded-mode.md) | Medium | 4-6 weeks | Run Ferrite as a library (like SQLite) |

## Recommended Implementation Order

### Phase 1: Foundation (Q1)
1. **Cost-Aware Tiering** - Directly supports "economics of cloud" value prop
2. **Native CDC** - Enables event-driven integrations, minimal risk

### Phase 2: Differentiation (Q2)
3. **Time-Travel Queries** - Unique capability, leverages existing HybridLog
4. **Embedded Mode** - Opens new market segment (edge, CLI, mobile)

### Phase 3: Enterprise Features (Q3)
5. **CRDT Multi-Region** - Enterprise-grade geo-distribution
6. **Vector Search** - AI/ML market opportunity

### Phase 4: Developer Experience (Q4)
7. **WebAssembly Functions** - Modern alternative to Lua scripting

## Quick Wins (Can be done anytime)

These smaller features provide high value with lower effort:

- `DEBUG COST` command - Show tiering cost per key
- `MEMORY TIER` command - Show which tier holds a key
- Native JSON path queries
- Prometheus carbon/power metrics
- `SLOWLOG` with tier attribution

## Decision Criteria

When prioritizing features, consider:

1. **Market Differentiation** - Does this set Ferrite apart?
2. **Value Proposition Alignment** - Does it support "speed + capacity + economics"?
3. **Implementation Risk** - How complex is the implementation?
4. **Customer Demand** - Are users asking for this?
5. **Ecosystem Impact** - Does it enable other features/integrations?

## Contributing

To propose a new feature:

1. Create a new markdown file following the existing template
2. Include: problem statement, technical design, API, implementation plan
3. Add estimated effort and priority recommendation
4. Submit for review

## Status Tracking

| Feature | Status | Progress |
|---------|--------|----------|
| Vector Search | Proposal | 0% |
| Time-Travel | Proposal | 0% |
| CRDT Multi-Region | Proposal | 0% |
| WebAssembly | Proposal | 0% |
| Cost-Aware Tiering | Proposal | 0% |
| Native CDC | Proposal | 0% |
| Embedded Mode | Proposal | 0% |
