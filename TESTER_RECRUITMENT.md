# Ferrite External Tester Recruitment

Maintainer playbook for recruiting the next candidate/hardening validation
cohort. The target is **8–12 testers**: enough diversity to reveal recurring
friction while remaining small enough for responsive triage.

Registration is open for interest only. Hands-on testing must not begin until
the campaign owner publishes and clean-machine verifies both an exact
`CAMPAIGN_OPS_COMMIT` (the full 40-character lowercase ferrite-ops commit SHA;
never a tag or a branch) and an exact, complete digest `FERRITE_TEST_IMAGE`
(`repository@sha256:<digest>`; never a tag). Campaign builds are for
disposable, non-production testing with synthetic data.

The public documentation site does not advertise the tester program at all
until `TESTER_INTEREST_OPEN=true` is set for its build (see the
[Launch checklist](#launch-checklist)); the default build has no announcement
bar, no navbar entry, and no footer registration call to action.

Do not copy tester names, email addresses, private messages, availability, or
other personal data into this repository. Use the public Tester Interest form
(`<PUBLISHED_TESTER_INTEREST_URL>`, published alongside the core tester
intake — see the [Launch checklist](#launch-checklist)) as the intake and
question channel for the tester program. Handle any necessary private
coordination outside Git.

## Screening questions

Use these to balance the cohort, not to collect unnecessary personal details:

1. Which disposable environment can you use? The initial cohort is
   Docker/Compose only; alternative environments (Homebrew, source, Kubernetes)
   are deferred until maintained tooling exists for them.
2. Which Redis client or application can you safely exercise?
3. Which track best matches your experience: compatibility,
   operations/metrics, performance comparison, IDE tooling, or an
   owner-enabled durability diagnostic?
4. Can you reserve one uninterrupted 60–90 minute session during the campaign?
5. Will you use only the exact campaign artifact and review/redact all shared
   diagnostics?

Favor a mix of operating systems, architectures, clients, and experience
levels. Do not require employer, demographic, or production-system details.

## Interest announcement

Use this announcement to recruit interest for the **next validation cohort**,
not to tell people that testing is immediately available. Replace
`<PUBLISHED_TESTER_PROGRAM_URL>` and `<PUBLISHED_TESTER_INTEREST_URL>` with
the real published URLs once the core intake in `ferrite` is merged (see the
[Launch checklist](#launch-checklist)) — do not send either placeholder as a
literal link.

> **Interested in helping harden the next Ferrite candidate?**
>
> Registration is open for interest only for a focused cohort of 8–12
> developers.
> Once the campaign passes its launch gate, the core session will take 60–90
> minutes in a disposable environment and cover deployment, compatibility
> smoke checks, safe diagnostics, and structured feedback.
>
> No hands-on testing is open yet. Before a session begins, we will publish an
> exact ferrite-ops commit SHA and an exact, complete candidate image
> digest, verify both on a clean machine, and send launch instructions. We
> welcome honest results, including successful sessions; participation is not
> a production-readiness endorsement.
>
> Read the [Tester Program](<PUBLISHED_TESTER_PROGRAM_URL>)
> and [register interest or ask a question](<PUBLISHED_TESTER_INTEREST_URL>).

Short form for community channels:

> Registration is open for interest only for Ferrite's next 8–12-person
> candidate hardening cohort. The later session will take 60–90 minutes in a
> disposable environment.
> Testing is not open until the exact tooling commit and image digest pass a
> clean-machine preflight. Details:
> <PUBLISHED_TESTER_PROGRAM_URL>
>
> Interest/questions:
> <PUBLISHED_TESTER_INTEREST_URL>

## Campaign launch invitation

Do not send this invitation with placeholders. Every hands-on invitation must
contain both immutable references, and `FERRITE_TEST_IMAGE` must be the
complete digest reference actually being used for the campaign — never a
tag and never a literal placeholder token:

> **Ferrite candidate validation campaign is ready**
>
> The campaign launch gate has passed on a clean machine. Use only these exact
> references:
>
> - `CAMPAIGN_OPS_COMMIT=<the exact full 40-character lowercase commit SHA verified for this campaign>`
> - `FERRITE_TEST_IMAGE=<the exact repository@sha256:digest verified for this campaign>`
>
> Clone ferrite-ops, run `git checkout --detach <CAMPAIGN_OPS_COMMIT>`, confirm
> `git rev-parse HEAD` matches it exactly, verify `scripts/tester.sh` exists,
> export `FERRITE_TEST_IMAGE`, then run the required `start`, `smoke`,
> `diagnostics`, and `stop` commands from the
> [Tester Program](<PUBLISHED_TESTER_PROGRAM_URL>).
> Never substitute `main`, a tag, `latest`, or a local build. Record both exact
> values in the report.
>
> Do not run durability unless the campaign owner separately states
> `FERRITE_TEST_ENABLE_DURABILITY=1`. Questions belong in the
> [Tester Interest form](<PUBLISHED_TESTER_INTEREST_URL>).

## Triage and response

- Assign one named triage owner and one backup before recruitment starts.
- Acknowledge reports within three business days; state clearly that this is a
  target, not a contractual support SLA.
- Stop the campaign for a credible Critical report until it is understood.
- Give every High report an owner and disposition before cohort completion.
- Ask for the smallest reproduction first; request a redacted archive only
  when it changes the investigation.
- For security findings, stop public discussion and report them privately
  using [GitHub private vulnerability reporting](https://github.com/ferritelabs/ferrite/security/advisories/new),
  as described in the canonical
  [Security Policy](https://github.com/ferritelabs/ferrite/blob/main/SECURITY.md#reporting-a-vulnerability).
- Publish recurring setup issues or limitations in canonical documentation so
  each tester does not rediscover them.

## Launch checklist

### Before outreach

Complete these steps, in order, before any interest announcement or hands-on
invitation goes out:

1. [ ] **Core intake:** merge and publish the canonical Tester Program,
       `tester_interest.yml`, `tester_report.yml`, issue-template configuration,
       and security guidance in `ferrite`.
2. [ ] **Ops tooling:** merge and publish `docker-compose.tester.yml`,
       `scripts/tester.sh`, `scripts/tester-host-probe.py`, their tests, and
       campaign documentation in `ferrite-ops`; record the exact
       `CAMPAIGN_OPS_COMMIT` (full 40-character lowercase commit SHA).
3. [ ] **Candidate image:** publish the exact, complete candidate image digest
       (`repository@sha256:<digest>`; never a tag) and record it as
       `FERRITE_TEST_IMAGE`.
4. [ ] **Clean-machine preflight:** run `git checkout --detach
       <CAMPAIGN_OPS_COMMIT>`, confirm `git rev-parse HEAD` matches it
       exactly, verify `scripts/tester.sh`, pull `FERRITE_TEST_IMAGE`, and
       pass start/smoke/diagnostics/stop (including the host reachability
       probe `start` runs). Enable durability only when explicitly governed
       for this campaign.
5. [ ] Assign the triage owner, backup, and three-business-day response target.
6. [x] **Private security intake:** GitHub private vulnerability reporting is
       enabled and verified for the `ferrite` repository:
       https://github.com/ferritelabs/ferrite/security/advisories/new
7. [ ] Optionally create labels/views for tester interest, passing reports, and
       findings; title prefixes remain the required baseline.
8. [ ] **Docs and outreach:** merge/publish the public tester page and the
       core intake from step 1, resolving `<PUBLISHED_TESTER_PROGRAM_URL>` and
       `<PUBLISHED_TESTER_INTEREST_URL>` to their real URLs, then post the
       interest announcement.
9. [ ] **Publication gate:** set `TESTER_INTEREST_OPEN=true` for the
       documentation site build **only after** steps 1 (core intake) and 2
       (ops tooling) are merged and published and step 4 (clean-machine
       preflight) passes. Until then the site must build with the gate off, so
       no announcement bar, navbar entry, or footer registration call to
       action recruits testers who cannot yet act on it. The enabled call to
       action stays interest-only and version-neutral: it never names a
       release and never claims hands-on testing is available.

### During recruitment

- [ ] Select **8–12 testers** with useful environment/client/track coverage.
- [ ] Send hands-on invitations to selected testers only; every invitation
      must contain the exact, complete digest-bearing `FERRITE_TEST_IMAGE`
      (never a tag or a placeholder) and the verified `CAMPAIGN_OPS_COMMIT`
      (full 40-character lowercase commit SHA).

### During campaign

- [ ] Monitor completion and pause immediately for a credible Critical finding.

### Cohort closeout

- [ ] Close the cohort against the success criteria in `TESTER_PROGRAM.md`.
- [ ] Publish known limitations and thank participants without exposing personal
      data or private correspondence.
