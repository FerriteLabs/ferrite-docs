---
sidebar_position: 2
title: Ferrite Roadmap
description: Planned features and improvements for Ferrite including performance enhancements, AI/ML features, enterprise capabilities, and ecosystem integrations.
keywords: [ferrite roadmap, upcoming features, ferrite future, redis alternative roadmap]
maturity: stable
---

# Roadmap

This roadmap outlines planned features and improvements for Ferrite.

## Current Status

Ferrite is in active development. Core features are stable and production-ready.

## Version 0.2 (Next)

### Performance
- [ ] Multi-threaded command processing
- [ ] Improved io_uring batching
- [ ] Memory-mapped warm tier optimizations

### Features
- [ ] Full Lua scripting support
- [ ] Stream data type (XADD, XREAD, etc.)
- [ ] Geospatial commands (GEO*)

### Operations
- [ ] Redis Sentinel compatibility
- [ ] Improved cluster resharding
- [ ] Online backup improvements

## Version 0.3

### AI/ML Features
- [ ] Built-in embedding models (no external API needed)
- [ ] RAG pipeline primitives
- [ ] Batch vector operations

### Enterprise
- [ ] Multi-tenancy improvements
- [ ] Row-level security
- [ ] Audit logging enhancements

### Integrations
- [ ] Kubernetes Operator GA
- [ ] Prometheus ServiceMonitor
- [ ] Grafana dashboards

## Version 1.0

### Stability
- [ ] API stability guarantee
- [ ] Long-term support (LTS)
- [ ] Comprehensive compatibility testing

### Documentation
- [ ] Complete command reference
- [ ] Migration guides from Redis/DragonflyDB/Garnet
- [ ] Performance tuning guide

### Ecosystem
- [ ] Official client libraries
- [ ] Plugin marketplace
- [ ] Community modules

## Future Considerations

These are ideas under consideration for future versions:

### Data Types
- Probabilistic data structures (Count-Min Sketch, Top-K)
- JSON document improvements
- Graph query language enhancements

### Storage
- NVMe direct I/O support
- Compression improvements
- Storage tiering to additional cloud providers

### Distributed Systems
- Global transactions
- Stronger consistency options
- Geographic partitioning

### AI/ML
- Model serving integration
- Feature store capabilities
- Online learning support

## Contributing

Want to help with a roadmap item? Check the [contributing guide](/docs/community/contributing) and look for issues tagged with the corresponding milestone.

## Feedback

Have suggestions for the roadmap? Start a discussion on GitHub Discussions or join our Discord.

## Release Schedule

We aim for regular releases:
- **Patch releases** (0.x.y) - As needed for bug fixes
- **Minor releases** (0.x.0) - Every 2-3 months with new features
- **Major releases** (x.0.0) - When API stability is achieved

All releases follow semantic versioning.
