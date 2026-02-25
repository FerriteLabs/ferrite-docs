---
sidebar_position: 3
maturity: stable
---

# Configuration

Ferrite can be configured via a TOML configuration file, environment variables, or command-line arguments.

> Note: The canonical schema is documented in `/docs/CONFIGURATION.md` and
> `ferrite.example.toml`. Size values are raw bytes and durations are integer
> seconds. Advanced feature modules (vector, semantic, temporal, etc.) are not
> loaded from `ferrite.toml` yet.

## Configuration File

Create a `ferrite.toml` file:

```toml
[server]
bind = "127.0.0.1"
port = 6379
max_connections = 10000
timeout = 0

[storage]
databases = 16
max_memory = 1073741824

[persistence]
aof_enabled = true
aof_sync = "everysec"
checkpoint_interval = 300

[metrics]
enabled = true
bind = "127.0.0.1"
port = 9090
```

Run with the configuration file:

```bash
./ferrite --config ferrite.toml
```

## Configuration Sections

### Server

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `bind` | string | `"127.0.0.1"` | IP address to bind to |
| `port` | integer | `6379` | Port to listen on |
| `max_connections` | integer | `10000` | Maximum concurrent connections |
| `timeout` | integer | `0` | Client timeout in seconds (0 = disabled) |
| `tcp_keepalive` | integer | `300` | TCP keepalive interval in seconds |

### Storage

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `databases` | integer | `16` | Number of databases (0-15) |
| `max_memory` | integer | `1073741824` | Maximum memory limit in bytes |
| `data_dir` | string | `"./data"` | Directory for persistent data |

### Persistence

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `aof_enabled` | boolean | `false` | Enable append-only file |
| `aof_sync` | string | `"everysec"` | AOF sync policy |
| `checkpoint_enabled` | boolean | `false` | Enable periodic checkpoints |
| `checkpoint_interval` | integer | `300` | Checkpoint interval in seconds |
| `checkpoint_dir` | string | `"./data/checkpoints"` | Checkpoint directory |

AOF sync policies:
- `always` - Sync after every write (safest, slowest)
- `everysec` - Sync every second (recommended)
- `no` - Let the OS decide (fastest, least safe)

### TLS

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable TLS |
| `cert_file` | string | - | Path to certificate file |
| `key_file` | string | - | Path to private key file |
| `ca_file` | string | - | Path to CA certificate (for mTLS) |
| `require_client_cert` | boolean | `false` | Require client certificates |
### ACL File

ACLs are stored in a separate file referenced by `server.acl_file`.

### Replication

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `role` | string | `"primary"` | Node role: "primary" or "replica" |
| `primary_host` | string | - | Primary host (for replicas) |
| `primary_port` | integer | - | Primary port (for replicas) |
| `replica_read_only` | boolean | `true` | Make replicas read-only |

### Cluster

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable cluster mode |
| `node_timeout` | integer | `15000` | Node timeout in milliseconds |
| `announce_ip` | string | - | IP to announce to other nodes |
| `announce_port` | integer | - | Port to announce to other nodes |

### Metrics

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable Prometheus metrics |
| `bind` | string | `"127.0.0.1"` | Metrics bind address |
| `port` | integer | `9090` | Metrics endpoint port |

## Environment Variables

All configuration options can be set via environment variables using the prefix `FERRITE_`:

```bash
FERRITE_PORT=6380
FERRITE_DATA_DIR=./data
FERRITE_LOG_LEVEL=debug
./ferrite
```

## Command-Line Arguments

```bash
./ferrite --help

Options:
  -c, --config <FILE>        Path to configuration file
  -p, --port <PORT>          Port to listen on [default: 6379]
  -b, --bind <ADDR>          Address to bind to [default: 127.0.0.1]
      --data-dir <DIR>       Data directory [default: ./data]
      --log-level <LEVEL>    Log level (trace, debug, info, warn, error)
      --metrics-bind <ADDR>  Metrics bind address
      --metrics-port <PORT>  Metrics port
      --dump-config          Print effective config and exit
```

## Example Configurations

### Development

```toml
[server]
bind = "127.0.0.1"
port = 6379

[storage]
max_memory = 268435456

[persistence]
aof_enabled = false
```

### Production

```toml
[server]
bind = "0.0.0.0"
port = 6379
max_connections = 50000

[storage]
max_memory = 8589934592
data_dir = "/var/lib/ferrite"

[persistence]
aof_enabled = true
aof_sync = "everysec"
checkpoint_enabled = true
checkpoint_interval = 3600

[tls]
enabled = true
cert_file = "/etc/ferrite/server.crt"
key_file = "/etc/ferrite/server.key"

[acl]
enabled = true

[metrics]
enabled = true
bind = "0.0.0.0"
port = 9090
```

## Next Steps

- [Embedded Mode](../guides/embedded-mode) - Use Ferrite as a library
- [Persistence](../guides/persistence) - Learn about durability options
- [Security](../advanced/security) - Configure TLS and ACLs
