# Ferrite Documentation

Official documentation for [Ferrite](https://github.com/ferritelabs/ferrite) — a high-performance, tiered-storage key-value store.

## Structure

- `website/` — [Docusaurus](https://docusaurus.io/) documentation site
- `docs/` — Markdown reference documentation
- `specs/` — TLA+ formal specifications
- `ideas/` — Design documents and feature proposals

## Development

```bash
cd website
npm install
npm start    # Dev server at http://localhost:3000
npm run build  # Production build
```

## Related Repositories

| Repository | Description |
|-----------|-------------|
| [ferrite](https://github.com/ferritelabs/ferrite) | Core database engine (Cargo workspace) |
| [ferrite-ops](https://github.com/ferritelabs/ferrite-ops) | Docker, Helm, Grafana, packaging |
| [vscode-ferrite](https://github.com/ferritelabs/vscode-ferrite) | VS Code extension |
| [jetbrains-ferrite](https://github.com/ferritelabs/jetbrains-ferrite) | JetBrains IDE plugin |
| [homebrew-tap](https://github.com/ferritelabs/homebrew-tap) | Homebrew formula |
| [ferrite-bench](https://github.com/ferritelabs/ferrite-bench) | Performance benchmarks |

## License

Apache-2.0
