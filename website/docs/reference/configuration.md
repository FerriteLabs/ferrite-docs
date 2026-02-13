---
sidebar_position: 2
maturity: stable
---

# Configuration Reference

Complete reference for the supported `ferrite.toml` schema and CLI overrides.

> Note: The authoritative schema is in `src/config.rs` and the canonical
> example is `ferrite.example.toml`. Size values are raw bytes and durations
> are integer seconds. Advanced feature modules (vector, semantic, temporal,
> etc.) use in-code defaults and are not loaded from `ferrite.toml` yet.

## Configuration File

Ferrite uses TOML format for configuration. Default location: `ferrite.toml`

```bash
ferrite --config /path/to/ferrite.toml
```

## Command-Line Options

```bash
ferrite [OPTIONS] [COMMAND]

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
```

Supported `--set` keys: `server.port`, `server.bind`, `logging.level`,
`storage.databases`, `persistence.aof_enabled`, `metrics.enabled`,
`metrics.bind`, `metrics.port`.

## Server Section

```toml
[server]
bind = "127.0.0.1"
port = 6379
max_connections = 10000
tcp_keepalive = 300
timeout = 0
acl_file = "./data/users.acl"
```

## Storage Section

```toml
[storage]
backend = "memory"         # memory | hybridlog
data_dir = "./data"
databases = 16
max_memory = 1073741824    # 1GB in bytes
max_key_size = 536870912
max_value_size = 536870912

# HybridLog settings (when backend = "hybridlog")
hybridlog_mutable_size = 67108864
hybridlog_readonly_size = 268435456
hybridlog_auto_tiering = true
hybridlog_migration_threshold = 0.8

# Prefetch
prefetch_enabled = true
prefetch_buffer_size = 65536
prefetch_read_ahead_entries = 16
```

## Persistence Section

```toml
[persistence]
aof_enabled = true
aof_path = "./data/appendonly.aof"
aof_sync = "everysec"        # always | everysec | no
checkpoint_enabled = true
checkpoint_interval = 300
checkpoint_dir = "./data/checkpoints"
```

## Replication Section

```toml
[replication]
replicaof = "primary.example.com:6379"
replica_read_only = true
backlog_size = 1048576
repl_timeout = 60
reconnect_delay = 5
```

## Cluster Section

```toml
[cluster]
enabled = false
node_addr = "10.0.0.1:6379"
bus_port_offset = 10000
node_timeout = 15000
replica_count = 1
failover_enabled = true
min_primaries = 1
require_full_coverage = true
known_nodes = ["10.0.0.2:6379", "10.0.0.3:6379"]
```

## TLS Section

```toml
[tls]
enabled = false
port = 6380
cert_file = "/path/to/server.crt"
key_file = "/path/to/server.key"
ca_file = "/path/to/ca.crt"
require_client_cert = false
```

## ACL Section

ACLs are stored in a separate file referenced by `server.acl_file`.

```
user default on nopass ~* &* +@all
```

## Metrics Section

```toml
[metrics]
enabled = true
bind = "127.0.0.1"
port = 9090
```

Metrics are served at `http://<bind>:<port>/metrics` with `/health`.

## Logging Section

```toml
[logging]
level = "info"   # trace | debug | info | warn | error
format = "pretty" # pretty | json
file = "/var/log/ferrite/ferrite.log"
```

## Cloud Tiering Section

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
size_threshold = 1024
max_cloud_size = 0
```

## Audit Section

```toml
[audit]
enabled = false
log_file = "/var/log/ferrite/audit.log"
format = "json"           # json | text
log_commands = []
exclude_commands = []
log_success = true
log_failures = true
log_auth = true
log_admin = true
max_file_size = 104857600
max_files = 10
```

## Encryption Section

```toml
[encryption]
enabled = false
key_file = "/etc/ferrite/keys/data.key"
algorithm = "chacha20poly1305" # chacha20poly1305 | aes256gcm
encrypt_aof = true
encrypt_rdb = true
encrypt_checkpoints = true
```

## OpenTelemetry Section

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

## Environment Variables

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
