---
sidebar_position: 15
maturity: stable
---

# Key Commands

Commands for managing keys and their lifecycle.

## Overview

Key commands provide operations for key management, including existence checks, deletion, expiration, and introspection.

## Commands

### DEL

Delete keys.

```bash
DEL key [key ...]
```

**Time Complexity:** O(N) where N is the number of keys

**Returns:** Number of keys deleted.

**Examples:**
```bash
SET key1 "value1"
SET key2 "value2"

DEL key1 key2 nonexistent
# (integer) 2
```

---

### UNLINK

Delete keys asynchronously.

```bash
UNLINK key [key ...]
```

**Time Complexity:** O(1) for each key, memory freed async

**Examples:**
```bash
# Better for large values
UNLINK largekey1 largekey2
# (integer) 2
```

---

### EXISTS

Check if keys exist.

```bash
EXISTS key [key ...]
```

**Time Complexity:** O(N)

**Returns:** Number of existing keys.

**Examples:**
```bash
SET key1 "value"

EXISTS key1
# (integer) 1

EXISTS key1 key2
# (integer) 1

EXISTS nonexistent
# (integer) 0
```

---

### TYPE

Get key type.

```bash
TYPE key
```

**Time Complexity:** O(1)

**Returns:** string, list, set, zset, hash, stream, or none

**Examples:**
```bash
SET mykey "value"
TYPE mykey
# string

LPUSH mylist "item"
TYPE mylist
# list
```

---

### KEYS

Find keys by pattern.

```bash
KEYS pattern
```

**Time Complexity:** O(N)

**Warning:** Use SCAN in production.

**Examples:**
```bash
SET user:1 "alice"
SET user:2 "bob"
SET product:1 "laptop"

KEYS user:*
# 1) "user:1"
# 2) "user:2"

KEYS *:1
# 1) "user:1"
# 2) "product:1"
```

---

### SCAN

Incrementally iterate keys.

```bash
SCAN cursor [MATCH pattern] [COUNT count] [TYPE type]
```

**Time Complexity:** O(1) per call, O(N) total

**Examples:**
```bash
# Basic scan
SCAN 0
# 1) "17"
# 2) 1) "key1"
#    2) "key2"

# With pattern
SCAN 0 MATCH user:*
# 1) "25"
# 2) 1) "user:1"

# With count hint
SCAN 0 COUNT 100

# With type filter
SCAN 0 TYPE string
```

---

### EXPIRE

Set expiration in seconds.

```bash
EXPIRE key seconds [NX | XX | GT | LT]
```

**Options:**
- `NX` - Only set if no expiry
- `XX` - Only set if has expiry
- `GT` - Only if new expiry > current
- `LT` - Only if new expiry < current

**Time Complexity:** O(1)

**Examples:**
```bash
SET mykey "value"

EXPIRE mykey 60
# (integer) 1

TTL mykey
# (integer) 60
```

---

### EXPIREAT

Set expiration at Unix timestamp.

```bash
EXPIREAT key unix-time-seconds [NX | XX | GT | LT]
```

**Time Complexity:** O(1)

**Examples:**
```bash
EXPIREAT mykey 1705320000
# (integer) 1
```

---

### PEXPIRE

Set expiration in milliseconds.

```bash
PEXPIRE key milliseconds [NX | XX | GT | LT]
```

**Time Complexity:** O(1)

---

### PEXPIREAT

Set expiration at millisecond timestamp.

```bash
PEXPIREAT key unix-time-milliseconds [NX | XX | GT | LT]
```

**Time Complexity:** O(1)

---

### EXPIRETIME

Get expiration as Unix timestamp.

```bash
EXPIRETIME key
```

**Time Complexity:** O(1)

**Returns:** Unix timestamp, -1 if no expiry, -2 if key doesn't exist.

---

### PEXPIRETIME

Get expiration as millisecond timestamp.

```bash
PEXPIRETIME key
```

**Time Complexity:** O(1)

---

### TTL

Get time-to-live in seconds.

```bash
TTL key
```

**Time Complexity:** O(1)

**Returns:** TTL in seconds, -1 if no expiry, -2 if key doesn't exist.

**Examples:**
```bash
SET mykey "value"
EXPIRE mykey 100

TTL mykey
# (integer) 100
```

---

### PTTL

Get time-to-live in milliseconds.

```bash
PTTL key
```

**Time Complexity:** O(1)

---

### PERSIST

Remove expiration.

```bash
PERSIST key
```

**Time Complexity:** O(1)

**Examples:**
```bash
SET mykey "value"
EXPIRE mykey 100
PERSIST mykey

TTL mykey
# (integer) -1
```

---

### RENAME

Rename a key.

```bash
RENAME key newkey
```

**Time Complexity:** O(1)

**Examples:**
```bash
SET oldkey "value"
RENAME oldkey newkey

GET newkey
# "value"
```

---

### RENAMENX

Rename only if new key doesn't exist.

```bash
RENAMENX key newkey
```

**Time Complexity:** O(1)

**Returns:** 1 if renamed, 0 if newkey exists.

---

### RANDOMKEY

Get random key.

```bash
RANDOMKEY
```

**Time Complexity:** O(1)

---

### TOUCH

Update last access time.

```bash
TOUCH key [key ...]
```

**Time Complexity:** O(N)

**Returns:** Number of existing keys touched.

---

### OBJECT

Inspect key internals.

```bash
OBJECT ENCODING key
OBJECT FREQ key
OBJECT IDLETIME key
OBJECT REFCOUNT key
OBJECT HELP
```

**Examples:**
```bash
SET mykey "12345"
OBJECT ENCODING mykey
# "int"

SET mykey "hello world"
OBJECT ENCODING mykey
# "embstr"

OBJECT IDLETIME mykey
# (integer) 5
```

---

### DUMP

Serialize key value.

```bash
DUMP key
```

**Time Complexity:** O(1) to access, O(N*M) to serialize

---

### RESTORE

Restore serialized value.

```bash
RESTORE key ttl serialized-value [REPLACE] [ABSTTL] [IDLETIME seconds] [FREQ frequency]
```

**Time Complexity:** O(1) to create, O(N*M) to construct

**Examples:**
```bash
# Dump from source
DUMP mykey
# "\x00\x05hello\t\x00\xb3\x80..."

# Restore on target
RESTORE mykey 0 "\x00\x05hello\t\x00\xb3\x80..." REPLACE
```

---

### MIGRATE

Move key to another instance.

```bash
MIGRATE host port key | "" destination-db timeout [COPY] [REPLACE] [AUTH password] [AUTH2 username password] [KEYS key [key ...]]
```

**Examples:**
```bash
MIGRATE 192.168.1.2 6379 mykey 0 5000

# Multiple keys
MIGRATE 192.168.1.2 6379 "" 0 5000 KEYS key1 key2 key3
```

---

### COPY

Copy key value.

```bash
COPY source destination [DB destination-db] [REPLACE]
```

**Time Complexity:** O(N)

**Examples:**
```bash
SET source "value"
COPY source destination

GET destination
# "value"
```

---

### SORT

Sort list/set/zset elements.

```bash
SORT key [BY pattern] [LIMIT offset count] [GET pattern [GET pattern ...]] [ASC | DESC] [ALPHA] [STORE destination]
```

**Time Complexity:** O(N+M*log(M))

**Examples:**
```bash
RPUSH mylist 3 1 2
SORT mylist
# 1) "1"
# 2) "2"
# 3) "3"

SORT mylist DESC
# 1) "3"
# 2) "2"
# 3) "1"
```

---

### SORT_RO

Read-only sort.

```bash
SORT_RO key [BY pattern] [LIMIT offset count] [GET pattern ...] [ASC | DESC] [ALPHA]
```

---

### WAIT

Wait for replication.

```bash
WAIT numreplicas timeout
```

**Examples:**
```bash
SET key "value"
WAIT 1 1000
# (integer) 1
```

---

### WAITAOF

Wait for AOF sync.

```bash
WAITAOF numlocal numreplicas timeout
```

## Key Patterns

### Hierarchical Keys

```bash
# User data
SET user:1000:profile "..."
SET user:1000:settings "..."
SET user:1000:preferences "..."

# Find all user keys
SCAN 0 MATCH user:1000:*
```

### Namespaced Keys

```bash
# Environment-based
SET prod:config:timeout "30"
SET dev:config:timeout "5"

# Feature-based
SET cache:product:123 "..."
SET session:abc123 "..."
```

### Temporary Keys

```bash
# With automatic expiration
SET temp:job:123 "processing" EX 3600

# Manual cleanup
DEL temp:job:123
```

## Rust API

```rust
use ferrite::Client;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Check existence
    let exists: bool = client.exists("mykey").await?;

    // Get type
    let key_type: String = client.type_of("mykey").await?;

    // Delete
    let deleted: i64 = client.del(&["key1", "key2"]).await?;

    // Async delete (for large values)
    let unlinked: i64 = client.unlink(&["largekey"]).await?;

    // Expiration
    client.expire("mykey", 3600).await?;
    let ttl: i64 = client.ttl("mykey").await?;
    client.persist("mykey").await?;

    // Rename
    client.rename("oldkey", "newkey").await?;

    // Scan keys
    let mut cursor = 0;
    loop {
        let (new_cursor, keys) = client.scan(cursor, Some("user:*"), Some(100)).await?;
        for key in keys {
            println!("Found: {}", key);
        }
        cursor = new_cursor;
        if cursor == 0 {
            break;
        }
    }

    // Copy key
    client.copy("source", "dest", None, true).await?;

    Ok(())
}
```

## Best Practices

1. **Use SCAN over KEYS** - KEYS blocks the server
2. **Use UNLINK for large values** - Async deletion
3. **Set TTL on temporary data** - Prevent memory bloat
4. **Use consistent naming** - namespace:entity:id format
5. **Batch operations** - DEL/EXISTS with multiple keys
6. **Use hash tags in cluster** - For related keys

## Related Commands

- [String Commands](/docs/reference/commands/strings) - String operations
- [Server Commands](/docs/reference/commands/server) - DBSIZE, FLUSHDB
- [Cluster Commands](/docs/reference/commands/cluster) - Key distribution
