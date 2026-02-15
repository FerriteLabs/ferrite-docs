---
sidebar_position: 5
description: Remote Direct Memory Access (RDMA) support for ultra-low-latency networking in high-performance deployments.
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# RDMA Networking

Ferrite supports Remote Direct Memory Access (RDMA) for ultra-low-latency networking in high-performance deployments.

## Overview

RDMA enables direct memory access between servers without CPU involvement, providing:

- **Sub-microsecond latency**: Bypass kernel network stack
- **Zero-copy transfers**: Data moves directly between memory regions
- **CPU offload**: Network processing handled by NIC hardware
- **High bandwidth**: 100+ Gbps with modern hardware

## When to Use RDMA

RDMA is beneficial for:

| Use Case | Benefit |
|----------|---------|
| High-frequency trading | Microsecond-level latency |
| ML inference | Fast model/embedding transfers |
| Large cluster replication | Efficient data sync |
| Real-time analytics | Low-latency aggregation |

## Hardware Requirements

### Supported Hardware

| Vendor | Cards | Protocol |
|--------|-------|----------|
| NVIDIA/Mellanox | ConnectX-5/6/7 | InfiniBand, RoCE v2 |
| Intel | E810 | RoCE v2 |
| Broadcom | BCM57504 | RoCE v2 |

### Network Requirements

- **InfiniBand**: Dedicated IB fabric with subnet manager
- **RoCE v2**: Lossless Ethernet with PFC/ECN configured
- **iWARP**: Standard Ethernet (less common)

## Configuration

### Enabling RDMA

```toml
# ferrite.toml
[network]
rdma_enabled = true
rdma_device = "mlx5_0"        # RDMA device name
rdma_port = 1                  # Device port
rdma_gid_index = 3            # GID index for RoCE

[network.rdma]
# Connection settings
max_connections = 1000
connection_timeout_ms = 5000

# Memory registration
max_mr_size = "1GB"           # Max memory region size
inline_threshold = 256        # Inline data for small messages

# Queue pair settings
send_queue_depth = 128
recv_queue_depth = 128
max_send_sge = 4
max_recv_sge = 4

# Completion settings
cq_size = 4096
poll_batch = 32
```

### Verifying RDMA Setup

```bash
# Check RDMA devices
ibv_devices
# Output:
#     device          node GUID
#     ------          ---------
#     mlx5_0          98039b0300123456

# Check device capabilities
ibv_devinfo mlx5_0

# Test RDMA connectivity
# Server:
ib_send_bw -d mlx5_0

# Client:
ib_send_bw -d mlx5_0 <server-ip>
```

## Architecture

### Connection Model

```
┌─────────────────────────────────────────────────────────────┐
│                        Ferrite Server                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Client    │  │   Client    │  │   Client    │         │
│  │ Connection  │  │ Connection  │  │ Connection  │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│  ┌──────┴────────────────┴────────────────┴──────┐         │
│  │              RDMA Connection Pool              │         │
│  │  ┌────────┐  ┌────────┐  ┌────────┐          │         │
│  │  │   QP   │  │   QP   │  │   QP   │   ...    │         │
│  │  └────────┘  └────────┘  └────────┘          │         │
│  └───────────────────────────────────────────────┘         │
│                          │                                  │
│  ┌───────────────────────┴───────────────────────┐         │
│  │           Memory Registration (MR)             │         │
│  │  ┌──────────────────────────────────────────┐ │         │
│  │  │     Pre-registered Memory Regions        │ │         │
│  │  │  (Request/Response Buffers, Data Pages)  │ │         │
│  │  └──────────────────────────────────────────┘ │         │
│  └───────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                          │
                    RDMA NIC (mlx5)
                          │
                    ──────────────
                    Network Fabric
```

### Data Flow

1. **Connection Setup**: Queue Pairs (QPs) established via RDMA CM
2. **Memory Registration**: Buffers registered with NIC for DMA
3. **Send/Recv**: Two-sided operations for request/response
4. **RDMA Read/Write**: One-sided operations for bulk transfers

## Operations

### Two-Sided Operations (Send/Recv)

Used for request/response patterns:

```
Client                              Server
  │                                   │
  │  SEND (Request)                   │
  │ ─────────────────────────────────>│
  │                                   │
  │               RECV (Request)      │
  │                                   │
  │  RECV (Response)                  │
  │<───────────────────────────────── │
  │                 SEND (Response)   │
```

### One-Sided Operations (RDMA Read/Write)

Used for bulk data transfers:

```rust
// Server exposes memory region
let mr = rdma.register_memory(&data_buffer)?;
let remote_key = mr.rkey();

// Client directly reads server memory
client.rdma_read(
    remote_addr,
    remote_key,
    local_buffer,
    length
).await?;
```

## Performance Tuning

### Queue Pair Settings

```toml
[network.rdma]
# Increase for high-throughput workloads
send_queue_depth = 256
recv_queue_depth = 256

# Increase for scatter-gather operations
max_send_sge = 8
max_recv_sge = 8
```

### Completion Queue Tuning

```toml
[network.rdma]
# Larger CQ for high connection counts
cq_size = 16384

# Batch completions for throughput
poll_batch = 64

# Adaptive polling for latency vs CPU
adaptive_polling = true
busy_poll_us = 100
```

### Memory Settings

```toml
[network.rdma]
# Pin memory to avoid page faults
pin_memory = true

# Huge pages for large registrations
huge_pages = true

# Pre-allocate receive buffers
recv_buffer_pool_size = 10000
recv_buffer_size = 4096
```

## Cluster RDMA

### Replication over RDMA

```toml
# Primary node
[replication]
transport = "rdma"
rdma_device = "mlx5_0"

[replication.rdma]
# Use RDMA Write for log shipping
use_rdma_write = true
max_inline_size = 512
```

### Inter-Node Communication

```toml
[cluster]
enabled = true
transport = "rdma"

[cluster.rdma]
# Gossip over RDMA
gossip_rdma = true
# Slot migration uses RDMA
migration_rdma = true
```

## Monitoring

### RDMA Metrics

```bash
# Ferrite RDMA stats
ferrite-cli INFO rdma

# Output:
rdma_connections: 150
rdma_send_ops: 15234567
rdma_recv_ops: 15234567
rdma_read_ops: 456789
rdma_write_ops: 234567
rdma_send_bytes: 12345678900
rdma_recv_bytes: 12345678900
rdma_completion_errors: 0
rdma_retry_exceeded: 0
```

### Hardware Counters

```bash
# RDMA device counters
perfquery -x mlx5_0

# Port errors
ibstat mlx5_0
```

### Prometheus Metrics

```
# HELP ferrite_rdma_operations_total Total RDMA operations
# TYPE ferrite_rdma_operations_total counter
ferrite_rdma_operations_total{type="send"} 15234567
ferrite_rdma_operations_total{type="recv"} 15234567
ferrite_rdma_operations_total{type="read"} 456789
ferrite_rdma_operations_total{type="write"} 234567

# HELP ferrite_rdma_latency_seconds RDMA operation latency
# TYPE ferrite_rdma_latency_seconds histogram
ferrite_rdma_latency_seconds_bucket{op="send",le="0.000001"} 1234
ferrite_rdma_latency_seconds_bucket{op="send",le="0.00001"} 5678
```

## Fallback Behavior

Ferrite gracefully handles RDMA unavailability:

```toml
[network]
rdma_enabled = true
rdma_fallback = "tcp"  # Fall back to TCP if RDMA fails

[network.rdma]
# Retry RDMA connection before fallback
connection_retries = 3
retry_delay_ms = 1000
```

## Troubleshooting

### Common Issues

#### RDMA device not found

```
Error: No RDMA devices found
```

**Solution**:
```bash
# Load RDMA kernel modules
modprobe ib_core
modprobe mlx5_ib

# Verify device is present
lspci | grep Mellanox
ibv_devices
```

#### Connection timeout

```
Error: RDMA connection timeout after 5000ms
```

**Solution**:
- Verify network connectivity
- Check firewall rules (RDMA CM uses TCP port 4791)
- Verify GID index is correct for RoCE

#### Memory registration failed

```
Error: ibv_reg_mr failed: Cannot allocate memory
```

**Solution**:
```bash
# Increase locked memory limit
ulimit -l unlimited

# Or in /etc/security/limits.conf
ferrite    soft    memlock    unlimited
ferrite    hard    memlock    unlimited
```

#### Completion errors

```
Error: Work completion error: IBV_WC_RETRY_EXC_ERR
```

**Solution**:
- Check network for packet loss
- Verify PFC/ECN configuration for RoCE
- Reduce queue depth if overloaded

### Diagnostic Commands

```bash
# Check RDMA connectivity
rdma link show

# Monitor RDMA traffic
perfquery -x mlx5_0 1

# Test bandwidth
ib_send_bw -d mlx5_0 -n 10000

# Test latency
ib_send_lat -d mlx5_0 -n 10000
```

## Performance Comparison

### Latency (P99)

| Transport | GET Latency | SET Latency |
|-----------|-------------|-------------|
| TCP | 150 μs | 180 μs |
| TCP + kernel bypass | 50 μs | 70 μs |
| RDMA (RoCE v2) | 8 μs | 12 μs |
| RDMA (InfiniBand) | 3 μs | 5 μs |

### Throughput

| Transport | GET ops/sec | SET ops/sec |
|-----------|-------------|-------------|
| TCP | 500K | 400K |
| RDMA (RoCE v2) | 2.5M | 2M |
| RDMA (InfiniBand) | 4M | 3M |

## Best Practices

1. **Use dedicated RDMA network** separate from management traffic
2. **Enable PFC and ECN** for RoCE deployments
3. **Pin Ferrite to NUMA node** with RDMA device
4. **Pre-register memory** for hot data paths
5. **Monitor completion errors** as early warning signs
6. **Test failover** to TCP regularly
7. **Size queue pairs appropriately** for workload

## See Also

- [Network Configuration](/docs/reference/configuration#server-section)
- [Performance Tuning](/docs/operations/performance-tuning)
- [Clustering](/docs/advanced/clustering)
