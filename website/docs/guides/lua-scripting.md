---
maturity: stable
---

# Lua Scripting

Ferrite supports Lua scripting for executing complex operations atomically on the server. Scripts run with transactional guarantees and access to all Redis commands.

## Overview

Lua scripts provide:

- **Atomicity** - Scripts execute as single atomic operations
- **Reduced latency** - Multiple operations in one round-trip
- **Complex logic** - Conditionals, loops, and data transformations
- **Reusability** - Load once, execute many times with EVALSHA

## Quick Start

### Basic Script Execution

```bash
# EVAL script numkeys [key ...] [arg ...]

# Simple script - return a value
EVAL "return 'Hello, World!'" 0

# Access keys and arguments
EVAL "return {KEYS[1], KEYS[2], ARGV[1], ARGV[2]}" 2 key1 key2 arg1 arg2

# Call Redis commands
EVAL "return redis.call('GET', KEYS[1])" 1 mykey

# Conditional logic
EVAL "
  local val = redis.call('GET', KEYS[1])
  if val then
    return redis.call('INCR', KEYS[1])
  else
    redis.call('SET', KEYS[1], ARGV[1])
    return ARGV[1]
  end
" 1 counter 100
```

### Loading and Caching Scripts

```bash
# Load script and get SHA1 hash
SCRIPT LOAD "return redis.call('GET', KEYS[1])"
# Returns: "a42059b356c875f0717db19a51f6aaa9161e77a2"

# Execute by SHA (faster for repeated execution)
EVALSHA a42059b356c875f0717db19a51f6aaa9161e77a2 1 mykey

# Check if script exists
SCRIPT EXISTS a42059b356c875f0717db19a51f6aaa9161e77a2

# Flush all cached scripts
SCRIPT FLUSH
```

## Rust Usage

### Execute Script

```rust
use ferrite::Client;

let client = Client::connect("localhost:6380").await?;

// Execute inline script
let result: String = client.eval(
    r#"return redis.call('GET', KEYS[1])"#,
    &["mykey"],
    &[],
).await?;

// With arguments
let result: i64 = client.eval(
    r#"
    local current = tonumber(redis.call('GET', KEYS[1]) or '0')
    local increment = tonumber(ARGV[1])
    local new_value = current + increment
    redis.call('SET', KEYS[1], new_value)
    return new_value
    "#,
    &["counter"],
    &["10"],
).await?;
```

### Load and Execute by SHA

```rust
// Load script once
let sha = client.script_load(r#"
    local current = redis.call('GET', KEYS[1])
    if current then
        return redis.call('INCR', KEYS[1])
    else
        redis.call('SET', KEYS[1], ARGV[1])
        return tonumber(ARGV[1])
    end
"#).await?;

// Execute many times by SHA
for i in 0..1000 {
    let result: i64 = client.evalsha(&sha, &["counter"], &["1"]).await?;
}
```

### Script Helper

```rust
use ferrite::Script;

// Define reusable script
let incr_or_init = Script::new(r#"
    local current = redis.call('GET', KEYS[1])
    if current then
        return redis.call('INCR', KEYS[1])
    else
        redis.call('SET', KEYS[1], ARGV[1])
        return tonumber(ARGV[1])
    end
"#);

// First call loads and executes
let result: i64 = incr_or_init.run(&client, &["counter"], &["100"]).await?;

// Subsequent calls use EVALSHA (faster)
let result: i64 = incr_or_init.run(&client, &["counter"], &["100"]).await?;
```

## Python Usage

```python
from ferrite import Ferrite

client = Ferrite(host="localhost", port=6380)

# Execute inline script
script = """
local current = redis.call('GET', KEYS[1])
if current then
    return redis.call('INCR', KEYS[1])
else
    redis.call('SET', KEYS[1], ARGV[1])
    return tonumber(ARGV[1])
end
"""

result = client.eval(script, 1, "counter", "100")

# Register script for repeated use
incr_or_init = client.register_script(script)

# Execute (automatically uses EVALSHA after first call)
result = incr_or_init(keys=["counter"], args=["100"])
```

## TypeScript Usage

```typescript
import { Ferrite, Script } from "@ferrite/client";

const client = new Ferrite({ host: "localhost", port: 6380 });

// Execute inline script
const result = await client.eval(
  `
  local current = redis.call('GET', KEYS[1])
  if current then
    return redis.call('INCR', KEYS[1])
  else
    redis.call('SET', KEYS[1], ARGV[1])
    return tonumber(ARGV[1])
  end
  `,
  { keys: ["counter"], args: ["100"] }
);

// Create reusable script
const incrOrInit = client.createScript<number>(`
  local current = redis.call('GET', KEYS[1])
  if current then
    return redis.call('INCR', KEYS[1])
  else
    redis.call('SET', KEYS[1], ARGV[1])
    return tonumber(ARGV[1])
  end
`);

// Execute (uses EVALSHA after first call)
const value = await incrOrInit.run({ keys: ["counter"], args: ["100"] });
```

## Common Script Patterns

### Rate Limiter

```lua
-- Rate limit: allow N requests per window
-- KEYS[1] = rate limit key
-- ARGV[1] = limit
-- ARGV[2] = window in seconds

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local current = redis.call('INCR', key)

if current == 1 then
    -- First request, set expiration
    redis.call('EXPIRE', key, window)
end

if current > limit then
    -- Over limit
    local ttl = redis.call('TTL', key)
    return {0, ttl}  -- Denied, seconds until reset
else
    -- Under limit
    return {1, limit - current}  -- Allowed, remaining
end
```

```rust
let rate_limiter = Script::new(include_str!("scripts/rate_limiter.lua"));

let (allowed, remaining): (bool, i64) = rate_limiter.run(
    &client,
    &[&format!("ratelimit:{}", user_id)],
    &["100", "60"], // 100 requests per 60 seconds
).await?;

if !allowed {
    return Err(Error::RateLimited(remaining));
}
```

### Compare and Swap

```lua
-- Atomic compare-and-swap
-- KEYS[1] = key
-- ARGV[1] = expected value
-- ARGV[2] = new value

local key = KEYS[1]
local expected = ARGV[1]
local new_value = ARGV[2]

local current = redis.call('GET', key)

if current == expected then
    redis.call('SET', key, new_value)
    return 1  -- Success
else
    return 0  -- Failed - value changed
end
```

```rust
let cas = Script::new(include_str!("scripts/compare_and_swap.lua"));

loop {
    let current: String = client.get("version").await?.unwrap_or_default();
    let new_version = increment_version(&current);

    let success: bool = cas.run(
        &client,
        &["version"],
        &[&current, &new_version],
    ).await?;

    if success {
        break;
    }
    // Retry on conflict
}
```

### Distributed Lock

```lua
-- Acquire lock with timeout
-- KEYS[1] = lock key
-- ARGV[1] = lock token (unique ID)
-- ARGV[2] = lock TTL in milliseconds

local key = KEYS[1]
local token = ARGV[1]
local ttl = tonumber(ARGV[2])

-- Try to acquire lock
local result = redis.call('SET', key, token, 'NX', 'PX', ttl)

if result then
    return 1  -- Lock acquired
else
    return 0  -- Lock held by someone else
end
```

```lua
-- Release lock (only if we own it)
-- KEYS[1] = lock key
-- ARGV[1] = lock token

local key = KEYS[1]
local token = ARGV[1]

local current = redis.call('GET', key)

if current == token then
    redis.call('DEL', key)
    return 1  -- Lock released
else
    return 0  -- Not our lock
end
```

```rust
let acquire_lock = Script::new(include_str!("scripts/acquire_lock.lua"));
let release_lock = Script::new(include_str!("scripts/release_lock.lua"));

let lock_key = "mylock";
let token = Uuid::new_v4().to_string();
let ttl_ms = 10000; // 10 seconds

// Acquire
let acquired: bool = acquire_lock.run(
    &client,
    &[lock_key],
    &[&token, &ttl_ms.to_string()],
).await?;

if acquired {
    // Do work...

    // Release
    release_lock.run(&client, &[lock_key], &[&token]).await?;
}
```

### Leaderboard with Rank

```lua
-- Add score and return rank
-- KEYS[1] = leaderboard key
-- ARGV[1] = member
-- ARGV[2] = score

local key = KEYS[1]
local member = ARGV[1]
local score = tonumber(ARGV[2])

redis.call('ZADD', key, score, member)
local rank = redis.call('ZREVRANK', key, member)
local total = redis.call('ZCARD', key)

return {rank + 1, total, score}  -- 1-indexed rank
```

### Cache with Stale-While-Revalidate

```lua
-- Get value with stale-while-revalidate pattern
-- KEYS[1] = cache key
-- KEYS[2] = lock key for revalidation
-- ARGV[1] = stale TTL (seconds before revalidation needed)
-- ARGV[2] = lock TTL for revalidation

local cache_key = KEYS[1]
local lock_key = KEYS[2]
local stale_ttl = tonumber(ARGV[1])
local lock_ttl = tonumber(ARGV[2])

-- Get cached value and its age
local value = redis.call('GET', cache_key)
local ttl = redis.call('TTL', cache_key)

if not value then
    -- Cache miss
    return {nil, 'miss'}
end

if ttl > stale_ttl then
    -- Fresh value
    return {value, 'fresh'}
end

-- Value is stale, try to acquire revalidation lock
local got_lock = redis.call('SET', lock_key, '1', 'NX', 'EX', lock_ttl)

if got_lock then
    -- We got the lock, caller should revalidate
    return {value, 'stale_revalidate'}
else
    -- Someone else is revalidating, return stale value
    return {value, 'stale'}
end
```

### Sliding Window Counter

```lua
-- Sliding window rate counter
-- KEYS[1] = counter key
-- ARGV[1] = window size in seconds
-- ARGV[2] = current timestamp
-- ARGV[3] = increment amount (optional, default 1)

local key = KEYS[1]
local window = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local increment = tonumber(ARGV[3] or '1')

local window_start = now - window

-- Remove old entries
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- Add new entry
redis.call('ZADD', key, now, now .. ':' .. math.random())

-- Increment might add multiple entries
for i = 2, increment do
    redis.call('ZADD', key, now, now .. ':' .. math.random() .. ':' .. i)
end

-- Count entries in window
local count = redis.call('ZCARD', key)

-- Set expiration
redis.call('EXPIRE', key, window + 1)

return count
```

## Lua API Reference

### Redis Commands

```lua
-- Call command (raises error on failure)
redis.call('SET', 'key', 'value')
local value = redis.call('GET', 'key')

-- Call command (returns error as value)
local result = redis.pcall('SET', 'key', 'value')
if result.err then
    -- Handle error
end
```

### Data Types

```lua
-- Strings
local s = "hello"
local len = #s  -- Length

-- Numbers
local n = 42
local f = 3.14

-- Tables (arrays)
local arr = {1, 2, 3}
local first = arr[1]  -- Lua arrays are 1-indexed!

-- Tables (dictionaries)
local dict = {name = "Alice", age = 30}
local name = dict.name

-- Nil
local empty = nil
```

### Control Flow

```lua
-- Conditionals
if condition then
    -- ...
elseif other_condition then
    -- ...
else
    -- ...
end

-- Loops
for i = 1, 10 do
    -- i goes from 1 to 10
end

for i, v in ipairs(array) do
    -- Iterate array
end

for k, v in pairs(table) do
    -- Iterate table
end

while condition do
    -- ...
end
```

### Type Conversions

```lua
-- String to number
local n = tonumber("42")

-- Number to string
local s = tostring(42)

-- Check type
local t = type(value)  -- "string", "number", "table", "nil"
```

### JSON Operations

```lua
-- Encode to JSON
local json = cjson.encode({name = "Alice", age = 30})

-- Decode from JSON
local data = cjson.decode('{"name": "Alice", "age": 30}')
local name = data.name
```

### Logging

```lua
-- Log messages (appear in Ferrite logs)
redis.log(redis.LOG_DEBUG, "Debug message")
redis.log(redis.LOG_VERBOSE, "Verbose message")
redis.log(redis.LOG_NOTICE, "Notice message")
redis.log(redis.LOG_WARNING, "Warning message")
```

## Best Practices

### 1. Always Use KEYS and ARGV

```lua
-- Bad - hardcoded keys
redis.call('GET', 'mykey')

-- Good - parameterized
redis.call('GET', KEYS[1])
```

### 2. Keep Scripts Short

```lua
-- Bad - too much logic
-- (hundreds of lines of Lua)

-- Good - focused operations
-- One atomic operation per script
```

### 3. Handle Nil Values

```lua
-- Bad - assumes value exists
local count = tonumber(redis.call('GET', KEYS[1]))

-- Good - handle nil
local raw = redis.call('GET', KEYS[1])
local count = raw and tonumber(raw) or 0
```

### 4. Use EVALSHA for Performance

```rust
// Load once, use many times
let sha = client.script_load(script).await?;

for _ in 0..1000 {
    client.evalsha(&sha, &keys, &args).await?;
}
```

### 5. Return Meaningful Results

```lua
-- Return structured data
return {
    success = true,
    value = result,
    remaining = limit - current
}

-- Or use simple array for performance
return {1, result, limit - current}  -- [success, value, remaining]
```

## Debugging Scripts

### Local Testing

```bash
# Test script locally
redis-cli --eval script.lua 1 mykey arg1 arg2

# Debug mode (Redis LDB)
redis-cli --ldb --eval script.lua 1 mykey
```

### Slow Script Detection

```bash
# Get slow log
SLOWLOG GET 10

# Configure slow log threshold (microseconds)
CONFIG SET slowlog-log-slower-than 10000
```

### Script Timeout

```bash
# Set script timeout (milliseconds)
CONFIG SET lua-time-limit 5000

# Kill running script (if not writing)
SCRIPT KILL
```

## Limitations

- **No external calls** - Can't access network or filesystem
- **Single-threaded** - Scripts block other operations
- **Limited libraries** - Only cjson, cmsgpack, bit, struct available
- **No state between calls** - Each execution is independent

## Related Topics

- [Transactions](/docs/guides/transactions) - MULTI/EXEC transactions
- [WASM Functions](/docs/extensibility/wasm-functions) - WebAssembly UDFs
- [Triggers](/docs/event-driven/triggers) - Event-driven execution
- [Commands Reference](/docs/reference/commands/scripting) - EVAL, EVALSHA commands
