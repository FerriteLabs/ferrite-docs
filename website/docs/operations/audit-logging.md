---
sidebar_position: 6
maturity: beta
---

# Audit Logging

Track all operations for compliance and security.

## Overview

Audit logging records all operations performed on Ferrite for security monitoring, compliance requirements, and forensic analysis.

## Enable Audit Logging

```toml
[audit]
enabled = true
destination = "file"  # file, syslog, kafka, http
file_path = "/var/log/ferrite/audit.log"
```

## Log Format

### JSON Format (Default)

```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "event_id": "evt_abc123",
  "event_type": "command",
  "command": "SET",
  "key": "user:123",
  "args": ["value"],
  "client": {
    "id": "conn:456",
    "ip": "192.168.1.100",
    "port": 52431,
    "user": "admin"
  },
  "database": 0,
  "duration_us": 150,
  "result": "OK",
  "session_id": "sess_xyz789"
}
```

### Event Types

| Event Type | Description |
|------------|-------------|
| `command` | Command execution |
| `auth` | Authentication attempt |
| `acl` | ACL change |
| `config` | Configuration change |
| `connection` | Client connect/disconnect |
| `replication` | Replication events |
| `admin` | Administrative operations |

## Filtering

### By Command

```toml
[audit.filter]
# Only audit these commands
include_commands = ["SET", "DEL", "EXPIRE", "FLUSHDB"]

# Audit all except these
exclude_commands = ["PING", "INFO", "KEYS"]
```

### By Key Pattern

```toml
[audit.filter]
# Only audit keys matching pattern
include_keys = ["user:*", "session:*", "payment:*"]

# Exclude keys
exclude_keys = ["cache:*", "temp:*"]
```

### By User

```toml
[audit.filter]
# Only audit specific users
include_users = ["admin", "service-account"]

# Exclude users
exclude_users = ["monitoring"]
```

### By Result

```toml
[audit.filter]
# Only audit failed operations
only_failures = false

# Include both success and failure
include_results = ["OK", "ERR", "NOAUTH"]
```

## Destinations

### File

```toml
[audit]
destination = "file"
file_path = "/var/log/ferrite/audit.log"
rotation = "daily"  # daily, hourly, size
max_size = "100mb"
max_files = 30
compress = true
```

### Syslog

```toml
[audit]
destination = "syslog"
syslog_facility = "local0"
syslog_tag = "ferrite"
```

### Kafka

```toml
[audit]
destination = "kafka"
kafka_brokers = ["kafka1:9092", "kafka2:9092"]
kafka_topic = "ferrite-audit"
kafka_compression = "snappy"
```

### HTTP Webhook

```toml
[audit]
destination = "http"
http_url = "https://audit.example.com/events"
http_auth = "bearer token123"
http_batch_size = 100
http_flush_interval = "5s"
```

### Multiple Destinations

```toml
[[audit.destinations]]
type = "file"
path = "/var/log/ferrite/audit.log"

[[audit.destinations]]
type = "kafka"
brokers = ["kafka:9092"]
topic = "ferrite-audit"
```

## Sensitive Data Handling

### Value Masking

```toml
[audit.masking]
mask_values = true
mask_pattern = "***"

# Keys to always mask
sensitive_keys = ["password:*", "secret:*", "token:*"]
```

### Key Hashing

```toml
[audit.masking]
hash_keys = true
hash_algorithm = "sha256"
```

### Sample Output with Masking

```json
{
  "command": "SET",
  "key": "password:user123",
  "args": ["***"],  // Masked
  "result": "OK"
}
```

## Commands

### View Audit Status

```bash
AUDIT STATUS
# Returns:
# enabled: true
# destination: file
# events_logged: 1500000
# events_filtered: 50000
# last_event: 2024-01-15T10:30:00Z
```

### Enable/Disable

```bash
# Disable audit logging
AUDIT DISABLE

# Enable audit logging
AUDIT ENABLE
```

### Query Logs

```bash
# Recent audit events
AUDIT QUERY LIMIT 100

# Filter by command
AUDIT QUERY COMMAND SET LIMIT 100

# Filter by user
AUDIT QUERY USER admin LIMIT 100

# Filter by time range
AUDIT QUERY FROM 2024-01-15T00:00:00Z TO 2024-01-15T23:59:59Z
```

## Compliance

### PCI-DSS

```toml
[audit]
enabled = true

[audit.compliance.pci]
enabled = true
# Log all cardholder data access
sensitive_keys = ["card:*", "payment:*"]
# Retain for 1 year
retention_days = 365
```

### GDPR

```toml
[audit.compliance.gdpr]
enabled = true
# Log all personal data access
sensitive_keys = ["user:*:personal", "user:*:email"]
# Support data subject access requests
include_access_logs = true
```

### HIPAA

```toml
[audit.compliance.hipaa]
enabled = true
# Log all PHI access
sensitive_keys = ["patient:*", "health:*"]
# Detailed access tracking
detailed_logging = true
```

## Analysis

### Log Aggregation

```bash
# Count commands by type
cat audit.log | jq -r '.command' | sort | uniq -c | sort -rn

# Failed operations
cat audit.log | jq 'select(.result != "OK")'

# Operations by user
cat audit.log | jq -r '.client.user' | sort | uniq -c

# Suspicious activity (many failures from same IP)
cat audit.log | jq 'select(.result == "NOAUTH")' | jq -r '.client.ip' | sort | uniq -c | sort -rn
```

### Alerting

```yaml
# Example Prometheus alerting rule
groups:
  - name: ferrite-audit
    rules:
      - alert: HighAuthFailures
        expr: rate(ferrite_audit_auth_failures_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High authentication failure rate"

      - alert: AdminOperations
        expr: increase(ferrite_audit_admin_commands_total[1h]) > 0
        labels:
          severity: info
        annotations:
          summary: "Administrative operations detected"
```

## Performance

### Async Logging

```toml
[audit]
async = true
buffer_size = 10000
flush_interval = "1s"
```

### Sampling

```toml
[audit]
# Sample 10% of read operations
sample_reads = 0.1

# Always log writes
sample_writes = 1.0
```

## Best Practices

1. **Enable for production** - Essential for security
2. **Mask sensitive data** - Don't log credentials
3. **Retain appropriately** - Balance compliance vs. storage
4. **Monitor audit system** - Alert if logging fails
5. **Regular review** - Analyze logs for anomalies
6. **Secure audit logs** - Prevent tampering

## Next Steps

- [Security](/docs/advanced/security) - Security configuration
- [Monitoring](/docs/operations/monitoring) - Operational monitoring
- [Security](/docs/advanced/security) - Security features
