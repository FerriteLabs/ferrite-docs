# Ferrite v0.4 Tester Recruitment

Maintainer playbook for recruiting and supporting the first external tester
cohort. The target is **8–12 testers**: enough diversity to reveal recurring
friction while remaining small enough for responsive triage.

Ferrite v0.4 and campaign artifacts are not promised to be production-ready.
Recruit only for disposable, non-production testing with synthetic data.
Do not copy tester names, email addresses, private messages, availability, or
other personal data into this repository. Keep public participation in the
GitHub issue forms and handle any necessary private coordination outside Git.

## Screening questions

Use these to balance the cohort, not to collect unnecessary personal details:

1. Which disposable environment can you use: Docker/Compose, Homebrew, source,
   or Kubernetes?
2. Which Redis client or application can you safely exercise?
3. Which track best matches your experience: compatibility,
   durability/restart, operations/metrics, performance comparison, or IDE
   tooling?
4. Can you reserve one uninterrupted 60–90 minute session during the campaign?
5. Do you acknowledge that the build is pre-release, non-production software
   and that all submitted diagnostics must be reviewed and redacted?

Favor a mix of operating systems, architectures, clients, and experience
levels. Do not require employer, demographic, or production-system details.

## Copy templates

Replace `<CAMPAIGN WINDOW>` and `<EXACT IMAGE OR DIGEST>` before posting.

### GitHub Discussion

> **Help test Ferrite v0.4**
>
> We are recruiting 8–12 developers for a focused external testing cohort
> during `<CAMPAIGN WINDOW>`. The core session takes 60–90 minutes and covers
> an isolated Docker Compose deployment, compatibility smoke checks,
> durability, safe diagnostics, and structured feedback.
>
> This is pre-release software for disposable, non-production environments
> only. Use synthetic data and the exact campaign artifact
> `<EXACT IMAGE OR DIGEST>`—never `latest`. We are looking for honest results,
> including successful sessions; participation is not a production-readiness
> endorsement.
>
> Read the [Tester Program](https://github.com/ferritelabs/ferrite/blob/main/TESTER_PROGRAM.md)
> and [register interest](https://github.com/ferritelabs/ferrite/issues/new?template=tester_interest.yml).

### Discord or Reddit

> Ferrite v0.4 needs 8–12 external testers for a 60–90 minute,
> non-production session. If you can try a Redis client, restart/durability,
> metrics, a small performance comparison, or IDE tooling in a disposable
> environment, please read:
> https://github.com/ferritelabs/ferrite/blob/main/TESTER_PROGRAM.md
>
> Expect pre-release rough edges; no production-readiness claims or production
> data. Interest form:
> https://github.com/ferritelabs/ferrite/issues/new?template=tester_interest.yml

### Direct invite

> Hi—your experience with `<CLIENT / ENVIRONMENT>` could help us evaluate
> Ferrite v0.4. Would you be willing to spend 60–90 minutes on a disposable,
> non-production test during `<CAMPAIGN WINDOW>`?
>
> We will provide one exact image tag or digest, a one-command environment,
> safe diagnostic guidance, and a structured report form. This is pre-release
> testing, not a claim that Ferrite is production-ready, and there is no
> expectation to use real data. Details:
> https://github.com/ferritelabs/ferrite/blob/main/TESTER_PROGRAM.md

## Triage and response suggestions

- Assign one named triage owner and one backup before recruitment starts.
- Acknowledge reports within three business days; state clearly that this is a
  target, not a contractual support SLA.
- Stop the campaign for a credible Critical report until it is understood.
- Give every High report an owner and disposition before cohort completion.
- Ask for the smallest reproduction first; request a redacted archive only
  when it changes the investigation.
- Move security reports immediately to a private advisory and remove sensitive
  public details where possible.
- Publish recurring setup issues or limitations in canonical documentation so
  each tester does not rediscover them.

## Launch checklist

- [ ] Publish the exact `0.4.0` image or RC digest and verify it can be pulled.
- [ ] Confirm `docker-compose.tester.yml` renders and all `tester.sh` commands
      work against that artifact on a clean machine.
- [ ] Review the canonical Tester Program, public tester page, interest form,
      and report form for consistent links and wording.
- [ ] Enable GitHub Discussions or select a replacement public question channel.
- [ ] Assign the triage owner, backup, and three-business-day response target.
- [ ] Prepare labels/views for tester interest, passing reports, and findings.
- [ ] Post recruitment copy with the campaign window and exact artifact filled in.
- [ ] Select 8–12 testers with useful environment/client/track coverage.
- [ ] Monitor completion and pause immediately for a credible Critical finding.
- [ ] Close the cohort against the success criteria in `TESTER_PROGRAM.md`.
- [ ] Publish known limitations and thank participants without exposing personal
      data or private correspondence.
