---
sidebar_position: 1
title: Test Ferrite
description: Register interest in the next Ferrite candidate hardening campaign.
keywords: [ferrite, external testing, redis compatibility, hardening]
---

# Ferrite External Tester Program

Ferrite's tester intake is open for a small cohort of developers who can spend
60–90 minutes validating a specific candidate build in a disposable
environment. The campaign will focus on setup, Redis-client compatibility,
operations, safe diagnostics, performance comparisons, and IDE tooling.

**Register interest for the next validation cohort now.** Selected testers
receive both required immutable references after the campaign owner passes the
[launch gate](#launch-gate).

This is a **Docker/Docker Compose-only, non-production initial cohort**;
alternative installation cohorts are deferred until maintained tooling
exists. Do not begin until you receive a campaign invitation. Use only
disposable infrastructure and synthetic data.

The canonical Tester Program is the file `TESTER_PROGRAM.md` at the root of
the [ferrite repository](https://github.com/ferritelabs/ferrite). It contains
the authoritative journey, safety rules, expected outcomes, severity
definitions, privacy guidance, and completion criteria. Open the repository
root and select `TESTER_PROGRAM.md`; the campaign invitation also supplies the
program URL with the campaign's exact references.

## Launch gate

Hands-on testing must not start until the campaign owner supplies both:

1. `CAMPAIGN_OPS_COMMIT` — the full 40-character lowercase ferrite-ops commit
   SHA that contains `scripts/tester.sh`. Only an exact commit SHA is
   accepted: a tag, `main`, another branch, and an abbreviated SHA are all
   rejected, because only a commit SHA is immutable and unambiguous.
2. `FERRITE_TEST_IMAGE` — the complete repository-qualified sha256 digest
   reference for the candidate image (e.g.
   `ghcr.io/ferritelabs/ferrite@sha256:<CAMPAIGN_DIGEST>`); never a tag or
   `latest`.

The owner must verify both references with a clean-machine preflight before
inviting the cohort to begin. Testers must also confirm that the commit checks
out in detached HEAD state, that `git rev-parse HEAD` matches
`CAMPAIGN_OPS_COMMIT` exactly, that the script exists, and that the image
pulls. If either reference is missing or fails verification, stop and wait for
corrected campaign details.

## Campaign quick start

Do not run this until the owner has supplied values for both placeholders and
confirmed the launch gate passed:

```bash
git clone https://github.com/ferritelabs/ferrite-ops.git
cd ferrite-ops
git checkout --detach <CAMPAIGN_OPS_COMMIT>
test "$(git rev-parse HEAD)" = "<CAMPAIGN_OPS_COMMIT>" || {
  echo "HEAD is not <CAMPAIGN_OPS_COMMIT>; stop and re-request the campaign commit" >&2
  exit 1
}
test -x scripts/tester.sh && ./scripts/tester.sh --help >/dev/null || {
  echo "scripts/tester.sh is missing or not runnable at <CAMPAIGN_OPS_COMMIT>" >&2
  exit 1
}
export FERRITE_TEST_IMAGE='ghcr.io/ferritelabs/ferrite@sha256:<CAMPAIGN_DIGEST>'
./scripts/tester.sh start
./scripts/tester.sh smoke
./scripts/tester.sh diagnostics
./scripts/tester.sh stop
```

There are no campaign defaults. Replace `<CAMPAIGN_OPS_COMMIT>` and
`<CAMPAIGN_DIGEST>` only with the exact values published by the campaign
owner. `<CAMPAIGN_OPS_COMMIT>` must be the full 40-character lowercase commit
SHA; substituting a tag or a branch name makes the `git rev-parse HEAD`
comparison fail, which is intended. `FERRITE_TEST_IMAGE` must always be the
complete repository-qualified digest reference shown above — never a bare
digest, a bare placeholder, or a tag. Record both exact values in your
report.

Durability/restart is an optional, campaign-specific diagnostic because current
candidate images may not persist data across restart. Run
`FERRITE_TEST_ENABLE_DURABILITY=1 ./scripts/tester.sh durability` only when the
campaign owner explicitly enables it; durability is not part of the required
core path or a core expected pass.

Other optional tracks include Redis/client compatibility, operations/metrics,
performance comparison, and IDE tooling. Every optional track, including IDE
tooling, connects to the same running Docker Compose instance.

## Interest, questions, and reports

The tester intake is open:

- To register interest or ask a program question, open the
  [issue chooser](https://github.com/ferritelabs/ferrite/issues/new/choose)
  and select **External tester interest**.
- After a session, use the same
  [issue chooser](https://github.com/ferritelabs/ferrite/issues/new/choose)
  and select **External tester report**.
- Browse the [ferrite repository](https://github.com/ferritelabs/ferrite) for
  the canonical `TESTER_PROGRAM.md` and campaign context.
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
