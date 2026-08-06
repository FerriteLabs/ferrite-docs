---
sidebar_position: 1
title: Test Ferrite
description: Join the Ferrite v0.4 external tester cohort in a safe, disposable environment.
keywords: [ferrite, external testing, redis compatibility, v0.4]
---

# Test Ferrite v0.4

Ferrite is recruiting a small cohort of developers to spend 60–90 minutes
testing v0.4 before broader release. The goal is practical feedback on setup,
Redis-client compatibility, durability, operations, performance comparisons,
and IDE tooling.

This campaign is **non-production only**. Use disposable infrastructure and
synthetic data, expect rough edges, and use only the exact immutable image tag
or digest provided for the campaign—never `latest`. Ferrite is not being
presented as production-ready through this program.

The [canonical Tester Program](https://github.com/ferritelabs/ferrite/blob/main/TESTER_PROGRAM.md)
contains the authoritative journey, safety rules, expected outcomes, severity
definitions, privacy guidance, and completion criteria.

## Quick start

Docker with Docker Compose is the primary path. From a checkout of
[ferrite-ops](https://github.com/ferritelabs/ferrite-ops):

```bash
git clone https://github.com/ferritelabs/ferrite-ops.git
cd ferrite-ops
export FERRITE_TEST_IMAGE='ghcr.io/ferritelabs/ferrite:0.4.0' # or exact campaign digest
./scripts/tester.sh start
./scripts/tester.sh smoke
./scripts/tester.sh durability
./scripts/tester.sh diagnostics
./scripts/tester.sh stop
```

Optional tracks are Redis/client compatibility, durability/restart,
operations/metrics, performance comparison, and IDE tooling. The canonical
program explains how to choose and report a track without duplicating the
procedure here.

## Join or report

- [Register interest](https://github.com/ferritelabs/ferrite/issues/new?template=tester_interest.yml)
- [Submit a completed session](https://github.com/ferritelabs/ferrite/issues/new?template=tester_report.yml)
- [Review open issues and known limitations](https://github.com/ferritelabs/ferrite/issues?q=is%3Aissue+is%3Aopen)
- [Report a security vulnerability privately](https://github.com/ferritelabs/ferrite/security/advisories/new)

Review diagnostic archives before sharing them. Do not post credentials,
personal data, customer data, private addresses, full configuration, or other
sensitive information in a public issue.
