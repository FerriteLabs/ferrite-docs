---
sidebar_position: 3
maturity: experimental
---

# Cloud Providers

Deploy Ferrite on major cloud platforms.

## AWS

### EC2 Deployment

```bash
# Launch EC2 instance
aws ec2 run-instances \
  --image-id ami-xxxxx \
  --instance-type r6g.xlarge \
  --key-name my-key \
  --security-group-ids sg-xxxxx \
  --user-data file://ferrite-init.sh
```

**ferrite-init.sh:**
```bash
#!/bin/bash
yum install -y docker
systemctl start docker

docker run -d \
  --name ferrite \
  -p 6379:6379 \
  -v /data:/data \
  ferrite/ferrite:latest
```

### Recommended Instance Types

| Workload | Instance Type | vCPUs | Memory | Notes |
|----------|--------------|-------|--------|-------|
| Development | t3.medium | 2 | 4 GB | Burstable |
| Production (small) | r6g.large | 2 | 16 GB | Graviton |
| Production (medium) | r6g.xlarge | 4 | 32 GB | Graviton |
| Production (large) | r6g.2xlarge | 8 | 64 GB | Graviton |
| High performance | r6gd.4xlarge | 16 | 128 GB | NVMe SSD |

### EBS Storage

```bash
# Create EBS volume
aws ec2 create-volume \
  --availability-zone us-east-1a \
  --size 100 \
  --volume-type gp3 \
  --iops 3000 \
  --throughput 125

# Attach to instance
aws ec2 attach-volume \
  --device /dev/sdf \
  --instance-id i-xxxxx \
  --volume-id vol-xxxxx
```

### EKS Deployment

```yaml
# ferrite-eks.yaml
apiVersion: ferrite.io/v1
kind: FerriteCluster
metadata:
  name: ferrite-prod
spec:
  replicas: 3
  resources:
    requests:
      cpu: "2"
      memory: "8Gi"
    limits:
      cpu: "4"
      memory: "16Gi"
  persistence:
    storageClassName: gp3
    size: 100Gi
```

```bash
# Deploy
kubectl apply -f ferrite-eks.yaml
```

### Elasticache Alternative

Ferrite can replace Amazon ElastiCache for Redis:

| Feature | ElastiCache | Ferrite |
|---------|------------|---------|
| Redis compatibility | ✅ | ✅ |
| Vector search | ❌ | ✅ |
| Document store | ❌ | ✅ |
| Cost | $0.017/hr (r6g.large) | EC2 cost only |

## Google Cloud

### Compute Engine

```bash
# Create VM
gcloud compute instances create ferrite-1 \
  --machine-type=e2-standard-4 \
  --image-family=debian-11 \
  --image-project=debian-cloud \
  --boot-disk-size=100GB \
  --boot-disk-type=pd-ssd

# SSH and install
gcloud compute ssh ferrite-1
```

### Recommended Machine Types

| Workload | Machine Type | vCPUs | Memory |
|----------|-------------|-------|--------|
| Development | e2-medium | 2 | 4 GB |
| Production (small) | n2-highmem-2 | 2 | 16 GB |
| Production (medium) | n2-highmem-4 | 4 | 32 GB |
| Production (large) | n2-highmem-8 | 8 | 64 GB |

### GKE Deployment

```yaml
# ferrite-gke.yaml
apiVersion: ferrite.io/v1
kind: FerriteCluster
metadata:
  name: ferrite-prod
spec:
  replicas: 3
  resources:
    requests:
      cpu: "2"
      memory: "8Gi"
  persistence:
    storageClassName: standard-rwo
    size: 100Gi
```

```bash
# Deploy
kubectl apply -f ferrite-gke.yaml
```

### Memorystore Alternative

Ferrite vs Google Cloud Memorystore:

| Feature | Memorystore | Ferrite |
|---------|------------|---------|
| Redis compatibility | ✅ | ✅ |
| Vector search | ❌ | ✅ |
| Graph database | ❌ | ✅ |
| Self-managed | ❌ | ✅ |

## Azure

### Virtual Machines

```bash
# Create VM
az vm create \
  --resource-group myResourceGroup \
  --name ferrite-1 \
  --image UbuntuLTS \
  --size Standard_E4s_v3 \
  --admin-username azureuser \
  --generate-ssh-keys
```

### Recommended VM Sizes

| Workload | Size | vCPUs | Memory |
|----------|------|-------|--------|
| Development | Standard_B2s | 2 | 4 GB |
| Production (small) | Standard_E2s_v3 | 2 | 16 GB |
| Production (medium) | Standard_E4s_v3 | 4 | 32 GB |
| Production (large) | Standard_E8s_v3 | 8 | 64 GB |

### AKS Deployment

```yaml
# ferrite-aks.yaml
apiVersion: ferrite.io/v1
kind: FerriteCluster
metadata:
  name: ferrite-prod
spec:
  replicas: 3
  resources:
    requests:
      cpu: "2"
      memory: "8Gi"
  persistence:
    storageClassName: managed-premium
    size: 100Gi
```

```bash
# Deploy
kubectl apply -f ferrite-aks.yaml
```

### Azure Cache Alternative

Ferrite vs Azure Cache for Redis:

| Feature | Azure Cache | Ferrite |
|---------|------------|---------|
| Redis compatibility | ✅ | ✅ |
| Time-series | ❌ | ✅ |
| Full-text search | ❌ | ✅ |
| Cost control | ❌ | ✅ |

## Terraform

### AWS Module

```hcl
# main.tf
module "ferrite" {
  source = "github.com/ferrite/terraform-aws-ferrite"

  cluster_name = "ferrite-prod"
  instance_type = "r6g.xlarge"
  node_count = 3

  vpc_id = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  ebs_volume_size = 100
  ebs_volume_type = "gp3"

  tags = {
    Environment = "production"
  }
}
```

### GCP Module

```hcl
module "ferrite" {
  source = "github.com/ferrite/terraform-gcp-ferrite"

  cluster_name = "ferrite-prod"
  machine_type = "n2-highmem-4"
  node_count = 3

  network = module.vpc.network_name
  subnetwork = module.vpc.subnets[0]

  disk_size_gb = 100
  disk_type = "pd-ssd"
}
```

### Azure Module

```hcl
module "ferrite" {
  source = "github.com/ferrite/terraform-azure-ferrite"

  cluster_name = "ferrite-prod"
  vm_size = "Standard_E4s_v3"
  node_count = 3

  resource_group_name = azurerm_resource_group.main.name
  virtual_network_name = module.vnet.name
  subnet_id = module.vnet.subnet_ids[0]

  disk_size_gb = 100
  disk_type = "Premium_LRS"
}
```

## Cost Comparison

### Monthly Estimates (3-node HA cluster)

| Provider | Instance | Storage | Total |
|----------|----------|---------|-------|
| AWS (r6g.xlarge) | $300 | $30 | ~$330 |
| GCP (n2-highmem-4) | $350 | $25 | ~$375 |
| Azure (E4s_v3) | $340 | $35 | ~$375 |

### vs Managed Redis Services

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| ElastiCache (r6g.xlarge) | ~$370 | No vector search |
| Memorystore (M2) | ~$400 | No advanced features |
| Azure Cache (P2) | ~$420 | Limited features |
| **Ferrite (self-hosted)** | ~$330 | Full features |

## Network Configuration

### Security Groups (AWS)

```hcl
resource "aws_security_group" "ferrite" {
  name = "ferrite-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port = 6379
    to_port = 6379
    protocol = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  ingress {
    from_port = 16379
    to_port = 16379
    protocol = "tcp"
    self = true  # Cluster bus
  }

  egress {
    from_port = 0
    to_port = 0
    protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### Private Link

```hcl
# AWS PrivateLink
resource "aws_vpc_endpoint" "ferrite" {
  vpc_id = var.vpc_id
  service_name = "com.amazonaws.vpce.${var.region}.ferrite"
  vpc_endpoint_type = "Interface"
  subnet_ids = var.subnet_ids
}
```

## Best Practices

1. **Use private subnets** - No public internet access
2. **Enable encryption** - TLS and at-rest encryption
3. **Multi-AZ deployment** - High availability
4. **Use managed disks** - Better IOPS, snapshots
5. **Configure backups** - Cross-region replication
6. **Monitor costs** - Use reserved instances for savings

## Next Steps

- [Docker](/docs/deployment/docker) - Container deployment
- [Kubernetes](/docs/deployment/kubernetes) - K8s deployment
- [High Availability](/docs/deployment/high-availability) - HA patterns
