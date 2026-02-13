---
maturity: stable
---

# Error Reference

Complete reference of Ferrite error codes, messages, and troubleshooting guidance.

## Error Format

Ferrite errors follow the Redis RESP error format:

```
-ERR <message>
-WRONGTYPE <message>
-MOVED <slot> <host:port>
-ASK <slot> <host:port>
-NOSCRIPT <message>
```

## Error Categories

### General Errors (ERR)

#### ERR unknown command

```
-ERR unknown command 'FOOBAR'
```

**Cause**: Command doesn't exist or is disabled.

**Solution**: Check command spelling, verify command is enabled in configuration.

---

#### ERR wrong number of arguments

```
-ERR wrong number of arguments for 'SET' command
```

**Cause**: Command called with incorrect number of arguments.

**Solution**: Check command syntax in [Commands Reference](/docs/reference/commands/strings).

---

#### ERR invalid argument

```
-ERR invalid expire time in 'SET' command
```

**Cause**: Argument value is invalid (wrong type, out of range).

**Solution**: Verify argument values meet command requirements.

---

#### ERR syntax error

```
-ERR syntax error
```

**Cause**: Command has syntax errors.

**Solution**: Check command format and options.

---

#### ERR value is not an integer or out of range

```
-ERR value is not an integer or out of range
```

**Cause**: Expected integer value, got something else or value too large.

**Solution**: Ensure value is a valid integer within range.

---

#### ERR value is not a valid float

```
-ERR value is not a valid float
```

**Cause**: Expected float value, got invalid format.

**Solution**: Use valid float format (e.g., "3.14", "-2.5").

---

### Type Errors (WRONGTYPE)

#### WRONGTYPE Operation against key holding wrong kind of value

```
-WRONGTYPE Operation against a key holding the wrong kind of value
```

**Cause**: Command for one type used on key of different type.

**Example**: Using LPUSH on a string key.

**Solution**:
1. Check key type with `TYPE key`
2. Use correct command for the type
3. Delete key if you need to change type

---

### Authentication Errors

#### NOAUTH Authentication required

```
-NOAUTH Authentication required
```

**Cause**: Server requires authentication but AUTH not sent.

**Solution**: Use `AUTH password` or `AUTH username password`.

---

#### ERR invalid password

```
-ERR invalid password
```

**Cause**: Wrong password provided.

**Solution**: Verify password is correct.

---

#### ERR invalid username-password pair

```
-ERR invalid username-password pair
```

**Cause**: ACL authentication failed.

**Solution**: Verify username and password.

---

#### NOPERM insufficient permissions

```
-NOPERM this user has no permissions to run the 'FLUSHALL' command
```

**Cause**: ACL denies access to command.

**Solution**: Contact administrator for permissions.

---

### Cluster Errors

#### MOVED

```
-MOVED 3999 127.0.0.1:6381
```

**Cause**: Key belongs to a different node in cluster.

**Solution**: Client should redirect to specified node. Most clients handle this automatically.

---

#### ASK

```
-ASK 3999 127.0.0.1:6381
```

**Cause**: Key is being migrated to another node.

**Solution**: Send ASKING to target node, then retry command.

---

#### CLUSTERDOWN

```
-CLUSTERDOWN The cluster is down
```

**Cause**: Cluster is in failed state.

**Possible causes**:
- Not enough master nodes
- Slots not fully covered
- Quorum lost

**Solution**: Check cluster status with `CLUSTER INFO`.

---

#### CROSSSLOT

```
-CROSSSLOT Keys in request don't hash to the same slot
```

**Cause**: Multi-key command with keys in different slots.

**Solution**:
1. Use hash tags: `{user}:name`, `{user}:email`
2. Use single-key commands

---

### Script Errors

#### NOSCRIPT No matching script

```
-NOSCRIPT No matching script. Please use EVAL.
```

**Cause**: EVALSHA called with unknown script SHA.

**Solution**: Load script with SCRIPT LOAD or use EVAL.

---

#### ERR Error running script

```
-ERR Error running script (call to f_abc123...): @user_script:3: error message
```

**Cause**: Lua script execution error.

**Solution**: Check script at indicated line number.

---

### Memory Errors

#### OOM command not allowed

```
-OOM command not allowed when used memory > 'maxmemory'
```

**Cause**: Memory limit reached and command would use more.

**Solution**:
1. Increase `maxmemory` setting
2. Configure eviction policy
3. Delete unused keys
4. Enable tiered storage

---

### Replication Errors

#### LOADING

```
-LOADING Ferrite is loading the dataset in memory
```

**Cause**: Server is still loading data on startup.

**Solution**: Wait for loading to complete, or set `busy-reply-on-loading yes`.

---

#### READONLY

```
-READONLY You can't write against a read only replica
```

**Cause**: Write command sent to replica.

**Solution**: Send writes to primary node.

---

#### MASTERDOWN

```
-MASTERDOWN Link with MASTER is down and replica-serve-stale-data is set to 'no'
```

**Cause**: Replica lost connection to primary.

**Solution**: Check primary node status and network connectivity.

---

### Transaction Errors

#### ERR EXEC without MULTI

```
-ERR EXEC without MULTI
```

**Cause**: EXEC called without starting transaction.

**Solution**: Use MULTI before queuing commands.

---

#### ERR DISCARD without MULTI

```
-ERR DISCARD without MULTI
```

**Cause**: DISCARD called without active transaction.

**Solution**: Only use DISCARD after MULTI.

---

#### EXECABORT

```
-EXECABORT Transaction discarded because of previous errors
```

**Cause**: Error during MULTI, transaction cannot execute.

**Solution**: Fix command errors and retry transaction.

---

### Pub/Sub Errors

#### ERR only allowed in Pub/Sub mode

```
-ERR only (P)SUBSCRIBE / (P)UNSUBSCRIBE / PING / QUIT / RESET are allowed in this context
```

**Cause**: Invalid command in Pub/Sub mode.

**Solution**: Use allowed commands or open new connection.

---

## Extended Feature Errors

### Vector Search Errors

#### ERR vector index not found

```
-ERR vector index 'embeddings' not found
```

**Solution**: Create index with VECTOR.INDEX.CREATE.

---

#### ERR invalid dimensions

```
-ERR vector has 256 dimensions but index expects 384
```

**Solution**: Ensure vectors match index dimensions.

---

#### ERR invalid distance metric

```
-ERR invalid distance metric 'euclidean', use COSINE, L2, or DOT
```

**Solution**: Use supported distance metric.

---

### Document Store Errors

#### ERR collection not found

```
-ERR collection 'articles' not found
```

**Solution**: Create collection or check name spelling.

---

#### ERR invalid JSON

```
-ERR invalid JSON at position 15: expected ':'
```

**Solution**: Validate JSON syntax.

---

#### ERR invalid query operator

```
-ERR unknown query operator '$foo'
```

**Solution**: Use valid MongoDB-compatible operators.

---

### Graph Errors

#### ERR graph not found

```
-ERR graph 'social' not found
```

**Solution**: Create graph with GRAPH.CREATE.

---

#### ERR vertex not found

```
-ERR vertex 'user:123' not found in graph 'social'
```

**Solution**: Add vertex before creating edges.

---

### Time Series Errors

#### ERR timestamp out of order

```
-ERR timestamp 1704067200 is before last timestamp 1704067201
```

**Solution**: Ensure timestamps are monotonically increasing or use '*' for auto-timestamp.

---

## Error Handling Best Practices

### Retry Logic

```rust
async fn with_retry<T, F, Fut>(mut f: F, max_retries: u32) -> Result<T>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T>>,
{
    let mut retries = 0;
    loop {
        match f().await {
            Ok(result) => return Ok(result),
            Err(e) if is_retryable(&e) && retries < max_retries => {
                retries += 1;
                tokio::time::sleep(Duration::from_millis(100 * retries as u64)).await;
            }
            Err(e) => return Err(e),
        }
    }
}

fn is_retryable(error: &FerriteError) -> bool {
    matches!(
        error,
        FerriteError::Connection(_)
            | FerriteError::Timeout
            | FerriteError::Loading
            | FerriteError::Busy
    )
}
```

### Error Classification

```rust
match error {
    // Retryable errors
    FerriteError::Connection(_) => retry(),
    FerriteError::Timeout => retry_with_backoff(),
    FerriteError::Loading => wait_and_retry(),

    // Client errors (don't retry)
    FerriteError::WrongType(_) => fix_code(),
    FerriteError::InvalidArgument(_) => fix_input(),
    FerriteError::NoAuth => authenticate(),

    // Server errors (alert)
    FerriteError::Oom => alert_ops_team(),
    FerriteError::ClusterDown => failover(),
}
```

## Monitoring Errors

### Error Metrics

```bash
# Get error statistics
INFO errorstats

# Output
errorstat_ERR:count=15
errorstat_WRONGTYPE:count=3
errorstat_OOM:count=0
errorstat_NOSCRIPT:count=42
```

### Error Logging

```toml
# ferrite.toml
[logging]
level = "warn"  # Log errors and warnings

[logging.filters]
# Log all authentication errors at debug level
auth = "debug"
```

## See Also

- [Commands Reference](/docs/reference/commands/strings)
- [Troubleshooting](/docs/operations/troubleshooting)
- [FAQ](/docs/community/faq)
