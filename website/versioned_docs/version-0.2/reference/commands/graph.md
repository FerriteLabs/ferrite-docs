---
sidebar_position: 18
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Graph Commands

Commands for property graph database operations.

## Overview

Graph commands enable storing and querying property graphs with vertices, edges, and traversal algorithms.

## Commands

### GRAPH.CREATE

Create a new graph.

```bash
GRAPH.CREATE graph_name
```

**Examples:**
```bash
GRAPH.CREATE social
# OK
```

---

### GRAPH.DROP

Delete a graph.

```bash
GRAPH.DROP graph_name
```

---

### GRAPH.LIST

List all graphs.

```bash
GRAPH.LIST
```

---

### GRAPH.VERTEX.ADD

Add a vertex.

```bash
GRAPH.VERTEX.ADD graph_name id label [properties]
```

**Examples:**
```bash
GRAPH.VERTEX.ADD social user:1 User '{"name": "Alice", "age": 30}'
# "user:1"

GRAPH.VERTEX.ADD social user:2 User '{"name": "Bob", "age": 25}'
# "user:2"
```

---

### GRAPH.VERTEX.GET

Get a vertex.

```bash
GRAPH.VERTEX.GET graph_name id
```

**Examples:**
```bash
GRAPH.VERTEX.GET social user:1
# {"id": "user:1", "label": "User", "properties": {"name": "Alice", "age": 30}}
```

---

### GRAPH.VERTEX.DEL

Delete a vertex.

```bash
GRAPH.VERTEX.DEL graph_name id
```

---

### GRAPH.VERTEX.UPDATE

Update vertex properties.

```bash
GRAPH.VERTEX.UPDATE graph_name id properties
```

**Examples:**
```bash
GRAPH.VERTEX.UPDATE social user:1 '{"age": 31}'
# OK
```

---

### GRAPH.EDGE.ADD

Add an edge.

```bash
GRAPH.EDGE.ADD graph_name from_id to_id label [properties]
```

**Examples:**
```bash
GRAPH.EDGE.ADD social user:1 user:2 FOLLOWS '{"since": "2024-01-01"}'
# "edge:1"

GRAPH.EDGE.ADD social user:2 user:1 FOLLOWS '{"since": "2024-01-15"}'
# "edge:2"
```

---

### GRAPH.EDGE.GET

Get an edge.

```bash
GRAPH.EDGE.GET graph_name edge_id
```

---

### GRAPH.EDGE.DEL

Delete an edge.

```bash
GRAPH.EDGE.DEL graph_name edge_id
```

---

### GRAPH.EDGE.UPDATE

Update edge properties.

```bash
GRAPH.EDGE.UPDATE graph_name edge_id properties
```

---

### GRAPH.QUERY

Execute a graph query.

```bash
GRAPH.QUERY graph_name query
```

**Cypher-like Syntax:**
```bash
# Match pattern
GRAPH.QUERY social 'MATCH (a:User)-[:FOLLOWS]->(b:User) RETURN a, b'

# With WHERE clause
GRAPH.QUERY social 'MATCH (u:User) WHERE u.age > 25 RETURN u'

# With aggregation
GRAPH.QUERY social 'MATCH (u:User)-[:FOLLOWS]->(f) RETURN u.name, COUNT(f) as followers'
```

---

### GRAPH.TRAVERSE

Traverse the graph.

```bash
GRAPH.TRAVERSE graph_name start_id
  [DIRECTION OUT|IN|BOTH]
  [DEPTH max_depth]
  [EDGE_LABELS label1,label2]
  [ALGORITHM BFS|DFS]
```

**Examples:**
```bash
# Outgoing edges, depth 2
GRAPH.TRAVERSE social user:1 DIRECTION OUT DEPTH 2

# Specific edge labels
GRAPH.TRAVERSE social user:1 EDGE_LABELS FOLLOWS,LIKES

# DFS traversal
GRAPH.TRAVERSE social user:1 ALGORITHM DFS DEPTH 5
```

---

### GRAPH.NEIGHBORS

Get immediate neighbors.

```bash
GRAPH.NEIGHBORS graph_name vertex_id
  [DIRECTION OUT|IN|BOTH]
  [EDGE_LABELS label1,label2]
```

**Examples:**
```bash
GRAPH.NEIGHBORS social user:1 DIRECTION OUT EDGE_LABELS FOLLOWS
# ["user:2", "user:3", "user:4"]
```

---

### GRAPH.PATH

Find path between vertices.

```bash
GRAPH.PATH graph_name from_id to_id
  [MAX_DEPTH depth]
  [ALGORITHM SHORTEST|ALL]
```

**Examples:**
```bash
# Shortest path
GRAPH.PATH social user:1 user:5 ALGORITHM SHORTEST
# [["user:1", "user:2", "user:5"]]

# All paths
GRAPH.PATH social user:1 user:5 MAX_DEPTH 4 ALGORITHM ALL
```

---

### GRAPH.DEGREE

Get vertex degree.

```bash
GRAPH.DEGREE graph_name vertex_id [DIRECTION OUT|IN|BOTH]
```

**Examples:**
```bash
GRAPH.DEGREE social user:1
# {"in": 5, "out": 10, "total": 15}

GRAPH.DEGREE social user:1 DIRECTION OUT
# (integer) 10
```

---

### GRAPH.PAGERANK

Calculate PageRank.

```bash
GRAPH.PAGERANK graph_name
  [ITERATIONS n]
  [DAMPING factor]
  [LIMIT n]
```

**Examples:**
```bash
GRAPH.PAGERANK social ITERATIONS 20 DAMPING 0.85 LIMIT 10
# 1) "user:5"
# 2) "0.0542"
# 3) "user:3"
# 4) "0.0481"
```

---

### GRAPH.COMMUNITY

Detect communities.

```bash
GRAPH.COMMUNITY graph_name
  [ALGORITHM LOUVAIN|LABEL_PROPAGATION]
```

**Examples:**
```bash
GRAPH.COMMUNITY social ALGORITHM LOUVAIN
# {"communities": 5, "modularity": 0.78, "assignments": {...}}
```

---

### GRAPH.STATS

Get graph statistics.

```bash
GRAPH.STATS graph_name
```

**Examples:**
```bash
GRAPH.STATS social
# {
#   "vertices": 10000,
#   "edges": 50000,
#   "labels": {"User": 10000, "Post": 5000},
#   "edge_labels": {"FOLLOWS": 30000, "LIKES": 20000}
# }
```

## Query Language

### MATCH Patterns

```cypher
-- Single vertex
MATCH (u:User) RETURN u

-- Single edge
MATCH (a)-[r:FOLLOWS]->(b) RETURN a, r, b

-- Path pattern
MATCH (a)-[:FOLLOWS]->()-[:FOLLOWS]->(c) RETURN a, c

-- Variable length
MATCH (a)-[:FOLLOWS*1..3]->(b) RETURN a, b
```

### WHERE Clause

```cypher
MATCH (u:User)
WHERE u.age > 25 AND u.city = 'NYC'
RETURN u

MATCH (a)-[r:FOLLOWS]->(b)
WHERE r.since > '2024-01-01'
RETURN a, b
```

### Aggregations

```cypher
-- Count
MATCH (u:User)-[:FOLLOWS]->(f)
RETURN u.name, COUNT(f) as followers

-- Group by
MATCH (u:User)
RETURN u.city, AVG(u.age) as avg_age, COUNT(*) as count

-- Order and limit
MATCH (u:User)-[:FOLLOWS]->(f)
RETURN u.name, COUNT(f) as followers
ORDER BY followers DESC
LIMIT 10
```

## Use Cases

### Social Network

```bash
# Create graph
GRAPH.CREATE social

# Add users
GRAPH.VERTEX.ADD social user:1 User '{"name": "Alice"}'
GRAPH.VERTEX.ADD social user:2 User '{"name": "Bob"}'
GRAPH.VERTEX.ADD social user:3 User '{"name": "Carol"}'

# Add relationships
GRAPH.EDGE.ADD social user:1 user:2 FOLLOWS
GRAPH.EDGE.ADD social user:1 user:3 FOLLOWS
GRAPH.EDGE.ADD social user:2 user:3 FOLLOWS

# Friend suggestions (friends of friends)
GRAPH.QUERY social '
  MATCH (u:User {name: "Alice"})-[:FOLLOWS]->(friend)-[:FOLLOWS]->(suggestion)
  WHERE suggestion <> u
  AND NOT (u)-[:FOLLOWS]->(suggestion)
  RETURN DISTINCT suggestion
'

# Mutual friends
GRAPH.QUERY social '
  MATCH (a:User {name: "Alice"})-[:FOLLOWS]->(mutual)<-[:FOLLOWS]-(b:User {name: "Bob"})
  RETURN mutual
'
```

### Knowledge Graph

```bash
# Create knowledge graph
GRAPH.CREATE knowledge

# Add entities
GRAPH.VERTEX.ADD knowledge entity:python Language '{"name": "Python", "type": "programming"}'
GRAPH.VERTEX.ADD knowledge entity:django Framework '{"name": "Django", "type": "web"}'
GRAPH.VERTEX.ADD knowledge entity:guido Person '{"name": "Guido van Rossum"}'

# Add relationships
GRAPH.EDGE.ADD knowledge entity:django entity:python WRITTEN_IN
GRAPH.EDGE.ADD knowledge entity:guido entity:python CREATED

# Query relationships
GRAPH.QUERY knowledge '
  MATCH (p:Person)-[:CREATED]->(lang:Language)<-[:WRITTEN_IN]-(fw)
  RETURN p.name, lang.name, fw.name
'
```

### Fraud Detection

```bash
# Create transaction graph
GRAPH.CREATE transactions

# Add accounts and transactions
GRAPH.VERTEX.ADD transactions acc:1 Account '{"holder": "Alice", "type": "checking"}'
GRAPH.VERTEX.ADD transactions acc:2 Account '{"holder": "Bob", "type": "checking"}'
GRAPH.EDGE.ADD transactions acc:1 acc:2 TRANSFER '{"amount": 1000, "date": "2024-01-15"}'

# Find circular transfers (potential fraud)
GRAPH.QUERY transactions '
  MATCH (a)-[:TRANSFER*2..5]->(a)
  RETURN a, COUNT(*) as cycles
'
```

## Rust API

```rust
use ferrite::Client;
use ferrite::graph::{Vertex, Edge};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Create graph
    client.graph_create("social").await?;

    // Add vertices
    client.graph_vertex_add("social", "user:1", "User", json!({
        "name": "Alice",
        "age": 30
    })).await?;

    // Add edge
    client.graph_edge_add("social", "user:1", "user:2", "FOLLOWS", json!({
        "since": "2024-01-01"
    })).await?;

    // Query
    let results = client.graph_query("social", r#"
        MATCH (u:User)-[:FOLLOWS]->(f:User)
        WHERE u.age > 25
        RETURN u.name, f.name
    "#).await?;

    // Traverse
    let reachable = client.graph_traverse(
        "social",
        "user:1",
        GraphTraverseOptions::default()
            .direction(Direction::Out)
            .depth(3)
            .algorithm(TraversalAlgorithm::BFS),
    ).await?;

    // Find path
    let path = client.graph_path("social", "user:1", "user:5", PathOptions::shortest()).await?;

    Ok(())
}
```

## Related Commands

- [Document Commands](/docs/reference/commands/document) - JSON documents
- [Search Commands](/docs/reference/commands/search) - Full-text search
- [Graph Database Guide](/docs/data-models/graph-database) - Detailed guide
