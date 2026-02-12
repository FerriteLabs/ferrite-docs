---
sidebar_position: 2
maturity: stable
---

# Server Mode

Run Ferrite as a standalone server that accepts connections from any Redis-compatible client.

## Starting the Server

### Basic Start

```bash
# Start with defaults (port 6379)
./ferrite

# Start with custom port
./ferrite --port 6380

# Start with config file
./ferrite --config ferrite.toml
```

### With Logging

```bash
# Enable debug logging
RUST_LOG=ferrite=debug ./ferrite

# Enable trace logging (very verbose)
RUST_LOG=ferrite=trace ./ferrite

# Log to file
RUST_LOG=ferrite=info ./ferrite 2>&1 | tee ferrite.log
```

## Connecting Clients

### Redis CLI

```bash
redis-cli -p 6379
```

### With TLS

```bash
redis-cli --tls -p 6379
```

### With Authentication

```bash
redis-cli -p 6379 -a your_password
```

## Server Commands

### INFO

Get server information:

```bash
127.0.0.1:6379> INFO
# Server
ferrite_version:0.1.0
rust_version:1.88.0
os:linux
arch:x86_64
uptime_in_seconds:3600

# Clients
connected_clients:5
blocked_clients:0

# Memory
used_memory:1048576
used_memory_human:1MB
maxmemory:0

# Stats
total_connections_received:100
total_commands_processed:10000
ops_per_sec:1500
```

### CLIENT LIST

See connected clients:

```bash
127.0.0.1:6379> CLIENT LIST
id=1 addr=127.0.0.1:52341 fd=5 name= age=100 idle=0 flags=N db=0 cmd=client
id=2 addr=127.0.0.1:52342 fd=6 name=worker age=50 idle=10 flags=N db=0 cmd=get
```

### CONFIG

View and modify configuration:

```bash
# Get config value
127.0.0.1:6379> CONFIG GET maxmemory
1) "maxmemory"
2) "0"

# Set config value
127.0.0.1:6379> CONFIG SET maxmemory 1gb
OK

# Get all config
127.0.0.1:6379> CONFIG GET *
```

### DEBUG

Debug commands (use with caution):

```bash
# Force a crash (testing)
127.0.0.1:6379> DEBUG SEGFAULT

# Sleep the server
127.0.0.1:6379> DEBUG SLEEP 5

# Get object encoding
127.0.0.1:6379> DEBUG OBJECT mykey
```

## Monitoring

### MONITOR

Watch all commands in real-time:

```bash
127.0.0.1:6379> MONITOR
OK
1610000000.000000 [0 127.0.0.1:52341] "SET" "foo" "bar"
1610000000.100000 [0 127.0.0.1:52342] "GET" "foo"
```

### SLOWLOG

View slow commands:

```bash
# Get last 10 slow commands
127.0.0.1:6379> SLOWLOG GET 10

# Reset slow log
127.0.0.1:6379> SLOWLOG RESET

# Configure slow log threshold (microseconds)
127.0.0.1:6379> CONFIG SET slowlog-log-slower-than 10000
```

### Prometheus Metrics

Ferrite exposes Prometheus metrics at the configured metrics port:

```bash
curl http://localhost:9090/metrics
```

Available metrics:
- `ferrite_commands_total` - Total commands processed
- `ferrite_connections_total` - Total connections received
- `ferrite_connected_clients` - Current connected clients
- `ferrite_memory_bytes` - Memory usage
- `ferrite_keys_total` - Number of keys per database
- `ferrite_latency_seconds` - Command latency histogram

## Pub/Sub

Ferrite supports Redis Pub/Sub:

### Subscribe

```bash
127.0.0.1:6379> SUBSCRIBE channel1 channel2
Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "channel1"
3) (integer) 1
```

### Publish

```bash
127.0.0.1:6379> PUBLISH channel1 "Hello, subscribers!"
(integer) 2
```

### Pattern Subscribe

```bash
127.0.0.1:6379> PSUBSCRIBE news.*
Reading messages... (press Ctrl-C to quit)
```

## Graceful Shutdown

### SHUTDOWN Command

```bash
127.0.0.1:6379> SHUTDOWN
# Server will save data and exit

127.0.0.1:6379> SHUTDOWN NOSAVE
# Server will exit without saving
```

### Signal Handling

The server handles signals gracefully:

- `SIGTERM` / `SIGINT` - Graceful shutdown with save
- `SIGHUP` - Reload configuration

```bash
# Send graceful shutdown
kill -TERM $(pgrep ferrite)

# Send reload signal
kill -HUP $(pgrep ferrite)
```

## Running as a Service

### systemd

Create `/etc/systemd/system/ferrite.service`:

```ini
[Unit]
Description=Ferrite Key-Value Store
After=network.target

[Service]
Type=simple
User=ferrite
Group=ferrite
ExecStart=/usr/local/bin/ferrite --config /etc/ferrite/ferrite.toml
ExecStop=/bin/kill -s TERM $MAINPID
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable ferrite
sudo systemctl start ferrite
sudo systemctl status ferrite
```

### Docker Compose

```yaml
version: '3.8'
services:
      ferrite:
        image: ferrite/ferrite:latest
        ports:
          - "6379:6379"
          - "9090:9090"
    volumes:
      - ferrite-data:/data
      - ./ferrite.toml:/etc/ferrite/ferrite.toml:ro
    environment:
      - FERRITE_BIND=0.0.0.0
      - FERRITE_METRICS_BIND=0.0.0.0
    command: ["--config", "/etc/ferrite/ferrite.toml"]
    restart: unless-stopped

volumes:
  ferrite-data:
```

## Performance Tuning

### TCP Settings

```toml
[server]
tcp_backlog = 511
tcp_keepalive = 300
```

### Memory Settings

```toml
[storage]
max_memory = 8589934592
```

### Thread Pool

```toml
[server]
io_threads = 4  # Number of I/O threads
```

## Next Steps

- [Persistence](/docs/guides/persistence) - Configure durability
- [Replication](/docs/advanced/replication) - Set up primary-replica
- [Clustering](/docs/advanced/clustering) - Scale horizontally
