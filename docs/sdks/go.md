---
sidebar_position: 4
title: Go Thin Client
description: Use go-redis to connect to Ferrite with a thin wrapper for Ferrite-specific commands like vector search and semantic caching.
keywords: [go, golang, go-redis, ferrite go, vector search go, semantic cache go]
---

# Go Thin Client

Ferrite is wire-compatible with Redis, so [go-redis](https://redis.uptrace.dev/) works for all standard commands. This guide shows how to add a thin wrapper for Ferrite-specific extensions.

## Installation

```bash
go get github.com/redis/go-redis/v9
```

Requires Go 1.21 or later.

## Standard Redis Operations

All standard Redis commands work directly through go-redis:

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

func main() {
	ctx := context.Background()

	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6380",
	})
	defer client.Close()

	// Standard operations — identical to Redis
	client.Set(ctx, "user:1:name", "Alice", 0)
	name, _ := client.Get(ctx, "user:1:name").Result()

	client.HSet(ctx, "user:1", map[string]interface{}{
		"name":  "Alice",
		"email": "alice@example.com",
	})
	user, _ := client.HGetAll(ctx, "user:1").Result()

	client.LPush(ctx, "queue:jobs", "job-123", "job-456")
	job, _ := client.RPop(ctx, "queue:jobs").Result()

	client.ZAdd(ctx, "leaderboard", redis.Z{Score: 100, Member: "alice"})
	top, _ := client.ZRevRangeWithScores(ctx, "leaderboard", 0, 9).Result()

	fmt.Println(name, user, job, top)
}
```

## Raw Ferrite Commands

You can execute any Ferrite-specific command directly via `Do()`:

```go
// Create a vector index
client.Do(ctx,
	"VECTOR.INDEX.CREATE", "embeddings",
	"DIM", 384, "DISTANCE", "COSINE", "TYPE", "HNSW",
).Result()

// Add a vector
vector := []float32{0.1, 0.2, 0.3}
blob := float32ToBytes(vector)
client.Do(ctx, "VECTOR.ADD", "embeddings", "doc:1", blob).Result()

// Search vectors
results, _ := client.Do(ctx,
	"VECTOR.SEARCH", "embeddings", blob, "TOP_K", 10,
).Result()
```

## FerriteClient Wrapper

For a cleaner API, use this thin wrapper that provides typed methods for Ferrite extensions while preserving full access to the underlying go-redis client.

```go
package ferrite

import (
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"time"

	"github.com/redis/go-redis/v9"
)

// VectorSearchResult holds a single result from a vector search.
type VectorSearchResult struct {
	ID       string
	Score    float64
	Metadata map[string]string
}

// FerriteClient wraps a go-redis client and adds Ferrite-specific methods.
// All standard go-redis methods are available via the Redis field.
type FerriteClient struct {
	Redis *redis.Client
}

// NewFerriteClient creates a new FerriteClient connected to the given address.
func NewFerriteClient(opts *redis.Options) *FerriteClient {
	if opts.Addr == "" {
		opts.Addr = "localhost:6380"
	}
	return &FerriteClient{
		Redis: redis.NewClient(opts),
	}
}

// Close shuts down the connection.
func (fc *FerriteClient) Close() error {
	return fc.Redis.Close()
}

// Ping tests connectivity.
func (fc *FerriteClient) Ping(ctx context.Context) error {
	return fc.Redis.Ping(ctx).Err()
}

// ── Vector Search (Stable) ─────────────────────────────────────────────

// VectorCreate creates a vector index.
//
// distance: COSINE, L2, or IP
// indexType: HNSW or IVF
func (fc *FerriteClient) VectorCreate(
	ctx context.Context,
	index string,
	dim int,
	distance string,
	indexType string,
) error {
	return fc.Redis.Do(ctx,
		"VECTOR.INDEX.CREATE", index,
		"DIM", dim, "DISTANCE", distance, "TYPE", indexType,
	).Err()
}

// VectorAdd adds a vector to an index with optional metadata.
func (fc *FerriteClient) VectorAdd(
	ctx context.Context,
	index string,
	key string,
	vector []float32,
	metadata map[string]string,
) error {
	blob := float32SliceToBytes(vector)
	args := []interface{}{"VECTOR.ADD", index, key, blob}
	for k, v := range metadata {
		args = append(args, k, v)
	}
	return fc.Redis.Do(ctx, args...).Err()
}

// VectorSearchOpts configures a vector search.
type VectorSearchOpts struct {
	TopK   int
	Filter string // metadata filter expression
}

// VectorSearch searches for nearest vectors.
func (fc *FerriteClient) VectorSearch(
	ctx context.Context,
	index string,
	vector []float32,
	opts *VectorSearchOpts,
) ([]VectorSearchResult, error) {
	if opts == nil {
		opts = &VectorSearchOpts{TopK: 10}
	}
	if opts.TopK <= 0 {
		opts.TopK = 10
	}

	blob := float32SliceToBytes(vector)
	args := []interface{}{"VECTOR.SEARCH", index, blob, "TOP_K", opts.TopK}
	if opts.Filter != "" {
		args = append(args, "FILTER", opts.Filter)
	}

	raw, err := fc.Redis.Do(ctx, args...).Result()
	if err != nil {
		return nil, err
	}

	return parseVectorResults(raw)
}

// VectorDelete removes a vector from an index.
func (fc *FerriteClient) VectorDelete(ctx context.Context, index, key string) error {
	return fc.Redis.Do(ctx, "VECTOR.DEL", index, key).Err()
}

// VectorIndexDrop drops a vector index.
func (fc *FerriteClient) VectorIndexDrop(ctx context.Context, index string) error {
	return fc.Redis.Do(ctx, "VECTOR.INDEX.DROP", index).Err()
}

// ── Semantic Cache (Stable) ────────────────────────────────────────────

// SemanticSet stores a value with meaning-based lookup.
func (fc *FerriteClient) SemanticSet(
	ctx context.Context,
	key, text, value string,
	ttl time.Duration,
) error {
	args := []interface{}{"SEMANTIC.SET", key, text, value}
	if ttl > 0 {
		args = append(args, "EX", int(ttl.Seconds()))
	}
	return fc.Redis.Do(ctx, args...).Err()
}

// SemanticGet retrieves a cached value by semantic similarity.
// Returns "" and nil if no match exceeds the threshold.
func (fc *FerriteClient) SemanticGet(
	ctx context.Context,
	key, text string,
	threshold float64,
) (string, error) {
	if threshold <= 0 {
		threshold = 0.85
	}
	result, err := fc.Redis.Do(ctx,
		"SEMANTIC.GET", key, text, "THRESHOLD", threshold,
	).Text()
	if err == redis.Nil {
		return "", nil
	}
	return result, err
}

// SemanticDelete deletes a semantic cache entry.
func (fc *FerriteClient) SemanticDelete(ctx context.Context, key string) error {
	return fc.Redis.Do(ctx, "SEMANTIC.DEL", key).Err()
}

// ── CRDT Operations (Experimental) ─────────────────────────────────────

// CRDTCounterIncr increments a CRDT counter.
//
// WARNING: Experimental — API may change.
func (fc *FerriteClient) CRDTCounterIncr(ctx context.Context, key string, amount int64) error {
	return fc.Redis.Do(ctx, "CRDT.COUNTER.INCR", key, amount).Err()
}

// CRDTCounterGet returns the value of a CRDT counter.
//
// WARNING: Experimental — API may change.
func (fc *FerriteClient) CRDTCounterGet(ctx context.Context, key string) (int64, error) {
	return fc.Redis.Do(ctx, "CRDT.COUNTER.GET", key).Int64()
}

// CRDTSetAdd adds members to a CRDT set (OR-Set).
//
// WARNING: Experimental — API may change.
func (fc *FerriteClient) CRDTSetAdd(ctx context.Context, key string, members ...string) error {
	args := []interface{}{"CRDT.SET.ADD", key}
	for _, m := range members {
		args = append(args, m)
	}
	return fc.Redis.Do(ctx, args...).Err()
}

// CRDTSetMembers returns all members of a CRDT set.
//
// WARNING: Experimental — API may change.
func (fc *FerriteClient) CRDTSetMembers(ctx context.Context, key string) ([]string, error) {
	return fc.Redis.Do(ctx, "CRDT.SET.MEMBERS", key).StringSlice()
}

// ── CDC — Change Data Capture (Experimental) ───────────────────────────

// CDCSubscribe subscribes to change data capture events matching a pattern.
//
// WARNING: Experimental — API may change.
func (fc *FerriteClient) CDCSubscribe(ctx context.Context, pattern string) error {
	return fc.Redis.Do(ctx, "CDC.SUBSCRIBE", pattern).Err()
}

// ── Helpers ────────────────────────────────────────────────────────────

func float32SliceToBytes(v []float32) []byte {
	buf := make([]byte, len(v)*4)
	for i, f := range v {
		binary.LittleEndian.PutUint32(buf[i*4:], math.Float32bits(f))
	}
	return buf
}

func parseVectorResults(raw interface{}) ([]VectorSearchResult, error) {
	arr, ok := raw.([]interface{})
	if !ok || len(arr) == 0 {
		return nil, nil
	}

	var results []VectorSearchResult
	i := 0
	// skip count header if present
	if _, ok := arr[0].(int64); ok {
		i = 1
	}

	for i < len(arr)-1 {
		id := fmt.Sprintf("%v", arr[i])
		score := 0.0
		if s, ok := arr[i+1].(string); ok {
			fmt.Sscanf(s, "%f", &score)
		}
		metadata := map[string]string{}
		i += 2
		if i < len(arr) {
			if pairs, ok := arr[i].([]interface{}); ok {
				for j := 0; j < len(pairs)-1; j += 2 {
					metadata[fmt.Sprintf("%v", pairs[j])] = fmt.Sprintf("%v", pairs[j+1])
				}
				i++
			}
		}
		results = append(results, VectorSearchResult{
			ID:       id,
			Score:    score,
			Metadata: metadata,
		})
	}
	return results, nil
}
```

## Usage Examples

### Standard + Ferrite Operations Together

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"your-module/ferrite" // the wrapper above
)

func main() {
	ctx := context.Background()

	client := ferrite.NewFerriteClient(&redis.Options{
		Addr: "localhost:6380",
	})
	defer client.Close()

	// ── Standard Redis commands (via .Redis field) ──
	client.Redis.Set(ctx, "app:version", "2.1.0", 0)
	client.Redis.HSet(ctx, "user:42", map[string]interface{}{
		"name": "Bob", "role": "admin",
	})

	// ── Vector search ──
	err := client.VectorCreate(ctx, "products", 384, "COSINE", "HNSW")
	if err != nil {
		log.Fatal(err)
	}

	embeddings := generateEmbeddings([]string{
		"Red running shoes",
		"Blue winter jacket",
	})

	client.VectorAdd(ctx, "products", "sku:1001", embeddings[0], map[string]string{
		"name":     "Red running shoes",
		"category": "footwear",
	})
	client.VectorAdd(ctx, "products", "sku:1002", embeddings[1], map[string]string{
		"name":     "Blue winter jacket",
		"category": "outerwear",
	})

	query := generateEmbedding("lightweight shoes for jogging")
	results, err := client.VectorSearch(ctx, "products", query, &ferrite.VectorSearchOpts{
		TopK: 5,
	})
	if err != nil {
		log.Fatal(err)
	}
	for _, r := range results {
		fmt.Printf("  %s (score: %.4f)\n", r.ID, r.Score)
	}

	// ── Semantic caching ──
	client.SemanticSet(ctx, "llm:cache",
		"What is Ferrite?", "Ferrite is a Redis-compatible ...",
		time.Hour,
	)

	cached, err := client.SemanticGet(ctx, "llm:cache", "Tell me about Ferrite", 0.85)
	if err != nil {
		log.Fatal(err)
	}
	if cached != "" {
		fmt.Printf("Cache hit: %s\n", cached)
	}
}
```

### HTTP Handler with Ferrite

```go
package main

import (
	"encoding/json"
	"net/http"

	"github.com/redis/go-redis/v9"
	"your-module/ferrite"
)

var fc *ferrite.FerriteClient

func init() {
	fc = ferrite.NewFerriteClient(&redis.Options{
		Addr:     "localhost:6380",
		PoolSize: 20,
	})
}

func searchHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	embedding := generateEmbedding(query)

	results, err := fc.VectorSearch(r.Context(), "products", embedding,
		&ferrite.VectorSearchOpts{TopK: 10},
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(results)
}

func cachedAnswerHandler(w http.ResponseWriter, r *http.Request) {
	question := r.URL.Query().Get("q")

	cached, err := fc.SemanticGet(r.Context(), "qa:cache", question, 0.85)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if cached != "" {
		json.NewEncoder(w).Encode(map[string]string{
			"answer": cached, "source": "cache",
		})
		return
	}

	answer := callLLM(question)
	fc.SemanticSet(r.Context(), "qa:cache", question, answer, 2*time.Hour)
	json.NewEncoder(w).Encode(map[string]string{
		"answer": answer, "source": "llm",
	})
}

func main() {
	http.HandleFunc("/search", searchHandler)
	http.HandleFunc("/answer", cachedAnswerHandler)
	http.ListenAndServe(":8080", nil)
}
```

### Connection Pool Tuning

```go
import "runtime"

client := ferrite.NewFerriteClient(&redis.Options{
	Addr:         "localhost:6380",
	PoolSize:     runtime.NumCPU() * 10,
	MinIdleConns: runtime.NumCPU() * 2,
	MaxIdleTime:  5 * time.Minute,
	DialTimeout:  5 * time.Second,
	ReadTimeout:  3 * time.Second,
	WriteTimeout: 3 * time.Second,
})

// Check pool stats
stats := client.Redis.PoolStats()
fmt.Printf("Hits: %d, Misses: %d, Timeouts: %d\n",
	stats.Hits, stats.Misses, stats.Timeouts)
```

## Command Stability

| Method | Command | Status |
|--------|---------|--------|
| `VectorCreate()` | `VECTOR.INDEX.CREATE` | **Stable** |
| `VectorAdd()` | `VECTOR.ADD` | **Stable** |
| `VectorSearch()` | `VECTOR.SEARCH` | **Stable** |
| `VectorDelete()` | `VECTOR.DEL` | **Stable** |
| `SemanticSet()` | `SEMANTIC.SET` | **Stable** |
| `SemanticGet()` | `SEMANTIC.GET` | **Stable** |
| `CRDTCounterIncr()` | `CRDT.COUNTER.INCR` | Experimental |
| `CRDTCounterGet()` | `CRDT.COUNTER.GET` | Experimental |
| `CRDTSetAdd()` | `CRDT.SET.ADD` | Experimental |
| `CRDTSetMembers()` | `CRDT.SET.MEMBERS` | Experimental |
| `CDCSubscribe()` | `CDC.SUBSCRIBE` | Experimental |

:::warning Experimental commands
Commands marked **Experimental** may have breaking changes between minor releases. Pin your Ferrite server version when using them in production.
:::

## Next Steps

- [Python Thin Client](/docs/sdks/python) — redis-py wrapper
- [Node.js Thin Client](/docs/sdks/nodejs) — ioredis wrapper
- [Vector Commands Reference](/docs/reference/commands/vector)
- [Semantic Commands Reference](/docs/reference/commands/semantic)
