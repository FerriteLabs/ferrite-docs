---
sidebar_position: 4
description: Comprehensive encryption capabilities to protect data at rest and in transit, including TLS, at-rest encryption, and key management.
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Encryption

Ferrite provides comprehensive encryption capabilities to protect data at rest and in transit.

## Overview

Ferrite supports multiple layers of encryption:

| Layer | Protection | Method |
|-------|------------|--------|
| TLS | Data in transit | TLS 1.3 |
| At-Rest | Data on disk | AES-256-GCM |
| Field-Level | Sensitive fields | Application-managed |

## TLS Encryption (In Transit)

### Configuring TLS

```toml
# ferrite.toml
[tls]
enabled = true
port = 6380
cert_file = "/etc/ferrite/certs/server.crt"
key_file = "/etc/ferrite/certs/server.key"
ca_file = "/etc/ferrite/certs/ca.crt"  # For client verification

# TLS options
min_version = "1.2"  # Minimum TLS version
prefer_server_ciphers = true
```

### Generating Self-Signed Certificates

For development and testing, generate a CA and server/client certificates:

```bash
# Generate CA
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 365 -key ca.key -out ca.crt \
  -subj "/CN=Ferrite CA"

# Generate server certificate with SANs
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr \
  -subj "/CN=ferrite.example.com"

cat > server-ext.cnf <<EOF
[v3_req]
subjectAltName = @alt_names
[alt_names]
DNS.1 = localhost
DNS.2 = ferrite.example.com
IP.1 = 127.0.0.1
EOF

openssl x509 -req -days 365 -in server.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt \
  -extfile server-ext.cnf -extensions v3_req

# Generate client certificate (for mutual TLS)
openssl genrsa -out client.key 2048
openssl req -new -key client.key -out client.csr \
  -subj "/CN=ferrite-client"
openssl x509 -req -days 365 -in client.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt
```

If you're using Docker, a helper script is provided:

```bash
# From the ferrite-ops repository
./docker/generate-certs.sh
```

### Let's Encrypt with cert-manager (Kubernetes)

For production Kubernetes deployments, use [cert-manager](https://cert-manager.io/) for automatic certificate management:

1. **Install cert-manager** (if not already installed):

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

2. **Create a ClusterIssuer**:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

3. **Enable in Helm values**:

```yaml
tls:
  enabled: true
  certManager:
    enabled: true
    issuerRef:
      name: letsencrypt-prod
      kind: ClusterIssuer
```

cert-manager will automatically provision and renew TLS certificates for the Ferrite deployment.

### Helm Chart TLS Configuration

The Ferrite Helm chart supports three TLS modes:

#### Using an existing secret

```yaml
tls:
  enabled: true
  existingSecret: my-tls-secret
```

#### Providing certificate data directly

```yaml
tls:
  enabled: true
  certificate: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  privateKey: |
    -----BEGIN PRIVATE KEY-----
    ...
    -----END PRIVATE KEY-----
```

#### Using cert-manager (recommended for production)

```yaml
tls:
  enabled: true
  certManager:
    enabled: true
    issuerRef:
      name: letsencrypt-prod
      kind: ClusterIssuer
```

### Mutual TLS (mTLS)

Enable client certificate verification for zero-trust environments:

```toml
[tls]
enabled = true
cert_file = "/etc/ferrite/certs/server.crt"
key_file = "/etc/ferrite/certs/server.key"
ca_file = "/etc/ferrite/certs/ca.crt"
require_client_cert = true
```

In Kubernetes via Helm:

```yaml
tls:
  enabled: true
  clientCA: |
    -----BEGIN CERTIFICATE-----
    ... (CA certificate that signed client certs) ...
    -----END CERTIFICATE-----
  certManager:
    enabled: true
    issuerRef:
      name: letsencrypt-prod
      kind: ClusterIssuer
```

### Docker Compose with TLS

Use the TLS overlay for Docker Compose:

```bash
# Generate test certificates
./docker/generate-certs.sh

# Start with TLS enabled
docker compose -f docker-compose.yml -f docker/docker-compose.tls.yml up -d
```

### Testing TLS Connectivity

```bash
# Basic TLS connection
redis-cli --tls --cacert /path/to/ca.crt -h ferrite.example.com -p 6380 PING

# mTLS connection (with client certificate)
redis-cli --tls \
  --cacert /path/to/ca.crt \
  --cert /path/to/client.crt \
  --key /path/to/client.key \
  -h ferrite.example.com -p 6380 PING

# Verify TLS with openssl
openssl s_client -connect ferrite.example.com:6380 \
  -CAfile /path/to/ca.crt -brief
```

### Connecting with TLS

```bash
# redis-cli with TLS
redis-cli --tls --cacert /path/to/ca.crt -h ferrite.example.com -p 6380
```

```rust
// Rust client with TLS (redis crate)
use redis::Client;

let client = Client::open("rediss://ferrite.example.com:6380")?;
```

```python
# Python client with TLS
import redis

client = redis.Redis(
    host='ferrite.example.com',
    port=6380,
    ssl=True,
    ssl_ca_certs='/path/to/ca.crt',
)
```

## At-Rest Encryption

### Enabling At-Rest Encryption

```toml
[encryption]
enabled = true
algorithm = "aes256gcm"  # aes256gcm or chacha20poly1305
key_file = "/etc/ferrite/encryption.key"
encrypt_aof = true
encrypt_rdb = true
encrypt_checkpoints = true
```

### Generating Encryption Keys

```bash
# Generate a 256-bit key
openssl rand -base64 32 > /etc/ferrite/encryption.key
chmod 600 /etc/ferrite/encryption.key
```

### Key Rotation

Ferrite supports online key rotation:

```bash
# Generate new key
openssl rand -base64 32 > /etc/ferrite/encryption-new.key

# Initiate rotation
ferrite-cli CONFIG SET encryption.new_key_file /etc/ferrite/encryption-new.key
ferrite-cli ENCRYPTION ROTATE

# Monitor progress
ferrite-cli ENCRYPTION STATUS
# Output: rotation_progress: 45%, keys_rotated: 1234567
```

### What Gets Encrypted

| Component | Encrypted | Notes |
|-----------|-----------|-------|
| AOF files | Yes | Entire file encrypted |
| Checkpoints | Yes | Each checkpoint encrypted |
| Warm tier (mmap) | Yes | Pages encrypted |
| Cold tier (disk) | Yes | Blocks encrypted |
| Replication stream | Yes | Via TLS |
| Backups | Yes | If encryption enabled |

## Key Management

### Key Providers

#### File Provider (Development)

```toml
[encryption.file]
key_file = "/etc/ferrite/encryption.key"
```

#### HashiCorp Vault

```toml
[encryption.vault]
address = "https://vault.example.com:8200"
auth_method = "kubernetes"  # token, kubernetes, aws
role = "ferrite"
key_path = "transit/keys/ferrite"
```

#### AWS KMS

```toml
[encryption.kms]
region = "us-east-1"
key_id = "arn:aws:kms:us-east-1:123456789:key/abc-123"
# Uses IAM role or environment credentials
```

#### Google Cloud KMS

```toml
[encryption.gcp_kms]
project = "my-project"
location = "us-east1"
keyring = "ferrite"
key = "encryption-key"
```

#### Azure Key Vault

```toml
[encryption.azure_kv]
vault_url = "https://ferrite-vault.vault.azure.net"
key_name = "ferrite-encryption-key"
```

### Key Hierarchy

Ferrite uses a two-tier key hierarchy:

```
Master Key (KEK - Key Encryption Key)
    │
    ├── Data Key 1 (DEK) - encrypts hot tier
    ├── Data Key 2 (DEK) - encrypts AOF
    ├── Data Key 3 (DEK) - encrypts checkpoints
    └── Data Key N (DEK) - per-tenant keys
```

## Field-Level Encryption

For sensitive data requiring application-level encryption:

```rust
use ferrite::crypto::{encrypt_field, decrypt_field};

// Encrypt sensitive data before storing
let ssn = "123-45-6789";
let encrypted = encrypt_field(ssn, &encryption_key)?;
client.hset("user:123", "ssn", &encrypted).await?;

// Decrypt when reading
let encrypted: String = client.hget("user:123", "ssn").await?;
let ssn = decrypt_field(&encrypted, &encryption_key)?;
```

### Client-Side Encryption Helper

```rust
use ferrite::Client;
use ferrite::crypto::EncryptedClient;

// Wrap client with encryption
let client = Client::connect("localhost:6380").await?;
let encrypted_client = EncryptedClient::new(client, encryption_key);

// Automatically encrypts/decrypts specified fields
encrypted_client
    .with_encrypted_fields(&["ssn", "credit_card", "password"])
    .hset("user:123", "ssn", "123-45-6789")
    .await?;
```

## Encryption Performance

### Benchmarks

| Operation | No Encryption | AES-256-GCM | Overhead |
|-----------|---------------|-------------|----------|
| SET (1KB) | 450K ops/sec | 420K ops/sec | ~7% |
| GET (1KB) | 520K ops/sec | 485K ops/sec | ~7% |
| SET (10KB) | 180K ops/sec | 165K ops/sec | ~8% |
| GET (10KB) | 210K ops/sec | 190K ops/sec | ~10% |

### Hardware Acceleration

Ferrite automatically uses AES-NI instructions when available:

```bash
# Check for AES-NI support
grep aes /proc/cpuinfo

# Verify Ferrite is using hardware acceleration
ferrite-cli INFO encryption
# hardware_acceleration: true
```

## Compliance

### Audit Logging

All encryption operations are logged:

```toml
[audit]
enabled = true
log_encryption_operations = true
```

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "event": "key_rotation_started",
  "old_key_id": "key-v1",
  "new_key_id": "key-v2",
  "initiated_by": "admin"
}
```

### Compliance Standards

Ferrite's encryption meets:

- **PCI DSS**: AES-256 for cardholder data
- **HIPAA**: Encryption for PHI at rest and in transit
- **SOC 2**: Encryption controls for Type II
- **GDPR**: Technical measures for data protection

## Troubleshooting

### Common Issues

#### Encryption key not found

```
Error: Encryption key file not found: /etc/ferrite/encryption.key
```

**Solution**: Ensure key file exists and has correct permissions (600).

#### TLS handshake failed

```
Error: TLS handshake failed: certificate verify failed
```

**Solution**: Verify CA certificate is correct and trusted.

#### Key rotation stuck

```bash
# Check rotation status
ferrite-cli ENCRYPTION STATUS

# If stuck, force completion
ferrite-cli ENCRYPTION ROTATE FORCE
```

## Best Practices

1. **Use Hardware Security Modules (HSM)** for production master keys
2. **Rotate keys regularly** (at least annually)
3. **Enable mTLS** for client authentication
4. **Separate encryption keys** per environment
5. **Back up keys securely** before rotation
6. **Monitor key usage** through audit logs
7. **Test recovery procedures** with encrypted backups

## See Also

- [Security Guide](/docs/advanced/security)
- [TLS Configuration](/docs/reference/configuration#tls-section)
- [Compliance](/docs/operations/audit-logging)
