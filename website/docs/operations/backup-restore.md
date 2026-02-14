---
sidebar_position: 5
maturity: beta
---

# Backup & Restore

Protect your data with comprehensive backup and recovery strategies.

## Overview

Ferrite supports multiple backup methods:

| Method | Type | Impact | Use Case |
|--------|------|--------|----------|
| AOF | Continuous | None | Point-in-time recovery |
| Checkpoint | Point-in-time | Minimal | Fast restore |
| Replica | Continuous | None | Disaster recovery |
| Export | On-demand | Read load | Migration, archival |

## AOF (Append-Only File)

### Enable AOF

```toml
[persistence.aof]
enabled = true
filename = "appendonly.aof"
fsync = "everysec"  # "always", "everysec", "no"
```

### AOF Rewrite

```bash
# Trigger AOF rewrite to compact file
BGREWRITEAOF

# Check status
INFO persistence
# aof_rewrite_in_progress: 1
# aof_last_rewrite_time_sec: 5
```

### AOF Configuration

```toml
[persistence.aof]
enabled = true
filename = "appendonly.aof"
fsync = "everysec"

# Auto-rewrite triggers
auto_rewrite_percentage = 100  # Rewrite when AOF is 2x checkpoint size
auto_rewrite_min_size = "64mb"
```

### Backup AOF

```bash
# 1. Trigger rewrite for clean file
BGREWRITEAOF

# 2. Wait for completion
while [ $(ferrite-cli INFO persistence | grep aof_rewrite_in_progress | cut -d: -f2) -eq 1 ]; do
  sleep 1
done

# 3. Copy AOF file
cp /var/lib/ferrite/appendonly.aof /backup/appendonly-$(date +%Y%m%d).aof
```

## Checkpoints

### Enable Checkpoints

```toml
[persistence.checkpoint]
enabled = true
filename = "checkpoint.fcpt"
directory = "/var/lib/ferrite/checkpoints"

# Trigger conditions
interval_secs = 3600  # Every hour
changes_threshold = 100000  # Or after 100K changes
```

### Manual Checkpoint

```bash
# Create checkpoint in background
BGSAVE

# Check status
INFO persistence
# checkpoint_in_progress: 0
# last_checkpoint_time: 1705312800
# last_checkpoint_status: ok
```

### Restore from Checkpoint

```bash
# 1. Stop server
ferrite-cli SHUTDOWN

# 2. Replace checkpoint file
cp /backup/checkpoint-latest.fcpt /var/lib/ferrite/checkpoint.fcpt

# 3. Start server
ferrite --config ferrite.toml
```

## Backup Scripts

The `ferrite-ops` repository provides production-ready backup and restore scripts.

### Local Backup

```bash
# Basic backup (uses defaults: /var/lib/ferrite/data → /var/lib/ferrite/backups)
./scripts/backup.sh

# Custom destination
BACKUP_DEST=/mnt/nfs/backups ./scripts/backup.sh

# Custom data directory and retention
FERRITE_DATA_DIR=/data/ferrite BACKUP_RETENTION=14 ./scripts/backup.sh
```

The backup script:
1. Triggers a `BGSAVE` checkpoint and waits for completion
2. Copies checkpoint and AOF files to a staging directory
3. Compresses the backup with gzip
4. Uploads to S3 (if configured)
5. Rotates old backups based on retention count

### S3 Backup

```bash
BACKUP_S3_BUCKET=my-ferrite-backups \
BACKUP_S3_REGION=us-east-1 \
BACKUP_S3_PREFIX=prod/ \
  ./scripts/backup.sh
```

### Restore

```bash
# Restore from local backup (stops server, replaces data, restarts)
./scripts/restore.sh /var/lib/ferrite/backups/ferrite-backup-20240115_020000.tar.gz

# Restore from S3
RESTORE_S3_BUCKET=my-ferrite-backups \
  ./scripts/restore.sh ferrite-backup-20240115_020000.tar.gz

# Point-in-time recovery (restore checkpoint then truncate AOF)
./scripts/restore.sh /backups/ferrite-backup-20240115.tar.gz \
  --pitr "2024-01-15T10:30:00Z"

# Skip server stop/start (for container environments)
RESTORE_SKIP_STOP=true ./scripts/restore.sh /backups/backup.tar.gz
```

The restore script:
1. Downloads backup from S3 (if configured)
2. Verifies archive integrity
3. Stops the Ferrite server
4. Creates a safety backup of current data
5. Extracts and replaces data files
6. Applies AOF truncation for point-in-time recovery
7. Restarts the server

## Scheduled Backups

### Cron-Based Backup

```bash
#!/bin/bash
# /usr/local/bin/ferrite-backup.sh

BACKUP_DIR="/backup/ferrite"
DATE=$(date +%Y%m%d_%H%M%S)
HOST="localhost"
PORT="6379"

# Create backup directory
mkdir -p $BACKUP_DIR

# Trigger checkpoint
ferrite-cli -h $HOST -p $PORT BGSAVE

# Wait for completion
while [ $(ferrite-cli -h $HOST -p $PORT INFO persistence | grep checkpoint_in_progress | cut -d: -f2) -eq 1 ]; do
  sleep 1
done

# Copy files
cp /var/lib/ferrite/checkpoint.fcpt $BACKUP_DIR/checkpoint-$DATE.fcpt
cp /var/lib/ferrite/appendonly.aof $BACKUP_DIR/appendonly-$DATE.aof

# Compress
gzip $BACKUP_DIR/checkpoint-$DATE.fcpt
gzip $BACKUP_DIR/appendonly-$DATE.aof

# Cleanup old backups (keep 7 days)
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```crontab
# Run backup daily at 2am
0 2 * * * /usr/local/bin/ferrite-backup.sh >> /var/log/ferrite-backup.log 2>&1
```

### Kubernetes CronJob

The Ferrite Helm chart includes a built-in CronJob for automated backups.

**Enable in Helm values:**

```yaml
backup:
  enabled: true
  schedule: "0 2 * * *"    # Daily at 2am
  destination: "/backups"
  retention:
    count: 7
  # Optional: upload to S3 after backup
  s3:
    enabled: true
    bucket: "my-ferrite-backups"
    region: "us-east-1"
    prefix: "prod/"
  # Optional: persistent storage for local backups
  persistence:
    enabled: true
    storageClassName: "gp3"
    size: "50Gi"
```

**Install with backups enabled:**

```bash
helm install ferrite ferrite-ops/charts/ferrite \
  --set backup.enabled=true \
  --set backup.schedule="0 */6 * * *" \
  --set backup.s3.enabled=true \
  --set backup.s3.bucket=my-ferrite-backups
```

**Monitor backup jobs:**

```bash
# List recent backup jobs
kubectl get cronjobs
kubectl get jobs -l app.kubernetes.io/component=backup

# Check backup logs
kubectl logs job/ferrite-backup-<timestamp>
```

## Cloud Backups

### AWS S3

```bash
#!/bin/bash
# Backup to S3

BUCKET="my-ferrite-backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create local backup
ferrite-cli BGSAVE
# ... wait for completion ...

# Upload to S3
aws s3 cp /var/lib/ferrite/checkpoint.fcpt \
  s3://$BUCKET/ferrite/checkpoint-$DATE.fcpt

# With lifecycle policy for retention
aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET \
  --lifecycle-configuration file://lifecycle.json
```

```json
// lifecycle.json
{
  "Rules": [
    {
      "ID": "DeleteOldBackups",
      "Status": "Enabled",
      "Prefix": "ferrite/",
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

### Google Cloud Storage

```bash
#!/bin/bash
BUCKET="gs://my-ferrite-backups"
DATE=$(date +%Y%m%d_%H%M%S)

gsutil cp /var/lib/ferrite/checkpoint.fcpt \
  $BUCKET/ferrite/checkpoint-$DATE.fcpt
```

### Azure Blob Storage

```bash
#!/bin/bash
CONTAINER="ferrite-backups"
DATE=$(date +%Y%m%d_%H%M%S)

az storage blob upload \
  --container-name $CONTAINER \
  --name checkpoint-$DATE.fcpt \
  --file /var/lib/ferrite/checkpoint.fcpt
```

## Export/Import

### Full Export

```bash
# Export all keys to file
EXPORT /backup/export.ferrite

# Export with filter
EXPORT /backup/users.ferrite MATCH 'user:*'
```

### Import

```bash
# Import from export file
IMPORT /backup/export.ferrite

# Import with key transformation
IMPORT /backup/export.ferrite PREFIX 'imported:'
```

### JSON Export

```bash
# Export to JSON format
EXPORT /backup/data.json FORMAT json

# Selective export
EXPORT /backup/users.json FORMAT json MATCH 'user:*' TYPE hash
```

## Point-in-Time Recovery

Point-in-time recovery (PITR) lets you restore data to any moment by combining a checkpoint with AOF replay.

### Strategy

1. Restore the most recent checkpoint **before** the target time
2. Replay AOF entries up to the target timestamp
3. Start the server — it loads the checkpoint and replays the truncated AOF

### Using the Restore Script

```bash
# Restore to a specific point in time
./scripts/restore.sh /backups/ferrite-backup-20240115.tar.gz \
  --pitr "2024-01-15T10:30:00Z"
```

### Manual PITR

```bash
# 1. Stop server
ferrite-cli SHUTDOWN

# 2. Restore checkpoint from before target time
cp checkpoint-20240115.fcpt /var/lib/ferrite/checkpoint.fcpt

# 3. Truncate AOF at target time
ferrite-check-aof --truncate-at "2024-01-15T10:30:00Z" appendonly.aof

# 4. Start server - it will replay AOF on top of checkpoint
ferrite --config ferrite.toml
```

## Disaster Recovery

### Disaster Recovery Playbook

#### Scenario 1: Single-Node Data Loss

1. Stop the affected instance
2. Restore from the most recent backup:
   ```bash
   ./scripts/restore.sh /backups/latest-backup.tar.gz
   ```
3. Verify data integrity:
   ```bash
   ferrite-cli DBSIZE
   ferrite-cli INFO persistence
   ```

#### Scenario 2: Restore from S3 to New Instance

1. Provision a new server
2. Install Ferrite
3. Download and restore:
   ```bash
   RESTORE_S3_BUCKET=my-backups RESTORE_SKIP_STOP=true \
     ./scripts/restore.sh ferrite-backup-20240115_020000.tar.gz
   ferrite --config ferrite.toml
   ```

#### Scenario 3: Replica-Based Failover

```bash
# 1. Verify primary is down
ferrite-cli -h primary-host PING  # Should fail

# 2. Promote replica to master
ferrite-cli -h replica-host REPLICAOF NO ONE

# 3. Update DNS/load balancer to point to new master

# 4. Verify
ferrite-cli -h replica-host INFO replication
# role: master
```

### Replica-Based DR

```toml
# Primary configuration
[replication]
role = "master"
min_replicas_to_write = 1
min_replicas_max_lag = 10

# DR replica configuration
[replication]
role = "replica"
master_host = "primary-host"
master_port = 6379
read_only = true
```

## Backup Verification and Testing

Regular verification ensures backups are usable when you need them.

### Verify Checkpoint

```bash
# Check checkpoint integrity
ferrite-check-checkpoint checkpoint.fcpt

# Output:
# Checkpoint file: checkpoint.fcpt
# Format version: 1
# Keys: 1000000
# Size: 512MB
# Checksum: valid
# Created: 2024-01-15T10:00:00Z
```

### Verify AOF

```bash
# Check AOF integrity
ferrite-check-aof appendonly.aof

# Output:
# AOF file: appendonly.aof
# Commands: 5000000
# Size: 1.2GB
# Status: valid
```

### Test Restore Procedure

Run periodic restore tests to validate your backups:

```bash
# Start a test instance with backup data
mkdir -p /tmp/ferrite-restore-test
cp /backups/latest-backup.tar.gz /tmp/ferrite-restore-test/

FERRITE_DATA_DIR=/tmp/ferrite-restore-test/data \
FERRITE_PORT=6399 \
RESTORE_SKIP_STOP=true \
  ./scripts/restore.sh /tmp/ferrite-restore-test/latest-backup.tar.gz

# Start test server
ferrite --port 6399 --dir /tmp/ferrite-restore-test/data &

# Verify data
ferrite-cli -p 6399 DBSIZE
ferrite-cli -p 6399 GET test:key

# Cleanup
ferrite-cli -p 6399 SHUTDOWN
rm -rf /tmp/ferrite-restore-test
```

### Automated Verification CronJob

Add a periodic restore verification in Kubernetes:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: ferrite-backup-verify
spec:
  schedule: "0 6 * * 0"  # Weekly on Sunday at 6am
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: verify
            image: ghcr.io/ferritelabs/ferrite:latest
            command:
              - /bin/sh
              - -c
              - |
                LATEST=$(ls -t /backups/ferrite-backup-*.tar.gz | head -1)
                echo "Verifying: $LATEST"
                gzip -t "$LATEST" && echo "PASS: Archive intact" || exit 1
          restartPolicy: OnFailure
```

## Configuration

```toml
[persistence]
dir = "/var/lib/ferrite"

[persistence.checkpoint]
enabled = true
filename = "checkpoint.fcpt"
interval_secs = 3600
changes_threshold = 100000
compression = true

[persistence.aof]
enabled = true
filename = "appendonly.aof"
fsync = "everysec"
auto_rewrite_percentage = 100
auto_rewrite_min_size = "64mb"

[backup]
enabled = true
schedule = "0 2 * * *"  # Daily at 2am
retention_days = 30
destination = "s3://bucket/ferrite/"
```

## Best Practices

1. **Use both AOF and checkpoints** — Checkpoints for fast restore, AOF for point-in-time
2. **Test restores regularly** — Verify backups actually work (at least monthly)
3. **Offsite backups** — Store backups in a different region or cloud provider
4. **Monitor backup success** — Alert on backup failures via Prometheus/alerting
5. **Document procedures** — Write runbooks for every restore scenario
6. **Automate everything** — Manual backups get forgotten; use CronJobs or cron
7. **Encrypt backups** — Use at-rest encryption or encrypt backup archives
8. **Version your scripts** — Keep backup/restore scripts in source control

## Next Steps

- [Monitoring](/docs/operations/monitoring) — Monitor backup status
- [Encryption](/docs/advanced/encryption) — Encrypt data in transit and at rest
- [Troubleshooting](/docs/operations/troubleshooting) — Recovery issues
- [Deployment](/docs/deployment/high-availability) — HA setup
