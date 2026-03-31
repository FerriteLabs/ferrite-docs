---
title: "Distributed Systems Specialist — Concord"
sidebar_position: 2
---

# Distributed Systems Specialist — Concord

**Location:** Remote-first · **Type:** Full-time · **Team:** Core Engine

## About Ferrite

Ferrite is a high-performance tiered-storage key-value store designed as a drop-in Redis replacement. Built in Rust with epoch-based concurrency and an io_uring-first persistence layer, Ferrite extends the Redis API with six moonshot capabilities — agentic memory, WebAssembly functions, cryptographic audit trails, time-travel branching, CRDT-based multi-region replication, and tiered storage beyond RAM. We're open-source, early-stage, and looking for engineers who want to own hard problems end-to-end.

## What You'll Do

- **Lead Concord (M5) from spike through GA.** Concord is Ferrite's multi-region active-active replication layer, built on CRDTs with δ-state propagation. You'll own the entire lifecycle — research spike, protocol design, formal verification, implementation, and production hardening.
- **Design the conflict resolution model.** Define how Ferrite merges concurrent writes across regions: per-key CRDTs, causal metadata, vector clocks, and user-facing merge semantics.
- **Formally verify the protocol.** Write TLA+ or P specifications for the replication protocol before committing to an implementation. Prove convergence, partition tolerance, and bounded metadata growth.
- **Build the gossip and anti-entropy layer.** Implement the protocol that synchronises state across Ferrite nodes — failure detection, state reconciliation, and protocol-level observability.
- **Collaborate with design partners.** Work directly with teams running multi-region workloads today, understand their conflict-resolution pain points, and ship a solution that eliminates manual reconciliation.

## Requirements

- **Production CRDT, Paxos, or Raft experience.** You've built or operated distributed consensus or convergent data structures in a system that people depended on.
- **Formal methods: TLA+ or P.** You've written at least one formal specification for a distributed protocol and used it to find real bugs or prove properties.
- **Gossip and anti-entropy protocols.** Comfortable with epidemic protocols, Merkle tree-based anti-entropy, and the tradeoffs between eager and lazy propagation.
- **Vector clocks and causal ordering.** You understand happens-before, logical timestamps, and how to bound metadata overhead in practice.

## Nice-to-Have

- **Multi-region operations experience.** You've operated or contributed to Riak, ScyllaDB, Cosmos DB, FoundationDB, or CockroachDB in a multi-region deployment.
- **Rust proficiency.** Concord will be implemented in Rust. Strong Rust skills are a plus, though we'll support ramp-up for exceptional distributed-systems candidates.
- **Published research or talks.** Papers, conference talks, or blog posts on distributed systems topics.

## Interview Process

We respect your time. Total candidate investment ≤ 8 hours, total elapsed ≤ 2 weeks.

1. **Async take-home (4 hours).** Implement a PN-counter with δ-propagation. See the take-home guide (`docs/templates/take-home-distributed.md` in the ferrite repo) for details.
2. **Pairing interview (1.5 hours).** Walk through your take-home solution. We'll discuss convergence properties, failure modes, and how you'd extend the design.
3. **System design interview (1.5 hours).** Design Concord's replication protocol for a specific multi-region scenario. We care about correctness reasoning, formal thinking, and practical tradeoffs.
4. **References + offer.**

## Compensation

Public salary band with an options grant on employee-friendly terms (non-restrictive, extended exercise window). Details shared at first conversation.

## How to Apply

Send an email to **careers@ferrite.dev** with:

- Your CV or LinkedIn profile
- Links to relevant distributed-systems work (code, papers, talks)
- A short note on your experience with CRDTs or consensus protocols

Or open a GitHub Discussion in the [Ferrite repository](https://github.com/FerriteLabs/ferrite) with the `hiring` label.
