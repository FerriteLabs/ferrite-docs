---
sidebar_position: 1
maturity: stable
---

# CLI Reference

Complete reference for Ferrite command-line tools.

## ferrite (Server)

### Usage

```bash
ferrite [OPTIONS] [COMMAND]
```

### Commands

| Command | Description |
|---------|-------------|
| `run` | Start the server (default) |
| `init` | Generate a new configuration file |
| `completions` | Generate shell completions |

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--config <FILE>` | `-c` | Configuration file path | `ferrite.toml` |
| `--bind <ADDR>` | `-b` | Bind address (alias: `--host`) | `127.0.0.1` |
| `--port <PORT>` | `-p` | Server port | `6379` |
| `--databases <NUM>` | | Number of databases (1-16) | `16` |
| `--data-dir <DIR>` | | Data directory | `./data` |
| `--log-level <LEVEL>` | `-l` | Log level | `info` |
| `--metrics-bind <ADDR>` | | Metrics bind address | `127.0.0.1` |
| `--metrics-port <PORT>` | | Metrics port | `9090` |
| `--set <KEY=VALUE>` | | Apply supported config overrides | |
| `--test-config` | | Validate config and exit | |
| `--dump-config` | | Print effective config and exit | |

### Examples

```bash
# Generate a config and start
ferrite init --output ferrite.toml
ferrite --config ferrite.toml

# Override port and bind
ferrite --port 6380 --bind 0.0.0.0

# Print effective configuration
ferrite --config ferrite.toml --dump-config
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `FERRITE_PORT` | Server port |
| `FERRITE_BIND` | Bind address |
| `FERRITE_DATA_DIR` | Data directory |
| `FERRITE_DATABASES` | Number of databases |
| `FERRITE_LOG_LEVEL` | Log level |
| `FERRITE_METRICS_BIND` | Metrics bind address |
| `FERRITE_METRICS_PORT` | Metrics port |

Use `--config` to point at a non-default config file.

---

## ferrite-cli (Interactive Client)

### Usage

```bash
ferrite-cli [OPTIONS] [COMMAND]
```

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--host <HOST>` | `-h` | Server hostname | `127.0.0.1` |
| `--port <PORT>` | `-p` | Server port | `6379` |
| `--db <DB>` | `-n` | Database number | `0` |
| `--password <PASS>` | `-a` | Authentication password | |
| `--user <USER>` | | ACL username | |
| `--format <FORMAT>` | | Output format (raw, pretty, json) | `raw` |
| `--stat` | | Continuous stats output | false |
| `--stat-interval <SEC>` | | Stat mode interval | `1` |

### Examples

```bash
# Interactive mode
ferrite-cli

# Non-interactive command
ferrite-cli GET mykey

# With auth
ferrite-cli -a mypassword -n 1
```

---

## ferrite-tui (Dashboard)

Build with the `tui` feature:

```bash
cargo build --release --features tui
ferrite-tui
```

---

## ferrite-migrate (Migration Tool)

```bash
ferrite-migrate analyze --source redis://localhost:6379
ferrite-migrate plan --source redis://localhost:6379 --target ferrite://localhost:6380
```

---

## ferrite-bench (Benchmark Tool)

```bash
ferrite-bench --help
```
