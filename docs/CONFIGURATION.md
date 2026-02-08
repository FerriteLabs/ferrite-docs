# Ferrite Configuration Reference

This document describes the configuration keys supported by `ferrite.toml` and the CLI.
The authoritative schema lives in `src/config.rs`, and the canonical example is
`ferrite.example.toml`.

> Note: Size values are raw bytes, and durations are integer seconds. Advanced
> feature modules (vector, semantic, etc.) currently use in-code defaults and are
> not loaded from `ferrite.toml`.

## Table of Contents

1. [Configuration Files](#configuration-files)
2. [Command-Line Options](#command-line-options)
3. [Server Configuration](#server-configuration)
4. [Storage Configuration](#storage-configuration)
5. [Persistence Configuration](#persistence-configuration)
6. [Replication Configuration](#replication-configuration)
7. [Cluster Configuration](#cluster-configuration)
8. [TLS Configuration](#tls-configuration)
9. [ACL File Configuration](#acl-file-configuration)
10. [Metrics Configuration](#metrics-configuration)
11. [Logging Configuration](#logging-configuration)
12. [Cloud Tiering Configuration](#cloud-tiering-configuration)
13. [Audit Logging Configuration](#audit-logging-configuration)
14. [Encryption Configuration](#encryption-configuration)
15. [OpenTelemetry Configuration](#opentelemetry-configuration)
16. [Environment Variables](#environment-variables)
17. [Complete Example](#complete-example)

---

## Configuration Files

Ferrite uses TOML format for configuration. The default configuration file is
`ferrite.toml` in the current directory. If it is missing but
`ferrite.example.toml` is present, Ferrite will load that as a fallback and
emit a warning; otherwise it uses built-in defaults.

### Loading Order

1. Default values (built-in)
2. Configuration file (`--config`, or `./ferrite.toml`, or `./ferrite.example.toml`)
3. Command-line arguments and their environment variable equivalents
4. `--set` overrides (highest priority)

Environment variables map directly to CLI flags and use the same precedence.

### Command-Line Options

```bash
ferrite [OPTIONS] [COMMAND]

Commands:
  run                 Start the server (default)
  init                Generate a new config file
  doctor              Run preflight checks
  completions         Generate shell completions

Options:
  -c, --config <FILE>        Path to configuration file [default: ferrite.toml]
  -b, --bind <ADDR>          Bind address (alias: --host)
  -p, --port <PORT>          Listen port [default: 6379]
      --metrics-bind <ADDR>  Metrics bind address [default: 127.0.0.1]
      --metrics-port <PORT>  Metrics port [default: 9090]
  -l, --log-level <LEVEL>    Log level (alias: --loglevel)
      --databases <NUM>      Number of logical databases (1-16)
      --data-dir <PATH>      Data directory path
      --set <KEY=VALUE>      Apply supported config overrides
      --test-config          Validate config and exit
      --dump-config          Print effective config and exit
      --help                 Print help
      --version              Print version
```

Supported `--set` keys: `server.port`, `server.bind`, `logging.level`,
`storage.databases`, `persistence.aof_enabled`, `metrics.enabled`,
`metrics.bind`, `metrics.port`.

---

## Server Configuration

```toml
[server]
bind = "127.0.0.1"      # Bind address (use 0.0.0.0 for all interfaces)
port = 6379             # Listen port
max_connections = 10000 # Maximum concurrent connections
tcp_keepalive = 300     # TCP keepalive interval (seconds)
timeout = 0             # Client timeout (seconds, 0 = disabled)
acl_file = "./data/users.acl" # Optional ACL file path
```

---

## Storage Configuration

```toml
[storage]
backend = "memory"      # memory | hybridlog
data_dir = "./data"     # Base data directory
databases = 16          # Number of logical databases (1-16)
max_memory = 1073741824 # Maximum memory in bytes (1GB)
max_key_size = 536870912   # Max key size (bytes)
max_value_size = 536870912 # Max value size (bytes)

# HybridLog settings (used when backend = "hybridlog")
hybridlog_mutable_size = 67108864        # 64MB
hybridlog_readonly_size = 268435456      # 256MB
hybridlog_auto_tiering = true
hybridlog_migration_threshold = 0.8

# Prefetch settings
prefetch_enabled = true
prefetch_buffer_size = 65536             # 64KB
prefetch_read_ahead_entries = 16
```

---

## Persistence Configuration

```toml
[persistence]
aof_enabled = true
aof_path = "./data/appendonly.aof"
aof_sync = "everysec"        # always | everysec | no
checkpoint_enabled = true
checkpoint_interval = 300    # seconds
checkpoint_dir = "./data/checkpoints"
```

---

## Replication Configuration

```toml
[replication]
replicaof = "primary.example.com:6379" # Empty/omitted for primaries
replica_read_only = true
backlog_size = 1048576  # 1MB
repl_timeout = 60       # seconds
reconnect_delay = 5     # seconds
```

---

## Cluster Configuration

```toml
[cluster]
enabled = false
node_addr = "10.0.0.1:6379" # Optional explicit address
bus_port_offset = 10000
node_timeout = 15000
replica_count = 1
failover_enabled = true
min_primaries = 1
require_full_coverage = true
known_nodes = ["10.0.0.2:6379", "10.0.0.3:6379"]
```

---

## TLS Configuration

```toml
[tls]
enabled = false
port = 6380
cert_file = "/path/to/server.crt"
key_file = "/path/to/server.key"
ca_file = "/path/to/ca.crt"  # Optional (mTLS)
require_client_cert = false
```

---

## ACL File Configuration

ACLs are configured in a separate file referenced by `server.acl_file`. The
format matches Redis ACL files.

```
# Default user (no password, full access)
user default on nopass ~* &* +@all
```

---

## Metrics Configuration

```toml
[metrics]
enabled = true
bind = "127.0.0.1"
port = 9090
```

Metrics are exposed at `http://<bind>:<port>/metrics` with a health check at
`/health` (paths are not configurable).

---

## Logging Configuration

```toml
[logging]
level = "info"   # trace | debug | info | warn | error
format = "pretty" # pretty | json
file = "/var/log/ferrite/ferrite.log" # Optional (stdout if omitted)
```

---

## Cloud Tiering Configuration

```toml
[cloud]
enabled = false
provider = "local"         # local | s3 | gcs | azure
bucket = "ferrite-data"
prefix = "cold/"
region = "us-east-1"
endpoint = "https://s3.amazonaws.com"
access_key_id = "AKIA..."
secret_access_key = "secret"
compression_enabled = true
compression_level = 6
min_age_seconds = 3600
size_threshold = 1024       # bytes
max_cloud_size = 0          # 0 = unlimited
```

---

## Audit Logging Configuration

```toml
[audit]
enabled = false
log_file = "/var/log/ferrite/audit.log"
format = "json"           # json | text
log_commands = []         # Empty = all commands
exclude_commands = []
log_success = true
log_failures = true
log_auth = true
log_admin = true
max_file_size = 104857600 # 100MB
max_files = 10
```

---

## Encryption Configuration

```toml
[encryption]
enabled = false
key_file = "/etc/ferrite/keys/data.key"
algorithm = "chacha20poly1305" # chacha20poly1305 | aes256gcm
encrypt_aof = true
encrypt_rdb = true
encrypt_checkpoints = true
```

---

## OpenTelemetry Configuration

```toml
[otel]
enabled = false
endpoint = "http://localhost:4317"
service_name = "ferrite"
traces_enabled = true
metrics_enabled = true
batch_max_queue_size = 2048
batch_max_export_batch_size = 512
```

---

## Environment Variables

CLI flags can be provided via environment variables:

```bash
export FERRITE_BIND=0.0.0.0
export FERRITE_PORT=6379
export FERRITE_DATA_DIR=./data
export FERRITE_DATABASES=16
export FERRITE_LOG_LEVEL=info
export FERRITE_METRICS_BIND=127.0.0.1
export FERRITE_METRICS_PORT=9090
```

Use `--config` to point at a non-default config file.

`RUST_LOG` can also be used to control tracing output.

---

## Complete Example

```toml
[server]
bind = "0.0.0.0"
port = 6379
max_connections = 10000
tcp_keepalive = 300
timeout = 0
acl_file = "/var/lib/ferrite/users.acl"

[storage]
backend = "hybridlog"
data_dir = "/var/lib/ferrite"
databases = 16
max_memory = 30000000000
max_key_size = 536870912
max_value_size = 536870912
hybridlog_mutable_size = 4294967296
hybridlog_readonly_size = 17179869184
hybridlog_auto_tiering = true
hybridlog_migration_threshold = 0.8
prefetch_enabled = true
prefetch_buffer_size = 65536
prefetch_read_ahead_entries = 16

[persistence]
aof_enabled = true
aof_path = "/var/lib/ferrite/appendonly.aof"
aof_sync = "everysec"
checkpoint_enabled = true
checkpoint_interval = 600
checkpoint_dir = "/var/lib/ferrite/checkpoints"

[replication]
replicaof = ""
replica_read_only = true
backlog_size = 1048576
repl_timeout = 60
reconnect_delay = 5

[cluster]
enabled = false
bus_port_offset = 10000
node_timeout = 15000
replica_count = 1
failover_enabled = true
min_primaries = 1
require_full_coverage = true
known_nodes = []

[tls]
enabled = false
port = 6380
cert_file = "/etc/ferrite/tls/server.crt"
key_file = "/etc/ferrite/tls/server.key"

[metrics]
enabled = true
bind = "0.0.0.0"
port = 9090

[logging]
level = "info"
format = "json"

[cloud]
enabled = false
provider = "local"
bucket = "ferrite-data"

[audit]
enabled = false
log_success = true
log_failures = true

[encryption]
enabled = false

[otel]
enabled = false
endpoint = "http://localhost:4317"
service_name = "ferrite"
```
