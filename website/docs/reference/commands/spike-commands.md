---
sidebar_position: 50
maturity: experimental
---

:::caution Experimental Feature Family
The `CON.*`, `CHR.*`, `LUC.*`, `PNG.*`, and `FN.*` command families are
**experimental spike implementations** backing ADR-019 through ADR-023.
They warn once on first use and may change shape (or be removed) between
releases.  Production use is **not** recommended.
:::

# Spike Commands (CON / CHR / LUC / PNG / FN)

These five command families surface the in-tree research spikes:

| Family | Crate              | Moonshot                                    | ADR     |
|--------|--------------------|---------------------------------------------|---------|
| `CON.*`| `ferrite-concord`  | Concord — CRDT multi-master geo-replication | ADR-020 |
| `LUC.*`| `ferrite-lucidity` | Lucidity — verifiable audit plane           | ADR-021 |
| `CHR.*`| `ferrite-chronicle`| Chronicle — branchable / time-travelling KV | ADR-022 |
| `PNG.*`| `ferrite-pangea`   | Pangea — CXL tier-0 memory                  | ADR-023 |
| `FN.*` | `ferrite-forge`    | Forge — WASM in-DB functions (`FN.CALL` gated on `forge-runtime`)| ADR-019 |

All five log a single `experimental` warning the first time they're invoked
in a session.

## Persistence

Each family persists state to the embedded Store under a well-known key:

| Family | Store key                  | What is persisted                                      |
|--------|----------------------------|--------------------------------------------------------|
| `CON.*`| `__ferrite:concord:data`   | **Full GCounter map** — survives restarts, mergeable.  |
| `LUC.*`| `__ferrite:lucidity:data`  | **All audit-log leaves** — chain restored on startup.  |
| `CHR.*`| `__ferrite:chronicle:data` | **Full state**: branch registry + main KV + per-branch overlays + rollback-snapshot stacks. |
| `PNG.*`| `__ferrite:pangea:data`    | **Full state**: every key→bytes pair (re-allocated on load). |
| `FN.*` | `__ferrite:forge:data`     | **All registered modules** as bincode `ModuleEnvelope`s — restored on startup. |

State is auto-loaded the first time any subcommand runs and auto-persisted
after every mutating subcommand.  Each family also exposes explicit
`SAVE` / `LOAD` (or, for FN, `LOAD_FROM_STORE`) subcommands for operator
control.

## CON.* — Concord CRDTs

```
CON.GINC key replica delta   # increment a GCounter slot, returns total
CON.GVAL key                 # current value (sum across replicas)
CON.GMERGE key json          # merge an incoming GCounter (JSON), returns total
CON.SAVE                     # explicitly persist all counters
CON.LOAD                     # merge persisted counters into memory
CON.HELP
```

Example:

```sh
> CON.GINC orders:total node-a 1
(integer) 1
> CON.GINC orders:total node-b 2
(integer) 3
> CON.GVAL orders:total
(integer) 3
```

## LUC.* — Lucidity Audit Log

Append-only, tamper-evident Merkle log with inclusion proofs.

```
LUC.APPEND key value         # append a SET leaf, returns its index
LUC.DEL key                  # append a DEL leaf, returns its index
LUC.LEN                      # number of leaves
LUC.HEAD                     # signed tree head (size, root, ts, signer)
LUC.PROOF index              # inclusion proof (JSON)
LUC.SAVE                     # persist all leaves to Store
LUC.LOAD                     # restore leaves from Store
LUC.HELP
```

Example:

```sh
> LUC.APPEND user:42 alice
(integer) 0
> LUC.APPEND user:43 bob
(integer) 1
> LUC.HEAD
1) "size"
2) (integer) 2
3) "root"
4) "9f86d081…"
5) "ts_ms"
6) (integer) 0
7) "signer"
8) "ferrite-luc-default"
```

## CHR.* — Chronicle Branched KV

Branch / overlay reads against a per-process branched KV.

```
CHR.BRANCH tenant [parent]   # create a branch, returns branch id
CHR.USE branch|MAIN          # switch active branch (MAIN = clear)
CHR.SET key value
CHR.GET key
CHR.DEL key
CHR.SNAPSHOT                 # take a rollback snapshot of the active branch, returns index
CHR.ROLLBACK index           # restore the active branch to the given snapshot index
CHR.STATS branch             # writes / deletes / snapshots
CHR.SAVE / CHR.LOAD          # full-state persistence (registry + main + overlays + snapshot stacks)
CHR.HELP
```

Branch state is now persisted in full — registry metadata, the main
KV map, every branch's overlay (including tombstones), and the
per-branch rollback-snapshot stack all round-trip through the Store.
`CHR.SNAPSHOT` requires an active branch (call `CHR.USE` first);
`CHR.ROLLBACK` truncates snapshots taken after the target index.

## PNG.* — Pangea NUMA-tiered Allocator

Two-node `NumaTopology` over an in-memory CXL allocator simulator.

```
PNG.ALLOC key value          # allocate, returns {node, page}
PNG.READ key                 # read bytes by key
PNG.FREE key                 # free the page bound to key
PNG.STATS                    # nodes, free_bytes
PNG.SAVE / PNG.LOAD          # full-state persistence (every key→bytes pair)
PNG.HELP
```

Every allocated `key → bytes` pair is persisted.  On `LOAD`, entries
are replayed via `allocate` against the current topology — keys may
land on different nodes if the topology shape or routing policy
changes between save and load.

## FN.* — Forge WASM In-DB Functions

A process-local `ModuleRegistry` plus an optional `Executor` (gated on
the `forge-runtime` build feature).

```
FN.LOAD name hex_bytes [read_globs [write_globs]]   # register a wasm module
FN.LIST                                              # list module names
FN.INFO name                                         # name, sha256, size, ACL
FN.DROP name                                         # remove a module
FN.STATS                                             # modules + total_bytes
FN.SAVE                                              # persist envelopes to Store
FN.LOAD_FROM_STORE                                   # restore envelopes from Store
FN.CALL name export input_hex [fuel] [wall_time_ms] [db]  # invoke a wasm export
FN.HELP
```

`FN.LOAD` accepts the wasm bytes as a lowercase even-length hex
string; `read_globs` / `write_globs` are comma-separated key globs
encoded into the per-module `ModuleAcl`.  Each module is stored with
its SHA-256 (computed at registration) so replicas can verify the
envelope before installing.

`FN.CALL` is gated on the **top-level `forge-runtime` feature**
(which enables `ferrite-forge`'s `runtime` feature and pulls in
wasmtime).  Default builds reply with an actionable error directing
operators to rebuild with `--features forge-runtime`.  When enabled,
each call runs under a `ResourceBudget` (default: 1 M fuel, 64 MiB
memory, 50 ms wall-clock); the optional `fuel` and `wall_time_ms`
arguments override the fuel/time caps for that invocation.  The
optional trailing `db` argument selects which database the host KV
imports target; when omitted, it defaults to the connection's
currently-`SELECT`ed database (so `SELECT 3` then `FN.CALL …` runs
against db 3).  Out-of-range values return an error
without invoking the module.  The return value is the raw output
bytes the module wrote (empty bulk for zero-length output).

Modules invoked through the `Store`-aware dispatch path (the only
path the live RESP server uses) get access to a host KV API:

```
ferrite_kv::kv_get(kptr: i32, klen: i32) -> i64       ;; packed (ptr, len); len < 0 if missing/denied
ferrite_kv::kv_set(kptr, klen, vptr, vlen) -> i32     ;; 0 ok, 1 acl, 2 backend
ferrite_kv::kv_del(kptr: i32, klen: i32) -> i32       ;; 0 missing, 1 deleted, negative on error
ferrite_kv::kv_scan(pptr, plen, limit: i32) -> i64    ;; packed (ptr, total_bytes); buffer is [u32 LE klen][k bytes]*
ferrite_kv::kv_incr(kptr, klen, delta: i64, out_ptr: i32) -> i32  ;; 0 ok (i64 LE at out_ptr), 1 acl, 2 not-int, 3 overflow, 4 backend
ferrite_kv::kv_expire(kptr, klen, ttl_ms: i64) -> i32 ;; 1 set, 0 key missing, -1 acl, -2 backend, -3 negative ttl
ferrite_kv::kv_ttl(kptr: i32, klen: i32) -> i64       ;; ms remaining, -1 no expiry, -2 missing, -3 acl, -4 backend
```

Every host call is gated by the per-module `ModuleAcl` set at
`FN.LOAD` time — `read_globs` controls `kv_get`, `kv_scan`, and
`kv_ttl`; `write_globs` controls `kv_set`/`kv_del`/`kv_expire`,
plus `kv_incr` (which also requires read since it returns the
post-increment value).  Default ACL denies everything; pass
explicit globs (e.g. `FN.LOAD name hex "user:*" "user:*"`) to
grant access.  `kv_scan` only returns keys that pass the read
ACL — non-matching keys are silently filtered out so a module
cannot use scan to enumerate keys outside its declared keyspace.
Host KV ops route to the database selected by `FN.CALL`'s
optional `db` argument; when omitted, `db` defaults to the
connection's currently-`SELECT`ed database (so `SELECT 3`
followed by `FN.CALL …` runs the module against db 3 without
any extra plumbing).  Pass an explicit `db` to override.

`kv_expire` / `kv_ttl` use millisecond precision at the host
boundary even though the underlying `Store` API exposes seconds —
the host adapter converts internally, so resolution is bounded
by the Store's second granularity (positive ttl values returned
are multiples of 1000).  Special return values follow Redis
PTTL conventions extended for ACL/backend signalling.

`FN.CALL` is **not** replicated — replicas should run their own
deterministic copy if they need the side-effect output (mirrors
Redis FCALL_RO semantics).

## Operator Notes

- **Replication**: mutating subcommands (`CON.GINC`, `CON.GMERGE`,
  `CHR.SET`, `CHR.DEL`, `CHR.BRANCH`, `CHR.SNAPSHOT`, `CHR.ROLLBACK`,
  `LUC.APPEND`, `LUC.DEL`, `PNG.ALLOC`, `PNG.FREE`, `FN.LOAD`,
  `FN.DROP`) are routed through the primary's replication stream as
  `Raw` frames, so replicas re-execute them through the same handlers.
  Read-only subcommands (`*.STATS`, `LUC.ROOT`, `LUC.PROOF`,
  `FN.LIST`, `FN.INFO`, etc.) stay local.
- All five Store entries (`__ferrite:{concord,lucidity,chronicle,pangea,forge}:data`)
  are real cluster state — back them up alongside other Ferrite snapshots.
- `CHR.LOAD`, `PNG.LOAD`, and `FN.LOAD_FROM_STORE` *merge* into the
  existing in-memory state rather than wiping it; flush manually via
  `FLUSHDB` first if you want a clean restore.
- `LUC.*` uses a real **Ed25519** signer (`ed25519-dalek` v2) with a
  deterministic default seed.  Override the seed at startup via either:
  - `FERRITE_LUCIDITY_SEED_HEX` — 64 hex chars = 32-byte seed (env var
    takes precedence when both are set), or
  - `FERRITE_LUCIDITY_SEED_FILE` — path to a file containing the seed
    as either 32 raw bytes or 64 hex chars (leading/trailing whitespace
    tolerated).  Useful for KMS / Vault / Kubernetes-secret mounts.

  Malformed values log a warning and fall back to the deterministic
  default so the handler can never fail to start.  Production
  deployments should source the seed from a KMS / config bridge — see
  ADR-021.
- `CHR.STATS` counters (writes / deletes per branch) and the
  per-branch rollback-snapshot stack are both persisted in the
  snapshot and restored across restarts.
- All five warn-once on first use via the standard
  `tracing` `warn_experimental` channel.
