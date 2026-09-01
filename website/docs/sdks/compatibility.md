---
title: SDK & Client Compatibility Matrix
description: Version compatibility between Ferrite server, official SDKs, and standard Redis clients
sidebar_position: 8
---

# SDK & Client Compatibility Matrix

This page tracks compatibility between Ferrite server versions, official Ferrite SDKs, and standard Redis client libraries.

## Ferrite Server ↔ Official SDK Compatibility

| SDK | SDK Version | Ferrite 0.1.x | Ferrite 0.2.x | Ferrite 0.3.x (dev) | Min Language Version |
|-----|-------------|:---:|:---:|:---:|---|
| **ferrite-rs** (Rust) | 0.1.x | ✅ | ✅ | ✅ | Rust 1.88+ |
| **ferrite-py** (Python) | 0.1.x | ✅ | ✅ | ✅ | Python 3.9+ |
| **ferrite-node** (Node.js) | 0.1.x | ✅ | ✅ | ✅ | Node.js 18+ |
| **ferrite-go** (Go) | 0.1.x | ✅ | ✅ | ✅ | Go 1.21+ |
| **ferrite-java** (Java) | 0.1.x | ✅ | ✅ | ✅ | Java 11+ |
| **ferrite-dotnet** (.NET) | 0.1.x | ✅ | ✅ | ✅ | .NET 8+ |
| **ferrite-ts** (TypeScript) | 0.1.x | ✅ | ✅ | ✅ | TypeScript 5.0+ |

:::info
All official SDKs follow the server's major version. Within a major version, SDKs are forward-compatible — an older SDK works with a newer server (new features return raw responses). Backward compatibility is guaranteed within a major version.
:::

## Standard Redis Client Compatibility

Since Ferrite implements the RESP2/RESP3 protocol, standard Redis clients work for all Redis-compatible commands:

| Language | Client Library | Version | Core Commands | Pub/Sub | Cluster | Transactions | Lua Scripting |
|----------|---------------|---------|:---:|:---:|:---:|:---:|:---:|
| Python | `redis-py` | ≥4.0 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Python | `aioredis` | ≥2.0 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Node.js | `ioredis` | ≥5.0 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Node.js | `node-redis` | ≥4.0 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Go | `go-redis/v9` | ≥9.0 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rust | `redis-rs` | ≥0.24 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Java | Jedis | ≥5.0 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Java | Lettuce | ≥6.0 | ✅ | ✅ | ✅ | ✅ | ✅ |
| C# | StackExchange.Redis | ≥2.7 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ruby | `redis-rb` | ≥5.0 | ✅ | ✅ | ✅ | ✅ | ✅ |
| PHP | `phpredis` | ≥6.0 | ✅ | ✅ | ✅ | ✅ | ✅ |
| PHP | `predis` | ≥2.0 | ✅ | ✅ | ✅ | ✅ | ✅ |

### Accessing Ferrite-Specific Features

Standard Redis clients can access Ferrite extensions via raw/custom command execution:

```python
# Python (redis-py)
r.execute_command('VECTOR.SEARCH', 'my_index', *vector, 'TOP_K', 10)
```

```javascript
// Node.js (ioredis)
await redis.call('VECTOR.SEARCH', 'my_index', ...vector, 'TOP_K', 10);
```

```go
// Go (go-redis)
redis.Do(ctx, "VECTOR.SEARCH", "my_index", vector, "TOP_K", 10)
```

## IDE Extension Compatibility

| Extension | Version | Ferrite 0.1.x | Ferrite 0.2.x | Ferrite 0.3.x (dev) |
|-----------|---------|:---:|:---:|:---:|
| [VS Code Extension](https://github.com/ferritelabs/vscode-ferrite) | 1.1.x | ✅ | ✅ | ✅ |
| [JetBrains Plugin](https://github.com/ferritelabs/jetbrains-ferrite) | 1.1.x | ✅ | ✅ | ✅ |

Both IDE extensions connect via the RESP protocol (using ioredis / Lettuce respectively) and support all Ferrite commands including extensions.

## Protocol Compatibility

| Protocol | Ferrite Support | Notes |
|----------|:-:|-------|
| RESP2 | ✅ | Full support, default protocol |
| RESP3 | ✅ | Full support, opt-in via `HELLO 3` |
| Inline commands | ✅ | Telnet-compatible |
| Redis Cluster protocol | ✅ | Gossip, MOVED, ASK redirections |

## Redis Command Coverage

Ferrite currently supports **~92%** of Redis commands. For detailed command-by-command compatibility, see the [Redis Compatibility Reference](/docs/reference/commands).

### Known Gaps

These Redis commands are not yet implemented:

| Category | Commands | Status |
|----------|----------|--------|
| Object inspection | `OBJECT` (ENCODING, FREQ, HELP, IDLETIME, REFCOUNT) | Planned for v0.3.0 |
| Debugging | `DEBUG` (OBJECT, SLEEP, SET-ACTIVE-EXPIRE) | Partial |
| Cluster management | `CLUSTER FAILOVER` (automatic) | Beta |
| Blocking operations | `BRPOPLPUSH`, `BLMOVE` | Planned for v0.3.0 |

## Version Policy

- **Server**: Follows [Semantic Versioning](https://semver.org/). Pre-1.0, minor versions may include breaking changes.
- **SDKs**: Track server major version. SDKs are released within one week of server releases.
- **IDE Extensions**: Compatible across all server versions within the same major version.
- **Deprecation**: Features are deprecated for at least one minor version before removal.
