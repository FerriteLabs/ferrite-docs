---
sidebar_position: 19
maturity: experimental
---

# Time-Series Commands

Commands for time-series data storage and analysis.

## Overview

Time-series commands enable efficient storage and querying of timestamped data with automatic downsampling, retention policies, and aggregations.

## Commands

### TIMESERIES.CREATE

Create a time-series.

```bash
TIMESERIES.CREATE key
  [RETENTION milliseconds]
  [ENCODING COMPRESSED|UNCOMPRESSED]
  [CHUNK_SIZE bytes]
  [DUPLICATE_POLICY BLOCK|FIRST|LAST|MIN|MAX|SUM]
  [LABELS label value ...]
```

**Options:**
- `RETENTION` - Data retention period (0 = forever)
- `ENCODING` - Compression mode
- `CHUNK_SIZE` - Chunk size in bytes (default: 4096)
- `DUPLICATE_POLICY` - How to handle duplicate timestamps
- `LABELS` - Metadata labels for filtering

**Examples:**
```bash
TIMESERIES.CREATE sensor:temp:1
  RETENTION 86400000
  LABELS location "building-a" sensor_type "temperature"

TIMESERIES.CREATE metrics:cpu
  RETENTION 604800000
  ENCODING COMPRESSED
  DUPLICATE_POLICY LAST
```

---

### TIMESERIES.ADD

Add a data point.

```bash
TIMESERIES.ADD key timestamp value
  [RETENTION milliseconds]
  [LABELS label value ...]
  [ON_DUPLICATE BLOCK|FIRST|LAST|MIN|MAX|SUM]
```

**Examples:**
```bash
# Add with specific timestamp
TIMESERIES.ADD sensor:temp:1 1705320000000 22.5

# Add with auto-generated timestamp (*)
TIMESERIES.ADD sensor:temp:1 * 23.1

# Add with labels
TIMESERIES.ADD sensor:temp:1 * 22.8 LABELS unit "celsius"
```

---

### TIMESERIES.MADD

Add multiple data points.

```bash
TIMESERIES.MADD key timestamp value [key timestamp value ...]
```

**Examples:**
```bash
TIMESERIES.MADD
  sensor:temp:1 1705320000000 22.5
  sensor:temp:2 1705320000000 23.1
  sensor:humidity:1 1705320000000 45.2
# [1705320000000, 1705320000000, 1705320000000]
```

---

### TIMESERIES.RANGE

Query time range.

```bash
TIMESERIES.RANGE key from to
  [FILTER_BY_TS ts ...]
  [FILTER_BY_VALUE min max]
  [COUNT count]
  [AGGREGATION aggregator bucket_duration]
  [ALIGN start|end|+|-]
```

**Aggregators:** avg, sum, min, max, count, first, last, range, std.p, std.s, var.p, var.s

**Examples:**
```bash
# Get all data in range
TIMESERIES.RANGE sensor:temp:1 1705320000000 1705406400000

# Last hour with 5-minute averages
TIMESERIES.RANGE sensor:temp:1 - + AGGREGATION avg 300000

# With value filter
TIMESERIES.RANGE sensor:temp:1 - + FILTER_BY_VALUE 20 30

# Limited results
TIMESERIES.RANGE sensor:temp:1 - + COUNT 100
```

---

### TIMESERIES.REVRANGE

Query in reverse order.

```bash
TIMESERIES.REVRANGE key from to [OPTIONS]
```

**Examples:**
```bash
# Get last 10 readings
TIMESERIES.REVRANGE sensor:temp:1 - + COUNT 10
```

---

### TIMESERIES.MRANGE

Query multiple time-series.

```bash
TIMESERIES.MRANGE from to
  FILTER filter...
  [WITHLABELS | SELECTED_LABELS label ...]
  [COUNT count]
  [AGGREGATION aggregator bucket_duration]
  [GROUPBY label REDUCE reducer]
```

**Examples:**
```bash
# All temperature sensors
TIMESERIES.MRANGE - + FILTER sensor_type=temperature

# With aggregation
TIMESERIES.MRANGE 1705320000000 1705406400000
  FILTER location=building-a
  AGGREGATION avg 3600000
  WITHLABELS

# Group by location
TIMESERIES.MRANGE - +
  FILTER sensor_type=temperature
  GROUPBY location REDUCE avg
```

---

### TIMESERIES.MREVRANGE

Query multiple time-series in reverse.

```bash
TIMESERIES.MREVRANGE from to FILTER filter... [OPTIONS]
```

---

### TIMESERIES.GET

Get latest data point.

```bash
TIMESERIES.GET key
```

**Examples:**
```bash
TIMESERIES.GET sensor:temp:1
# [1705406400000, 23.5]
```

---

### TIMESERIES.MGET

Get latest from multiple series.

```bash
TIMESERIES.MGET FILTER filter... [WITHLABELS]
```

**Examples:**
```bash
TIMESERIES.MGET FILTER sensor_type=temperature WITHLABELS
```

---

### TIMESERIES.DEL

Delete data in range.

```bash
TIMESERIES.DEL key from to
```

**Examples:**
```bash
TIMESERIES.DEL sensor:temp:1 1705320000000 1705323600000
# (integer) 360  # Number of samples deleted
```

---

### TIMESERIES.INFO

Get time-series metadata.

```bash
TIMESERIES.INFO key
```

**Examples:**
```bash
TIMESERIES.INFO sensor:temp:1
# {
#   "totalSamples": 86400,
#   "memoryUsage": 104576,
#   "firstTimestamp": 1705320000000,
#   "lastTimestamp": 1705406400000,
#   "retentionTime": 86400000,
#   "chunkCount": 26,
#   "labels": {"location": "building-a", "sensor_type": "temperature"}
# }
```

---

### TIMESERIES.ALTER

Modify time-series settings.

```bash
TIMESERIES.ALTER key
  [RETENTION milliseconds]
  [LABELS label value ...]
  [DUPLICATE_POLICY policy]
```

---

### TIMESERIES.CREATERULE

Create a downsampling rule.

```bash
TIMESERIES.CREATERULE source destination
  AGGREGATION aggregator bucket_duration
  [ALIGN start|end]
```

**Examples:**
```bash
# Create hourly averages
TIMESERIES.CREATERULE sensor:temp:1 sensor:temp:1:hourly AGGREGATION avg 3600000

# Create daily min/max
TIMESERIES.CREATERULE sensor:temp:1 sensor:temp:1:daily_min AGGREGATION min 86400000
TIMESERIES.CREATERULE sensor:temp:1 sensor:temp:1:daily_max AGGREGATION max 86400000
```

---

### TIMESERIES.DELETERULE

Delete a downsampling rule.

```bash
TIMESERIES.DELETERULE source destination
```

---

### TIMESERIES.QUERYINDEX

Query by labels.

```bash
TIMESERIES.QUERYINDEX filter...
```

**Examples:**
```bash
TIMESERIES.QUERYINDEX location=building-a sensor_type=temperature
# ["sensor:temp:1", "sensor:temp:2", "sensor:temp:3"]
```

## Filter Syntax

```bash
# Equals
location=building-a

# Not equals
location!=building-b

# Contains
sensor_type=(temperature,humidity)

# Exists
location=

# Not exists
temporary!=
```

## Use Cases

### IoT Sensor Data

```bash
# Create sensor time-series
TIMESERIES.CREATE sensor:temp:room1
  RETENTION 2592000000  # 30 days
  LABELS building "hq" floor "1" room "101" type "temperature"

# Add readings
TIMESERIES.ADD sensor:temp:room1 * 22.5
TIMESERIES.ADD sensor:temp:room1 * 22.7
TIMESERIES.ADD sensor:temp:room1 * 22.4

# Query last hour
TIMESERIES.RANGE sensor:temp:room1
  NOW-3600000 NOW
  AGGREGATION avg 300000

# Get all room temps on floor 1
TIMESERIES.MGET
  FILTER building=hq floor=1 type=temperature
  WITHLABELS
```

### Application Metrics

```bash
# Create metrics
TIMESERIES.CREATE app:requests:count
  RETENTION 604800000  # 7 days
  LABELS app "api" env "prod"

TIMESERIES.CREATE app:requests:latency
  RETENTION 604800000
  LABELS app "api" env "prod"

# Record metrics
TIMESERIES.ADD app:requests:count * 1
TIMESERIES.ADD app:requests:latency * 45.5

# Create rollups
TIMESERIES.CREATERULE app:requests:count app:requests:count:hourly
  AGGREGATION sum 3600000

# Query QPS
TIMESERIES.RANGE app:requests:count
  NOW-3600000 NOW
  AGGREGATION sum 60000
```

### Stock Prices

```bash
# Create price series
TIMESERIES.CREATE stock:AAPL:price
  DUPLICATE_POLICY LAST
  LABELS symbol "AAPL" exchange "NASDAQ"

# Add tick data
TIMESERIES.ADD stock:AAPL:price 1705320000000 182.50
TIMESERIES.ADD stock:AAPL:price 1705320001000 182.52
TIMESERIES.ADD stock:AAPL:price 1705320002000 182.48

# Get OHLC candles
TIMESERIES.RANGE stock:AAPL:price
  1705320000000 1705406400000
  AGGREGATION first 3600000  # Open

TIMESERIES.RANGE stock:AAPL:price
  1705320000000 1705406400000
  AGGREGATION max 3600000    # High
```

## Rust API

```rust
use ferrite::Client;
use ferrite::timeseries::{TimeSeriesOptions, Aggregation};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Create time-series
    client.timeseries_create(
        "sensor:temp:1",
        TimeSeriesOptions::default()
            .retention(86400000)
            .labels(&[("location", "building-a"), ("type", "temperature")]),
    ).await?;

    // Add data point
    client.timeseries_add("sensor:temp:1", None, 22.5).await?;

    // Range query
    let data = client.timeseries_range(
        "sensor:temp:1",
        "-",
        "+",
        Some(Aggregation::Avg(300000)),  // 5-min averages
    ).await?;

    for (timestamp, value) in data {
        println!("{}: {}", timestamp, value);
    }

    // Multi-range query
    let results = client.timeseries_mrange(
        "-",
        "+",
        &["location=building-a"],
        Some(Aggregation::Avg(3600000)),
    ).await?;

    // Create downsampling rule
    client.timeseries_createrule(
        "sensor:temp:1",
        "sensor:temp:1:hourly",
        Aggregation::Avg(3600000),
    ).await?;

    Ok(())
}
```

## Related Commands

- [Stream Commands](/docs/reference/commands/streams) - Event streaming
- [Sorted Set Commands](/docs/reference/commands/sorted-sets) - Simple time-ordered data
- [Time-Series Guide](/docs/data-models/time-series) - Detailed guide
