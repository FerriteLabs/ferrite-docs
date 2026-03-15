---
sidebar_position: 9
maturity: stable
---

# Bitmap Commands

Commands for bit-level operations on strings.

## Overview

Bitmaps are strings that allow bit-level operations. They're extremely memory-efficient for storing binary flags and can handle up to 2^32 bits per key.

## Commands

### SETBIT

Set or clear a bit.

```bash
SETBIT key offset value
```

**Time Complexity:** O(1)

**Returns:** Original bit value at that offset.

**Examples:**
```bash
SETBIT mybitmap 7 1
# 0

SETBIT mybitmap 7 0
# 1

GETBIT mybitmap 7
# 0
```

---

### GETBIT

Get bit value.

```bash
GETBIT key offset
```

**Time Complexity:** O(1)

**Examples:**
```bash
SETBIT mybitmap 7 1

GETBIT mybitmap 7
# 1

GETBIT mybitmap 0
# 0
```

---

### BITCOUNT

Count set bits.

```bash
BITCOUNT key [start end [BYTE | BIT]]
```

**Time Complexity:** O(N)

**Examples:**
```bash
SET mykey "\xff\xf0\x00"

BITCOUNT mykey
# 12

BITCOUNT mykey 0 0
# 8

BITCOUNT mykey 0 0 BIT
# 1
```

---

### BITPOS

Find first bit set to 0 or 1.

```bash
BITPOS key bit [start [end [BYTE | BIT]]]
```

**Time Complexity:** O(N)

**Examples:**
```bash
SET mykey "\xff\xf0\x00"

BITPOS mykey 0
# 12

BITPOS mykey 1
# 0
```

---

### BITOP

Perform bitwise operations.

```bash
BITOP AND | OR | XOR | NOT destkey key [key ...]
```

**Time Complexity:** O(N)

**Examples:**
```bash
SET key1 "foof"
SET key2 "foof"

BITOP AND destkey key1 key2
# 4

GET destkey
# "foof"

BITOP XOR destkey key1 key2
# 4

GET destkey
# "\x00\x00\x00\x00"
```

---

### BITFIELD

Perform multiple bit operations.

```bash
BITFIELD key [GET encoding offset | SET encoding offset value | INCRBY encoding offset increment | OVERFLOW WRAP | SAT | FAIL] ...
```

**Encodings:**
- `u<bits>` - Unsigned integer
- `i<bits>` - Signed integer

**Time Complexity:** O(1)

**Examples:**
```bash
# Set 8-bit unsigned at offset 0
BITFIELD mybitfield SET u8 0 200
# 1) 0

# Get value
BITFIELD mybitfield GET u8 0
# 1) 200

# Increment
BITFIELD mybitfield INCRBY u8 0 10
# 1) 210

# Overflow handling
BITFIELD mybitfield OVERFLOW SAT INCRBY u8 0 100
# 1) 255 (saturated at max)
```

---

### BITFIELD_RO

Read-only bitfield operations.

```bash
BITFIELD_RO key [GET encoding offset] ...
```

**Time Complexity:** O(1)

## Use Cases

### User Activity Tracking

```bash
# Track daily logins (1 bit per user)
# Day key format: logins:YYYY-MM-DD
# User ID as bit offset

# User 1000 logged in today
SETBIT logins:2024-01-15 1000 1

# Check if user logged in
GETBIT logins:2024-01-15 1000
# 1

# Count daily active users
BITCOUNT logins:2024-01-15

# Weekly active users (OR of 7 days)
BITOP OR logins:week1 logins:2024-01-15 logins:2024-01-14 logins:2024-01-13 logins:2024-01-12 logins:2024-01-11 logins:2024-01-10 logins:2024-01-09
BITCOUNT logins:week1
```

### Feature Flags

```bash
# Define feature flags
# Bit 0: new_ui
# Bit 1: beta_features
# Bit 2: dark_mode
# Bit 3: notifications

# Enable new_ui for user 42
SETBIT user:42:features 0 1

# Enable dark_mode for user 42
SETBIT user:42:features 2 1

# Check if user has new_ui
GETBIT user:42:features 0
# 1

# Enable multiple features at once with BITFIELD
BITFIELD user:42:features SET u4 0 0b1101
```

### Online Status

```bash
# Track online users (1 bit per user ID)
SETBIT online 1000 1  # User 1000 online
SETBIT online 1001 1  # User 1001 online
SETBIT online 1000 0  # User 1000 offline

# Count online users
BITCOUNT online

# Check specific user
GETBIT online 1001
# 1
```

### Bloom Filter (Simple Implementation)

```bash
# Simple bloom filter using multiple hash positions
# For element "foo", hash to positions 5, 127, 256

SETBIT bloom 5 1
SETBIT bloom 127 1
SETBIT bloom 256 1

# Check if "foo" might exist
GETBIT bloom 5    # 1
GETBIT bloom 127  # 1
GETBIT bloom 256  # 1
# All 1s = probably exists

# Check if "bar" exists (hashes to 10, 200, 300)
GETBIT bloom 10   # 0
# Any 0 = definitely not exists
```

### Permissions Matrix

```bash
# Bit positions for permissions
# 0: read, 1: write, 2: delete, 3: admin

# User 1: read + write
BITFIELD perms:1 SET u4 0 0b0011

# User 2: read + write + delete
BITFIELD perms:2 SET u4 0 0b0111

# Check if user 1 can delete
BITFIELD perms:1 GET u4 0
# 3 (binary: 0011)
# Check bit 2: (3 >> 2) & 1 = 0 (no delete permission)
```

### Retention Analysis

```bash
# Track which days a user was active in a month
# Bit 0 = day 1, Bit 1 = day 2, etc.

# User was active on days 1, 5, 10, 15, 20
SETBIT user:1:activity:2024-01 0 1
SETBIT user:1:activity:2024-01 4 1
SETBIT user:1:activity:2024-01 9 1
SETBIT user:1:activity:2024-01 14 1
SETBIT user:1:activity:2024-01 19 1

# Count active days
BITCOUNT user:1:activity:2024-01
# 5

# Find first active day
BITPOS user:1:activity:2024-01 1
# 0 (day 1)
```

## Memory Efficiency

```bash
# Storing 1 million user flags
# Traditional approach: 1M keys = ~64 MB
# Bitmap approach: 1 bitmap = ~125 KB

# Memory per user:
# - Hash/String: ~40-80 bytes
# - Bitmap: 1 bit = 0.125 bytes
```

## Rust API

```rust
use ferrite::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Set bits
    client.setbit("mybitmap", 100, true).await?;
    client.setbit("mybitmap", 200, true).await?;

    // Get bit
    let is_set: bool = client.getbit("mybitmap", 100).await?;
    println!("Bit 100 is set: {}", is_set);

    // Count bits
    let count: i64 = client.bitcount("mybitmap").await?;
    println!("Total set bits: {}", count);

    // Find first set bit
    let pos: i64 = client.bitpos("mybitmap", true).await?;
    println!("First set bit at: {}", pos);

    // Bitwise operations
    client.setbit("bitmap1", 0, true).await?;
    client.setbit("bitmap2", 0, true).await?;
    client.setbit("bitmap2", 1, true).await?;

    client.bitop("AND", "result", &["bitmap1", "bitmap2"]).await?;
    let and_count: i64 = client.bitcount("result").await?;

    // Bitfield operations
    let results: Vec<Option<i64>> = client.bitfield("bf", &[
        BitfieldOp::Set { encoding: "u8", offset: 0, value: 200 },
        BitfieldOp::Get { encoding: "u8", offset: 0 },
        BitfieldOp::IncrBy { encoding: "u8", offset: 0, increment: 10 },
    ]).await?;

    Ok(())
}
```

## Related Commands

- [String Commands](/docs/reference/commands/strings) - Bitmaps are strings
- [HyperLogLog Commands](/docs/reference/commands/hyperloglog) - Probabilistic counting
- [Set Commands](/docs/reference/commands/sets) - Alternative for membership
