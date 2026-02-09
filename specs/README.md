# Ferrite TLA+ Formal Specifications

## What is TLA+?

[TLA+](https://lamport.azurewebsites.net/tla/tla.html) is a formal specification language developed by Leslie Lamport for designing, modeling, and verifying concurrent and distributed systems. It allows us to mathematically prove that Ferrite's critical algorithms satisfy safety and liveness properties before writing a single line of Rust.

### Why TLA+ for Ferrite?

Ferrite relies on distributed algorithms for cluster coordination, data replication, and failover. These algorithms are notoriously difficult to get right through testing alone—bugs often hide in rare interleavings that may never occur in practice but can cause catastrophic failures in production. TLA+ lets us exhaustively explore **every possible interleaving** of events and verify that our invariants always hold.

## Specifications

| File | Algorithm | What It Verifies |
|------|-----------|------------------|
| `TwoPhaseCommit.tla` | Two-Phase Commit (2PC) | Atomic commit/abort, no data loss, no half-commits, eventual decision |
| `CrdtGCounter.tla` | G-Counter CRDT | Strong eventual consistency, monotonic growth |
| `ClusterFailover.tla` | Cluster Failover | Single leader, no split-brain, eventual leader election |

## Installation & Setup

### Option 1: TLA+ Toolbox (GUI)

1. Download the [TLA+ Toolbox](https://github.com/tlaplus/tlaplus/releases) for your platform.
2. Open a `.tla` file via **File → Open Spec → Add New Spec**.
3. Create a new model via **TLC Model Checker → New Model**.
4. Configure constants (e.g., `Participants`, `Replicas`, `Nodes`) with small finite sets.
5. Add invariants and temporal properties under the **Properties** tab.
6. Click **Run TLC** to model-check.

### Option 2: Command-Line TLC

```bash
# Download tla2tools.jar
wget https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar

# Run the model checker (example for TwoPhaseCommit)
java -jar tla2tools.jar -config TwoPhaseCommit.cfg TwoPhaseCommit.tla
```

### Option 3: VS Code Extension

1. Install the [TLA+ extension](https://marketplace.visualstudio.com/items?itemName=alygin.vscode-tlaplus) for VS Code.
2. Open any `.tla` file.
3. Use **Cmd+Shift+P → TLA+: Check Model** to run the model checker.

## Running the Specs

For small model checking, use finite sets for constants:

| Spec | Suggested Constants |
|------|-------------------|
| `TwoPhaseCommit.tla` | `Participants = {"p1", "p2", "p3"}` |
| `CrdtGCounter.tla` | `Replicas = {"r1", "r2", "r3"}`, `MaxVal = 3` |
| `ClusterFailover.tla` | `Nodes = {"n1", "n2", "n3"}`, `QuorumSize = 2` |

## Contributing New Specs

1. **Identify the algorithm**: Choose a critical distributed algorithm used in Ferrite.
2. **Define the state space**: List constants, variables, and their domains.
3. **Write Init and Next**: Define the initial state and the next-state relation.
4. **State invariants**: Define safety properties as state predicates.
5. **Add temporal properties**: Define liveness properties using temporal logic (e.g., `<>[]P`).
6. **Model-check with small constants first**: Start with 2–3 nodes/participants.
7. **Document**: Add an entry to this README and comment the spec thoroughly.

### Spec Structure Template

```tla
---- MODULE MyAlgorithm ----
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS ...
VARIABLES ...

vars == << ... >>

TypeInvariant == ...
Init == ...
Next == ... \/ ...

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

SafetyProperty == ...
LivenessProperty == ...

====
```
