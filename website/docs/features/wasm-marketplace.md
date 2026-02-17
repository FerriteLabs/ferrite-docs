---
title: WASM Module Marketplace
sidebar_label: WASM Marketplace
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# WASM Module Marketplace

Ferrite includes a built-in marketplace for discovering, installing, and
managing WebAssembly user-defined functions (UDFs). WASM modules run inside
a secure sandbox and extend Ferrite with custom data processing, validation,
transformation, and analytics logic — all without modifying the core server.

## What Is the WASM Marketplace?

The marketplace is a registry of reusable WASM modules that can be:

- **Browsed** by category, tag, or free-text search
- **Installed** with a single CLI command
- **Published** by anyone using the `ferrite-plugin.toml` manifest format
- **Version-resolved** using semver-compatible constraints

Modules are packaged as `.ferrpkg` archives containing the compiled `.wasm`
binary and metadata.

## Browsing and Installing Modules

### Search the Marketplace

```bash
# Free-text search
ferrite-cli marketplace search "email validation"

# Filter by category
ferrite-cli marketplace search --category validation

# Filter by tag
ferrite-cli marketplace search --tag json
```

### Install a Module

```bash
# Install the latest version
ferrite-cli marketplace install validate-email

# Install a specific version
ferrite-cli marketplace install validate-email@1.0.0

# Install from a local .ferrpkg file
ferrite-cli marketplace install ./validate-email-1.0.0.ferrpkg
```

### List Installed Modules

```bash
ferrite-cli marketplace list
```

### Uninstall a Module

```bash
ferrite-cli marketplace uninstall validate-email
```

## Creating Your Own Module

### 1. Create a Rust Library

```bash
cargo new --lib my-udf
cd my-udf
```

Set the crate type in `Cargo.toml`:

```toml
[lib]
crate-type = ["cdylib"]

[profile.release]
opt-level = "s"
lto = true
```

### 2. Write Your Function

```rust
static mut BUFFER: [u8; 4096] = [0u8; 4096];

#[no_mangle]
pub extern "C" fn get_buffer_ptr() -> i32 {
    unsafe { BUFFER.as_ptr() as i32 }
}

#[no_mangle]
pub extern "C" fn get_buffer_cap() -> i32 { 4096 }

/// Validate that the buffer contains a plausible email address.
#[no_mangle]
pub extern "C" fn validate_email(len: i32) -> i32 {
    let email = unsafe { &BUFFER[..len as usize] };
    let s = core::str::from_utf8(email).unwrap_or("");
    if s.contains('@') && s.contains('.') { 1 } else { 0 }
}
```

### 3. Compile to WASM

```bash
rustup target add wasm32-unknown-unknown
cargo build --target wasm32-unknown-unknown --release
```

### 4. Create a Manifest

Create `ferrite-plugin.toml` next to your `.wasm` file:

```toml
[module]
name = "my-udf"
version = "1.0.0"
author = "Your Name"
description = "My custom UDF for Ferrite"
license = "MIT"
categories = ["validation"]
tags = ["custom", "example"]
min_ferrite_version = "0.1.0"

[dependencies]
```

### 5. Package and Publish

```bash
# Package into a .ferrpkg archive
ferrite-cli marketplace pack ./my-udf.wasm --manifest ferrite-plugin.toml

# Publish to a registry (when registry support is available)
ferrite-cli marketplace publish ./my-udf-1.0.0.ferrpkg
```

## Module Manifest Format (`ferrite-plugin.toml`)

```toml
[module]
name = "validate-email"          # Unique module identifier
version = "1.0.0"               # Semantic version
author = "Ferrite Labs"          # Author name or organisation
description = "Email validation" # Short description
license = "Apache-2.0"          # SPDX license identifier
categories = ["validation"]     # Module categories (see below)
tags = ["email", "format"]      # Searchable tags
min_ferrite_version = "0.1.0"   # Minimum compatible Ferrite version

[dependencies]
# other-module = ">=1.0.0"      # Dependencies on other WASM modules
```

### Available Categories

| Category | Description |
|----------|-------------|
| `data-processing` | ETL, aggregation, enrichment |
| `validation` | Input validation, format checking |
| `transformation` | Format conversion, data reshaping |
| `analytics` | Statistics, counters, metrics computation |
| `security` | Hashing, rate limiting, access control helpers |

## Security Model

All WASM modules execute inside Ferrite's sandboxed runtime. The security
model provides multiple layers of protection:

### WASM Sandboxing

- **Memory isolation** — each module gets its own linear memory; it cannot
  access the host process memory
- **No filesystem or network** — modules have no access to the OS unless
  explicitly granted via host function imports
- **Deterministic execution** — WASM is a Harvard-architecture VM with no
  undefined behaviour

### Resource Limits

Every module invocation is constrained by configurable limits:

| Limit | Default | Description |
|-------|---------|-------------|
| `max_memory` | 16 MB | Maximum linear memory the module can allocate |
| `max_fuel` | 10M instructions | CPU instruction budget per call |
| `max_time` | 5 s | Wall-clock timeout |

### Permission Grants

Modules can only access Ferrite data through explicitly imported host
functions. Permissions are declared at load time:

```
FUNCTION.LOAD my_udf ./my_udf.wasm READ user:* WRITE audit:* MEMORY 16MB TIMEOUT 1000
```

| Permission | Description |
|-----------|-------------|
| `READ <pattern>` | Keys the module may read (glob pattern) |
| `WRITE <pattern>` | Keys the module may write |
| `MEMORY <size>` | Memory limit override |
| `TIMEOUT <ms>` | Execution timeout override |

### Checksum Verification

`.ferrpkg` archives embed a checksum of the WASM binary. On installation
Ferrite verifies the checksum to detect corruption or tampering.

## CLI Commands Reference

| Command | Description |
|---------|-------------|
| `marketplace search <query>` | Search for modules |
| `marketplace install <name[@version]>` | Install a module |
| `marketplace uninstall <name>` | Remove a module |
| `marketplace list` | List installed modules |
| `marketplace info <name>` | Show module details |
| `marketplace pack <wasm> --manifest <toml>` | Create a `.ferrpkg` archive |
| `marketplace publish <ferrpkg>` | Publish to a remote registry |
| `marketplace verify <ferrpkg>` | Verify archive checksum |
