---
sidebar_position: 42
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Vector Ingest Commands

Commands for vector bulk ingest pipelines.

## Overview

Vector ingest commands manage high-throughput bulk ingestion pipelines for vector data. Start, stop, pause, and monitor ingest jobs that efficiently load large volumes of vectors into Ferrite's vector indexes with automatic batching and backpressure.

## Commands

### VECTOR.INGEST.START

Start a new vector ingest pipeline.

```bash
VECTOR.INGEST.START pipeline_id
  INDEX index_name
  SOURCE source_type source_config
  [BATCH_SIZE n]
  [PARALLELISM n]
  [ERROR_POLICY skip|abort]
```

**Time Complexity:** O(1) to start the pipeline

**Parameters:**
- `pipeline_id` - Unique pipeline identifier
- `INDEX` - Target vector index
- `SOURCE` - Data source type and configuration (e.g., `file /path/to/data.jsonl`, `s3 bucket/prefix`)
- `BATCH_SIZE` - Vectors per batch (default: 1000)
- `PARALLELISM` - Concurrent ingest threads (default: 4)
- `ERROR_POLICY` - How to handle errors: `skip` bad records or `abort` (default: skip)

**Examples:**
```bash
VECTOR.INGEST.START ingest:docs
  INDEX embeddings
  SOURCE file "/data/embeddings.jsonl"
  BATCH_SIZE 500
  PARALLELISM 8
# OK

VECTOR.INGEST.START ingest:images
  INDEX image_vectors
  SOURCE s3 "my-bucket/vectors/"
  ERROR_POLICY abort
# OK
```

**Returns:** OK

---

### VECTOR.INGEST.STOP

Stop and remove an ingest pipeline.

```bash
VECTOR.INGEST.STOP pipeline_id [DRAIN|IMMEDIATE]
```

**Time Complexity:** O(1) for IMMEDIATE, O(N) for DRAIN where N is the current batch size

**Parameters:**
- `DRAIN` - Finish processing the current batch before stopping (default)
- `IMMEDIATE` - Stop immediately, discard in-flight batch

**Examples:**
```bash
VECTOR.INGEST.STOP ingest:docs
# OK (drains current batch)

VECTOR.INGEST.STOP ingest:images IMMEDIATE
# OK (stops immediately)
```

**Returns:** OK

---

### VECTOR.INGEST.PAUSE

Pause an active ingest pipeline.

```bash
VECTOR.INGEST.PAUSE pipeline_id
```

**Time Complexity:** O(1)

**Examples:**
```bash
VECTOR.INGEST.PAUSE ingest:docs
# OK
```

**Returns:** OK

---

### VECTOR.INGEST.RESUME

Resume a paused ingest pipeline.

```bash
VECTOR.INGEST.RESUME pipeline_id
```

**Time Complexity:** O(1)

**Examples:**
```bash
VECTOR.INGEST.RESUME ingest:docs
# OK
```

**Returns:** OK

---

### VECTOR.INGEST.STATUS

Get status and progress of an ingest pipeline.

```bash
VECTOR.INGEST.STATUS pipeline_id
```

**Time Complexity:** O(1)

**Examples:**
```bash
VECTOR.INGEST.STATUS ingest:docs
# {
#   "pipeline_id": "ingest:docs",
#   "index": "embeddings",
#   "state": "running",
#   "vectors_ingested": 450000,
#   "vectors_total": 1000000,
#   "vectors_failed": 12,
#   "progress_pct": 45.0,
#   "rate_vectors_per_sec": 8500,
#   "elapsed_seconds": 53,
#   "eta_seconds": 65,
#   "batch_size": 500,
#   "parallelism": 8
# }
```

**Returns:** Map of pipeline status

---

### VECTOR.INGEST.LIST

List all ingest pipelines.

```bash
VECTOR.INGEST.LIST [STATE running|paused|completed|failed]
```

**Time Complexity:** O(N) where N is the number of pipelines

**Examples:**
```bash
VECTOR.INGEST.LIST
# 1) 1) "pipeline_id"
#    2) "ingest:docs"
#    3) "state"
#    4) "running"
#    5) "progress_pct"
#    6) "45.0"
# 2) 1) "pipeline_id"
#    2) "ingest:images"
#    3) "state"
#    4) "completed"
#    5) "progress_pct"
#    6) "100.0"

VECTOR.INGEST.LIST STATE running
# 1) 1) "pipeline_id"
#    2) "ingest:docs"
#    3) "state"
#    4) "running"
#    5) "progress_pct"
#    6) "45.0"
```

**Returns:** Array of pipeline summaries

## Use Cases

### Bulk Loading Embeddings

```bash
# Create the target index
VECTOR.CREATE embeddings DIM 384 DISTANCE COSINE TYPE HNSW

# Start bulk ingest from file
VECTOR.INGEST.START load:embeddings
  INDEX embeddings
  SOURCE file "/data/embeddings.jsonl"
  BATCH_SIZE 1000
  PARALLELISM 8

# Monitor progress
VECTOR.INGEST.STATUS load:embeddings

# Pause if needed (e.g., during peak hours)
VECTOR.INGEST.PAUSE load:embeddings

# Resume during off-peak
VECTOR.INGEST.RESUME load:embeddings
```

### Continuous Ingest from S3

```bash
# Ingest from S3 with error handling
VECTOR.INGEST.START s3:daily
  INDEX product_vectors
  SOURCE s3 "data-lake/vectors/2026-01-20/"
  ERROR_POLICY skip
  PARALLELISM 4

# Check progress
VECTOR.INGEST.STATUS s3:daily

# List all active pipelines
VECTOR.INGEST.LIST STATE running
```

## Related Commands

- [Vector Commands](/docs/reference/commands/vector) - Vector storage and search
- [Semantic Commands](/docs/reference/commands/semantic) - Semantic caching
- [S3 Storage Commands](/docs/reference/commands/s3-storage) - S3 object storage
