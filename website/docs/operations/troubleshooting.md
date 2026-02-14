---
sidebar_position: 4
maturity: stable
---

# Troubleshooting

Diagnose and resolve common Ferrite issues.

## Quick Diagnostics

### Server Status

```bash
# Check if server is running
PING
# Expected: PONG

# Get server info
INFO server
```

### Resource Usage

```bash
# Memory usage
INFO memory

# Check for issues
DEBUG SLEEP 0  # Test command processing
```

## Common Issues

### Connection Refused

**Symptoms:**
```
Error: Connection refused (os error 111)
```

**Causes & Solutions:**

1. **Server not running**
   ```bash
   # Start server
   ferrite --config ferrite.toml
   ```

2. **Wrong host/port**
   ```bash
   # Check configuration
   ferrite-cli -h localhost -p 6379 PING
   ```

3. **Firewall blocking**
   ```bash
   # Check firewall rules
   sudo ufw allow 6379/tcp
   ```

4. **Bind address mismatch**
   ```toml
   # ferrite.toml - bind to all interfaces
   [network]
   bind = "0.0.0.0"
   port = 6379
   ```

### Out of Memory

**Symptoms:**
```
Error: OOM command not allowed when used memory > maxmemory
```

**Solutions:**

1. **Increase maxmemory**
   ```toml
   [memory]
   maxmemory = "16gb"
   ```

2. **Enable eviction**
   ```toml
   [memory]
   maxmemory_policy = "allkeys-lru"
   ```

3. **Add TTL to keys**
   ```bash
   EXPIRE key 3600
   ```

4. **Identify large keys**
   ```bash
   MEMORY USAGE large_key
   DEBUG OBJECT key
   ```

### High Latency

**Symptoms:**
- P99 latency > 10ms
- Slow responses

**Diagnostics:**
```bash
# Check slow log
SLOWLOG GET 10

# Check command stats
INFO commandstats
```

**Solutions:**

1. **Identify slow commands**
   ```bash
   SLOWLOG GET 25
   # Look for KEYS, SCAN without COUNT, large SORT
   ```

2. **Check memory pressure**
   ```bash
   INFO memory
   # Look for used_memory vs maxmemory
   ```

3. **Check persistence**
   ```bash
   INFO persistence
   # Long AOF rewrites can cause latency
   ```

4. **Check client connections**
   ```bash
   CLIENT LIST
   # Look for blocked clients
   ```

### Data Loss After Restart

**Symptoms:**
- Keys missing after restart
- Partial data recovery

**Diagnostics:**
```bash
# Check persistence status
INFO persistence

# Check AOF status
CONFIG GET appendonly
CONFIG GET appendfsync
```

**Solutions:**

1. **Enable persistence**
   ```toml
   [persistence.aof]
   enabled = true
   fsync = "everysec"
   ```

2. **Check AOF file**
   ```bash
   # Verify AOF integrity
   ferrite-check-aof appendonly.aof
   ```

3. **Repair corrupted AOF**
   ```bash
   ferrite-check-aof --fix appendonly.aof
   ```

### Replication Lag

**Symptoms:**
- Replica data behind master
- Stale reads from replica

**Diagnostics:**
```bash
# On master
INFO replication

# Check replica lag
ferrite_replica_lag_bytes
```

**Solutions:**

1. **Check network**
   ```bash
   # Test connectivity
   ping replica-host
   # Check bandwidth
   iperf3 -c replica-host
   ```

2. **Increase replication buffer**
   ```toml
   [replication]
   backlog_size = "64mb"
   ```

3. **Check replica load**
   ```bash
   # On replica
   INFO server
   INFO clients
   ```

### Authentication Failures

**Symptoms:**
```
NOAUTH Authentication required
ERR invalid password
```

**Solutions:**

1. **Check password**
   ```bash
   # Authenticate
   AUTH password
   # Or with username
   AUTH username password
   ```

2. **Verify configuration**
   ```toml
   [security]
   requirepass = "your-password"
   ```

3. **Check ACL**
   ```bash
   ACL LIST
   ACL WHOAMI
   ```

### Cluster Issues

**Symptoms:**
- CLUSTERDOWN
- Slot coverage incomplete
- Node unreachable

**Diagnostics:**
```bash
CLUSTER INFO
CLUSTER NODES
CLUSTER SLOTS
```

**Solutions:**

1. **Fix slot coverage**
   ```bash
   # Find uncovered slots
   CLUSTER SLOTS

   # Reassign slots
   CLUSTER ADDSLOTS 0 1 2 3 ...
   ```

2. **Forget failed node**
   ```bash
   CLUSTER FORGET <node-id>
   ```

3. **Fix configuration**
   ```bash
   # On each node
   CLUSTER RESET
   ```

## Debug Commands

### Memory Analysis

```bash
# Overall memory stats
MEMORY STATS

# Memory for specific key
MEMORY USAGE mykey

# Memory doctor
MEMORY DOCTOR
```

### Key Analysis

```bash
# Key info
TYPE mykey
OBJECT ENCODING mykey
OBJECT FREQ mykey
OBJECT IDLETIME mykey
DEBUG OBJECT mykey
```

### Client Analysis

```bash
# List clients
CLIENT LIST

# Kill specific client
CLIENT KILL ID 123

# Get client name
CLIENT GETNAME

# Set timeout for slow clients
CLIENT NO-EVICT ON
```

### Slow Log Analysis

```bash
# Get recent slow queries
SLOWLOG GET 25

# Reset slow log
SLOWLOG RESET

# Get slow log length
SLOWLOG LEN

# Configure threshold (microseconds)
CONFIG SET slowlog-log-slower-than 10000
```

## Log Analysis

### Enable Debug Logging

```toml
[logging]
level = "debug"
```

### Log Patterns to Watch

```bash
# Search for errors
grep "ERROR" /var/log/ferrite/ferrite.log

# Search for OOM
grep "OOM" /var/log/ferrite/ferrite.log

# Search for connection issues
grep "connection" /var/log/ferrite/ferrite.log

# Search for replication issues
grep "replica\|replication" /var/log/ferrite/ferrite.log
```

### Structured Log Queries

```bash
# Using jq for JSON logs
cat ferrite.log | jq 'select(.level == "error")'
cat ferrite.log | jq 'select(.duration_ms > 10)'
```

## Performance Profiling

### CPU Profiling

```bash
# Start CPU profile
PROFILE.START CPU DURATION 30

# Get results
PROFILE.RESULTS
```

### Memory Profiling

```bash
# Start memory profile
PROFILE.START MEMORY DURATION 30

# Get results
PROFILE.RESULTS
```

### Tracing

```bash
# Start trace session
TRACE.START mysession

# Execute commands...

# Stop and view
TRACE.STOP mysession
```

## Recovery Procedures

### Corrupt AOF Recovery

```bash
# 1. Backup current AOF
cp appendonly.aof appendonly.aof.backup

# 2. Check for corruption
ferrite-check-aof appendonly.aof

# 3. Fix if possible
ferrite-check-aof --fix appendonly.aof

# 4. Restart with fixed file
ferrite --config ferrite.toml
```

### Master Failover

```bash
# On replica, promote to master
REPLICAOF NO ONE

# Update clients to point to new master
```

### Cluster Recovery

```bash
# 1. Check cluster state
CLUSTER INFO
CLUSTER NODES

# 2. Fix failed nodes
CLUSTER FORGET <failed-node-id>

# 3. Rebalance slots
redis-cli --cluster rebalance host:port

# 4. Verify
CLUSTER INFO
```

## Getting Help

### Collect Diagnostics

```bash
# Generate diagnostic report
ferrite-cli DEBUG REPORT > diagnostics.txt

# Include:
INFO all
CLUSTER INFO  # if clustered
SLOWLOG GET 100
CLIENT LIST
MEMORY STATS
```

### Report Issues

When reporting issues, include:
1. Ferrite version (`INFO server`)
2. OS and version
3. Configuration (sanitized)
4. Error messages
5. Steps to reproduce
6. Diagnostic output

## Next Steps

- [Monitoring](/docs/operations/monitoring) - Proactive monitoring
- [Performance Tuning](/docs/operations/performance-tuning) - Optimization
- [Observability](/docs/operations/observability) - Deep diagnostics
