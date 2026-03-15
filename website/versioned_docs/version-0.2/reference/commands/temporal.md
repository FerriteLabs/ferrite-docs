---
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Temporal Commands

Commands for working with temporal (time-based) data and time-travel queries.

## Overview

Ferrite's temporal commands enable:

- Point-in-time queries (time travel)
- Bi-temporal data modeling
- Historical data access
- Temporal range queries

## TEMPORAL.SET

Set a value with explicit valid time.

```
TEMPORAL.SET key value [VALID_FROM timestamp] [VALID_TO timestamp] [TX_TIME timestamp]
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `key` | Key name |
| `value` | Value to store |
| `VALID_FROM` | When the value becomes valid (default: now) |
| `VALID_TO` | When the value expires (default: infinity) |
| `TX_TIME` | Transaction time override (admin only) |

### Examples

```bash
# Set current value
TEMPORAL.SET employee:123:salary "75000"

# Set value valid from specific date
TEMPORAL.SET employee:123:salary "80000" VALID_FROM 1704067200000

# Set value with validity range
TEMPORAL.SET employee:123:salary "85000" VALID_FROM 1704067200000 VALID_TO 1735689600000

# Retroactive correction (backdate)
TEMPORAL.SET employee:123:salary "77000" VALID_FROM 1672531200000 VALID_TO 1704067200000
```

### Return Value

`OK` on success.

---

## TEMPORAL.GET

Get a value at a specific point in time.

```
TEMPORAL.GET key [AS_OF timestamp] [TX_TIME timestamp]
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `key` | Key name |
| `AS_OF` | Valid time to query (default: now) |
| `TX_TIME` | Transaction time to query (default: now) |

### Examples

```bash
# Get current value
TEMPORAL.GET employee:123:salary
# "85000"

# Get value as it was on a specific date
TEMPORAL.GET employee:123:salary AS_OF 1688169600000
# "75000"

# Bi-temporal query: what we knew on date X about date Y
TEMPORAL.GET employee:123:salary AS_OF 1688169600000 TX_TIME 1690848000000
# "75000"
```

### Return Value

The value at the specified point in time, or `nil` if not found.

---

## TEMPORAL.HISTORY

Get the complete history of a key.

```
TEMPORAL.HISTORY key [FROM timestamp] [TO timestamp] [LIMIT count]
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `key` | Key name |
| `FROM` | Start of time range (default: beginning) |
| `TO` | End of time range (default: now) |
| `LIMIT` | Maximum records to return |

### Examples

```bash
# Get full history
TEMPORAL.HISTORY employee:123:salary

# Get history for 2024
TEMPORAL.HISTORY employee:123:salary FROM 1704067200000 TO 1735689600000

# Get last 5 changes
TEMPORAL.HISTORY employee:123:salary LIMIT 5
```

### Return Value

Array of temporal records:

```
1) 1) "value"
   2) "85000"
   3) "valid_from"
   4) "1704067200000"
   5) "valid_to"
   6) "9223372036854775807"
   7) "tx_time"
   8) "1704067200123"
2) 1) "value"
   2) "80000"
   3) "valid_from"
   4) "1672531200000"
   5) "valid_to"
   6) "1704067200000"
   7) "tx_time"
   8) "1672531200456"
```

---

## TEMPORAL.DEL

Delete a key at a specific valid time (soft delete).

```
TEMPORAL.DEL key [VALID_FROM timestamp]
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `key` | Key name |
| `VALID_FROM` | When deletion becomes effective (default: now) |

### Examples

```bash
# Delete from now
TEMPORAL.DEL employee:123:salary

# Schedule future deletion
TEMPORAL.DEL employee:123:salary VALID_FROM 1735689600000

# Retroactive deletion
TEMPORAL.DEL employee:123:salary VALID_FROM 1704067200000
```

### Return Value

`(integer) 1` if deleted, `(integer) 0` if key didn't exist.

---

## TEMPORAL.RANGE

Query temporal data across a time range.

```
TEMPORAL.RANGE pattern FROM timestamp TO timestamp [COUNT count] [ASC|DESC]
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `pattern` | Key pattern to match |
| `FROM` | Start timestamp |
| `TO` | End timestamp |
| `COUNT` | Maximum results |
| `ASC/DESC` | Sort order by valid_from |

### Examples

```bash
# Get all salary changes in 2024
TEMPORAL.RANGE employee:*:salary FROM 1704067200000 TO 1735689600000

# Get first 10 changes, oldest first
TEMPORAL.RANGE employee:*:salary FROM 1704067200000 TO 1735689600000 COUNT 10 ASC

# Get most recent changes
TEMPORAL.RANGE employee:*:salary FROM 1704067200000 TO 1735689600000 COUNT 10 DESC
```

### Return Value

Array of matching temporal records with their keys.

---

## TEMPORAL.SNAPSHOT

Create a snapshot of data at a point in time.

```
TEMPORAL.SNAPSHOT destination pattern AS_OF timestamp [TTL seconds]
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `destination` | Key prefix for snapshot data |
| `pattern` | Source key pattern |
| `AS_OF` | Point in time for snapshot |
| `TTL` | Snapshot expiration |

### Examples

```bash
# Snapshot all employee data as of year-end
TEMPORAL.SNAPSHOT snapshot:2023 employee:* AS_OF 1704067199000

# With expiration
TEMPORAL.SNAPSHOT snapshot:2023 employee:* AS_OF 1704067199000 TTL 86400
```

### Return Value

`(integer)` number of keys in snapshot.

---

## TEMPORAL.DIFF

Compare values between two points in time.

```
TEMPORAL.DIFF key TIME1 timestamp TIME2 timestamp
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `key` | Key to compare |
| `TIME1` | First timestamp |
| `TIME2` | Second timestamp |

### Examples

```bash
# Compare salary between two dates
TEMPORAL.DIFF employee:123:salary TIME1 1672531200000 TIME2 1704067200000
```

### Return Value

```
1) "time1_value"
2) "75000"
3) "time2_value"
4) "85000"
5) "changed"
6) (integer) 1
```

---

## TEMPORAL.COALESCE

Get the first non-null value across time points.

```
TEMPORAL.COALESCE key timestamp [timestamp ...]
```

### Examples

```bash
# Try multiple timestamps until finding a value
TEMPORAL.COALESCE employee:123:salary 1704067200000 1672531200000 1640995200000
```

### Return Value

First non-null value found, or `nil`.

---

## TEMPORAL.STATS

Get temporal statistics for a key.

```
TEMPORAL.STATS key
```

### Examples

```bash
TEMPORAL.STATS employee:123:salary
```

### Return Value

```
1) "versions"
2) (integer) 5
3) "first_valid_from"
4) "1640995200000"
5) "last_valid_from"
6) "1704067200000"
7) "total_size_bytes"
8) (integer) 2048
```

---

## Bi-Temporal Data Model

Ferrite supports bi-temporal data with two time dimensions:

### Valid Time (Application Time)

When the fact was true in the real world.

```bash
# Employee started at $70k on Jan 1, 2023
TEMPORAL.SET employee:123:salary "70000" VALID_FROM 1672531200000
```

### Transaction Time (System Time)

When we recorded the fact in the database.

```bash
# We recorded this on Jan 5, 2023
# Transaction time is automatic
```

### Bi-Temporal Queries

```bash
# What is the current salary?
TEMPORAL.GET employee:123:salary

# What was the salary on June 1, 2023?
TEMPORAL.GET employee:123:salary AS_OF 1685577600000

# What did we think the June 1 salary was on July 1?
TEMPORAL.GET employee:123:salary AS_OF 1685577600000 TX_TIME 1688169600000
```

---

## Use Cases

### Audit Trail

```bash
# All changes to a field
TEMPORAL.HISTORY user:123:email

# Who had access at a specific time
TEMPORAL.GET user:123:permissions AS_OF 1704067200000
```

### Regulatory Compliance

```bash
# State of data at audit date
TEMPORAL.SNAPSHOT audit:2023 customer:* AS_OF 1704067199000

# Prove data wasn't backdated
TEMPORAL.GET contract:456:terms AS_OF 1672531200000 TX_TIME 1672531200000
```

### Slowly Changing Dimensions

```bash
# Product price history
TEMPORAL.SET product:ABC:price "19.99" VALID_FROM 1672531200000
TEMPORAL.SET product:ABC:price "24.99" VALID_FROM 1704067200000

# Historical analysis
TEMPORAL.RANGE product:*:price FROM 1672531200000 TO 1735689600000
```

---

## Configuration

```toml
[temporal]
enabled = true

# Retention for temporal history
history_retention_days = 365

# Index temporal data for faster queries
temporal_index = true

# Compression for historical data
compress_history = true
```

---

## Performance Considerations

| Operation | Time Complexity |
|-----------|-----------------|
| TEMPORAL.SET | O(log n) |
| TEMPORAL.GET | O(log n) |
| TEMPORAL.HISTORY | O(n) for n versions |
| TEMPORAL.RANGE | O(m log n) for m keys |

---

## See Also

- [Time-Series Commands](/docs/reference/commands/timeseries)
- [Time-Series Guide](/docs/data-models/time-series)
- [CDC](/docs/event-driven/cdc)
