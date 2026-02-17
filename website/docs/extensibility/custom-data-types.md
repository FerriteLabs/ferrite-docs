---
sidebar_position: 4
maturity: experimental
---

# Custom Data Types

Create custom data structures for Ferrite using the plugin system.

## Overview

Custom data types allow you to extend Ferrite's type system beyond the built-in types (strings, lists, hashes, sets, sorted sets). Implement specialized data structures with custom commands for your use case.

## Data Type Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Custom Data Type                      │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │   Encoding    │  │   Commands    │  │   Events    │ │
│  │  (serialize)  │  │  (CRUD ops)   │  │  (hooks)    │ │
│  └───────────────┘  └───────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Defining Data Types

### Manifest Declaration

```toml
[[data_types]]
name = "BLOOM"
description = "Bloom filter probabilistic data structure"
encoding = "bloom-v1"
version = 1

# Associated commands
commands = [
    "BF.ADD",
    "BF.EXISTS",
    "BF.INFO",
    "BF.RESERVE",
    "BF.MADD",
    "BF.MEXISTS"
]
```

### Implementation Structure

```rust
use ferrite_plugin_sdk::{data_type, DataType, Encoding};

#[data_type(name = "BLOOM", encoding = "bloom-v1")]
pub struct BloomFilter {
    bits: Vec<u8>,
    num_bits: usize,
    num_hashes: u8,
    items_added: u64,
}

impl DataType for BloomFilter {
    fn type_name() -> &'static str {
        "bloom"
    }

    fn encoding_version() -> u32 {
        1
    }
}

impl Encoding for BloomFilter {
    fn encode(&self) -> Vec<u8> {
        // Serialize to bytes
        let mut buf = Vec::new();
        buf.extend(&self.num_bits.to_le_bytes());
        buf.push(self.num_hashes);
        buf.extend(&self.items_added.to_le_bytes());
        buf.extend(&self.bits);
        buf
    }

    fn decode(bytes: &[u8]) -> Result<Self, String> {
        // Deserialize from bytes
        if bytes.len() < 17 {
            return Err("Invalid bloom filter data".to_string());
        }
        let num_bits = usize::from_le_bytes(bytes[0..8].try_into().unwrap());
        let num_hashes = bytes[8];
        let items_added = u64::from_le_bytes(bytes[9..17].try_into().unwrap());
        let bits = bytes[17..].to_vec();

        Ok(BloomFilter {
            bits,
            num_bits,
            num_hashes,
            items_added,
        })
    }
}
```

## Example: Bloom Filter

### Full Implementation

```rust
use ferrite_plugin_sdk::{command, data_type, PluginContext, CommandResult, Value};
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;

#[data_type(name = "BLOOM")]
pub struct BloomFilter {
    bits: Vec<u8>,
    num_bits: usize,
    num_hashes: u8,
    items_added: u64,
}

impl BloomFilter {
    pub fn new(expected_items: usize, false_positive_rate: f64) -> Self {
        // Calculate optimal parameters
        let num_bits = Self::optimal_bits(expected_items, false_positive_rate);
        let num_hashes = Self::optimal_hashes(num_bits, expected_items);

        BloomFilter {
            bits: vec![0u8; (num_bits + 7) / 8],
            num_bits,
            num_hashes,
            items_added: 0,
        }
    }

    fn optimal_bits(n: usize, p: f64) -> usize {
        let ln2_squared = std::f64::consts::LN_2.powi(2);
        (-(n as f64 * p.ln()) / ln2_squared).ceil() as usize
    }

    fn optimal_hashes(m: usize, n: usize) -> u8 {
        let k = (m as f64 / n as f64 * std::f64::consts::LN_2).ceil();
        k.min(255.0) as u8
    }

    pub fn add(&mut self, item: &[u8]) {
        for i in 0..self.num_hashes {
            let bit_index = self.hash(item, i as u32) % self.num_bits;
            let byte_index = bit_index / 8;
            let bit_offset = bit_index % 8;
            self.bits[byte_index] |= 1 << bit_offset;
        }
        self.items_added += 1;
    }

    pub fn contains(&self, item: &[u8]) -> bool {
        for i in 0..self.num_hashes {
            let bit_index = self.hash(item, i as u32) % self.num_bits;
            let byte_index = bit_index / 8;
            let bit_offset = bit_index % 8;
            if self.bits[byte_index] & (1 << bit_offset) == 0 {
                return false;
            }
        }
        true
    }

    fn hash(&self, item: &[u8], seed: u32) -> usize {
        let mut hasher = DefaultHasher::new();
        item.hash(&mut hasher);
        seed.hash(&mut hasher);
        hasher.finish() as usize
    }
}

// Commands

#[command(name = "BF.RESERVE", flags = ["write"])]
fn bf_reserve(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let key = args.get(0).ok_or("Missing key")?.as_str().ok_or("Invalid key")?;
    let error_rate = args.get(1).ok_or("Missing error rate")?.as_f64().ok_or("Invalid error rate")?;
    let capacity = args.get(2).ok_or("Missing capacity")?.as_i64().ok_or("Invalid capacity")? as usize;

    if ctx.storage().exists(key)? {
        return Err("Key already exists".into());
    }

    let bf = BloomFilter::new(capacity, error_rate);
    ctx.storage().set_typed(key, &bf)?;

    Ok(Value::Ok)
}

#[command(name = "BF.ADD", flags = ["write"])]
fn bf_add(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let key = args.get(0).ok_or("Missing key")?.as_str().ok_or("Invalid key")?;
    let item = args.get(1).ok_or("Missing item")?.as_bytes().ok_or("Invalid item")?;

    let mut bf: BloomFilter = ctx.storage().get_typed(key)?
        .ok_or("Key not found")?;

    let existed = bf.contains(item);
    bf.add(item);
    ctx.storage().set_typed(key, &bf)?;

    Ok(Value::Integer(if existed { 0 } else { 1 }))
}

#[command(name = "BF.EXISTS", flags = ["read"])]
fn bf_exists(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let key = args.get(0).ok_or("Missing key")?.as_str().ok_or("Invalid key")?;
    let item = args.get(1).ok_or("Missing item")?.as_bytes().ok_or("Invalid item")?;

    let bf: BloomFilter = ctx.storage().get_typed(key)?
        .ok_or("Key not found")?;

    Ok(Value::Integer(if bf.contains(item) { 1 } else { 0 }))
}

#[command(name = "BF.MADD", flags = ["write"])]
fn bf_madd(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let key = args.get(0).ok_or("Missing key")?.as_str().ok_or("Invalid key")?;

    let mut bf: BloomFilter = ctx.storage().get_typed(key)?
        .ok_or("Key not found")?;

    let results: Vec<Value> = args[1..].iter()
        .filter_map(|v| v.as_bytes())
        .map(|item| {
            let existed = bf.contains(item);
            bf.add(item);
            Value::Integer(if existed { 0 } else { 1 })
        })
        .collect();

    ctx.storage().set_typed(key, &bf)?;
    Ok(Value::Array(results))
}

#[command(name = "BF.MEXISTS", flags = ["read"])]
fn bf_mexists(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let key = args.get(0).ok_or("Missing key")?.as_str().ok_or("Invalid key")?;

    let bf: BloomFilter = ctx.storage().get_typed(key)?
        .ok_or("Key not found")?;

    let results: Vec<Value> = args[1..].iter()
        .filter_map(|v| v.as_bytes())
        .map(|item| Value::Integer(if bf.contains(item) { 1 } else { 0 }))
        .collect();

    Ok(Value::Array(results))
}

#[command(name = "BF.INFO", flags = ["read"])]
fn bf_info(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let key = args.get(0).ok_or("Missing key")?.as_str().ok_or("Invalid key")?;

    let bf: BloomFilter = ctx.storage().get_typed(key)?
        .ok_or("Key not found")?;

    Ok(Value::Array(vec![
        Value::BulkString(b"Capacity".to_vec()),
        Value::Integer(bf.num_bits as i64),
        Value::BulkString(b"Size".to_vec()),
        Value::Integer(bf.bits.len() as i64),
        Value::BulkString(b"Number of filters".to_vec()),
        Value::Integer(bf.num_hashes as i64),
        Value::BulkString(b"Items inserted".to_vec()),
        Value::Integer(bf.items_added as i64),
    ]))
}
```

### Usage

```bash
# Create bloom filter (1% error rate, 1000 items)
BF.RESERVE myfilter 0.01 1000

# Add items
BF.ADD myfilter item1
# 1 (new item)

BF.ADD myfilter item1
# 0 (probably existed)

# Check existence
BF.EXISTS myfilter item1
# 1 (probably exists)

BF.EXISTS myfilter item2
# 0 (definitely doesn't exist)

# Bulk operations
BF.MADD myfilter a b c d
# [1, 1, 1, 1]

BF.MEXISTS myfilter a b c x y z
# [1, 1, 1, 0, 0, 0]

# Get info
BF.INFO myfilter
# Capacity: 9586
# Size: 1199
# Number of filters: 7
# Items inserted: 5
```

## Example: HyperLogLog

```rust
#[data_type(name = "HLL")]
pub struct HyperLogLog {
    registers: Vec<u8>,
    precision: u8,
}

impl HyperLogLog {
    pub fn new(precision: u8) -> Self {
        let num_registers = 1 << precision;
        HyperLogLog {
            registers: vec![0; num_registers],
            precision,
        }
    }

    pub fn add(&mut self, item: &[u8]) {
        let hash = self.hash(item);
        let index = (hash >> (64 - self.precision)) as usize;
        let remaining = hash << self.precision | (1 << (self.precision - 1));
        let zeros = remaining.leading_zeros() as u8 + 1;
        self.registers[index] = self.registers[index].max(zeros);
    }

    pub fn count(&self) -> u64 {
        let m = self.registers.len() as f64;
        let alpha = self.alpha();

        let sum: f64 = self.registers.iter()
            .map(|&r| 2f64.powi(-(r as i32)))
            .sum();

        let estimate = alpha * m * m / sum;

        // Apply corrections
        if estimate <= 2.5 * m {
            let zeros = self.registers.iter().filter(|&&r| r == 0).count();
            if zeros > 0 {
                return (m * (m / zeros as f64).ln()) as u64;
            }
        }

        estimate as u64
    }

    fn alpha(&self) -> f64 {
        match self.precision {
            4 => 0.673,
            5 => 0.697,
            6 => 0.709,
            _ => 0.7213 / (1.0 + 1.079 / (1 << self.precision) as f64),
        }
    }

    fn hash(&self, item: &[u8]) -> u64 {
        let mut hasher = DefaultHasher::new();
        item.hash(&mut hasher);
        hasher.finish()
    }
}

#[command(name = "PFADD", flags = ["write"])]
fn pfadd(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let key = args.get(0).ok_or("Missing key")?.as_str().ok_or("Invalid key")?;

    let mut hll: HyperLogLog = ctx.storage().get_typed(key)?
        .unwrap_or_else(|| HyperLogLog::new(14));

    for item in &args[1..] {
        if let Some(bytes) = item.as_bytes() {
            hll.add(bytes);
        }
    }

    ctx.storage().set_typed(key, &hll)?;
    Ok(Value::Integer(1))
}

#[command(name = "PFCOUNT", flags = ["read"])]
fn pfcount(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let key = args.get(0).ok_or("Missing key")?.as_str().ok_or("Invalid key")?;

    let hll: HyperLogLog = ctx.storage().get_typed(key)?
        .ok_or("Key not found")?;

    Ok(Value::Integer(hll.count() as i64))
}
```

## Encoding Considerations

### Versioning

```rust
impl Encoding for MyDataType {
    const VERSION: u32 = 2;

    fn encode(&self) -> Vec<u8> {
        let mut buf = Vec::new();
        buf.extend(&Self::VERSION.to_le_bytes());
        // ... rest of encoding
        buf
    }

    fn decode(bytes: &[u8]) -> Result<Self, String> {
        let version = u32::from_le_bytes(bytes[0..4].try_into().unwrap());
        match version {
            1 => Self::decode_v1(&bytes[4..]),
            2 => Self::decode_v2(&bytes[4..]),
            _ => Err("Unknown version".to_string()),
        }
    }
}
```

### Compression

```rust
use lz4_flex::{compress_prepend_size, decompress_size_prepended};

impl Encoding for LargeDataType {
    fn encode(&self) -> Vec<u8> {
        let uncompressed = self.serialize();
        compress_prepend_size(&uncompressed)
    }

    fn decode(bytes: &[u8]) -> Result<Self, String> {
        let uncompressed = decompress_size_prepended(bytes)
            .map_err(|e| e.to_string())?;
        Self::deserialize(&uncompressed)
    }
}
```

## Memory Management

### Size Tracking

```rust
impl DataType for MyDataType {
    fn memory_usage(&self) -> usize {
        std::mem::size_of::<Self>() + self.data.len()
    }
}
```

### Lazy Loading

```rust
#[data_type(name = "LAZY")]
pub struct LazyDataType {
    header: Header,
    data: Option<Vec<u8>>,
    data_offset: usize,
}

impl LazyDataType {
    fn load_data(&mut self, ctx: &PluginContext) {
        if self.data.is_none() {
            self.data = Some(ctx.storage().read_range(self.data_offset..)?);
        }
    }
}
```

## Type Checking

```rust
#[command(name = "MYTYPE.OP", flags = ["write"])]
fn mytype_op(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let key = args.get(0).ok_or("Missing key")?.as_str().ok_or("Invalid key")?;

    // Check type before operating
    let type_name = ctx.storage().type_of(key)?;
    if type_name != "none" && type_name != "MYTYPE" {
        return Err("WRONGTYPE Operation against a key holding the wrong kind of value".into());
    }

    // Proceed with operation
    // ...
}
```

## Best Practices

1. **Version your encoding** - Support backward compatibility
2. **Implement memory tracking** - Report accurate memory usage
3. **Validate on decode** - Check data integrity
4. **Use efficient serialization** - Consider compression for large data
5. **Handle type mismatches** - Return WRONGTYPE errors appropriately
6. **Test serialization** - Round-trip encode/decode tests
7. **Document size limits** - Specify maximum sizes

## Next Steps

- [Plugin System](/docs/extensibility/plugin-system) - Plugin architecture
- [Custom Commands](/docs/extensibility/custom-commands) - Command implementation
- [WASM Functions](/docs/extensibility/wasm-functions) - UDF functions
