---
sidebar_position: 1
title: Docker Deployment
description: Run Ferrite in Docker containers. Includes quick start, docker-compose, configuration, persistence, and production deployment guides.
keywords: [docker, container, docker-compose, deployment, production, devops]
maturity: stable
---

# Docker Deployment

Run Ferrite in Docker containers.

## Quick Start

```bash
# Run Ferrite server
docker run -d \
  --name ferrite \
  -p 6379:6379 \
  ferrite/ferrite:latest

# Test connection
docker exec ferrite ferrite-cli PING
```

## Docker Images

### Available Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest stable release |
| `1.0.0` | Specific version |
| `1.0` | Latest patch of minor version |
| `alpine` | Alpine-based (smaller) |
| `debug` | Includes debug tools |

### Pull Image

```bash
docker pull ferrite/ferrite:latest
docker pull ferrite/ferrite:1.0.0
docker pull ferrite/ferrite:alpine
```

## Configuration

### Using Environment Variables

```bash
docker run -d \
  --name ferrite \
  -p 6379:6379 \
  -e FERRITE_MAXMEMORY=2gb \
  -e FERRITE_REQUIREPASS=secretpassword \
  -e FERRITE_APPENDONLY=yes \
  ferrite/ferrite:latest
```

### Using Config File

```bash
# Create config
cat > ferrite.toml << EOF
[server]
port = 6379

[memory]
maxmemory = "2gb"

[security]
requirepass = "secretpassword"

[persistence.aof]
enabled = true
EOF

# Run with config
docker run -d \
  --name ferrite \
  -p 6379:6379 \
  -v $(pwd)/ferrite.toml:/etc/ferrite/ferrite.toml:ro \
  ferrite/ferrite:latest \
  --config /etc/ferrite/ferrite.toml
```

## Persistence

### Volume Mount

```bash
docker run -d \
  --name ferrite \
  -p 6379:6379 \
  -v ferrite-data:/data \
  ferrite/ferrite:latest
```

### Named Volume

```bash
# Create volume
docker volume create ferrite-data

# Use volume
docker run -d \
  --name ferrite \
  -p 6379:6379 \
  -v ferrite-data:/data \
  ferrite/ferrite:latest
```

### Backup from Volume

```bash
# Backup
docker run --rm \
  -v ferrite-data:/data:ro \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/ferrite-backup.tar.gz /data

# Restore
docker run --rm \
  -v ferrite-data:/data \
  -v $(pwd)/backup:/backup \
  alpine tar xzf /backup/ferrite-backup.tar.gz -C /
```

## Docker Compose

### Basic Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  ferrite:
    image: ferrite/ferrite:latest
    container_name: ferrite
    ports:
      - "6379:6379"
    volumes:
      - ferrite-data:/data
      - ./ferrite.toml:/etc/ferrite/ferrite.toml:ro
    command: ["--config", "/etc/ferrite/ferrite.toml"]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "ferrite-cli", "PING"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  ferrite-data:
```

### With Monitoring

```yaml
version: '3.8'

services:
  ferrite:
    image: ferrite/ferrite:latest
    ports:
      - "6379:6379"
      - "9090:9090"  # Metrics
    volumes:
      - ferrite-data:/data
    environment:
      - FERRITE_METRICS_PORT=9090
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9091:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    depends_on:
      - ferrite

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus

volumes:
  ferrite-data:
  grafana-data:
```

### Replica Setup

```yaml
version: '3.8'

services:
  ferrite-master:
    image: ferrite/ferrite:latest
    ports:
      - "6379:6379"
    volumes:
      - master-data:/data

  ferrite-replica-1:
    image: ferrite/ferrite:latest
    ports:
      - "6380:6379"
    environment:
      - FERRITE_REPLICAOF=ferrite-master 6379
    depends_on:
      - ferrite-master

  ferrite-replica-2:
    image: ferrite/ferrite:latest
    ports:
      - "6381:6379"
    environment:
      - FERRITE_REPLICAOF=ferrite-master 6379
    depends_on:
      - ferrite-master

volumes:
  master-data:
```

## Resource Limits

### Memory Limits

```bash
docker run -d \
  --name ferrite \
  --memory=4g \
  --memory-swap=4g \
  -e FERRITE_MAXMEMORY=3gb \
  ferrite/ferrite:latest
```

### CPU Limits

```bash
docker run -d \
  --name ferrite \
  --cpus=2 \
  ferrite/ferrite:latest
```

### Docker Compose Resources

```yaml
services:
  ferrite:
    image: ferrite/ferrite:latest
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## Networking

### Custom Network

```bash
# Create network
docker network create ferrite-net

# Run on network
docker run -d \
  --name ferrite \
  --network ferrite-net \
  -p 6379:6379 \
  ferrite/ferrite:latest

# Connect app to same network
docker run -d \
  --name myapp \
  --network ferrite-net \
  myapp:latest
```

### Host Networking

```bash
docker run -d \
  --name ferrite \
  --network host \
  ferrite/ferrite:latest
```

## Security

### Run as Non-Root

```dockerfile
FROM ferrite/ferrite:latest
USER ferrite
```

### Read-Only Filesystem

```bash
docker run -d \
  --name ferrite \
  --read-only \
  --tmpfs /tmp \
  -v ferrite-data:/data \
  ferrite/ferrite:latest
```

### Security Options

```yaml
services:
  ferrite:
    image: ferrite/ferrite:latest
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

## Health Checks

### Docker Health Check

```dockerfile
FROM ferrite/ferrite:latest

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD ferrite-cli PING || exit 1
```

### Compose Health Check

```yaml
services:
  ferrite:
    image: ferrite/ferrite:latest
    healthcheck:
      test: ["CMD", "ferrite-cli", "PING"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
```

## Logging

### Log to stdout

```bash
docker logs ferrite
docker logs -f ferrite  # Follow
```

### Log Driver

```bash
docker run -d \
  --name ferrite \
  --log-driver json-file \
  --log-opt max-size=100m \
  --log-opt max-file=3 \
  ferrite/ferrite:latest
```

### Compose Logging

```yaml
services:
  ferrite:
    image: ferrite/ferrite:latest
    logging:
      driver: json-file
      options:
        max-size: "100m"
        max-file: "3"
```

## Building Custom Image

### Dockerfile

```dockerfile
FROM ferrite/ferrite:latest

# Add custom config
COPY ferrite.toml /etc/ferrite/ferrite.toml

# Add plugins
COPY plugins/ /var/lib/ferrite/plugins/

# Set entrypoint
ENTRYPOINT ["ferrite", "--config", "/etc/ferrite/ferrite.toml"]
```

### Build

```bash
docker build -t my-ferrite:latest .
```

## Best Practices

1. **Use specific version tags** - Avoid `latest` in production
2. **Set resource limits** - Prevent container from consuming all resources
3. **Use volumes for data** - Persist data outside container
4. **Enable health checks** - For orchestrator awareness
5. **Run as non-root** - Better security
6. **Log to stdout** - For container log aggregation
7. **Use secrets** - Don't embed passwords in images

## Next Steps

- [Kubernetes](/docs/deployment/kubernetes) - K8s deployment
- [High Availability](/docs/deployment/high-availability) - HA setup
- [Monitoring](/docs/operations/monitoring) - Container monitoring
