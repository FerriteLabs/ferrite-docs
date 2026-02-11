---
sidebar_position: 1
title: Installation Guide
description: Install Ferrite via Cargo, Docker, Homebrew, or from source. Get started with the high-performance Redis alternative in minutes.
keywords: [ferrite installation, install ferrite, cargo install, docker ferrite, redis alternative setup]
maturity: stable
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Installation

There are several ways to install Ferrite depending on your use case.

<Tabs groupId="install-method">
  <TabItem value="cargo" label="Cargo (Recommended)" default>

The easiest way to install Ferrite is via Cargo:

```bash
cargo install ferrite
```

**Prerequisites:**
- Rust 1.88 or later
- Cargo (included with Rust)

After installation, start the server:

```bash
ferrite
```

  </TabItem>
  <TabItem value="docker" label="Docker">

Pull and run the official Docker image:

```bash
# Pull the latest image
docker pull ferrite/ferrite:latest

# Run with default settings
docker run -p 6379:6379 ferrite/ferrite:latest

# Run with persistent storage
docker run -p 6379:6379 -v ferrite-data:/data ferrite/ferrite:latest

# Run with custom configuration
docker run -p 6379:6379 \
  -v ./ferrite.toml:/etc/ferrite/ferrite.toml \
  ferrite/ferrite:latest --config /etc/ferrite/ferrite.toml
```

  </TabItem>
  <TabItem value="source" label="From Source">

Build from source for maximum control:

```bash
# Clone the repository
git clone https://github.com/ferrite-rs/ferrite.git
cd ferrite

# Build release version
cargo build --release

# The binary will be at ./target/release/ferrite
./target/release/ferrite
```

**Prerequisites:** Rust 1.88+, Cargo, Git

  </TabItem>
  <TabItem value="homebrew" label="Homebrew (macOS)">

Install via Homebrew on macOS:

```bash
# Add the tap
brew tap ferrite-rs/ferrite

# Install
brew install ferrite

# Start the server
ferrite
```

  </TabItem>
</Tabs>

## Feature Flags

Ferrite supports optional features via Cargo feature flags:

| Feature | Description |
|---------|-------------|
| `io-uring` | Enable io_uring for Linux (requires kernel 5.11+) |
| `tui` | Build the terminal dashboard (ferrite-tui) |
| `wasm` | Enable WebAssembly user functions |
| `onnx` | Enable local ONNX embeddings for semantic search |
| `otel` | Enable OpenTelemetry tracing |

Build with specific features:

```bash
# Build with io_uring support (Linux only)
cargo build --release --features io-uring

# Build with multiple features
cargo build --release --features "io-uring,wasm,otel"

# Build with all features
cargo build --release --all-features
```

## Verifying Installation

After installation, verify Ferrite is working:

```bash
# Start the server
./target/release/ferrite

# In another terminal, connect with redis-cli
redis-cli -p 6379

# Test basic commands
127.0.0.1:6379> PING
PONG
127.0.0.1:6379> SET test "Hello, Ferrite!"
OK
127.0.0.1:6379> GET test
"Hello, Ferrite!"
```

## Platform Support

| Platform | Support Level | Notes |
|----------|---------------|-------|
| Linux x86_64 | Full | Best performance with io_uring |
| Linux ARM64 | Full | Tested on AWS Graviton |
| macOS x86_64 | Full | Uses tokio for async I/O |
| macOS ARM64 | Full | Native Apple Silicon support |
| Windows | Experimental | Uses tokio for async I/O |

## Next Steps

- [Quick Start](/docs/getting-started/quick-start) - Run your first commands
- [Configuration](/docs/getting-started/configuration) - Configure Ferrite
