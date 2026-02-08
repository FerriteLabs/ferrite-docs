# ADR-0003: Redis RESP Protocol Compatibility

## Status

Accepted

## Context

Ferrite's primary goal is to serve as a **drop-in Redis replacement**. This means existing applications using Redis should be able to switch to Ferrite with minimal or no code changes. The key to this compatibility is the wire protocol.

Redis uses the **RESP (REdis Serialization Protocol)**, which has evolved through several versions:
- **RESP2**: Original protocol, simple and widely supported
- **RESP3**: Introduced in Redis 6.0, adds new data types (maps, sets, booleans)

The protocol is text-based and human-readable, making it easy to debug. Every Redis client library implements RESP, so compatibility here means compatibility with the entire Redis ecosystem.

Alternatives considered:
1. **Custom binary protocol**: Higher performance but breaks compatibility
2. **gRPC/Protocol Buffers**: Modern, typed, but no Redis client support
3. **HTTP/REST**: Universal but high overhead for key-value operations
4. **Partial RESP**: Implement subset, but which commands to exclude?

## Decision

We implement **full RESP2 and RESP3 protocol compatibility**, including:

### Protocol Support
- RESP2 for maximum client compatibility
- RESP3 for clients that opt-in (via HELLO command)
- Automatic protocol detection based on client handshake

### Wire Format Implementation
```
RESP2 Types:
+OK\r\n                      Simple String
-ERR message\r\n             Error
:1000\r\n                    Integer
$6\r\nfoobar\r\n             Bulk String
*2\r\n$3\r\nfoo\r\n$3\r\nbar\r\n  Array
$-1\r\n                      Null Bulk String
*-1\r\n                      Null Array

RESP3 Additional Types:
_\r\n                        Null
#t\r\n / #f\r\n              Boolean
,3.14159\r\n                 Double
(3492890328409238509324850943850943825024385\r\n  Big Number
!21\r\nSYNTAX invalid syntax\r\n  Blob Error
=15\r\ntxt:Some text\r\n     Verbatim String
%2\r\n+key1\r\n:1\r\n+key2\r\n:2\r\n  Map
~2\r\n+item1\r\n+item2\r\n   Set
```

### Module Structure
```
src/protocol/
├── mod.rs       # Public interface
├── parser.rs    # RESP parsing (streaming)
├── encoder.rs   # RESP encoding
├── frame.rs     # Frame types (internal representation)
└── command.rs   # Command parsing and validation
```

### Streaming Parser
```rust
pub struct RespParser {
    buffer: BytesMut,
    protocol_version: ProtocolVersion,
}

impl RespParser {
    /// Parse next frame, returns None if incomplete
    pub fn parse(&mut self) -> Result<Option<Frame>, ProtocolError>;
}
```

## Consequences

### Positive
- **Drop-in replacement**: Any Redis client works with Ferrite
- **Ecosystem access**: redis-cli, monitoring tools, client libraries all work
- **Migration path**: Zero application changes to switch from Redis
- **Debugging ease**: Protocol is human-readable, easy to inspect with tcpdump
- **Battle-tested**: RESP has been refined over 10+ years

### Negative
- **Protocol overhead**: Text-based format less efficient than binary
- **Parsing complexity**: Must handle RESP2 and RESP3 variants
- **Command compatibility burden**: Must implement hundreds of Redis commands
- **Version management**: Different behaviors between Redis versions

### Trade-offs
- **Text vs binary**: ~10-15% bandwidth overhead vs custom binary protocol
- **Compatibility vs features**: Some Ferrite features may not map cleanly to RESP
- **Strict vs lenient parsing**: We choose strict to catch client bugs early

## Implementation Notes

Key files:
- `src/protocol/parser.rs` - Streaming RESP parser
- `src/protocol/encoder.rs` - Response encoder
- `src/protocol/frame.rs` - Internal frame representation
- `src/protocol/command.rs` - Command validation

Frame type mapping:
```rust
pub enum Frame {
    Simple(String),           // +
    Error(String),            // -
    Integer(i64),             // :
    Bulk(Option<Bytes>),      // $
    Array(Option<Vec<Frame>>),// *
    Null,                     // _ (RESP3)
    Boolean(bool),            // # (RESP3)
    Double(f64),              // , (RESP3)
    Map(Vec<(Frame, Frame)>), // % (RESP3)
    Set(Vec<Frame>),          // ~ (RESP3)
}
```

Protocol negotiation:
```
Client: HELLO 3
Server: %7\r\n
        +server\r\n+ferrite\r\n
        +version\r\n+0.1.0\r\n
        +proto\r\n:3\r\n
        ...
```

## Command Compatibility

Priority tiers for command implementation:

| Tier | Commands | Status |
|------|----------|--------|
| P0 | GET, SET, DEL, EXISTS, EXPIRE, TTL, PING, INFO | ✅ Complete |
| P1 | MGET, MSET, INCR, DECR, LPUSH, RPUSH, HSET, HGET | ✅ Complete |
| P2 | ZADD, ZRANGE, SADD, SMEMBERS, PUB/SUB | ✅ Complete |
| P3 | Transactions, Scripting, Cluster | ✅ Complete |
| P4 | Streams, Modules | ✅ Complete |

## References

- [Redis Protocol Specification](https://redis.io/docs/reference/protocol-spec/)
- [RESP3 Specification](https://github.com/redis/redis-specifications/blob/master/protocol/RESP3.md)
- [Redis Commands Reference](https://redis.io/commands/)
