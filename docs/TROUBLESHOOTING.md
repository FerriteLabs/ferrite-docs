# Ferrite Troubleshooting Guide

This comprehensive guide covers common issues, diagnostics, and solutions for operating Ferrite in production environments.

## Table of Contents

1. [Startup Issues](#startup-issues)
2. [Connection Problems](#connection-problems)
3. [Memory Issues](#memory-issues)
4. [Persistence and Recovery Problems](#persistence-and-recovery-problems)
5. [Replication Issues](#replication-issues)
6. [Performance Problems](#performance-problems)
7. [Debug Logging](#debug-logging)
8. [Collecting Diagnostics](#collecting-diagnostics)
9. [FAQ](#faq)

---

## Startup Issues

### Ferrite fails to start with "Address already in use"

**Symptoms:**
```
Error: Address already in use (os error 48)
```

**Solutions:**

1. Check if another process is using the port:
   ```bash
   # Linux
   sudo lsof -i :6379
   sudo netstat -tlnp | grep 6379

   # macOS
   lsof -i :6379
   netstat -an | grep 6379
   ```

2. Stop the conflicting process or use a different port:
   ```bash
   ferrite --port 6380
   ```

3. If a previous Ferrite instance didn't shut down cleanly:
   ```bash
   pkill ferrite
   # Wait a few seconds
   ferrite --config /etc/ferrite/ferrite.toml
   ```

### Permission Denied Errors

**Symptoms:**
```
Error: Permission denied (os error 13)
```

**Common Causes**:

1. **Data directory not writable**:
   ```bash
   # Check permissions
   ls -la /var/lib/ferrite/

   # Fix permissions
   sudo chown -R ferrite:ferrite /var/lib/ferrite/
   sudo chmod 755 /var/lib/ferrite/
   ```

2. **Privileged port (< 1024)**:
   ```bash
   # Option 1: Use a higher port
   [server]
   port = 6379

   # Option 2: Grant capability (Linux)
   sudo setcap 'cap_net_bind_service=+ep' /usr/local/bin/ferrite

   # Option 3: Run as root (not recommended)
   sudo ferrite --config /etc/ferrite/ferrite.toml
   ```

3. **Log file not writable**:
   ```bash
   sudo mkdir -p /var/log/ferrite
   sudo chown ferrite:ferrite /var/log/ferrite
   ```

### Configuration file not found

**Symptoms:**
```
Error: Config file not found: ferrite.toml
```

**Solutions:**

1. Specify the config file path explicitly:
   ```bash
   ferrite --config /path/to/ferrite.toml
   ```

2. Create a default configuration:
   ```bash
   ferrite --dump-config > ferrite.toml
   # Or with comments and defaults
   ferrite init --output ferrite.toml
   ```

3. Place config in default location:
   ```bash
   # Linux
   sudo mkdir -p /etc/ferrite
   sudo cp ferrite.toml /etc/ferrite/

   # Or user-specific
   mkdir -p ~/.config/ferrite
   cp ferrite.toml ~/.config/ferrite/
   ```

**Tip:** If no config file is provided, Ferrite will use `./ferrite.toml` when
present, then fall back to `./ferrite.example.toml`, and finally built-in
defaults. Run `ferrite doctor` to see the resolved configuration source.

### io_uring Not Available

**Symptom**:
```
Error: io_uring not supported on this system
```

**Causes**:
- Running on non-Linux OS (macOS, Windows, BSD)
- Kernel version < 5.11
- io_uring disabled in kernel configuration

**Solutions**:

1. **Check kernel version** (Linux):
   ```bash
   uname -r
   # Upgrade to 5.11+ for optimal io_uring support
   ```

2. **Build without io_uring** (default for non-Linux):
   ```bash
   cargo build --release
   ```

3. **Enable io_uring on Linux**:
   ```bash
   cargo build --release --features io-uring
   ```

4. **Verify io_uring support** (Linux):
   ```bash
   # Check if io_uring is available
   cat /proc/sys/kernel/io_uring_disabled
   # Should be 0 (enabled) or not exist

   # If disabled, enable it
   echo 0 | sudo tee /proc/sys/kernel/io_uring_disabled
   ```

### Cannot Create Data Directory

**Symptom**:
```
Error: Failed to create data directory: Permission denied
```

**Solution**:
```bash
# Create directory with correct permissions
sudo mkdir -p /var/lib/ferrite
sudo chown ferrite:ferrite /var/lib/ferrite
sudo chmod 755 /var/lib/ferrite

# Verify
ls -ld /var/lib/ferrite

# Alternative: change data directory in config
[storage]
data_dir = "/home/myuser/ferrite-data"
```

### Invalid Configuration Errors

**Symptom**:
```
Error: Failed to parse config: TOML parse error at line X
```

**Solutions**:

1. **Validate TOML syntax**:
   ```bash
   # Install a TOML validator
   cargo install taplo-cli

   # Validate config
   taplo format --check ferrite.toml
   ```

2. **Common TOML mistakes**:
   - Missing quotes around strings
   - Incorrect boolean values (use `true`/`false`, not `yes`/`no`)
   - Invalid section names
   - Duplicate keys

3. **Check configuration reference**:
   ```bash
   # Generate example config
   ferrite --dump-config
   ```

---

## Connection Problems

### Clients Cannot Connect

**Symptom**: Clients timeout or receive connection refused errors.

**Diagnostic Steps**:

1. **Verify Ferrite is running**:
   ```bash
   # Check process
   ps aux | grep ferrite
   pgrep -fl ferrite

   # Check service status
   systemctl status ferrite
   ```

2. **Verify listening port**:
   ```bash
   # Linux
   sudo netstat -tlnp | grep ferrite
   sudo ss -tlnp | grep ferrite

   # Should show: 0.0.0.0:6379 or specific IP
   ```

3. **Test local connection**:
   ```bash
   redis-cli -h 127.0.0.1 -p 6379 PING
   # Should return: PONG
   ```

4. **Test remote connection**:
   ```bash
   # From client machine
   telnet <ferrite-host> 6379
   nc -zv <ferrite-host> 6379
   redis-cli -h <ferrite-host> -p 6379 PING
   ```

5. **Check firewall rules**:
   ```bash
   # Ubuntu/Debian (ufw)
   sudo ufw status
   sudo ufw allow 6379/tcp

   # RHEL/CentOS (firewalld)
   sudo firewall-cmd --list-all
   sudo firewall-cmd --add-port=6379/tcp --permanent
   sudo firewall-cmd --reload

   # iptables
   sudo iptables -L -n | grep 6379
   sudo iptables -A INPUT -p tcp --dport 6379 -j ACCEPT
   ```

6. **Check bind address in configuration**:
   ```toml
   [server]
   # Binding to 127.0.0.1 only allows local connections
   bind = "127.0.0.1:6379"

   # Bind to all interfaces for remote access
   bind = "0.0.0.0:6379"

   # Bind to specific interface
   bind = "192.168.1.100:6379"
   ```

### Connection Drops/Timeouts

**Symptom**: Established connections drop unexpectedly or timeout.

**Causes and Solutions**:

1. **Idle timeout too aggressive**:
   ```toml
   [server]
   # Increase timeout (seconds, 0 = never timeout)
   client_timeout = 300  # 5 minutes
   timeout = 0  # Disabled
   ```

2. **Enable TCP Keepalive**:
   ```toml
   [server]
   # Send keepalive packets every 5 minutes
   tcp_keepalive = 300
   ```

3. **Network issues**:
   ```bash
   # Check for packet loss
   ping -c 100 <ferrite-host>

   # Check MTU issues
   ping -M do -s 1472 <ferrite-host>

   # Check TCP retransmissions
   netstat -s | grep retransmit
   ss -ti | grep retrans
   ```

4. **File descriptor limits**:
   ```bash
   # Check current limit
   ulimit -n
   cat /proc/$(pidof ferrite)/limits | grep 'open files'

   # Increase limit (add to /etc/security/limits.conf)
   ferrite soft nofile 65536
   ferrite hard nofile 65536

   # Or in systemd service file
   [Service]
   LimitNOFILE=65536
   ```

5. **Connection pool exhaustion**:
   ```bash
   # Monitor active connections
   redis-cli CLIENT LIST | wc -l
   redis-cli INFO clients
   ```

### Too Many Connections

**Symptoms:**
```
ERR max number of clients reached
```

**Solutions:**

1. **Increase max clients limit**:
   ```toml
   [server]
   maxclients = 10000
   ```

2. **Identify connection sources**:
   ```bash
   # List all connected clients
   redis-cli CLIENT LIST

   # Count connections by IP
   redis-cli CLIENT LIST | awk '{print $2}' | cut -d: -f1 | sort | uniq -c | sort -rn
   ```

3. **Check for connection leaks**:
   - Ensure application properly closes connections
   - Use connection pooling with limits
   - Set timeouts on idle connections

4. **Kill idle connections**:
   ```bash
   # List idle connections
   redis-cli CLIENT LIST | grep 'idle=300'

   # Kill specific client
   redis-cli CLIENT KILL <ip:port>

   # Kill idle clients (careful!)
   redis-cli CLIENT KILL TYPE normal SKIPME yes
   ```

### High Connection Latency

**Symptom**: First command on new connection is slow (>10ms).

**Solutions**:

1. **Enable TCP Fast Open**:
   ```toml
   [server]
   tcp_fast_open = true
   ```

   ```bash
   # Enable on Linux system
   echo 3 | sudo tee /proc/sys/net/ipv4/tcp_fastopen

   # Persist across reboots
   echo 'net.ipv4.tcp_fastopen = 3' | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

2. **Check DNS resolution**:
   ```bash
   # Disable reverse DNS lookups if slow
   # Test resolution speed
   time host <client-ip>
   ```

3. **Use connection pooling** to reuse connections and avoid handshake overhead.

4. **Tune TCP parameters**:
   ```bash
   # Reduce SYN retries
   echo 'net.ipv4.tcp_syn_retries = 2' | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

---

## Memory Issues

### Out of Memory Errors

**Symptom**:
```
Error: Cannot allocate memory
OOM Killer terminated ferrite
```

**Diagnostic**:
```bash
# Check current memory usage
ps aux | grep ferrite
pmap -x $(pidof ferrite)

# System memory
free -h
cat /proc/meminfo

# Ferrite metrics
curl http://localhost:9090/metrics | grep memory
redis-cli INFO memory
```

**Solutions**:

1. **Set memory limit in configuration**:
   ```toml
   [storage]
   # Limit total memory usage (bytes)
   max_memory = 8589934592  # 8GB
   ```

2. **Adjust HybridLog tier sizes**:
   ```toml
   [storage]
   # Reduce hot tier (mutable region) size
   hybridlog_mutable_size = 1073741824  # 1GB

   # Adjust warm tier (readonly region)
   hybridlog_readonly_size = 2147483648  # 2GB
   ```

3. **System resource limits**:
   ```bash
   # Add to systemd service file
   [Service]
   MemoryLimit=8G
   MemoryAccounting=yes
   MemoryMax=8G  # Hard limit
   ```

4. **Check for memory leaks**:
   ```bash
   # Monitor memory over time
   watch -n 5 'ps aux | grep ferrite'

   # Check memory growth rate
   redis-cli INFO memory | grep used_memory_human
   ```

### Memory Fragmentation

**Symptom**: High memory usage despite low logical data size.

**Diagnostic**:
```bash
# Check fragmentation ratio
redis-cli INFO memory | grep mem_fragmentation_ratio
# Ratio > 1.5 indicates fragmentation

# Ferrite metrics
curl http://localhost:9090/metrics | grep fragmentation

# Detailed memory stats
redis-cli MEMORY STATS
```

**Solutions**:

1. **Enable active defragmentation** (if available):
   ```toml
   [storage]
   active_defrag = true
   active_defrag_threshold = 30  # Start defrag at 30% fragmentation
   ```

2. **Configure compaction**:
   ```toml
   [storage]
   compaction_threshold = 0.2  # Trigger at 20% fragmentation
   compaction_interval_secs = 300  # Every 5 minutes
   ```

3. **Restart during maintenance window**:
   ```bash
   # Save data
   redis-cli SAVE

   # Restart to defragment
   systemctl restart ferrite
   ```

4. **Use jemalloc allocator** (usually default for Rust):
   ```bash
   # Verify allocator
   ldd /usr/local/bin/ferrite | grep jemalloc
   ```

### Memory Leaks

**Symptom**: Memory usage grows unbounded over time without corresponding data growth.

**Diagnostic**:
```bash
# Monitor memory growth
while true; do
  redis-cli INFO memory | grep used_memory_human
  sleep 60
done

# Check for stuck epochs (indicates reclamation stall)
curl http://localhost:9090/metrics | grep epoch

# Heap profiling (requires build with profiling)
RUST_LOG=ferrite=debug ferrite --enable-heap-profiling
```

**Solutions**:

1. **Update to latest Ferrite version** (may contain leak fixes)

2. **Check configuration**:
   - Verify TTLs are set on temporary keys
   - Check for extremely large keys/values
   - Monitor keyspace growth: `redis-cli DBSIZE`

3. **Enable heap profiling and report**:
   ```bash
   # Build with profiling
   cargo build --release --features "heap-profiling"

   # Run with profiling
   MALLOC_CONF=prof:true,prof_prefix:/tmp/ferrite-heap ferrite

   # Analyze with jeprof
   jeprof --pdf /usr/local/bin/ferrite /tmp/ferrite-heap.*.heap > heap.pdf
   ```

4. **File bug report** with heap profile and reproduction steps

### Keys Not Expiring

**Symptom**: Memory keeps growing, expired keys still accessible.

**Solutions**:

1. **Check TTL settings**:
   ```bash
   # Verify TTL on specific key
   redis-cli TTL <key>
   # -1 = no expiration, -2 = key doesn't exist, >0 = seconds remaining
   ```

2. **Verify clock synchronization**:
   ```bash
   # Check system time
   date
   timedatectl status

   # Sync with NTP
   sudo systemctl restart chronyd  # RHEL/CentOS
   sudo systemctl restart systemd-timesyncd  # Ubuntu
   ```

3. **Check expiration configuration**:
   ```toml
   [storage]
   # How often to check for expired keys (ms)
   expire_check_interval = 100

   # Number of keys to check per interval
   expire_check_count = 20
   ```

4. **Force manual expiration** (for testing):
   ```bash
   # Manually trigger expiration check
   redis-cli DEBUG SLEEP 0
   ```

---

## Persistence and Recovery Problems

### Slow Startup After Crash

**Symptom**: Recovery takes many minutes or hours, blocking server startup.

**Cause**: Replaying large AOF (Append-Only File) or loading large snapshot.

**Solutions**:

1. **Enable periodic checkpoints**:
   ```toml
   [persistence]
   # Create checkpoints regularly
   checkpoint_interval_secs = 3600  # Every hour
   checkpoint_on_shutdown = true

   # Keep recent checkpoints
   max_checkpoints = 3
   ```

2. **Configure AOF rewrite**:
   ```bash
   # Trigger manual rewrite
   redis-cli BGREWRITEAOF
   ```

   Or configure automatic rewrites:
   ```toml
   [persistence]
   # Rewrite when AOF is 50% larger than last checkpoint
   aof_rewrite_threshold = 1.5
   auto_aof_rewrite_min_size = "64mb"
   ```

3. **Use faster storage**:
   - Move persistence files to NVMe SSD
   - Use separate disk from main data
   - Consider RAID 0 for speed (with backups)

4. **Monitor recovery progress**:
   ```bash
   # Watch logs during startup
   tail -f /var/log/ferrite/ferrite.log | grep -i 'loading\|recovery'
   ```

### Data Loss After Crash

**Symptom**: Recent writes are missing after unclean shutdown or crash.

**Cause**: AOF not fully synchronized to disk before crash.

**Solutions**:

1. **Increase fsync durability** (trades performance):
   ```toml
   [persistence]
   # Options: always, everysec, no

   # Maximum durability (slow)
   aof_fsync = "always"  # Fsync after every write

   # Balanced (recommended)
   aof_fsync = "everysec"  # At most 1 second of data loss

   # Maximum performance (risky)
   aof_fsync = "no"  # OS decides when to fsync
   ```

2. **Enable both AOF and snapshots**:
   ```toml
   [persistence]
   enable_aof = true
   enable_checkpoints = true
   ```

3. **Verify persistence configuration**:
   ```bash
   redis-cli CONFIG GET appendonly
   redis-cli CONFIG GET appendfsync
   ```

### Corrupted AOF File

**Symptom**:
```
Error: AOF corrupted at offset 12345678
Error: Bad file format reading the append only file
```

**Recovery Steps**:

1. **Backup corrupted file**:
   ```bash
   cp /var/lib/ferrite/appendonly.aof /var/lib/ferrite/appendonly.aof.backup
   ```

2. **Use ferrite-check-aof tool** (if available):
   ```bash
   # Check AOF integrity
   ferrite-check-aof /var/lib/ferrite/appendonly.aof

   # Attempt automatic fix
   ferrite-check-aof --fix /var/lib/ferrite/appendonly.aof
   ```

3. **Manual truncation** (as last resort):
   ```bash
   # Truncate to last good position (from error message)
   truncate -s 12345678 /var/lib/ferrite/appendonly.aof
   ```

4. **Restart Ferrite**:
   ```bash
   systemctl restart ferrite

   # Verify recovery
   redis-cli PING
   redis-cli DBSIZE
   ```

5. **Restore from backup** (if truncation fails):
   ```bash
   systemctl stop ferrite
   cp /backup/appendonly.aof /var/lib/ferrite/
   systemctl start ferrite
   ```

### Checkpoint/Snapshot Failures

**Symptom**:
```
Warning: Checkpoint failed: disk full
Error: Failed to save snapshot: No space left on device
```

**Solutions**:

1. **Free disk space**:
   ```bash
   # Check disk usage
   df -h /var/lib/ferrite

   # Find large files
   du -sh /var/lib/ferrite/*

   # Remove old checkpoints
   find /var/lib/ferrite/checkpoints -mtime +7 -delete

   # Remove old AOF files
   rm /var/lib/ferrite/appendonly.aof.*.bak
   ```

2. **Use separate checkpoint directory**:
   ```toml
   [persistence]
   # Store checkpoints on different disk
   checkpoint_dir = "/mnt/backup/ferrite-checkpoints"
   ```

3. **Reduce checkpoint frequency**:
   ```toml
   [persistence]
   checkpoint_interval_secs = 7200  # Every 2 hours instead of 1
   ```

4. **Monitor disk space**:
   ```bash
   # Alert when disk usage > 80%
   df -h /var/lib/ferrite | awk 'NR==2 {print $5}' | cut -d% -f1
   ```

---

## Replication Issues

### Replica Lag

**Symptom**: Replica falls behind primary, stale reads.

**Diagnostic**:
```bash
# Check replication status on replica
redis-cli INFO replication
# Look for: master_repl_offset vs slave_repl_offset

# Check lag in seconds
redis-cli INFO replication | grep master_last_io_seconds_ago

# Monitor continuous lag
watch -n 1 'redis-cli INFO replication | grep offset'
```

**Solutions**:

1. **Increase replication buffers**:
   ```toml
   [replication]
   # Increase backlog size
   repl_backlog_size = 104857600  # 100MB

   # Increase per-client output buffer
   repl_buffer_size = 33554432  # 32MB
   ```

2. **Reduce disk I/O on replica**:
   ```toml
   [persistence]
   # Disable persistence on replica (if acceptable)
   enable_aof = false
   enable_checkpoints = false

   # Or use less aggressive settings
   aof_fsync = "everysec"
   ```

3. **Check network between primary and replica**:
   ```bash
   # Latency test
   ping -c 100 <primary-host>

   # Bandwidth test
   iperf3 -c <primary-host>

   # Check for packet loss
   mtr -r -c 100 <primary-host>
   ```

4. **Use dedicated network interface**:
   ```toml
   [replication]
   # Bind replication to specific interface
   repl_bind = "10.0.0.1"  # Internal network
   ```

5. **Enable parallel replication** (if supported):
   ```toml
   [replication]
   parallel_sync = true
   sync_threads = 4
   ```

### Replication Connection Failures

**Symptom**:
```
Error: Failed to connect to primary: Connection refused
Error: LOADING Ferrite is loading the dataset in memory
```

**Solutions**:

1. **Verify primary is running**:
   ```bash
   # On primary
   redis-cli PING
   netstat -tlnp | grep 6379
   ```

2. **Check primary configuration**:
   ```bash
   # Ensure primary is listening
   redis-cli CONFIG GET bind

   # Check replication role
   redis-cli INFO replication | grep role
   ```

3. **Verify firewall allows replica**:
   ```bash
   # On primary server
   sudo ufw status
   sudo ufw allow from <replica-ip> to any port 6379
   ```

4. **Fix authentication issues**:
   ```toml
   # On replica
   [replication]
   primary_host = "primary-host"
   primary_port = 6379
   primary_auth = "your-secure-password"
   ```

   ```toml
   # On primary
   [server]
   require_auth = true
   password = "your-secure-password"
   ```

5. **Test connectivity from replica**:
   ```bash
   # From replica server
   telnet <primary-host> 6379
   redis-cli -h <primary-host> PING
   traceroute <primary-host>
   ```

### Full Resync Loop

**Symptom**: Replica repeatedly performs full resyncs, never catching up.

**Causes**:
- Replication backlog too small
- Network instability
- Replica too slow

**Solutions**:

1. **Increase replication backlog**:
   ```toml
   [replication]
   # Make backlog large enough to cover disconnections
   repl_backlog_size = 268435456  # 256MB

   # Keep backlog longer after disconnection
   repl_backlog_ttl = 7200  # 2 hours
   ```

2. **Monitor partial vs full resyncs**:
   ```bash
   redis-cli INFO replication | grep sync
   # Look for: sync_full, sync_partial_ok, sync_partial_err
   ```

3. **Check network stability**:
   ```bash
   # Monitor connection drops
   watch -n 1 'redis-cli INFO replication | grep master_link_status'
   ```

4. **Reduce write load during catch-up**:
   - Temporarily reduce traffic to primary
   - Add more replicas to distribute load

### Split Brain Scenarios

**Symptom**: Both primary and replica accept writes, causing data divergence.

**Prevention**:
```toml
[replication]
# Require minimum replicas for writes
min_replicas_to_write = 1
min_replicas_max_lag = 10  # seconds
```

**Detection**:
```bash
# Check replication role on all nodes
redis-cli -h node1 INFO replication | grep role
redis-cli -h node2 INFO replication | grep role
```

**Recovery**:

1. **Identify canonical primary**:
   - Check monitoring/orchestration system
   - Use Sentinel to determine current primary

2. **Force resync replica**:
   ```bash
   # On replica
   redis-cli REPLICAOF <primary-ip> 6379

   # Verify sync
   redis-cli INFO replication | grep master_sync_in_progress
   ```

3. **Manually reconcile conflicting writes** (application-specific):
   - Export data from both instances
   - Merge based on application logic
   - Re-import to canonical primary

---

## Performance Problems

### High Latency

**Symptom**: P99 latency > 5ms, slow command responses.

**Diagnostic**:
```bash
# Check latency metrics
curl http://localhost:9090/metrics | grep latency

# Monitor latency in real-time
redis-cli --latency
redis-cli --latency-history

# Check slowlog
redis-cli SLOWLOG GET 10

# System-wide profiling
sudo perf record -F 99 -p $(pidof ferrite) -g -- sleep 30
sudo perf report
```

**Solutions**:

1. **Tune worker threads**:
   ```toml
   [server]
   # Match number of CPU cores
   worker_threads = 16
   io_threads = 16
   ```

2. **Disable expensive operations**:
   ```toml
   [server]
   # Disable dangerous commands
   disable_dangerous_commands = true
   # Blocks: KEYS, FLUSHDB, FLUSHALL, CONFIG, etc.
   ```

   Or rename them:
   ```toml
   [server]
   rename_commands = { "KEYS" = "KEYS_DISABLED", "FLUSHALL" = "" }
   ```

3. **Optimize storage tiers**:
   ```toml
   [storage]
   # Reduce read-only region for faster writes
   readonly_region_size = 2147483648  # 2GB

   # Increase mutable region for hot data
   mutable_region_size = 2147483648  # 2GB
   ```

4. **Check system latency**:
   ```bash
   # Kernel scheduling latency
   sudo cyclictest -p 99 -m -n

   # Disk latency
   ioping -c 100 /var/lib/ferrite

   # Network latency
   redis-cli --intrinsic-latency 100
   ```

5. **Disable swap**:
   ```bash
   # Check swap usage
   free -h | grep Swap

   # Disable swap
   sudo swapoff -a

   # Or reduce swappiness
   echo 'vm.swappiness=1' | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

### Low Throughput

**Symptom**: Not reaching expected ops/sec, underutilized CPU.

**Diagnostic**:
```bash
# Benchmark with redis-benchmark
redis-benchmark -h localhost -p 6379 -c 50 -n 100000 -t get,set

# Check CPU usage
top -H -p $(pidof ferrite)
mpstat -P ALL 1

# Check I/O wait
iostat -x 1

# Monitor throughput
redis-cli INFO stats | grep instantaneous_ops_per_sec
```

**Solutions**:

1. **Increase parallelism**:
   ```toml
   [server]
   max_connections = 10000
   worker_threads = 32  # Increase if CPU underutilized
   io_threads = 32
   ```

2. **Use client-side optimizations**:
   - Enable pipelining
   - Use batch operations (MGET, MSET)
   - Connection pooling

3. **Disable persistence** (if acceptable):
   ```toml
   [persistence]
   enable_aof = false
   enable_checkpoints = false
   ```

4. **Tune I/O scheduler** (for SSD/NVMe):
   ```bash
   # Check current scheduler
   cat /sys/block/nvme0n1/queue/scheduler

   # Set to 'none' or 'noop' for SSDs
   echo none | sudo tee /sys/block/nvme0n1/queue/scheduler

   # Persist setting
   echo 'ACTION=="add|change", KERNEL=="nvme[0-9]n[0-9]", ATTR{queue/scheduler}="none"' | \
     sudo tee /etc/udev/rules.d/60-scheduler.rules
   ```

5. **Optimize network**:
   ```bash
   # Increase network buffers
   sudo sysctl -w net.core.rmem_max=16777216
   sudo sysctl -w net.core.wmem_max=16777216
   ```

### CPU Saturation

**Symptom**: 100% CPU usage but low throughput.

**Diagnostic**:
```bash
# Profile CPU usage
sudo perf record -e cycles -g -p $(pidof ferrite) -- sleep 10
sudo perf report --stdio | head -50

# Check for lock contention
sudo perf record -e cycles -g -p $(pidof ferrite) -- sleep 10
sudo perf report --stdio | grep -i 'spin\|lock\|mutex'

# Generate flamegraph
cargo flamegraph --pid $(pidof ferrite)
```

**Solutions**:

1. **Increase sharding** to reduce lock contention:
   ```toml
   [storage]
   # More shards = less contention per shard
   num_shards = 32  # Or 64, 128
   ```

2. **Identify hot keys**:
   ```bash
   # Find frequently accessed keys
   redis-cli --hotkeys

   # Monitor with MONITOR (high overhead)
   redis-cli MONITOR
   ```

   **Mitigations for hot keys**:
   - Use client-side caching
   - Read from replicas
   - Shard hot keys (e.g., `key:1`, `key:2`, ...)

3. **Find expensive commands**:
   ```bash
   redis-cli SLOWLOG GET 100
   redis-cli INFO commandstats | sort -t: -k2 -rn | head
   ```

   **Solutions**:
   - Optimize queries
   - Use SCAN instead of KEYS
   - Paginate large results
   - Disable or rate-limit expensive commands

4. **Check for CPU throttling**:
   ```bash
   # Check CPU frequency
   watch -n 1 'grep MHz /proc/cpuinfo'

   # Disable CPU throttling
   echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
   ```

---

## Debug Logging

### Enable Debug Logging

```bash
# Environment variable (most verbose)
RUST_LOG=ferrite=debug ferrite --config ferrite.toml

# Trace level (extremely verbose, includes detailed tracing)
RUST_LOG=ferrite=trace ferrite --config ferrite.toml

# Module-specific logging
RUST_LOG=ferrite::storage=debug,ferrite::protocol=info ferrite --config ferrite.toml

# Multiple modules with different levels
RUST_LOG=ferrite::storage=trace,ferrite::server=debug,ferrite=info ferrite --config ferrite.toml
```

### Configuration File Logging

```toml
[logging]
level = "debug"  # trace, debug, info, warn, error
format = "json"  # json or pretty

# Log to file
log_file = "/var/log/ferrite/ferrite.log"

# Log rotation
log_rotation = "daily"  # daily, hourly, size-based
max_log_size = 104857600  # 100MB (for size-based rotation)
max_log_files = 10  # Keep last 10 rotated files

# Include additional context
log_thread_ids = true
log_thread_names = true
log_module_path = true
```

### Structured Logging with JSON

If using JSON logging, query logs with `jq`:

```bash
# Filter by log level
tail -f /var/log/ferrite/ferrite.log | jq 'select(.level == "ERROR")'

# Filter by module
tail -f /var/log/ferrite/ferrite.log | jq 'select(.target == "ferrite::storage")'

# Find slow operations
tail -f /var/log/ferrite/ferrite.log | jq 'select(.duration_ms > 100)'

# Filter by specific field
tail -f /var/log/ferrite/ferrite.log | jq 'select(.command == "SET")'

# Pretty print errors
tail -f /var/log/ferrite/ferrite.log | jq -r 'select(.level == "ERROR") | "\(.timestamp) \(.message)"'

# Count errors by type
grep '"level":"ERROR"' /var/log/ferrite/ferrite.log | \
  jq -r '.error_type' | sort | uniq -c | sort -rn
```

### Dynamic Log Level Changes

If supported, change log level without restart:

```bash
# Change log level via Redis command
redis-cli CONFIG SET loglevel debug

# Reproduce issue with debug logging

# Restore normal log level
redis-cli CONFIG SET loglevel info
```

### Performance Impact of Logging

**Warning**: Debug and trace logging significantly impact performance:
- `debug`: ~10-20% overhead
- `trace`: ~30-50% overhead

**Production Recommendations**:
- Use `info` level normally
- Temporarily enable `debug` for troubleshooting
- Use `trace` only for specific modules
- Monitor disk space when logging to file

---

## Collecting Diagnostics

### Essential Diagnostic Script

Create a comprehensive diagnostic collection script:

```bash
#!/bin/bash
# ferrite-diagnostics.sh - Collect comprehensive Ferrite diagnostics

set -e

OUTDIR="ferrite-diagnostics-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTDIR"

echo "Collecting Ferrite diagnostics to $OUTDIR..."

# Version information
echo "Collecting version info..."
ferrite --version > "$OUTDIR/version.txt" 2>&1 || echo "Failed to get version" > "$OUTDIR/version.txt"
rustc --version >> "$OUTDIR/version.txt" 2>&1 || true
cargo --version >> "$OUTDIR/version.txt" 2>&1 || true

# Configuration
echo "Collecting configuration..."
if [ -f /etc/ferrite/ferrite.toml ]; then
  cp /etc/ferrite/ferrite.toml "$OUTDIR/ferrite.toml"
else
  echo "Config not found at /etc/ferrite/ferrite.toml" > "$OUTDIR/ferrite.toml"
fi

# Logs (last 10000 lines)
echo "Collecting logs..."
if [ -f /var/log/ferrite/ferrite.log ]; then
  tail -10000 /var/log/ferrite/ferrite.log > "$OUTDIR/ferrite.log"
else
  journalctl -u ferrite -n 10000 > "$OUTDIR/ferrite.log" 2>&1 || echo "No logs found" > "$OUTDIR/ferrite.log"
fi

# System information
echo "Collecting system info..."
uname -a > "$OUTDIR/system.txt"
cat /etc/os-release >> "$OUTDIR/system.txt" 2>&1 || true

# CPU info
cat /proc/cpuinfo > "$OUTDIR/cpuinfo.txt"
lscpu >> "$OUTDIR/cpuinfo.txt" 2>&1 || true

# Memory info
cat /proc/meminfo > "$OUTDIR/meminfo.txt"
free -h >> "$OUTDIR/meminfo.txt"

# Disk info
df -h > "$OUTDIR/disk.txt"
df -i >> "$OUTDIR/disk.txt"  # Inodes
lsblk >> "$OUTDIR/disk.txt" 2>&1 || true

# I/O stats
iostat -x 1 5 > "$OUTDIR/iostat.txt" 2>&1 || echo "iostat not available" > "$OUTDIR/iostat.txt"

# Network configuration
echo "Collecting network info..."
ip addr > "$OUTDIR/network.txt" 2>&1 || ifconfig >> "$OUTDIR/network.txt" 2>&1 || true
netstat -tuln > "$OUTDIR/netstat.txt" 2>&1 || ss -tuln > "$OUTDIR/netstat.txt" 2>&1 || true
ss -s >> "$OUTDIR/netstat.txt" 2>&1 || true

# Ferrite process information
echo "Collecting process info..."
if pgrep ferrite > /dev/null; then
  FERRITE_PID=$(pidof ferrite)
  ps aux | grep ferrite > "$OUTDIR/process.txt"
  top -b -n 1 -p $FERRITE_PID >> "$OUTDIR/process.txt" 2>&1 || true
  pmap $FERRITE_PID > "$OUTDIR/memmap.txt" 2>&1 || true
  cat /proc/$FERRITE_PID/limits > "$OUTDIR/limits.txt" 2>&1 || true
  lsof -p $FERRITE_PID > "$OUTDIR/open-files.txt" 2>&1 || true
  cat /proc/$FERRITE_PID/status > "$OUTDIR/proc-status.txt" 2>&1 || true
else
  echo "Ferrite process not running" > "$OUTDIR/process.txt"
fi

# Metrics
echo "Collecting metrics..."
curl -s http://localhost:9090/metrics > "$OUTDIR/metrics.txt" 2>&1 || echo "Metrics not available" > "$OUTDIR/metrics.txt"

# Redis INFO
echo "Collecting Redis INFO..."
redis-cli INFO ALL > "$OUTDIR/redis-info.txt" 2>&1 || echo "Redis INFO not available" > "$OUTDIR/redis-info.txt"
redis-cli INFO memory > "$OUTDIR/redis-info-memory.txt" 2>&1 || true
redis-cli INFO replication > "$OUTDIR/redis-info-replication.txt" 2>&1 || true
redis-cli INFO stats > "$OUTDIR/redis-info-stats.txt" 2>&1 || true

# Slowlog
redis-cli SLOWLOG GET 100 > "$OUTDIR/slowlog.txt" 2>&1 || true

# Client list
redis-cli CLIENT LIST > "$OUTDIR/clients.txt" 2>&1 || true

# Database size
redis-cli DBSIZE > "$OUTDIR/dbsize.txt" 2>&1 || true

# Kernel parameters
echo "Collecting kernel parameters..."
sysctl -a > "$OUTDIR/sysctl.txt" 2>&1 || true

# Firewall rules
echo "Collecting firewall rules..."
iptables -L -n > "$OUTDIR/iptables.txt" 2>&1 || echo "iptables not available" > "$OUTDIR/iptables.txt"
ufw status verbose >> "$OUTDIR/firewall.txt" 2>&1 || true
firewall-cmd --list-all >> "$OUTDIR/firewall.txt" 2>&1 || true

# systemd service status
systemctl status ferrite > "$OUTDIR/systemd-status.txt" 2>&1 || echo "Not running under systemd" > "$OUTDIR/systemd-status.txt"

# Package and compress
echo "Creating archive..."
tar czf "$OUTDIR.tar.gz" "$OUTDIR"
rm -rf "$OUTDIR"

echo "Diagnostics collected: $OUTDIR.tar.gz"
echo "Size: $(du -h "$OUTDIR.tar.gz" | cut -f1)"
echo ""
echo "Please attach this file when reporting issues."
```

Make it executable:
```bash
chmod +x ferrite-diagnostics.sh
sudo ./ferrite-diagnostics.sh
```

### Performance Profiling

```bash
# CPU profiling with perf (30 seconds)
sudo perf record -F 99 -p $(pidof ferrite) -g -- sleep 30
sudo perf report

# Generate flamegraph
sudo perf script | ~/FlameGraph/stackcollapse-perf.pl | ~/FlameGraph/flamegraph.pl > ferrite-cpu.svg

# Heap profiling (requires jemalloc)
MALLOC_CONF=prof:true,prof_prefix:/tmp/ferrite-heap ferrite --config ferrite.toml

# Analyze heap dump
jeprof --pdf /usr/local/bin/ferrite /tmp/ferrite-heap.*.heap > heap.pdf

# Async profiling with tokio-console
RUSTFLAGS="--cfg tokio_unstable" cargo build --release
tokio-console http://localhost:6669
```

### Network Traffic Capture

```bash
# Capture Redis protocol traffic (60 seconds)
sudo tcpdump -i any -s 0 -w ferrite-traffic.pcap 'port 6379' &
TCPDUMP_PID=$!
sleep 60
sudo kill $TCPDUMP_PID

# View in Wireshark or analyze with tshark
tshark -r ferrite-traffic.pcap -Y "redis"

# Extract Redis commands
tshark -r ferrite-traffic.pcap -Y "redis" -T fields -e redis.command
```

---

## FAQ

### Q: Can I use Ferrite as a drop-in Redis replacement?

**A**: Ferrite aims for Redis protocol compatibility but may not support all commands or edge cases. Before production deployment:
- Test thoroughly with your specific workload
- Check `COMPATIBILITY.md` for command coverage
- Run integration tests with your application
- Monitor for any behavioral differences

### Q: Is Ferrite production-ready?

**A**: Ferrite is under active development. Stability depends on:
- Your specific use case and workload
- Required features (some may be experimental)
- Risk tolerance for data loss

**Recommendations**:
- Start with non-critical workloads
- Maintain Redis as fallback initially
- Monitor closely during transition
- Check release notes for stability indicators

### Q: How do I migrate from Redis to Ferrite?

**A**: Recommended migration path:

1. **Set up Ferrite as Redis replica**:
   ```bash
   # On Ferrite instance
   redis-cli REPLICAOF <redis-host> 6379
   ```

2. **Monitor replication lag**:
   ```bash
   watch -n 1 'redis-cli INFO replication | grep master_repl_offset'
   ```

3. **When fully synced, switch application traffic**:
   - Update application config to point to Ferrite
   - Use gradual rollout (e.g., 1% -> 10% -> 50% -> 100%)

4. **Keep Redis as backup** during transition period

5. **Decommission Redis** once confident

See `MIGRATION.md` for detailed migration guide.

### Q: What's the performance overhead vs. Redis?

**A**: Performance varies by workload:

| Workload | Ferrite vs Redis |
|----------|------------------|
| GET-heavy | 90-110% throughput |
| SET-heavy | 80-95% throughput |
| Mixed | 85-100% throughput |
| Large values (>1KB) | Often faster (io_uring benefits) |
| Small values (<100B) | Slightly slower (overhead) |

**Factors**:
- io_uring provides advantages on Linux 5.11+
- HybridLog tiering helps with large datasets
- Thread-per-core architecture scales well
- Run your own benchmarks for your workload

### Q: Does Ferrite support Redis Cluster?

**A**: Current support status:
- ✅ **Single instance**: Fully supported
- ✅ **Primary-replica replication**: Supported
- 🚧 **Sentinel**: Planned
- 🚧 **Cluster mode**: Roadmap

For high availability, currently use primary-replica with external orchestration (e.g., Kubernetes).

### Q: Can I run Ferrite in Docker/Kubernetes?

**A**: Yes, with considerations:

**Docker**:
- io_uring requires privileged mode or `--cap-add=SYS_ADMIN` capability
- Set appropriate resource limits
- Use persistent volumes for data

**Kubernetes**:
- Use StatefulSet for stable storage
- Configure PersistentVolumeClaims
- Set security context for capabilities
- See `DEPLOYMENT.md` for examples

### Q: How do I enable TLS/SSL?

**A**:
```toml
[server]
tls_enabled = true
tls_cert_file = "/etc/ferrite/certs/server.crt"
tls_key_file = "/etc/ferrite/certs/server.key"
tls_ca_file = "/etc/ferrite/certs/ca.crt"  # Optional, for mutual TLS
tls_verify_client = false  # Set true for mutual TLS
```

Generate self-signed certificate:
```bash
openssl req -x509 -nodes -newkey rsa:4096 \
  -keyout server.key -out server.crt -days 365 \
  -subj "/CN=ferrite.example.com"
```

### Q: What authentication methods are supported?

**A**: Currently supported:
- ✅ Simple password (Redis AUTH compatible)
- ✅ TLS client certificates (mutual TLS)
- 🚧 ACL (Access Control Lists) - Planned
- 🚧 External auth providers - Roadmap

Example password auth:
```toml
[security]
requirepass = "your-secure-password"
```

### Q: How do I back up Ferrite data?

**A**: Three backup methods:

1. **Checkpoint-based** (preferred):
   ```bash
   # Trigger checkpoint
   redis-cli SAVE
   # or background save
   redis-cli BGSAVE

   # Copy checkpoint
   cp -r /var/lib/ferrite/checkpoints/latest /backup/ferrite-$(date +%Y%m%d)
   ```

2. **AOF-based**:
   ```bash
   # Stop writes (optional)
   redis-cli CONFIG SET appendonly yes
   redis-cli BGREWRITEAOF

   # Wait for rewrite to complete
   # Copy AOF
   cp /var/lib/ferrite/appendonly.aof /backup/
   ```

3. **Replication-based** (no impact on primary):
   ```bash
   # On replica
   redis-cli SAVE
   cp /var/lib/ferrite/dump.rdb /backup/
   ```

### Q: Can I run multiple Ferrite instances on the same server?

**A**: Yes, configure different:

**Instance 1**:
```toml
[server]
port = 6379

[storage]
data_dir = "/var/lib/ferrite1"

[logging]
log_file = "/var/log/ferrite/ferrite1.log"
```

**Instance 2**:
```toml
[server]
port = 6380

[storage]
data_dir = "/var/lib/ferrite2"

[logging]
log_file = "/var/log/ferrite/ferrite2.log"
```

Use separate systemd service files:
```bash
cp /etc/systemd/system/ferrite.service /etc/systemd/system/ferrite2.service
# Edit ferrite2.service to use different config
```

### Q: What monitoring tools integrate with Ferrite?

**A**: Monitoring integrations:

- **Prometheus**: Native `/metrics` endpoint
  ```toml
  [metrics]
  enabled = true
  port = 9090
  ```

- **Grafana**: Import dashboard from `docs/monitoring/grafana-dashboard.json`

- **Datadog**: Via Prometheus integration or Redis integration

- **New Relic**: Via Prometheus remote write

- **Redis-compatible tools**: Many work with Ferrite's INFO command

### Q: How do I report a bug or request a feature?

**A**:

1. **Check existing issues** on GitHub

2. **Collect diagnostics**:
   ```bash
   ./ferrite-diagnostics.sh
   ```

3. **Create GitHub issue** with:
   - Ferrite version (`ferrite --version`)
   - Operating system and kernel version
   - Configuration file (sanitized, remove passwords)
   - Steps to reproduce
   - Expected vs actual behavior
   - Diagnostics bundle attachment
   - Minimal reproducible example (if possible)

4. **For security issues**: Email security@ferrite.io (don't use public issues)

### Q: Where can I get help?

**A**: Support resources:

- **Documentation**: `/docs` directory in repository
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community support
- **Stack Overflow**: Tag questions with `ferrite`
- **Community Chat**: [Discord/Slack link if available]
- **Professional Support**: [Link to commercial support if available]

### Q: What are the hardware requirements?

**A**: Minimum and recommended:

**Minimum**:
- CPU: 2 cores
- RAM: 4GB
- Disk: 20GB
- OS: Linux 4.x+ (5.11+ for io_uring)

**Recommended for production**:
- CPU: 8+ cores (modern processor)
- RAM: 32GB+ ECC
- Disk: NVMe SSD with 500GB+
- Network: 1Gbps+
- OS: Linux 5.11+ (for io_uring)

See `PERFORMANCE_TUNING.md` for detailed hardware recommendations.

---

**Last Updated**: 2025-12-21
**Ferrite Version**: Development (pre-1.0)

For additional help, see:
- [Deployment Guide](DEPLOYMENT.md)
- [Performance Tuning](PERFORMANCE_TUNING.md)
- [Architecture Documentation](ARCHITECTURE.md)
