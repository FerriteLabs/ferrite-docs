---
title: "Senior Rust Engineer — Storage / Runtime"
sidebar_position: 1
---

# Senior Rust Engineer — Storage / Runtime

**Location:** Remote-first · **Type:** Full-time · **Team:** Core Engine

## About Ferrite

Ferrite is a high-performance tiered-storage key-value store designed as a drop-in Redis replacement. Built in Rust with epoch-based concurrency and an io_uring-first persistence layer, Ferrite extends the Redis API with six moonshot capabilities — agentic memory, WebAssembly functions, cryptographic audit trails, time-travel branching, CRDT-based multi-region replication, and tiered storage beyond RAM. We're open-source, early-stage, and looking for engineers who want to own hard problems end-to-end.

## What You'll Do

- **Own a moonshot through GA.** You'll take primary ownership of one of **Mnemo** (agentic memory), **Forge** (Wasm server-side functions), or **Lucidity** (cryptographic audit trails) — from design through production release.
- **Build core storage infrastructure.** Work on the HybridLog storage engine (inspired by Microsoft FASTER), epoch-based reclamation, and the thread-per-core runtime.
- **Collaborate with design partners.** Work directly with early adopters running pre-release builds, incorporate their feedback, and ship what matters.
- **Shape the public API.** Design command families, protocol extensions, and SDK surfaces that thousands of developers will use.
- **Write code that ships.** We're a small team. You'll write Rust daily — `unsafe` when justified, safe wherever possible, tested always.

## Requirements

- **3+ years of production Rust.** You've shipped Rust to production, not just side projects.
- **Comfortable with `unsafe` and lock-free programming.** You understand memory ordering, atomics, and when `unsafe` is the right call.
- **Epoch-based or hazard-pointer reclamation.** Experience with concurrent memory reclamation schemes, or demonstrated ability to learn them quickly.
- **Familiarity with at least one of:** Wasmtime, embedded vector indexes, or Merkle / audit-log structures.
- **Public open-source contributions.** Commits to projects like Tokio, Wasmtime, FoundationDB, Sled, redb, or similar.

## Nice-to-Have

- **io_uring experience.** You've used `io_uring` (or `tokio-uring`) for async file I/O in production or a serious project.
- **Wasmtime / WebAssembly runtime internals.** You've embedded or extended a Wasm runtime.
- **Cryptography exposure.** Familiarity with Halo2, ML-DSA, COSE, or post-quantum signature schemes.

## Interview Process

We respect your time. Total candidate investment ≤ 8 hours, total elapsed ≤ 2 weeks.

1. **Async take-home (4 hours).** Implement a small but real component — for example, a WIT-bound function host. See the take-home guide (`docs/templates/take-home-rust.md` in the ferrite repo) for details.
2. **Pairing interview (1.5 hours).** Walk through your take-home solution. We'll extend it together, discuss tradeoffs, and dig into edge cases.
3. **System design interview (1.5 hours).** Design a subsystem relevant to the moonshot you'd own. We care about tradeoff reasoning, not whiteboard perfection.
4. **References + offer.**

## Compensation

Public salary band with an options grant on employee-friendly terms (non-restrictive, extended exercise window). Details shared at first conversation.

## How to Apply

Applications are temporarily paused until FerriteLabs configures a verified private hiring channel. Do not post CVs or other personal application materials in public issues or discussions. Hiring updates will be published through [Ferrite Discussions](https://github.com/FerriteLabs/ferrite/discussions).
