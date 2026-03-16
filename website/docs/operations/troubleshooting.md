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

## Error Code Reference

Ferrite returns structured numeric error codes for programmatic handling. Use these to
map errors to solutions.

### 1xxx — Protocol & Parsing Errors

| Code | Name | Cause | Solution |
|------|------|-------|----------|
| 1001 | `UNKNOWN_COMMAND` | Command not recognized | Check spelling; run `COMMAND LIST` to see available commands |
| 1002 | `WRONG_ARITY` | Wrong number of arguments | Check command documentation for correct argument count |
| 1003 | `SYNTAX_ERROR` | Malformed command syntax | Verify argument types and order match the command spec |
| 1004 | `PARSE_ERROR` | Cannot parse RESP frame | Ensure client sends valid RESP2/RESP3 protocol |

### 2xxx — Command Execution Errors

| Code | Name | Cause | Solution |
|------|------|-------|----------|
| 2000 | `WRONG_TYPE` | Operation against key of wrong type | Check key type with `TYPE key` before operating |
| 2001 | `NOT_INTEGER` | Value is not a valid integer | Ensure value can be parsed as integer for INCR/DECR |
| 2002 | `NOT_FLOAT` | Value is not a valid float | Ensure value is numeric for float operations |
| 2003 | `INDEX_OUT_OF_RANGE` | Index exceeds collection bounds | Check collection length with `LLEN`/`SCARD`/`ZCARD` first |
| 2004 | `OUT_OF_MEMORY` | maxmemory limit reached | Increase `maxmemory`, enable eviction policy, or add TTLs |

### 3xxx — Storage & Persistence Errors

| Code | Name | Cause | Solution |
|------|------|-------|----------|
| 3000 | `AOF` | Append-only file write failed | Check disk space and permissions on AOF directory |
| 3001 | `RDB` | RDB snapshot failed | Verify disk space; check `INFO persistence` for details |
| 3002 | `CHECKPOINT` | Checkpoint creation failed | Check memory availability; reduce checkpoint frequency |

### 4xxx — Authentication & Authorization Errors

| Code | Name | Cause | Solution |
|------|------|-------|----------|
| 4000 | `NO_AUTH` | Command requires authentication | Send `AUTH password` or `AUTH username password` first |
| 4001 | `NO_PERMISSION` | ACL denies this operation | Check user permissions with `ACL WHOAMI` and `ACL LIST` |
| 4002 | `INVALID_PASSWORD` | Authentication password is wrong | Verify password matches `requirepass` in config |

### 5xxx — Server & Connection Errors

| Code | Name | Cause | Solution |
|------|------|-------|----------|
| 5000 | `CONNECTION_CLOSED` | Client connection dropped | Check network stability; increase `tcp-keepalive` |
| 5001 | `TIMEOUT` | Command execution timed out | Reduce command complexity or increase timeout |
| 5002 | `INTERNAL` | Unexpected server error | Check server logs; report as a bug with diagnostic output |

## Ferrite Doctor

Run the built-in diagnostic tool to quickly identify issues:

```bash
# Quick health check (from client)
ferrite-cli MEMORY DOCTOR

# Full diagnostic report
ferrite-cli DEBUG REPORT
```

### Interpreting Doctor Output

| Finding | Severity | Action |
|---------|----------|--------|
| `sam: high memory fragmentation` | ⚠️ Warning | Restart server during maintenance window to defragment |
| `sam: out of memory` | 🔴 Critical | Increase `maxmemory` or enable eviction immediately |
| `sam: high CPU usage` | ⚠️ Warning | Check `SLOWLOG`; look for expensive commands (KEYS, SORT) |
| `sam: persistence falling behind` | ⚠️ Warning | Reduce write throughput or use faster storage for AOF |
| `sam: replication lag > 10s` | 🔴 Critical | Check network between primary/replica; increase backlog size |

### Quick Health Dashboard

Run this sequence to get a complete picture in seconds:

```bash
# 1. Is the server alive?
PING

# 2. Key metrics at a glance
INFO server    # uptime, version, mode
INFO memory    # used vs max, fragmentation ratio
INFO stats     # total commands processed, keyspace hits/misses
INFO persistence  # AOF/RDB status, last save time

# 3. Active problems?
SLOWLOG GET 5            # Recent slow commands
CLIENT LIST              # Connected clients, blocked clients
MEMORY DOCTOR            # Automated diagnosis

# 4. For clustered deployments
CLUSTER INFO             # Cluster state, slots coverage
CLUSTER NODES            # Node status and roles
```
