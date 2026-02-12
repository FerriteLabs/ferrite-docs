---
sidebar_position: 13
maturity: stable
---

# Server Commands

Commands for server management and administration.

## Overview

Server commands provide information about the Ferrite server, configuration management, and administrative operations.

## Commands

### PING

Test connection.

```bash
PING [message]
```

**Time Complexity:** O(1)

**Examples:**
```bash
PING
# PONG

PING "hello"
# "hello"
```

---

### ECHO

Echo message.

```bash
ECHO message
```

**Time Complexity:** O(1)

---

### QUIT

Close connection.

```bash
QUIT
```

**Time Complexity:** O(1)

---

### SELECT

Select database.

```bash
SELECT index
```

**Time Complexity:** O(1)

**Examples:**
```bash
SELECT 0
# OK

SELECT 15
# OK
```

---

### SWAPDB

Swap two databases.

```bash
SWAPDB index1 index2
```

**Time Complexity:** O(N) where N is the count of clients watching keys

---

### DBSIZE

Get number of keys.

```bash
DBSIZE
```

**Time Complexity:** O(1)

**Examples:**
```bash
DBSIZE
# (integer) 12345
```

---

### INFO

Get server information.

```bash
INFO [section ...]
```

**Sections:** server, clients, memory, persistence, stats, replication, cpu, cluster, keyspace, all, default

**Examples:**
```bash
INFO
# Full information

INFO server memory
# Server and memory sections only

INFO replication
# Replication info only
```

**Sample Output:**
```
# Server
ferrite_version:1.0.0
redis_version:7.2.0
arch_bits:64
multiplexing_api:io_uring
process_id:12345
uptime_in_seconds:86400
uptime_in_days:1

# Memory
used_memory:1048576
used_memory_human:1.00M
used_memory_peak:2097152
used_memory_peak_human:2.00M
```

---

### TIME

Get server time.

```bash
TIME
```

**Time Complexity:** O(1)

**Returns:** Unix timestamp (seconds) and microseconds.

**Examples:**
```bash
TIME
# 1) "1705320000"
# 2) "123456"
```

---

### LASTSAVE

Get last save timestamp.

```bash
LASTSAVE
```

**Time Complexity:** O(1)

---

### BGSAVE

Trigger background save.

```bash
BGSAVE [SCHEDULE]
```

**Time Complexity:** O(1)

**Examples:**
```bash
BGSAVE
# Background saving started

BGSAVE SCHEDULE
# Background saving scheduled
```

---

### BGREWRITEAOF

Trigger AOF rewrite.

```bash
BGREWRITEAOF
```

**Time Complexity:** O(1)

---

### SAVE

Synchronous save (blocks server).

```bash
SAVE
```

**Time Complexity:** O(N)

---

### SHUTDOWN

Shutdown server.

```bash
SHUTDOWN [NOSAVE | SAVE] [NOW] [FORCE] [ABORT]
```

**Options:**
- `NOSAVE` - Don't save before shutdown
- `SAVE` - Save before shutdown
- `NOW` - Skip waiting for clients
- `FORCE` - Force shutdown
- `ABORT` - Abort scheduled shutdown

---

### FLUSHDB

Clear current database.

```bash
FLUSHDB [ASYNC | SYNC]
```

**Time Complexity:** O(N)

---

### FLUSHALL

Clear all databases.

```bash
FLUSHALL [ASYNC | SYNC]
```

**Time Complexity:** O(N)

---

### DEBUG

Debug commands (subset supported).

```bash
DEBUG SLEEP seconds
DEBUG SEGFAULT
DEBUG RELOAD
```

---

### CONFIG

Manage configuration.

```bash
CONFIG GET pattern
CONFIG SET parameter value
CONFIG REWRITE
CONFIG RESETSTAT
```

**Examples:**
```bash
CONFIG GET maxmemory
# 1) "maxmemory"
# 2) "0"

CONFIG GET max*
# 1) "maxmemory"
# 2) "0"
# 3) "maxclients"
# 4) "10000"

CONFIG SET maxmemory 1gb
# OK

CONFIG REWRITE
# OK (saves to config file)
```

---

### SLOWLOG

Manage slow query log.

```bash
SLOWLOG GET [count]
SLOWLOG LEN
SLOWLOG RESET
```

**Examples:**
```bash
SLOWLOG GET 10
# Returns last 10 slow queries

SLOWLOG LEN
# (integer) 50
```

---

### MEMORY

Memory introspection.

```bash
MEMORY USAGE key [SAMPLES count]
MEMORY STATS
MEMORY DOCTOR
MEMORY MALLOC-SIZE ptr
MEMORY PURGE
```

**Examples:**
```bash
SET mykey "hello world"
MEMORY USAGE mykey
# (integer) 56

MEMORY STATS
# Returns detailed memory statistics

MEMORY DOCTOR
# Returns memory health report
```

---

### CLIENT

Manage client connections.

```bash
CLIENT LIST [TYPE normal|master|replica|pubsub]
CLIENT ID
CLIENT GETNAME
CLIENT SETNAME name
CLIENT KILL [ID id | TYPE type | ADDR addr | LADDR laddr | SKIPME yes/no]
CLIENT PAUSE timeout [WRITE | ALL]
CLIENT UNPAUSE
CLIENT NO-EVICT ON | OFF
CLIENT INFO
```

**Examples:**
```bash
CLIENT LIST
# id=1 addr=127.0.0.1:45678 name= age=10 idle=0 ...

CLIENT ID
# (integer) 1

CLIENT SETNAME myapp
# OK

CLIENT GETNAME
# "myapp"
```

---

### COMMAND

Command introspection.

```bash
COMMAND
COMMAND COUNT
COMMAND DOCS [command ...]
COMMAND GETKEYS command [arg ...]
COMMAND INFO [command ...]
COMMAND LIST [FILTERBY MODULE name | ACLCAT category | PATTERN pattern]
```

**Examples:**
```bash
COMMAND COUNT
# (integer) 250

COMMAND INFO GET SET
# Returns command metadata
```

---

### ACL

Access Control Lists.

```bash
ACL CAT [category]
ACL DELUSER username [username ...]
ACL DRYRUN username command [arg ...]
ACL GENPASS [bits]
ACL GETUSER username
ACL LIST
ACL LOAD
ACL LOG [count | RESET]
ACL SAVE
ACL SETUSER username [rule ...]
ACL USERS
ACL WHOAMI
```

**Examples:**
```bash
ACL LIST
# 1) "user default on nopass ~* &* +@all"

ACL WHOAMI
# "default"

ACL SETUSER alice on >password ~user:* +get +set
# OK
```

---

### LATENCY

Latency monitoring.

```bash
LATENCY DOCTOR
LATENCY GRAPH event
LATENCY HISTOGRAM [command ...]
LATENCY HISTORY event
LATENCY LATEST
LATENCY RESET [event ...]
```

---

### MODULE

Module management (Ferrite uses plugins instead).

```bash
MODULE LIST
MODULE LOAD path [arg ...]
MODULE LOADEX path [CONFIG name value ...] [ARGS arg ...]
MODULE UNLOAD name
```

Note: Ferrite uses WASM plugins. See [Plugin Commands](/docs/reference/commands/wasm).

## Rust API

```rust
use ferrite::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Ping
    let pong: String = client.ping().await?;

    // Get server info
    let info = client.info(Some("server")).await?;
    println!("Server info: {}", info);

    // Get database size
    let size: i64 = client.dbsize().await?;
    println!("Keys: {}", size);

    // Configuration
    let maxmem: Vec<(String, String)> = client.config_get("maxmemory").await?;
    client.config_set("maxmemory", "2gb").await?;

    // Memory usage
    let usage: i64 = client.memory_usage("mykey").await?;

    // Slow log
    let slow_queries = client.slowlog_get(10).await?;

    // Client info
    let client_list = client.client_list().await?;

    Ok(())
}
```

## Monitoring Script

```bash
#!/bin/bash
# Monitor Ferrite server

while true; do
    clear
    echo "=== Ferrite Server Status ==="
    echo ""

    # Uptime
    echo "Uptime:"
    redis-cli INFO server | grep uptime

    # Memory
    echo ""
    echo "Memory:"
    redis-cli INFO memory | grep -E "used_memory_human|used_memory_peak_human"

    # Clients
    echo ""
    echo "Clients:"
    redis-cli INFO clients | grep connected_clients

    # Stats
    echo ""
    echo "Operations:"
    redis-cli INFO stats | grep -E "total_commands_processed|instantaneous_ops_per_sec"

    # Keys
    echo ""
    echo "Keys:"
    redis-cli DBSIZE

    sleep 5
done
```

## Related Commands

- [Cluster Commands](/docs/reference/commands/cluster) - Cluster management
- [Configuration Reference](/docs/reference/configuration) - Full config options
- [Monitoring Guide](/docs/operations/monitoring) - Observability setup
