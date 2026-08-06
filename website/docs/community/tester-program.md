---
sidebar_position: 1
title: Test Ferrite
description: Register interest in the next Ferrite candidate hardening campaign.
keywords: [ferrite, external testing, redis compatibility, hardening]
---

# Ferrite External Tester Program

Ferrite is gathering interest for a small cohort of developers who can spend
60–90 minutes validating a specific candidate build in a disposable
environment. The campaign will focus on setup, Redis-client compatibility,
operations, safe diagnostics, performance comparisons, and IDE tooling.

Registration is open for interest only. This is a **Docker/Docker Compose-only,
non-production initial cohort**; alternative installation cohorts are deferred
until maintained tooling exists. Registering interest does not mean testing can
begin. Use only disposable infrastructure and synthetic data once a campaign
launches.

The [canonical Tester Program](https://github.com/ferritelabs/ferrite/blob/main/TESTER_PROGRAM.md)
contains the authoritative journey, safety rules, expected outcomes, severity
definitions, privacy guidance, and completion criteria.

## Launch gate

Hands-on testing must not start until the campaign owner supplies both:

1. `CAMPAIGN_OPS_REF` — an immutable ferrite-ops tag or full commit SHA that
   contains `scripts/tester.sh`; never `main` or another floating branch.
2. `FERRITE_TEST_IMAGE` — the exact immutable candidate image digest, or a
   governed non-floating tag; never `latest`.

The owner must verify both references with a clean-machine preflight before
inviting the cohort to begin. Testers must also confirm that the ops reference
checks out, the script exists, and the image pulls. If either reference is
missing or fails verification, stop and wait for corrected campaign details.

## Campaign quick start

Do not run this until the owner has supplied values for both placeholders and
confirmed the launch gate passed:

```bash
git clone https://github.com/ferritelabs/ferrite-ops.git
cd ferrite-ops
git checkout <CAMPAIGN_OPS_REF>
test -x scripts/tester.sh && ./scripts/tester.sh --help >/dev/null || {
  echo "scripts/tester.sh is missing or not runnable at <CAMPAIGN_OPS_REF>" >&2
  exit 1
}
export FERRITE_TEST_IMAGE='<CAMPAIGN_IMAGE_DIGEST>'
./scripts/tester.sh start
./scripts/tester.sh smoke
./scripts/tester.sh diagnostics
./scripts/tester.sh stop
```

There are no campaign defaults. Replace `<CAMPAIGN_OPS_REF>` and
`<CAMPAIGN_IMAGE_DIGEST>` only with the exact values published by the campaign
owner.

Durability/restart is an optional, campaign-specific diagnostic because current
candidate images may not persist data across restart. Run
`FERRITE_TEST_ENABLE_DURABILITY=1 ./scripts/tester.sh durability` only when the
campaign owner explicitly enables it; durability is not part of the required
core path or a core expected pass.

Other optional tracks include Redis/client compatibility, operations/metrics,
performance comparison, and IDE tooling. Every optional track, including IDE
tooling, connects to the same running Docker Compose instance.

## Interest, questions, and reports

- [Register interest or ask a program question](https://github.com/ferritelabs/ferrite/issues/new?template=tester_interest.yml)
- [Submit a completed session](https://github.com/ferritelabs/ferrite/issues/new?template=tester_report.yml)
- [Review open issues and known limitations](https://github.com/ferritelabs/ferrite/issues?q=is%3Aissue+is%3Aopen)
- Report vulnerabilities privately using
  [GitHub private vulnerability reporting](https://github.com/ferritelabs/ferrite/security/advisories/new),
  as described in the canonical
  [Security Policy](https://github.com/ferritelabs/ferrite/blob/main/SECURITY.md#reporting-a-vulnerability)

The interest issue is the intake and question channel for the tester program.
Do not disclose a vulnerability or sensitive data in a public issue.

Review diagnostic archives before sharing them. Do not post credentials,
personal data, customer data, private addresses, full configuration, or other
sensitive information.
