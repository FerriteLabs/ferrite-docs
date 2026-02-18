---
slug: edge-embedded-mode
title: "Ferrite at the Edge: Embedded Mode for IoT and Edge Computing"
authors: [ferrite-team]
tags: [embedded, edge-computing, iot, lite]
description: How Ferrite's embedded mode and lite feature flag enable high-performance key-value storage for IoT devices, edge gateways, and resource-constrained environments.
---

Not every workload runs in a data center with unlimited memory and a fast network to a centralized cache. Edge computing, IoT gateways, and embedded systems need local, fast, persistent storage in a small footprint. Ferrite's embedded mode brings the same storage engine to devices where running a full server process is impractical.

<!-- truncate -->

## Edge Computing Needs Local State

Edge applications face a fundamental tension. They need fast data access, but network round trips to a centralized database add latency that defeats the purpose of running at the edge. Common patterns include:

- **IoT gateways** buffering sensor data before batched uploads
- **Point-of-sale systems** caching product catalogs for offline operation
- **CDN edge nodes** storing session data and rate-limiting counters
- **Autonomous vehicles** maintaining local maps and configuration state

These workloads need a storage engine that is fast, persistent, embeddable as a library, and small enough to run on constrained hardware.

## The `lite` Feature Flag

Ferrite's `lite` feature flag strips the binary down to its essential components: the HybridLog storage engine, RESP protocol parser, and basic data structures. Everything else -- vector search, AI features, clustering, WASM runtime, TUI dashboard -- is excluded.

```bash
# Full build (all features)
cargo build --release --features all
# Binary size: ~42 MB

# Lite build (minimal features)
cargo build --release --features lite
# Binary size: ~5.8 MB

# Lite + static musl linking (no glibc dependency)
cargo build --release --features lite --target x86_64-unknown-linux-musl
# Binary size: ~6.1 MB
```

### Binary Size Breakdown by Feature

| Feature | Added Size | Description |
|---------|-----------|-------------|
| Core (lite baseline) | 5.8 MB | Storage engine, protocol, basic types |
| +clustering | +3.2 MB | Raft consensus, gossip, slot migration |
| +scripting | +2.1 MB | Lua 5.4 runtime |
| +wasm | +8.4 MB | Wasmtime runtime |
| +ai | +12.3 MB | ONNX runtime, vector indexes |
| +tls | +1.8 MB | rustls + certificate management |
| +otel | +2.4 MB | OpenTelemetry SDK |
| +tui | +1.6 MB | Terminal dashboard |
| All features | ~42 MB | Everything |

For ARM-based edge devices, cross-compilation produces similarly compact binaries:

```bash
# Raspberry Pi (ARMv7)
cross build --release --features lite --target armv7-unknown-linux-musleabihf
# Binary size: ~6.4 MB

# ARM64 (e.g., NVIDIA Jetson, Apple Silicon)
cross build --release --features lite --target aarch64-unknown-linux-musl
# Binary size: ~6.0 MB
```

## Embedded API: Ferrite as a Library

When you do not need a network server at all, Ferrite can be used as an embedded library directly in your Rust application. This eliminates serialization overhead and network latency entirely.

```rust
use ferrite::embedded::{Database, Options};

fn main() -> anyhow::Result<()> {
    // Open a database with a 64 MB mutable region
    let opts = Options::builder()
        .path("./sensor_data")
        .mutable_region_size(64 * 1024 * 1024)  // 64 MB
        .read_only_region_size(256 * 1024 * 1024) // 256 MB
        .enable_fsync(true)
        .build();

    let db = Database::open(opts)?;

    // Standard key-value operations
    db.set("sensor:temp:latest", "22.5")?;
    db.set("sensor:humidity:latest", "61.2")?;

    // Batch writes for efficiency
    let mut batch = db.batch();
    for i in 0..1000 {
        batch.set(
            format!("reading:{}", i),
            format!("{{\"temp\": {}, \"ts\": {}}}", 20.0 + (i as f64 * 0.01), i),
        );
    }
    batch.commit()?;

    // Reads with tier awareness
    let val = db.get("sensor:temp:latest")?;
    println!("Temperature: {:?}", val);

    Ok(())
}
```

Add Ferrite as a dependency in your `Cargo.toml`:

```toml
[dependencies]
ferrite = { version = "0.1", default-features = false, features = ["embedded"] }
```

## Comparison: Embedded Ferrite vs SQLite vs RocksDB

We benchmarked embedded Ferrite against two popular embedded storage engines on a Raspberry Pi 4 (4 GB RAM, SD card storage):

### Sequential Write Throughput

| Engine | Ops/sec | P99 Latency |
|--------|---------|-------------|
| Ferrite (embedded, lite) | 285K | 12 us |
| RocksDB 9.0 | 195K | 28 us |
| SQLite 3.45 (WAL mode) | 42K | 145 us |

### Random Read Throughput (hot data)

| Engine | Ops/sec | P99 Latency |
|--------|---------|-------------|
| Ferrite (embedded, lite) | 1.2M | 2.8 us |
| RocksDB 9.0 | 680K | 5.1 us |
| SQLite 3.45 | 310K | 14 us |

### Memory Usage (1M keys, 100-byte values)

| Engine | RSS |
|--------|-----|
| Ferrite (embedded, lite) | 89 MB |
| RocksDB 9.0 | 142 MB |
| SQLite 3.45 | 52 MB |

Ferrite's HybridLog architecture gives it a significant advantage for append-heavy workloads typical in IoT (sensor readings, event logs). SQLite uses less memory due to its B-tree page cache design, but pays for it in write throughput. RocksDB's LSM-tree compaction can cause latency spikes under sustained writes, which Ferrite avoids by design.

## Example: Rust IoT Application with Embedded Ferrite

Here is a complete example of an IoT gateway application that collects sensor readings, buffers them locally in Ferrite, and periodically uploads batches to a cloud endpoint:

```rust
use ferrite::embedded::{Database, Options};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let db = Database::open(
        Options::builder()
            .path("/var/lib/ferrite/gateway")
            .mutable_region_size(32 * 1024 * 1024)
            .build(),
    )?;

    // Spawn sensor collection task
    let db_writer = db.clone();
    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_millis(100));
        loop {
            interval.tick().await;
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis();
            let reading = read_sensor(); // your sensor HAL
            db_writer.set(
                format!("reading:{}", ts),
                serde_json::to_string(&reading).unwrap(),
            ).unwrap();
        }
    });

    // Spawn upload task -- batch every 60 seconds
    let db_reader = db.clone();
    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            let readings = db_reader.scan_prefix("reading:");
            if !readings.is_empty() {
                match upload_batch(&readings).await {
                    Ok(_) => {
                        for (key, _) in &readings {
                            db_reader.del(key).unwrap();
                        }
                    }
                    Err(e) => eprintln!("Upload failed: {}, retrying", e),
                }
            }
        }
    });

    // Keep running
    tokio::signal::ctrl_c().await?;
    Ok(())
}
```

If the network goes down, readings accumulate in Ferrite's persistent storage and are uploaded when connectivity returns. The HybridLog engine handles the write burst gracefully, spilling to disk when the mutable region fills up.

## Deployment Considerations

**Power loss safety.** Ferrite's embedded mode supports configurable fsync behavior. For devices with unreliable power (battery-operated sensors, vehicles), enable `fsync_on_commit` to guarantee durability at the cost of some write throughput.

**Flash wear.** SD cards and eMMC storage have limited write endurance. Ferrite's append-only log minimizes write amplification compared to B-tree or LSM-tree designs, extending media lifetime.

**Cross-compilation.** The `cross` tool makes it straightforward to build for any target architecture. We test against `armv7`, `aarch64`, `x86_64`, and `riscv64` on every release.

## What Is Next

We are working on a sync protocol that lets embedded Ferrite instances replicate their data to a centralized Ferrite cluster, enabling a hub-and-spoke architecture where edge devices maintain fast local caches that eventually converge with a central source of truth.

Try embedded Ferrite for your next edge project. The [Embedded Mode guide](/docs/features/embedded-mode) covers setup, configuration, and advanced patterns.

---

*The speed of memory, the capacity of disk, the economics of cloud.*
