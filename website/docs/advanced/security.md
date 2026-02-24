---
sidebar_position: 3
maturity: beta
---

# Security

Secure your Ferrite deployment with TLS encryption and access control lists (ACLs).

## TLS/SSL

### Enable TLS

```toml
[tls]
enabled = true
cert_file = "/etc/ferrite/server.crt"
key_file = "/etc/ferrite/server.key"
```

### Harden TLS for Production

```toml
[tls]
enabled = true
cert_file = "/etc/ferrite/server.crt"
key_file = "/etc/ferrite/server.key"
min_protocol_version = "1.3"  # Require TLS 1.3 (default: "1.2")
```

Supported values for `min_protocol_version`: `"1.2"` (default) or `"1.3"`.

### Enable mTLS (Client Certificates)

```toml
[tls]
enabled = true
cert_file = "/etc/ferrite/server.crt"
key_file = "/etc/ferrite/server.key"
ca_file = "/etc/ferrite/ca.crt"
require_client_cert = true
```

### Generate Certificates

#### Self-Signed (Development)

```bash
# Generate CA
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 365 -key ca.key -out ca.crt \
    -subj "/CN=Ferrite CA"

# Generate server certificate
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr \
    -subj "/CN=ferrite.example.com"
openssl x509 -req -days 365 -in server.csr -CA ca.crt -CAkey ca.key \
    -CAcreateserial -out server.crt
```

#### Let's Encrypt (Production)

```bash
certbot certonly --standalone -d ferrite.example.com
```

Use certificates at `/etc/letsencrypt/live/ferrite.example.com/`.

### Client Connection

```bash
# redis-cli with TLS
redis-cli --tls --cacert ca.crt -p 6379
```

### Mutual TLS (mTLS)

Require client certificates:

```toml
[tls]
enabled = true
cert_file = "/etc/ferrite/server.crt"
key_file = "/etc/ferrite/server.key"
ca_file = "/etc/ferrite/ca.crt"
require_client_cert = true
```

Connect with client certificate:

```bash
redis-cli --tls \
    --cacert ca.crt \
    --cert client.crt \
    --key client.key
```

## Access Control Lists (ACLs)

### Enable ACLs

```toml
[acl]
enabled = true
```

### Default User

The default user has full access by default:

```bash
# Set password for default user
127.0.0.1:6379> ACL SETUSER default on >mypassword

# Connect with password
redis-cli -a mypassword
```

### Create Users

```bash
# Create admin user with all permissions
ACL SETUSER admin on >adminpass ~* &* +@all

# Create read-only user
ACL SETUSER reader on >readerpass ~* &* +@read -@write

# Create user for specific key pattern
ACL SETUSER app on >apppass ~app:* +@all

# Create user with limited commands
ACL SETUSER limited on >limitedpass ~* &* +get +set +del
```

### ACL Syntax

```
ACL SETUSER username [on|off] [>password] [~pattern] [+command|-command] [+@category|-@category]
```

- `on/off` - Enable/disable user
- `>password` - Set password (add multiple for multiple passwords)
- `~pattern` - Key pattern access (e.g., `~user:*`)
- `+command` - Allow command
- `-command` - Deny command
- `+@category` - Allow category
- `-@category` - Deny category

### Command Categories

| Category | Commands |
|----------|----------|
| `@read` | GET, MGET, HGET, LRANGE, etc. |
| `@write` | SET, DEL, LPUSH, HSET, etc. |
| `@admin` | CONFIG, SHUTDOWN, DEBUG, etc. |
| `@dangerous` | KEYS, FLUSHALL, FLUSHDB, etc. |
| `@slow` | KEYS, SORT, etc. |
| `@pubsub` | SUBSCRIBE, PUBLISH, etc. |
| `@transaction` | MULTI, EXEC, etc. |
| `@scripting` | EVAL, EVALSHA, etc. |

### ACL Commands

```bash
# List all users
ACL LIST

# Get user details
ACL GETUSER username

# Delete user
ACL DELUSER username

# List categories
ACL CAT

# List commands in category
ACL CAT @read

# Test permissions
ACL DRYRUN username command [arg ...]

# Save ACLs to file
ACL SAVE

# Load ACLs from file
ACL LOAD
```

### ACL File

Store ACLs persistently:

```toml
[acl]
enabled = true
users_file = "/etc/ferrite/users.acl"
```

Example `users.acl`:

```
user default on >defaultpass ~* &* +@all
user admin on >adminpass ~* &* +@all
user reader on >readerpass ~* &* +@read -@write
user app on >apppass ~app:* &* +@all
```

## Network Security

### Bind to Specific Interface

```toml
[server]
bind = "192.168.1.100"  # Don't use 0.0.0.0 in production
```

### Firewall Rules

```bash
# Allow only from app servers
iptables -A INPUT -p tcp --dport 6379 -s 192.168.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 6379 -j DROP
```

### Protected Mode

Protected mode is enabled by default when no password is set:

```bash
# Disable protected mode (not recommended)
127.0.0.1:6379> CONFIG SET protected-mode no
```

## Audit Logging

Enable ACL logging:

```toml
[acl]
log_enabled = true
log_max_len = 128
```

View denied commands:

```bash
127.0.0.1:6379> ACL LOG
1) 1) "count"
   2) (integer) 1
   3) "reason"
   4) "command"
   5) "context"
   6) "toplevel"
   7) "object"
   8) "SET"
   9) "username"
  10) "reader"
  11) "age-seconds"
  12) "10.5"
```

## Password Hashing

Ferrite uses Argon2 for password hashing:

```bash
# Passwords are hashed automatically
ACL SETUSER user >mypassword

# View hashed password
ACL GETUSER user
# Shows hash, not plaintext
```

## Best Practices

### Production Checklist

1. **Enable TLS** - Always use encryption in production
2. **Set strong passwords** - Use random, long passwords
3. **Enable ACLs** - Use least-privilege principle
4. **Bind to specific IP** - Don't expose to public internet
5. **Use firewall** - Restrict access to known IPs
6. **Disable dangerous commands** - KEYS, FLUSHALL, etc.
7. **Enable audit logging** - Track access attempts
8. **Use mTLS for internal** - For service-to-service communication

### Disable Dangerous Commands

```bash
# Disable for specific user
ACL SETUSER app -@dangerous

# Or rename commands globally
127.0.0.1:6379> CONFIG SET rename-command FLUSHALL ""
127.0.0.1:6379> CONFIG SET rename-command DEBUG ""
127.0.0.1:6379> CONFIG SET rename-command CONFIG "CONFIG_1234"
```

## Configuration Reference

```toml
[tls]
enabled = false
port = 6379
cert_file = ""
key_file = ""
ca_file = ""
require_client_cert = false
protocols = ["TLSv1.2", "TLSv1.3"]
ciphers = ""
prefer_server_ciphers = true

[acl]
enabled = false
default_user = "default"
users_file = ""
log_enabled = true
log_max_len = 128
```

## Next Steps

- [Clustering](/docs/advanced/clustering) - Secure cluster setup
- [Configuration Reference](/docs/reference/configuration) - All security options
