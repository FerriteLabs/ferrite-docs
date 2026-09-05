# Clean-Code and Single-Responsibility Audit

## Summary

- BASE-001 adds a runnable Vitest behavior suite and restores the documented typecheck/build gates.
- The highest-leverage split is SRP-01: cloud pricing and tier-cost decisions now live outside the React page that renders and collects inputs.
- SRP-02 separates RESP byte encoding from interactive presentation and clipboard behavior, including correct UTF-8 byte lengths.
- The new domain functions are independently testable without Docusaurus, React rendering, or browser globals.
- Large benchmark pages remain intact where length reflects one presentation actor rather than unrelated reasons to change.

## Findings

| ID | location | category | severity P0/P1/P2 | actors-in-conflict | cost | size S/M/L | behavior risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BASE-001 | commit `b0cf5dd` | verification | P0 | documentation UI owners and verification/tooling owners | Resolved: behavior tests, typecheck, and production build are runnable locally and in CI-compatible Node versions | M | Low |
| SRP-01 | `website/src/pages/cost-calculator.tsx` | pricing decision vs. presentation | P1 | product/finance pricing owners and documentation UI owners | Pricing or tier-distribution changes previously required editing a React page and could not be tested without rendering it | S | Low |
| SRP-02 | `website/src/components/RespDemo/index.tsx` | protocol encoding vs. presentation | P1 | RESP contract owners and interactive-demo UI owners | Encoding correctness, rendering labels, examples, and clipboard behavior changed in one component | S | Low |
| QUAL-01 | `website/src/theme/DocItem/Layout.tsx`; component return types | type safety | P1 | Docusaurus front-matter integration and React rendering | React 19/Docusaurus package boundaries made the documented typecheck fail | S | Low |
| SRP-03 | `website/src/pages/benchmarks.tsx` | long presentation module | P2 | benchmark documentation owners only | Navigation cost is high, but tables and charts change for the same actor and splitting would add indirection | L | Low |

## Ordered Refactor Sequence

1. Add the behavior test runner and characterize cost and RESP calculations (BASE-001).
2. Rewire the calculator page to the tested pricing domain function (SRP-01).
3. Rewire the RESP demo to the tested encoder (SRP-02).
4. Preserve React 19 and Docusaurus front-matter type safety (QUAL-01).
5. Keep benchmark presentation together unless a second actor or reusable data source emerges (SRP-03).

## Out of Scope

- `website/src/pages/benchmarks.tsx` remains long because it is a cohesive static benchmark-presentation page; extracting each table would create navigation without removing an actor.
- Broad Markdown reformatting and benchmark-value changes remain deferred because content accuracy requires product/release decisions rather than a mechanical refactor.
- The legacy Markdown lint baseline (1,609 findings across 203 files) remains visible but non-blocking; resolving it belongs in a dedicated formatting-only review rather than this cross-cutting refactor PR.
- No visual redesign, global style sweep, Docusaurus upgrade, browserslist refresh, or unrelated dependency bump is included.
- Cross-repository command, configuration, release, and metrics drift remains governed by organization-level validation rather than docs-site runtime coupling.
