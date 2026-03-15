---
sidebar_position: 4
maturity: stable
---

# Transactions

Ferrite supports Redis-compatible transactions for atomic execution of multiple commands.

## Basic Transactions

### MULTI/EXEC

Queue commands and execute atomically:

```bash
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379> SET user:1:name "Alice"
QUEUED
127.0.0.1:6379> SET user:1:email "alice@example.com"
QUEUED
127.0.0.1:6379> INCR user:1:visits
QUEUED
127.0.0.1:6379> EXEC
1) OK
2) OK
3) (integer) 1
```

### DISCARD

Cancel a transaction:

```bash
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379> SET key1 "value1"
QUEUED
127.0.0.1:6379> DISCARD
OK
# No commands were executed
```

## Optimistic Locking

### WATCH

Watch keys for changes before starting a transaction:

```bash
127.0.0.1:6379> WATCH balance
OK
127.0.0.1:6379> GET balance
"100"
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379> DECRBY balance 50
QUEUED
127.0.0.1:6379> EXEC
1) (integer) 50
```

If another client modifies `balance` between WATCH and EXEC, the transaction aborts:

```bash
# EXEC returns nil if watched key changed
127.0.0.1:6379> EXEC
(nil)
```

### UNWATCH

Cancel all watches:

```bash
127.0.0.1:6379> WATCH key1 key2
OK
127.0.0.1:6379> UNWATCH
OK
```

## Embedded Mode Transactions

In embedded mode, use the transaction API:

```rust
use ferrite::embedded::Database;

let db = Database::open("./data")?;

// Start transaction
let tx = db.transaction();

// Queue operations
tx.set("key1", "value1")?;
tx.set("key2", "value2")?;
tx.incr("counter")?;

// Commit atomically
tx.commit()?;
```

### With Optimistic Locking

```rust
loop {
    // Watch keys
    let watch = db.watch(&["balance"])?;

    // Read current value
    let balance: i64 = watch.get("balance")?.unwrap_or(0);

    if balance < 50 {
        return Err(anyhow!("Insufficient funds"));
    }

    // Start transaction
    let tx = watch.transaction();
    tx.decrby("balance", 50)?;
    tx.incrby("spent", 50)?;

    // Try to commit (fails if balance changed)
    match tx.commit() {
        Ok(_) => break,
        Err(FerriteError::WatchConflict) => continue,  // Retry
        Err(e) => return Err(e.into()),
    }
}
```

## Transaction Guarantees

Ferrite transactions provide:

- **Atomicity**: All commands execute or none do
- **Isolation**: Other clients see either all changes or none
- **Consistency**: Database remains valid after transaction

Note: Ferrite transactions are not durable by default. Use AOF with `always` sync for durability.

## Pipelining vs Transactions

### Pipelining (for performance)

Send multiple commands without waiting for responses:

```python
pipe = redis.pipeline(transaction=False)
for i in range(1000):
    pipe.set(f"key:{i}", f"value:{i}")
pipe.execute()
```

### Transactions (for atomicity)

Use when you need atomic execution:

```python
pipe = redis.pipeline(transaction=True)  # Default
pipe.watch("balance")
balance = int(pipe.get("balance") or 0)
pipe.multi()
pipe.decrby("balance", amount)
pipe.incrby("spent", amount)
pipe.execute()
```

## Lua Scripting

For complex atomic operations, consider Lua scripts:

```bash
127.0.0.1:6379> EVAL "
    local balance = tonumber(redis.call('GET', KEYS[1]) or 0)
    if balance < tonumber(ARGV[1]) then
        return redis.error_reply('Insufficient funds')
    end
    redis.call('DECRBY', KEYS[1], ARGV[1])
    redis.call('INCRBY', KEYS[2], ARGV[1])
    return balance - tonumber(ARGV[1])
" 2 balance spent 50
```

Lua scripts are atomic and cannot be interrupted.

## Best Practices

1. Keep transactions short to minimize conflicts
2. Use WATCH only for keys you read and modify
3. Implement retry logic for WATCH conflicts
4. Consider Lua scripts for complex atomic operations
5. Use pipelining (not transactions) when atomicity isn't needed

## Next Steps

- [Vector Search](/docs/guides/vector-search) - AI/ML workloads
- [Commands Reference](/docs/reference/commands) - All available commands
