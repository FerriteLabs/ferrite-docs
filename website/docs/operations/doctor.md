---
sidebar_position: 6
maturity: beta
---

# Ferrite Doctor

The `ferrite doctor` command runs preflight diagnostics to verify that your system environment and configuration are ready to run Ferrite. It checks configuration validity, port availability, storage permissions, system resources, and TLS setup.

## Running the Doctor

```bash
# Run with default configuration
ferrite doctor

# Run with a specific config file
ferrite doctor --config ferrite.toml

# Run with a custom port override
ferrite doctor --port 6380
```

## What It Checks

The doctor performs the following checks in order:

| Check | What It Verifies | Pass Criteria |
|-------|-----------------|---------------|
| **Configuration** | Config file loads and validates | Valid TOML, all values in range |
| **Data directory** | Storage path exists and is writable | Directory exists, write test succeeds |
| **Server port** | Bind address and port are available | Port not already in use |
| **Metrics port** | Metrics endpoint can bind (if enabled) | Metrics port not already in use |
| **Kernel version** | Linux kernel supports io_uring (Linux only) | Kernel ≥ 5.11 |
| **Memory** | Available system memory | ≥ 256 MB available |
| **Disk space** | Free disk space on data directory volume | ≥ 1 GB available |
| **TLS certificates** | Certificate, key, and CA files exist (if TLS enabled) | All configured files found on disk |
| **Build info** | Ferrite version and Rust compiler version | Informational only |

## Example Output

### All Checks Passing

```
Ferrite doctor
Config source: ferrite.toml
Data directory OK: ./data
Port OK: 127.0.0.1:6379
Metrics OK: 127.0.0.1:9090
Kernel OK: 6.1.0
Memory OK: 15832MB available
Disk space OK: 142GB available on ./data
TLS cert OK: /etc/ferrite/tls/server.crt
TLS key OK: /etc/ferrite/tls/server.key
TLS OK
Ferrite version: 0.1.0
Rust compiler: rustc 1.88.0 (e7e1dc158 2025-06-04)
Doctor checks passed
```

### With Warnings and Errors

```
Ferrite doctor
Config source: built-in defaults
Data directory OK: ./data
ERROR: Port 127.0.0.1:6379 is already in use.
  Suggestion: Stop the process using port 6379 or choose a different port.
Memory OK: 7916MB available
Disk space WARNING: 512MB available on ./data (recommend 1GB+)
Ferrite version: 0.1.0
Rust compiler: rustc 1.88.0 (e7e1dc158 2025-06-04)
```

## Understanding Each Check

### Configuration

The doctor loads your configuration file (or falls back to built-in defaults) and runs full validation. If the config file cannot be parsed or contains invalid values, the doctor reports the error and exits immediately.

**Common issues:**
- Typos in TOML keys or invalid value types
- Missing required fields after partial edits
- Using an example config without customizing it

### Data Directory

Ferrite creates a temporary `.ferrite-doctor` file inside the data directory to verify write access. The file is removed after the test.

**Common issues:**
- Directory doesn't exist — run `ferrite init` first
- Permission denied — fix ownership with `chown`
- Path points to a file instead of a directory

### Port Availability

The doctor attempts to bind to the configured server port (default `127.0.0.1:6379`) and, if metrics are enabled, the metrics port (default `127.0.0.1:9090`).

**Common issues:**
- Another Ferrite instance is already running
- Another service (Redis, another database) is using the port
- On Linux, ports below 1024 require root or `CAP_NET_BIND_SERVICE`

### Kernel Version (Linux Only)

Ferrite's io_uring storage backend requires Linux kernel 5.11 or later. On older kernels, Ferrite falls back to standard async I/O but performance may be reduced.

### Memory

The doctor checks available system memory and warns if less than 256 MB is available. For production workloads, significantly more memory is recommended depending on your dataset size.

### Disk Space

Checks free disk space on the volume containing the data directory. Warns if less than 1 GB is available. In production, ensure enough headroom for AOF rewrites and checkpoint files.

### TLS Certificates

When TLS is enabled in configuration, the doctor verifies that:
- The certificate file (`tls.cert_file`) exists
- The private key file (`tls.key_file`) exists
- If mutual TLS is enabled (`tls.require_client_cert`), the CA file (`tls.ca_file`) exists

## When to Use Ferrite Doctor

| Scenario | Why |
|----------|-----|
| **First installation** | Verify environment before first startup |
| **After config changes** | Validate configuration edits before restarting |
| **Before production deployment** | Confirm resource availability and TLS setup |
| **After OS/kernel upgrades** | Verify io_uring compatibility on Linux |
| **Debugging startup failures** | When `ferrite run` fails, doctor provides targeted diagnostics |
| **CI/CD pipelines** | Automated preflight check before deploying |

## Troubleshooting Common Issues

### "Port already in use"

```bash
# Find what's using the port
lsof -i :6379

# Kill the process or use a different port
ferrite doctor --port 6380
```

### "Permission denied" on Data Directory

```bash
# Fix ownership
sudo chown -R $(whoami) /var/lib/ferrite

# Or create a new data directory
mkdir -p ./data
ferrite doctor --config ferrite.toml
```

### "No config file found"

This is informational — Ferrite will use built-in defaults. To create a config file:

```bash
ferrite init --output ferrite.toml
ferrite doctor --config ferrite.toml
```

### Low Memory Warning

If the doctor reports less than 256 MB available:
- Close unused applications
- Reduce `max_memory` in ferrite.toml to fit within available RAM
- Consider upgrading the instance/server

### Low Disk Space Warning

If less than 1 GB is available on the data directory volume:
- Clean up old checkpoint or AOF files
- Expand the volume or move the data directory to a larger disk
- Reduce checkpoint frequency to limit disk usage

### TLS Certificate Warnings

```bash
# Verify certificate files exist
ls -la /path/to/cert.pem /path/to/key.pem

# Check certificate validity
openssl x509 -in /path/to/cert.pem -noout -dates

# Generate self-signed certificates for testing
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All checks passed |
| `1` | One or more checks failed |

## Next Steps

- [Troubleshooting](/docs/operations/troubleshooting) — Resolve runtime issues
- [Monitoring](/docs/operations/monitoring) — Set up proactive monitoring
- [Performance Tuning](/docs/operations/performance-tuning) — Optimize for production
