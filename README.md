# Ferrite Documentation

[![CI](https://github.com/ferritelabs/ferrite-docs/actions/workflows/ci.yml/badge.svg)](https://github.com/ferritelabs/ferrite-docs/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![Docusaurus](https://img.shields.io/badge/Docusaurus-3.9-3ECC5F)](https://docusaurus.io/)
[![Website](https://img.shields.io/badge/docs-ferrite.dev-blue)](https://ferrite.dev)

Official documentation for [Ferrite](https://github.com/ferritelabs/ferrite) — a high-performance, tiered-storage key-value store designed as a drop-in Redis replacement.

## 📚 Live Site

Visit the documentation at **[ferrite.dev](https://ferrite.dev)**.

## Structure

| Directory | Purpose |
|-----------|---------|
| `website/` | [Docusaurus](https://docusaurus.io/) documentation site (190+ pages) |
| `docs/` | Markdown reference documentation, ADRs, and guides |
| `specs/` | TLA+ formal specifications (cluster failover, 2PC, CRDTs) |
| `ideas/` | Design documents and feature proposals |
| `blog/` | Blog posts and announcements |

### Documentation Coverage

- **Getting Started** — Installation, quickstart, first commands
- **Core Concepts** — Data types, persistence, replication, clustering
- **Operations** — Monitoring, backup/restore, troubleshooting, performance tuning
- **SDKs** — Rust, Python, Node.js, Go, TypeScript, Java, .NET, AI SDKs
- **Advanced** — Tiered storage, security, encryption, RDMA
- **Comparisons** — vs Redis, Dragonfly, KeyDB, Valkey, Garnet, Memcached
- **Use Cases** — Caching, session management, real-time analytics, ML feature stores

## Development

```bash
cd website
npm install
npm start        # Dev server at http://localhost:3000
npm run build    # Production build
npm run typecheck  # Type checking
```

## 🌐 FerriteLabs Ecosystem

| Repository | Description |
|-----------|-------------|
| [ferrite](https://github.com/ferritelabs/ferrite) | Core database engine (Rust, 12 crates) |
| **ferrite-docs** | 📍 You are here |
| [ferrite-ops](https://github.com/ferritelabs/ferrite-ops) | Docker, Helm, Grafana, packaging |
| [ferrite-bench](https://github.com/ferritelabs/ferrite-bench) | Performance benchmarks vs Redis, Dragonfly, KeyDB |
| [vscode-ferrite](https://github.com/ferritelabs/vscode-ferrite) | VS Code extension |
| [jetbrains-ferrite](https://github.com/ferritelabs/jetbrains-ferrite) | JetBrains IDE plugin |
| [homebrew-tap](https://github.com/ferritelabs/homebrew-tap) | Homebrew formula for macOS/Linux |

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Documentation improvements are one of the best ways to help the project — fixing typos, adding examples, and improving clarity all make a big difference.

## License

Apache-2.0
