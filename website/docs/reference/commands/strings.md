---
sidebar_position: 1
title: String Commands
description: Redis-compatible string commands in Ferrite. SET, GET, INCR, APPEND, and more with full options support.
keywords: [string commands, set, get, incr, append, redis strings]
maturity: stable
---

# String Commands

Commands for managing string values in Ferrite.

## Overview

Strings are the most basic data type in Ferrite. A string value can be at most 512 MB.

## Commands

### SET

Set a string value.

```bash
SET key value [EX seconds] [PX milliseconds] [NX|XX] [GET] [KEEPTTL]
```

**Options:**
- `EX seconds` - Set expiration in seconds
- `PX milliseconds` - Set expiration in milliseconds
- `NX` - Only set if key doesn't exist
- `XX` - Only set if key exists
- `GET` - Return old value
- `KEEPTTL` - Retain existing TTL

**Time Complexity:** O(1)

**Examples:**
```bash
SET mykey "Hello"
# OK

SET mykey "World" GET
# "Hello"

SET counter 100 EX 3600
# OK

SET lock:resource "owner" NX EX 30
# OK (if not exists)
```

---

### GET

Get the value of a key.

```bash
GET key
```

**Time Complexity:** O(1)

**Returns:** The value, or nil if key doesn't exist.

**Examples:**
```bash
SET greeting "Hello World"
# OK

GET greeting
# "Hello World"

GET nonexistent
# (nil)
```

---

### GETEX

Get value and optionally set expiration.

```bash
GETEX key [EX seconds | PX milliseconds | EXAT timestamp | PXAT timestamp | PERSIST]
```

**Time Complexity:** O(1)

**Examples:**
```bash
SET mykey "Hello"
# OK

GETEX mykey EX 60
# "Hello"

TTL mykey
# 60
```

---

### GETDEL

Get value and delete the key.

```bash
GETDEL key
```

**Time Complexity:** O(1)

**Examples:**
```bash
SET mykey "Hello"
# OK

GETDEL mykey
# "Hello"

GET mykey
# (nil)
```

---

### MSET

Set multiple keys.

```bash
MSET key1 value1 [key2 value2 ...]
```

**Time Complexity:** O(N) where N is the number of keys

**Examples:**
```bash
MSET key1 "Hello" key2 "World"
# OK

MGET key1 key2
# 1) "Hello"
# 2) "World"
```

---

### MGET

Get multiple keys.

```bash
MGET key1 [key2 ...]
```

**Time Complexity:** O(N) where N is the number of keys

**Examples:**
```bash
SET key1 "Hello"
SET key2 "World"

MGET key1 key2 nonexistent
# 1) "Hello"
# 2) "World"
# 3) (nil)
```

---

### MSETNX

Set multiple keys only if none exist.

```bash
MSETNX key1 value1 [key2 value2 ...]
```

**Time Complexity:** O(N) where N is the number of keys

**Returns:** 1 if all keys were set, 0 if no keys were set.

**Examples:**
```bash
MSETNX key1 "Hello" key2 "World"
# 1

MSETNX key2 "new" key3 "value"
# 0 (key2 exists)
```

---

### SETNX

Set if not exists (deprecated, use SET NX).

```bash
SETNX key value
```

**Time Complexity:** O(1)

---

### SETEX

Set with expiration in seconds (deprecated, use SET EX).

```bash
SETEX key seconds value
```

**Time Complexity:** O(1)

---

### PSETEX

Set with expiration in milliseconds (deprecated, use SET PX).

```bash
PSETEX key milliseconds value
```

**Time Complexity:** O(1)

---

### INCR

Increment integer value by 1.

```bash
INCR key
```

**Time Complexity:** O(1)

**Examples:**
```bash
SET counter 10
# OK

INCR counter
# 11

GET counter
# "11"
```

---

### DECR

Decrement integer value by 1.

```bash
DECR key
```

**Time Complexity:** O(1)

**Examples:**
```bash
SET counter 10
# OK

DECR counter
# 9
```

---

### INCRBY

Increment integer value by amount.

```bash
INCRBY key increment
```

**Time Complexity:** O(1)

**Examples:**
```bash
SET counter 10
# OK

INCRBY counter 5
# 15
```

---

### DECRBY

Decrement integer value by amount.

```bash
DECRBY key decrement
```

**Time Complexity:** O(1)

**Examples:**
```bash
SET counter 10
# OK

DECRBY counter 3
# 7
```

---

### INCRBYFLOAT

Increment float value.

```bash
INCRBYFLOAT key increment
```

**Time Complexity:** O(1)

**Examples:**
```bash
SET price 10.50
# OK

INCRBYFLOAT price 0.1
# "10.60"

INCRBYFLOAT price -5.0
# "5.60"
```

---

### APPEND

Append to string value.

```bash
APPEND key value
```

**Time Complexity:** O(1) amortized

**Returns:** Length of string after append.

**Examples:**
```bash
SET greeting "Hello"
# OK

APPEND greeting " World"
# 11

GET greeting
# "Hello World"
```

---

### STRLEN

Get string length.

```bash
STRLEN key
```

**Time Complexity:** O(1)

**Examples:**
```bash
SET mykey "Hello World"
# OK

STRLEN mykey
# 11

STRLEN nonexistent
# 0
```

---

### GETRANGE

Get substring.

```bash
GETRANGE key start end
```

**Time Complexity:** O(N) where N is the length of the returned string

**Examples:**
```bash
SET mykey "Hello World"
# OK

GETRANGE mykey 0 4
# "Hello"

GETRANGE mykey -5 -1
# "World"

GETRANGE mykey 0 -1
# "Hello World"
```

---

### SETRANGE

Overwrite part of string.

```bash
SETRANGE key offset value
```

**Time Complexity:** O(1) for small strings, O(N) when creating large strings

**Examples:**
```bash
SET key1 "Hello World"
# OK

SETRANGE key1 6 "Redis"
# 11

GET key1
# "Hello Redis"
```

---

### STRALGO

String algorithms.

```bash
STRALGO LCS KEYS key1 key2 [IDX] [MINMATCHLEN len] [WITHMATCHLEN]
STRALGO LCS STRINGS string1 string2 [IDX] [MINMATCHLEN len] [WITHMATCHLEN]
```

**Time Complexity:** O(N*M) where N and M are string lengths

**Examples:**
```bash
STRALGO LCS STRINGS "ohmytext" "mynewtext"
# "mytext"
```

## Rust API

```rust
use ferrite::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Basic SET/GET
    client.set("key", "value").await?;
    let value: Option<String> = client.get("key").await?;

    // SET with options
    client.set_ex("key", "value", 3600).await?;
    client.set_nx("key", "value").await?;

    // Increment
    let counter: i64 = client.incr("counter").await?;
    let counter: i64 = client.incrby("counter", 5).await?;

    // Multiple keys
    client.mset(&[("k1", "v1"), ("k2", "v2")]).await?;
    let values: Vec<Option<String>> = client.mget(&["k1", "k2"]).await?;

    Ok(())
}
```

## Related Commands

- [Key Commands](/docs/reference/commands/keys) - DEL, EXISTS, EXPIRE
- [Hash Commands](/docs/reference/commands/hashes) - For field-value pairs
- [Bitmap Commands](/docs/reference/commands/bitmap) - Bit operations on strings
