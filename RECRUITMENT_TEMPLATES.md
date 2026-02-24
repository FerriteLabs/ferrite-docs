# Contributor Recruitment Templates

## Reddit r/rust Post

**Title**: Looking for Rust contributors: Ferrite — Redis-compatible database with tiered storage

**Body**:

Hi r/rust! 👋

I've been building [Ferrite](https://github.com/ferritelabs/ferrite), a
Redis-compatible key-value database in Rust. It's 451K LOC with 6,200+ tests,
and I'm looking for contributors to help get it to v1.0.

**What makes it interesting for Rustaceans:**

- Thread-per-core architecture with `crossbeam-epoch` for lock-free reads
- `tokio-uring` integration for async disk I/O on Linux
- Custom RESP protocol parser (zero-copy with `bytes`)
- 12-crate Cargo workspace with clean dependency DAG
- Comprehensive `deny.toml`, pre-commit hooks, 14 CI workflows
- `#[deny(unwrap_used)]` enforced workspace-wide

**Good first issues (20 tagged):**

Easy (1-4 hours):
- Implement `OBJECT ENCODING` command
- Implement `RANDOMKEY` command
- Implement `COMMAND COUNT`
- Add `SINTERCARD` command

Medium (4-6 hours):
- Implement `COPY` command
- Add `MEMORY USAGE` command
- Implement `LATENCY HISTORY/LATEST`

Full contributor guide: https://github.com/ferritelabs/ferrite/blob/main/FIRST_CONTRIBUTORS.md

Setup is `cargo build && cargo test --lib` (~6s for tests). Happy to mentor
anyone through their first PR. AMA!

---

## Rust Discord Message

**Channel**: #projects or #help-wanted

Hey! I'm looking for contributors for Ferrite — a Redis-compatible database
in Rust (451K LOC, 6,200+ tests, Apache-2.0).

20 good-first-issues ready, ranging from 1-6 hours. Full architecture
walkthrough in the contributor guide. Happy to pair-program on first PRs.

GitHub: https://github.com/ferritelabs/ferrite
Issues: https://github.com/ferritelabs/ferrite/labels/good%20first%20issue

---

## Twitter/X Thread

🧵 I've been building Ferrite, a Redis replacement in Rust, for the past
month. 451K lines, 6,200+ tests. Now looking for contributors.

Here's why it might interest you: 🧵

1/ Ferrite is a Redis-compatible database that adds tiered storage
(memory→disk→S3), SQL queries, and built-in vector search. One binary
replaces Redis + Elasticsearch + Pinecone.

2/ It's pure Rust with:
- Thread-per-core + epoch-based reclamation
- io_uring for async disk I/O
- Zero-copy RESP parsing with bytes
- #[deny(unwrap_used)] workspace-wide

3/ 20 good-first-issues tagged, from "implement RANDOMKEY" (1hr) to "add
MEMORY USAGE command" (4hrs). Full contributor guide with architecture
diagrams.

4/ Looking for help with:
- Redis command compatibility (72% → 95%)
- Performance benchmarking
- Documentation
- Integration testing

5/ Get started:
```
git clone https://github.com/ferritelabs/ferrite
cargo test --lib  # 6,187 tests in ~6s
```

Contributor guide: github.com/ferritelabs/ferrite/blob/main/FIRST_CONTRIBUTORS.md

DMs open for questions! 🧲

---

## Direct Outreach Email (for known Rust contributors)

Subject: Contributor invitation: Ferrite (Redis replacement in Rust)

Hi [Name],

I noticed your work on [project/contribution] and thought you might be
interested in contributing to Ferrite — an open-source Redis-compatible
database built in Rust.

It's a 451K LOC Cargo workspace with 12 crates, 6,200+ tests, and strict
engineering standards (#[deny(unwrap_used)], comprehensive deny.toml, 14 CI
workflows). The architecture uses thread-per-core with epoch-based reclamation
and io_uring — similar to what you've worked on in [related area].

I have 20 good-first-issues tagged, ranging from simple command implementations
(2-4 hours) to more involved features. I'm happy to mentor through the first
PR and pair-program if useful.

GitHub: https://github.com/ferritelabs/ferrite
Contributor guide: https://github.com/ferritelabs/ferrite/blob/main/FIRST_CONTRIBUTORS.md

No pressure — just thought it might be an interesting codebase to explore.

Best,
Jose David Baena
