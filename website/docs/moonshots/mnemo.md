---
sidebar_position: 1
title: "Mnemo — Agent Memory OS"
description: "Persistent, queryable memory layer for AI agents running inside Ferrite."
---

# Mnemo — Agent Memory OS

## What It Is

Mnemo turns Ferrite into a long-term memory store for AI agents. Instead of losing context between sessions, agents can persist episodic, semantic, and procedural memories as first-class objects, then recall them by agent, session, or memory type — all through the Redis protocol with zero external dependencies.

## When to Use It

- You are building an AI agent that needs to remember past conversations across sessions.
- You want to query an agent's memories by type (episodic, semantic, procedural) without a separate vector database.
- You need a lightweight memory backend that co-locates with your application's primary data store.
- Your agent framework (LangChain, AutoGen, CrewAI) needs a pluggable memory provider.
- You want to persist and restore agent memory snapshots for debugging or replay.

## Quick Start

```redis
# Connect to Ferrite
redis-cli -p 6379

# Store an episodic memory for agent1 in session1
MEM.PUT agent1 session1 episodic "User asked about pricing"

# Store another memory
MEM.PUT agent1 session1 episodic "User compared the Pro and Enterprise tiers"

# Recall all memories for agent1
MEM.RECALL agent1

# Check memory statistics
MEM.STATS

# Persist memory state to disk
MEM.SAVE
```

## Command Reference

### MEM.PUT

Store a memory entry for an agent within a session.

**Synopsis**

```
MEM.PUT <agent-id> <session-id> <memory-type> <content>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `agent-id` | string | Unique identifier for the agent. |
| `session-id` | string | Session or conversation identifier. |
| `memory-type` | string | One of `episodic`, `semantic`, or `procedural`. |
| `content` | string | The memory content to store. |

**Return**

`OK` on success.

**Example**

```redis
MEM.PUT agent1 session1 episodic "User asked about pricing"
# OK
```

---

### MEM.GET

Retrieve a specific memory entry by agent, session, and index.

**Synopsis**

```
MEM.GET <agent-id> [session-id] [memory-type]
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `agent-id` | string | Agent identifier. |
| `session-id` | string | *(Optional)* Filter by session. |
| `memory-type` | string | *(Optional)* Filter by memory type. |

**Return**

Array of matching memory entries.

**Example**

```redis
MEM.GET agent1 session1 episodic
# 1) "User asked about pricing"
# 2) "User compared the Pro and Enterprise tiers"
```

---

### MEM.RECALL

Retrieve all memories for an agent, optionally filtered.

**Synopsis**

```
MEM.RECALL <agent-id> [memory-type]
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `agent-id` | string | Agent identifier. |
| `memory-type` | string | *(Optional)* Filter by type (`episodic`, `semantic`, `procedural`). |

**Return**

Array of memory entries across all sessions.

**Example**

```redis
MEM.RECALL agent1
# 1) 1) "session1"
#    2) "episodic"
#    3) "User asked about pricing"
# 2) 1) "session1"
#    2) "episodic"
#    3) "User compared the Pro and Enterprise tiers"
```

---

### MEM.FORGET

Remove memories for an agent, optionally scoped to a session or type.

**Synopsis**

```
MEM.FORGET <agent-id> [session-id] [memory-type]
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `agent-id` | string | Agent identifier. |
| `session-id` | string | *(Optional)* Scope deletion to a session. |
| `memory-type` | string | *(Optional)* Scope deletion to a memory type. |

**Return**

Integer — the number of memories removed.

**Example**

```redis
MEM.FORGET agent1 session1
# (integer) 2
```

---

### MEM.STATS

Return statistics about the memory subsystem.

**Synopsis**

```
MEM.STATS
```

**Return**

Key-value pairs with memory counts, agent counts, and storage usage.

**Example**

```redis
MEM.STATS
# 1) "total_memories"
# 2) (integer) 42
# 3) "total_agents"
# 4) (integer) 3
# 5) "total_sessions"
# 6) (integer) 7
```

---

### MEM.SAVE

Persist the current memory state to disk.

**Synopsis**

```
MEM.SAVE
```

**Return**

`OK` on success.

**Example**

```redis
MEM.SAVE
# OK
```

---

### MEM.LOAD

Load previously persisted memory state from disk.

**Synopsis**

```
MEM.LOAD
```

**Return**

`OK` on success.

**Example**

```redis
MEM.LOAD
# OK
```

---

### MEM.HELP

Display usage information for Mnemo commands.

**Synopsis**

```
MEM.HELP
```

**Return**

Array of help strings describing available commands.

**Example**

```redis
MEM.HELP
# 1) "MEM.PUT <agent-id> <session-id> <memory-type> <content>"
# 2) "MEM.GET <agent-id> [session-id] [memory-type]"
# ...
```

## Concepts

### Data Model

Mnemo organizes memories in a three-level hierarchy:

- **Agent** — top-level namespace, typically one per AI agent instance.
- **Session** — a conversation or task context within an agent.
- **Memory entry** — a single piece of information tagged with a type.

### Memory Types

| Type | Purpose | Example |
|------|---------|---------|
| `episodic` | Events that happened | "User asked about pricing on Jan 5" |
| `semantic` | Facts and knowledge | "Company uses the Enterprise tier" |
| `procedural` | How-to knowledge | "To reset a password, navigate to Settings > Security" |

### Lifecycle

1. **Store** — `MEM.PUT` appends a memory entry (memories are append-only within a session).
2. **Query** — `MEM.GET` and `MEM.RECALL` retrieve memories with optional filtering.
3. **Prune** — `MEM.FORGET` removes memories that are no longer relevant.
4. **Persist** — `MEM.SAVE` writes the in-memory state to Ferrite's disk store.

## Operational Guidance

### Telemetry

When OpenTelemetry is enabled (`--features otel`), Mnemo emits the following metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite.mnemo.memories_total` | Counter | Total memories stored. |
| `ferrite.mnemo.recall_latency_ms` | Histogram | Recall operation latency. |
| `ferrite.mnemo.agents_active` | Gauge | Number of agents with memories. |

### Limits

- Maximum content size per memory entry: **1 MB**.
- No hard limit on memories per agent, but recall performance degrades beyond ~10,000 entries per agent.
- `MEM.SAVE` / `MEM.LOAD` operate on the entire memory store — large stores may cause brief latency spikes.

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| Server restart without `MEM.SAVE` | In-memory data is lost. |
| Invalid memory type | Returns an error: `ERR unknown memory type`. |
| Agent not found on `MEM.RECALL` | Returns an empty array. |

## Migration / Interop

Mnemo is a Ferrite-native feature with no direct Redis equivalent. To migrate from an external memory store:

1. Export memories as JSON from your current store.
2. Script `MEM.PUT` calls using `redis-cli --pipe` or your preferred Redis client.
3. Verify with `MEM.STATS` that counts match.

Mnemo memories are accessible from any Redis-compatible client (Python redis-py, Node.js ioredis, Go go-redis) as custom commands.

## Status

:::caution Pre-alpha
Mnemo is in **pre-alpha**. APIs may change without notice. Do not use in production workloads. Feedback is welcome via [GitHub Issues](https://github.com/FerriteLabs/ferrite/issues).
:::
