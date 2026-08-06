# Ferrite External Tester Recruitment

Maintainer playbook for recruiting the next candidate/hardening validation
cohort. The target is **8–12 testers**: enough diversity to reveal recurring
friction while remaining small enough for responsive triage.

Recruit interest first. Hands-on testing must not begin until the campaign
owner publishes and clean-machine verifies both an immutable
`CAMPAIGN_OPS_REF` and an exact `FERRITE_TEST_IMAGE`. Campaign builds are for
disposable, non-production testing with synthetic data.

Do not copy tester names, email addresses, private messages, availability, or
other personal data into this repository. Use the public
[Tester Interest form](https://github.com/ferritelabs/ferrite/issues/new?template=tester_interest.yml)
as the temporary intake and question channel until an active community channel
is selected. Handle any necessary private coordination outside Git.

## Screening questions

Use these to balance the cohort, not to collect unnecessary personal details:

1. Which disposable environment can you use: Docker/Compose, Homebrew, source,
   or Kubernetes?
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
not to tell people that testing is immediately available:

> **Interested in helping harden the next Ferrite candidate?**
>
> We are building an interest list for a focused cohort of 8–12 developers.
> Once the campaign passes its launch gate, the core session will take 60–90
> minutes in a disposable environment and cover deployment, compatibility
> smoke checks, safe diagnostics, and structured feedback.
>
> No hands-on testing is open yet. Before a session begins, we will publish an
> immutable ferrite-ops reference and exact candidate image, verify both on a
> clean machine, and send launch instructions. We welcome honest results,
> including successful sessions; participation is not a production-readiness
> endorsement.
>
> Read the [Tester Program](https://github.com/ferritelabs/ferrite/blob/main/TESTER_PROGRAM.md)
> and [register interest or ask a question](https://github.com/ferritelabs/ferrite/issues/new?template=tester_interest.yml).

Short form for community channels:

> Ferrite is gathering interest for the next 8–12-person candidate hardening
> cohort. The later session will take 60–90 minutes in a disposable environment.
> Testing is not open until immutable tooling and image references pass a
> clean-machine preflight. Details:
> https://github.com/ferritelabs/ferrite/blob/main/TESTER_PROGRAM.md
>
> Interest/questions:
> https://github.com/ferritelabs/ferrite/issues/new?template=tester_interest.yml

## Campaign launch invitation

Do not send this invitation with placeholders. Every hands-on invitation must
contain both immutable references:

> **Ferrite candidate validation campaign is ready**
>
> The campaign launch gate has passed on a clean machine. Use only these exact
> references:
>
> - `CAMPAIGN_OPS_REF=<CAMPAIGN_OPS_REF>`
> - `FERRITE_TEST_IMAGE=<CAMPAIGN_IMAGE_DIGEST>`
>
> Clone ferrite-ops, check out `CAMPAIGN_OPS_REF`, verify
> `scripts/tester.sh` exists, export `FERRITE_TEST_IMAGE`, then run the required
> `start`, `smoke`, `diagnostics`, and `stop` commands from the
> [Tester Program](https://github.com/ferritelabs/ferrite/blob/main/TESTER_PROGRAM.md).
> Never substitute `main`, `latest`, or a local build.
>
> Do not run durability unless the campaign owner separately states
> `FERRITE_TEST_ENABLE_DURABILITY=1`. Questions belong in the
> [Tester Interest form](https://github.com/ferritelabs/ferrite/issues/new?template=tester_interest.yml).

## Triage and response

- Assign one named triage owner and one backup before recruitment starts.
- Acknowledge reports within three business days; state clearly that this is a
  target, not a contractual support SLA.
- Stop the campaign for a credible Critical report until it is understood.
- Give every High report an owner and disposition before cohort completion.
- Ask for the smallest reproduction first; request a redacted archive only
  when it changes the investigation.
- For security findings, stop public discussion and follow the canonical
  [Security Policy](https://github.com/ferritelabs/ferrite/blob/main/SECURITY.md#reporting-a-vulnerability)
  or email **security@ferritelabs.dev**. GitHub private vulnerability reporting
  is not currently enabled.
- Publish recurring setup issues or limitations in canonical documentation so
  each tester does not rediscover them.

## Launch checklist

Complete the artifact-dependent steps in this order:

1. [ ] **Core intake:** merge and publish the canonical Tester Program,
       `tester_interest.yml`, `tester_report.yml`, issue-template configuration,
       and security guidance in `ferrite`.
2. [ ] **Ops tooling:** merge and publish `docker-compose.tester.yml`,
       `scripts/tester.sh`, its tests, and campaign documentation in
       `ferrite-ops`; select the immutable `CAMPAIGN_OPS_REF`.
3. [ ] **Candidate image:** publish the exact candidate image digest or governed
       non-floating tag and record it as `FERRITE_TEST_IMAGE`.
4. [ ] **Clean-machine preflight:** check out `CAMPAIGN_OPS_REF`, verify
       `scripts/tester.sh`, pull `FERRITE_TEST_IMAGE`, and pass
       start/smoke/diagnostics/stop. Enable durability only when explicitly
       governed for this campaign.
5. [ ] **Docs and outreach:** merge/publish the public tester page, then post the
       interest announcement and send hands-on invitations containing both
       verified immutable references.

Before outreach also:

- [ ] Assign the triage owner, backup, and three-business-day response target.
- [ ] Verify **security@ferritelabs.dev** is monitored and test its response path.
- [ ] Optionally create labels/views for tester interest, passing reports, and
      findings; title prefixes remain the required baseline.
- [ ] Select **8–12 testers** with useful environment/client/track coverage.
- [ ] Monitor completion and pause immediately for a credible Critical finding.
- [ ] Close the cohort against the success criteria in `TESTER_PROGRAM.md`.
- [ ] Publish known limitations and thank participants without exposing personal
      data or private correspondence.
