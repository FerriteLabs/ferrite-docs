---
sidebar_position: 11
title: Edge & IoT Deployment
description: Deploy Ferrite on Raspberry Pi, ARM devices, and edge nodes. Minimal builds with the lite feature, memory-constrained configurations, and cloud sync patterns.
keywords: [ferrite iot, edge computing, raspberry pi, arm, cross-compilation, embedded database, sensor data, edge caching]
maturity: experimental
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Edge & IoT Deployment

This tutorial covers deploying Ferrite on resource-constrained devices — Raspberry Pi, ARM gateways, industrial edge nodes, and IoT sensors. You'll learn how to build minimal binaries, configure tight memory budgets, and sync data to the cloud.

## Target Environments

| Device | RAM | Storage | CPU | Ferrite Preset |
|--------|-----|---------|-----|----------------|
| Raspberry Pi Zero | 512 MB | SD card | ARM11 | `EdgeConfig::minimal()` |
| Raspberry Pi 4 | 2–8 GB | SD / SSD | Cortex-A72 | `EdgeConfig::standard()` |
| Industrial gateway | 1–4 GB | eMMC | ARM Cortex-A53 | `EdgeConfig::full()` |
| IoT sensor module | 64–256 MB | Flash | Cortex-M / RISC-V | `EdgeConfig::iot()` |
| Mobile device | 4–16 GB | NVMe | ARM big.LITTLE | `EdgeConfig::mobile()` |

## Minimal Build with `--features lite`

The `lite` feature produces a smaller binary by excluding heavy optional dependencies:

```bash
# Standard build (~15 MB)
cargo build --release

# Lite build (~2 MB stripped)
cargo build --release --features lite
strip target/release/my-app
```

### Cargo.toml Setup

```toml title="Cargo.toml"
[dependencies]
ferrite = { version = "0.1", default-features = false, features = ["lite"] }
anyhow = "1"
bytes = "1"

[profile.release]
opt-level = "z"     # Optimize for size
lto = true          # Link-time optimization
codegen-units = 1   # Single codegen unit for better optimization
panic = "abort"     # Smaller binary (no unwinding)
strip = true        # Strip debug symbols
```

This profile minimizes binary size for deployment on flash-constrained devices.

## Memory-Constrained Configuration

### Using EdgeStore (Ultra-Low Memory)

The `EdgeStore` is optimized for devices with as little as 2 MB of available memory:

```rust
use ferrite_core::embedded::edge::{EdgeStore, EdgeConfig};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // IoT preset: 2 MB memory, 1K keys, max compression
    let store = EdgeStore::new(EdgeConfig::iot());

    // Small values are stored inline (≤23 bytes, zero heap allocation)
    store.set("sensor:id", b"TH-001", None)?;

    // Larger values are automatically LZ4-compressed
    let reading = format!(
        r#"{{"temp":22.5,"hum":45.2,"ts":{}}}"#,
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs()
    );
    store.set("reading:latest", reading.as_bytes(), Some(3600))?;

    // Check memory usage
    let stats = store.stats();
    println!("Memory: {} / {} bytes ({} keys)",
        stats.memory_used, stats.memory_limit, stats.keys);
    println!("Compression savings: {} bytes", stats.compression_savings);

    Ok(())
}
```

### Using LiteDatabase (Balanced)

The `LiteDatabase` provides a simpler API with cloud sync support:

```rust
use ferrite_core::embedded::lite::{LiteConfig, LiteDatabase};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = LiteConfig {
        max_memory_mb: 32,              // 32 MB budget
        max_keys: 50_000,
        enable_persistence: true,
        data_dir: "/var/lib/ferrite".to_string(),
        compression_enabled: true,
        enable_sync: false,
        ..Default::default()
    };

    let db = LiteDatabase::new(config)?;

    db.set("device:name", "edge-gateway-01")?;
    db.set("device:location", "warehouse-north")?;

    let stats = db.stats();
    println!("Keys: {}, Memory: {} / {} bytes",
        stats.keys_count, stats.memory_used_bytes, stats.memory_limit_bytes);

    Ok(())
}
```

### Using the High-Level Ferrite API

For edge devices with more resources (Raspberry Pi 4, industrial gateways):

```rust
use ferrite::embedded::Ferrite;
use std::sync::Arc;

fn main() -> anyhow::Result<()> {
    let db = Arc::new(
        Ferrite::builder()
            .max_memory("64mb")
            .persistence(false)
            .compression(true)
            .eviction_policy(ferrite::embedded::EvictionPolicy::AllKeysLru)
            .build()?
    );

    // Full Redis-style API available
    db.set("config:sample_rate", "1000")?;
    db.hset("device:info", "firmware", "v2.1.0")?;
    db.hset("device:info", "uptime", "0")?;

    Ok(())
}
```

## Example: IoT Sensor Data Collection

This pattern collects sensor data locally, maintains sliding-window aggregations, and tracks active sensors — all within a tight memory budget.

```rust
use bytes::Bytes;
use ferrite::embedded::Ferrite;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

/// Represents a reading from a physical sensor.
struct SensorReading {
    sensor_id: String,
    temperature: f64,
    humidity: f64,
    timestamp: u64,
}

fn main() -> anyhow::Result<()> {
    // Edge gateway with 64 MB budget
    let db = Arc::new(
        Ferrite::builder()
            .max_memory("64mb")
            .persistence(false)
            .build()?,
    );

    // Simulate 3 sensors reporting every second
    let sensors = ["sensor:temp-001", "sensor:temp-002", "sensor:hum-001"];
    let mut ts: u64 = 1_700_000_000;

    for round in 0..10 {
        for sensor_id in &sensors {
            let reading = SensorReading {
                sensor_id: sensor_id.to_string(),
                temperature: 20.0 + (round as f64 * 0.5),
                humidity: 45.0 + (round as f64 * 0.2),
                timestamp: ts,
            };
            ingest_reading(&db, &reading)?;
            ts += 1;
        }
    }

    // Query aggregations
    for sensor_id in &sensors {
        let agg_key = format!("{}:agg", sensor_id);
        if let Some(count) = db.hget(&agg_key, "count")? {
            let count_str = String::from_utf8_lossy(&count);
            let min = db.hget(&agg_key, "min_temp")?
                .map(|b| String::from_utf8_lossy(&b).to_string())
                .unwrap_or_default();
            let max = db.hget(&agg_key, "max_temp")?
                .map(|b| String::from_utf8_lossy(&b).to_string())
                .unwrap_or_default();
            println!("  {} -> count={}, min={}, max={}", sensor_id, count_str, min, max);
        }
    }

    // Active sensors tracked via a set
    let active = db.smembers("active_sensors")?;
    println!("Active sensors: {}", active.len());

    Ok(())
}

/// Ingest a sensor reading into the local database.
///
/// Storage pattern:
///   - `{sensor_id}:latest`  → latest reading as a string
///   - `{sensor_id}:history` → bounded list of last 100 readings
///   - `{sensor_id}:agg`     → hash with running min/max/sum/count
///   - `active_sensors`      → set of all reporting sensor IDs
fn ingest_reading(db: &Ferrite, reading: &SensorReading) -> anyhow::Result<()> {
    let payload = format!(
        "ts={} temp={:.2} hum={:.2}",
        reading.timestamp, reading.temperature, reading.humidity,
    );

    // Latest reading (overwritten each time)
    let latest_key = format!("{}:latest", reading.sensor_id);
    db.set(latest_key.as_str(), payload.as_str())?;

    // Bounded history list (newest first, keep last 100)
    let history_key = format!("{}:history", reading.sensor_id);
    db.lpush(history_key.as_str(), &[Bytes::from(payload)])?;

    // Running aggregations in a hash
    let agg_key = format!("{}:agg", reading.sensor_id);
    let temp_str = format!("{:.2}", reading.temperature);

    let count: f64 = db.hget(&agg_key, "count")?
        .map(|b| String::from_utf8_lossy(&b).parse().unwrap_or(0.0))
        .unwrap_or(0.0);
    db.hset(&agg_key, "count", format!("{}", count + 1.0))?;

    let sum: f64 = db.hget(&agg_key, "sum_temp")?
        .map(|b| String::from_utf8_lossy(&b).parse().unwrap_or(0.0))
        .unwrap_or(0.0);
    db.hset(&agg_key, "sum_temp", format!("{:.2}", sum + reading.temperature))?;

    // Update min
    let update_min = db.hget(&agg_key, "min_temp")?
        .map(|b| String::from_utf8_lossy(&b).parse::<f64>().unwrap_or(f64::MAX))
        .map(|current| reading.temperature < current)
        .unwrap_or(true);
    if update_min {
        db.hset(&agg_key, "min_temp", temp_str.as_str())?;
    }

    // Update max
    let update_max = db.hget(&agg_key, "max_temp")?
        .map(|b| String::from_utf8_lossy(&b).parse::<f64>().unwrap_or(f64::MIN))
        .map(|current| reading.temperature > current)
        .unwrap_or(true);
    if update_max {
        db.hset(&agg_key, "max_temp", temp_str.as_str())?;
    }

    // Track active sensor
    db.sadd("active_sensors", &[Bytes::from(reading.sensor_id.clone())])?;

    Ok(())
}
```

## Example: Edge Caching with Cloud Sync {#edge-caching-with-cloud-sync}

This pattern maintains a local cache on the edge device and periodically syncs changes to a central cloud service using the delta sync protocol:

```rust
use ferrite_core::embedded::lite::{LiteConfig, LiteDatabase};
use ferrite_core::embedded::sync::{SyncEngine, SyncConfig, ConflictResolution, ChangeType};
use bytes::Bytes;
use std::time::Duration;
use std::thread;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // ── Local edge database ─────────────────────────────────────
    let config = LiteConfig {
        max_memory_mb: 32,
        max_keys: 10_000,
        enable_persistence: true,
        data_dir: "/var/lib/ferrite-edge".to_string(),
        enable_sync: true,
        sync_endpoint: Some("https://api.example.com/sync".to_string()),
        sync_interval_secs: 60,
        compression_enabled: true,
        ..Default::default()
    };

    let db = LiteDatabase::new(config)?;

    // ── Sync engine for conflict resolution ─────────────────────
    let sync_config = SyncConfig {
        node_id: "edge-node-01".to_string(),
        conflict_resolution: ConflictResolution::LastWriteWins,
        compression: true,
        ..Default::default()
    };

    let sync_engine = SyncEngine::new(sync_config);

    // ── Collect data and track changes ──────────────────────────
    for i in 0..100 {
        let key = format!("reading:{}", i);
        let value = format!("temp={:.1},ts={}", 20.0 + (i as f64 * 0.1), i * 1000);

        db.set(&key, &value)?;
        sync_engine.record_change(
            &key,
            ChangeType::Set,
            Some(Bytes::from(value)),
        );
    }

    // ── Generate delta for cloud upload ─────────────────────────
    let delta = sync_engine.get_delta(0);
    println!("Delta: {} changes, sequence {}-{}",
        delta.changes.len(), delta.from_sequence, delta.to_sequence);

    // Serialize delta for network transfer
    let delta_bytes = delta.to_bytes()?;
    println!("Delta size: {} bytes (compressed: {})", delta_bytes.len(), delta.compressed);

    // ── Periodic sync trigger ───────────────────────────────────
    let result = db.sync_now()?;
    println!("Sync complete: {} keys, {} bytes in {}ms",
        result.keys_synced, result.bytes_transferred, result.duration_ms);

    Ok(())
}
```

## Cross-Compilation Guide

### Raspberry Pi (ARM 64-bit)

<Tabs groupId="cross-compile">
  <TabItem value="linux" label="From Linux" default>

```bash
# Install the cross-compilation toolchain
rustup target add aarch64-unknown-linux-gnu
sudo apt install gcc-aarch64-linux-gnu

# Configure cargo for cross-compilation
cat >> ~/.cargo/config.toml << 'EOF'
[target.aarch64-unknown-linux-gnu]
linker = "aarch64-linux-gnu-gcc"
EOF

# Build
cargo build --release --target aarch64-unknown-linux-gnu --features lite

# Copy to device
scp target/aarch64-unknown-linux-gnu/release/my-app pi@raspberrypi:~/
```

  </TabItem>
  <TabItem value="macos" label="From macOS">

```bash
# Install cross (recommended for macOS → Linux cross-compilation)
cargo install cross

# Build for Raspberry Pi
cross build --release --target aarch64-unknown-linux-gnu --features lite

# Copy to device
scp target/aarch64-unknown-linux-gnu/release/my-app pi@raspberrypi:~/
```

  </TabItem>
  <TabItem value="docker" label="Using Docker">

```dockerfile
# Multi-stage build for Raspberry Pi
FROM rust:1.88 AS builder

RUN rustup target add aarch64-unknown-linux-gnu && \
    apt-get update && \
    apt-get install -y gcc-aarch64-linux-gnu

ENV CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc

WORKDIR /app
COPY . .
RUN cargo build --release \
    --target aarch64-unknown-linux-gnu \
    --features lite

FROM arm64v8/debian:bookworm-slim
COPY --from=builder /app/target/aarch64-unknown-linux-gnu/release/my-app /usr/local/bin/
CMD ["my-app"]
```

  </TabItem>
</Tabs>

### Raspberry Pi (ARM 32-bit)

```bash
# For older Raspberry Pi models (Zero W, Pi 1, Pi 2)
rustup target add armv7-unknown-linux-gnueabihf
cargo build --release --target armv7-unknown-linux-gnueabihf --features lite
```

### Common Cross-Compilation Targets

| Target | Device |
|--------|--------|
| `aarch64-unknown-linux-gnu` | Raspberry Pi 3/4/5, ARM64 gateways |
| `armv7-unknown-linux-gnueabihf` | Raspberry Pi 2/3 (32-bit), BeagleBone |
| `arm-unknown-linux-gnueabihf` | Raspberry Pi Zero W |
| `x86_64-unknown-linux-musl` | Static Linux binaries (Alpine, minimal containers) |
| `aarch64-linux-android` | Android ARM64 devices |

## Production Tips

### 1. Set Memory Limits Conservatively

Leave headroom for the OS and your application logic. A good rule of thumb is to allocate no more than 50% of available RAM to Ferrite:

```rust
// On a 512 MB Raspberry Pi Zero, use ~200 MB max
let db = Ferrite::builder()
    .max_memory("200mb")
    .eviction_policy(EvictionPolicy::AllKeysLru)
    .build()?;
```

### 2. Use TTLs Aggressively

On memory-constrained devices, every key should have a TTL to prevent unbounded growth:

```rust
// Sensor readings expire after 1 hour
db.set("reading:latest", &data)?;
db.expire("reading:latest", 3600)?;

// Alerts expire after 5 minutes
db.set("alert:high-temp", "warning")?;
db.expire("alert:high-temp", 300)?;
```

### 3. Monitor Memory Usage

Periodically check memory usage and trigger cleanup if needed:

```rust
// With EdgeStore
let stats = store.stats();
let usage_pct = (stats.memory_used as f64 / stats.memory_limit as f64) * 100.0;
if usage_pct > 80.0 {
    let cleaned = store.cleanup_expired();
    println!("Warning: {}% memory used, cleaned {} expired keys", usage_pct, cleaned);
}
```

### 4. Handle Sync Failures Gracefully

Network connectivity on edge devices is unreliable. Always handle sync errors:

```rust
match db.sync_now() {
    Ok(result) => println!("Synced {} keys", result.keys_synced),
    Err(e) => {
        eprintln!("Sync failed: {} — will retry next interval", e);
        // Data is safe locally; sync will catch up later
    }
}
```

### 5. Use Compression for Repetitive Data

Sensor data is often highly compressible. Enable LZ4 compression to fit more data in limited memory:

```rust
let config = EdgeConfig {
    compression: true,
    compression_level: 6,  // Balance between speed and ratio
    ..EdgeConfig::iot()
};
```

## Systemd Service for Raspberry Pi

Deploy your Ferrite-based application as a systemd service:

```ini title="/etc/systemd/system/ferrite-edge.service"
[Unit]
Description=Ferrite Edge Data Collector
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/my-edge-app
Restart=always
RestartSec=5
Environment=RUST_LOG=info
MemoryMax=256M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ferrite-edge
sudo systemctl start ferrite-edge
sudo journalctl -u ferrite-edge -f
```

## Next Steps

- [Embedded Mode Reference](/docs/features/embedded-mode) — Full API reference and comparison with alternatives
- [Embedded Mode Guide](/docs/guides/embedded-mode) — Data types, transactions, and vector search in embedded mode
- [IoT Telemetry Use Case](/docs/use-cases/iot-telemetry) — Architecture patterns for IoT data pipelines
