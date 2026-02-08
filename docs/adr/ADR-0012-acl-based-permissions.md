# ADR-0012: ACL-Based Permission System

## Status

Accepted

## Context

Production Redis deployments require access control for:
- Multi-tenant environments (isolate customer data)
- Principle of least privilege (apps get minimal access)
- Audit and compliance (track who did what)
- Operational safety (prevent accidental FLUSHALL)

Redis 6.0 introduced ACLs (Access Control Lists), replacing the simple `requirepass` authentication. Ferrite needs equivalent security for production readiness.

Security approaches considered:

1. **Password-only (legacy Redis)**
   - Single password for all access
   - All-or-nothing permissions
   - No audit trail

2. **External auth (LDAP/OAuth)**
   - Centralized identity management
   - Complex integration
   - Network dependency

3. **Redis ACL (users + permissions)**
   - Fine-grained per-user control
   - Command and key pattern restrictions
   - Compatible with existing tooling

4. **Role-based (RBAC)**
   - Roles group permissions
   - Users assigned roles
   - More abstraction, more complexity

## Decision

We implement **Redis-compatible ACL** with extensions:

### User Model
```rust
pub struct AclUser {
    /// Username (case-sensitive)
    pub name: String,

    /// User status
    pub flags: UserFlags,

    /// Password hashes (multiple allowed)
    pub passwords: Vec<PasswordHash>,

    /// Allowed commands (patterns with wildcards)
    pub commands: CommandPermissions,

    /// Allowed key patterns
    pub keys: Vec<KeyPattern>,

    /// Allowed Pub/Sub channel patterns
    pub channels: Vec<ChannelPattern>,

    /// Allowed selectors (Redis 7+ feature)
    pub selectors: Vec<Selector>,
}

bitflags! {
    pub struct UserFlags: u32 {
        const ON = 0x01;           // User is active
        const OFF = 0x02;          // User is disabled
        const NOPASS = 0x04;       // No password required
        const SKIP_SANITIZE = 0x08;// Skip input sanitization
    }
}
```

### Permission Hierarchy
```
┌─────────────────────────────────────────────────────────────┐
│                    ACL Permission Model                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User: "analytics"                                           │
│  ├── Status: ON                                              │
│  ├── Password: ******** (SHA256 hash)                        │
│  │                                                           │
│  ├── Commands:                                               │
│  │   ├── +@read           (all read commands)                │
│  │   ├── -@admin          (no admin commands)                │
│  │   └── +EVAL            (allow scripting)                  │
│  │                                                           │
│  ├── Keys:                                                   │
│  │   ├── ~analytics:*     (read/write analytics:* keys)      │
│  │   └── %R~cache:*       (read-only cache:* keys)           │
│  │                                                           │
│  └── Channels:                                               │
│      └── &events:*        (subscribe to events:* channels)   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Command Categories
```rust
pub enum CommandCategory {
    Read,           // @read - GET, MGET, SCAN, etc.
    Write,          // @write - SET, DEL, LPUSH, etc.
    Admin,          // @admin - CONFIG, SHUTDOWN, DEBUG, etc.
    Dangerous,      // @dangerous - FLUSHALL, KEYS, etc.
    Fast,           // @fast - O(1) commands
    Slow,           // @slow - O(n) commands
    Pubsub,         // @pubsub - PUBLISH, SUBSCRIBE, etc.
    Transaction,    // @transaction - MULTI, EXEC, etc.
    Scripting,      // @scripting - EVAL, EVALSHA, etc.
    Blocking,       // @blocking - BLPOP, BRPOP, etc.
    Connection,     // @connection - AUTH, CLIENT, etc.
    // Ferrite extensions
    Vector,         // @vector - FT.* commands
    Wasm,           // @wasm - WASM.* commands
}
```

### Authentication Flow
```
┌─────────────────────────────────────────────────────────────┐
│                    Authentication Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Client                           Server                     │
│    │                                │                        │
│    │── AUTH username password ─────▶│                        │
│    │                                │                        │
│    │                         ┌──────┴──────┐                 │
│    │                         │ Lookup user │                 │
│    │                         │ Verify pass │                 │
│    │                         │ Check flags │                 │
│    │                         └──────┬──────┘                 │
│    │                                │                        │
│    │◀───────── OK ─────────────────│                        │
│    │                                │                        │
│    │── SET foo bar ────────────────▶│                        │
│    │                         ┌──────┴──────┐                 │
│    │                         │ Check cmd   │                 │
│    │                         │ Check key   │                 │
│    │                         └──────┬──────┘                 │
│    │                                │                        │
│    │◀───────── OK ─────────────────│  (if permitted)        │
│    │◀── NOPERM message ────────────│  (if denied)           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### ACL Commands
```
# List all users
ACL LIST

# Get current user
ACL WHOAMI

# Create/modify user
ACL SETUSER alice ON >password123 ~cache:* +@read

# Delete user
ACL DELUSER alice

# Get user details
ACL GETUSER alice

# Generate secure password
ACL GENPASS [bits]

# List command categories
ACL CAT [category]

# Check permissions
ACL DRYRUN alice GET cache:foo

# Load ACL from file
ACL LOAD

# Save ACL to file
ACL SAVE

# View ACL log (denied commands)
ACL LOG [count | RESET]
```

## Consequences

### Positive
- **Fine-grained control**: Per-user command and key restrictions
- **Redis compatible**: Existing ACL configs work
- **Audit logging**: Track denied access attempts
- **Multiple passwords**: Rotate without downtime
- **Key patterns**: Wildcard matching for namespacing
- **Category shortcuts**: @read, @write, etc. for easy setup

### Negative
- **Configuration complexity**: ACL syntax has learning curve
- **Performance overhead**: Permission check on every command
- **Management burden**: More users = more to manage
- **Default-deny pitfalls**: Easy to lock yourself out

### Trade-offs
- **Caching**: Cache permission checks (invalidate on ACL change)
- **Strictness**: Deny by default vs allow by default
- **Granularity**: Per-key vs per-pattern permissions

## Implementation Notes

Key files:
- `src/auth/mod.rs` - Authentication subsystem
- `src/auth/acl.rs` - ACL management
- `src/auth/user.rs` - User model
- `src/auth/password.rs` - Password hashing (Argon2)
- `src/auth/permissions.rs` - Permission checking
- `src/commands/handlers/acl.rs` - ACL commands

Password hashing:
```rust
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};

pub fn hash_password(password: &str) -> String {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2.hash_password(password.as_bytes(), &salt)
        .unwrap()
        .to_string()
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    let parsed = PasswordHash::new(hash).unwrap();
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}
```

Permission check hot path:
```rust
impl AclManager {
    #[inline]
    pub fn check_permission(
        &self,
        user: &AclUser,
        cmd: &str,
        keys: &[&[u8]],
    ) -> Result<(), AclError> {
        // 1. Check user is ON
        if !user.flags.contains(UserFlags::ON) {
            return Err(AclError::UserDisabled);
        }

        // 2. Check command permission
        if !user.commands.is_allowed(cmd) {
            return Err(AclError::CommandNotAllowed(cmd.into()));
        }

        // 3. Check key patterns
        for key in keys {
            if !user.keys.iter().any(|p| p.matches(key)) {
                return Err(AclError::KeyNotAllowed(key.to_vec()));
            }
        }

        Ok(())
    }
}
```

Default users:
```
# Default admin (for backwards compatibility)
user default on nopass ~* +@all

# Example restricted user
user readonly on >readonlypass ~* +@read -@admin
```

ACL file format (`users.acl`):
```
user default on nopass ~* +@all
user admin on >$argon2hash ~* +@all
user app on >$argon2hash ~app:* +@read +@write -@admin -@dangerous
user analytics on >$argon2hash ~analytics:* %R~* +@read
```

Configuration:
```toml
[security]
# Require authentication
requirepass = ""  # Empty = no default password

# ACL file location
aclfile = "./users.acl"

# Log denied commands
acl_log_max_entries = 128

# Password hashing
password_hash_algorithm = "argon2"
```

## Security Best Practices

1. **Disable default user** in production
2. **Use strong passwords** (ACL GENPASS)
3. **Principle of least privilege** (minimal permissions)
4. **Separate users** for different apps/services
5. **Monitor ACL LOG** for intrusion attempts
6. **Rotate passwords** regularly
7. **Use TLS** for password transmission

## References

- [Redis ACL](https://redis.io/docs/management/security/acl/)
- [Redis Security](https://redis.io/docs/management/security/)
- [Argon2 Password Hashing](https://www.password-hashing.net/)
- [OWASP Authentication Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
