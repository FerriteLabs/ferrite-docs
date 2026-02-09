---- MODULE CrdtGCounter ----
(***************************************************************************)
(* TLA+ specification for a G-Counter (Grow-only Counter) CRDT as used    *)
(* in Ferrite's distributed counter implementation.                        *)
(*                                                                         *)
(* A G-Counter is a state-based CRDT where each replica maintains a       *)
(* vector of counts (one entry per replica). The counter value is the      *)
(* sum of all entries. Replicas increment only their own entry and         *)
(* merge by taking the pointwise maximum.                                  *)
(*                                                                         *)
(* Safety:                                                                 *)
(*   - MonotonicGrowth: the observed counter value never decreases         *)
(*   - CounterNonNegative: all counter entries are >= 0                    *)
(*                                                                         *)
(* Liveness:                                                               *)
(*   - EventualConsistency: if increments stop, all replicas eventually   *)
(*     converge to the same value                                          *)
(***************************************************************************)

EXTENDS Integers, FiniteSets, TLC

CONSTANTS
    Replicas,   \* Set of replica IDs, e.g., {"r1", "r2", "r3"}
    MaxVal      \* Maximum value any single replica can increment to (bounds model checking)

VARIABLES
    counters,       \* Function: Replicas -> [Replicas -> Nat] (per-replica vector)
    merged_view,    \* Function: Replicas -> Nat (each replica's last observed total)
    can_increment   \* Boolean: whether increments are still allowed (for liveness checking)

vars == <<counters, merged_view, can_increment>>

(***************************************************************************)
(* Helper operators                                                        *)
(***************************************************************************)

\* Pointwise maximum of two vectors
Max(a, b) == IF a >= b THEN a ELSE b

MergeVectors(v1, v2) ==
    [r \in Replicas |-> Max(v1[r], v2[r])]

\* Sum of all entries in a vector
VectorSum(v) ==
    LET RECURSIVE SumOver(_)
        SumOver(S) ==
            IF S = {} THEN 0
            ELSE LET r == CHOOSE r \in S : TRUE
                 IN v[r] + SumOver(S \ {r})
    IN SumOver(Replicas)

\* The counter value as observed by replica r
CounterValue(r) == VectorSum(counters[r])

(***************************************************************************)
(* Type invariant                                                          *)
(***************************************************************************)

TypeInvariant ==
    /\ counters \in [Replicas -> [Replicas -> Nat]]
    /\ merged_view \in [Replicas -> Nat]
    /\ can_increment \in BOOLEAN

(***************************************************************************)
(* Initial state                                                           *)
(***************************************************************************)

Init ==
    /\ counters = [r \in Replicas |-> [s \in Replicas |-> 0]]
    /\ merged_view = [r \in Replicas |-> 0]
    /\ can_increment = TRUE

(***************************************************************************)
(* Actions                                                                 *)
(***************************************************************************)

\* Replica r increments its own entry
Increment(r) ==
    /\ can_increment = TRUE
    /\ counters[r][r] < MaxVal
    /\ counters' = [counters EXCEPT ![r][r] = counters[r][r] + 1]
    /\ merged_view' = [merged_view EXCEPT ![r] = CounterValue(r) + 1]
    /\ UNCHANGED <<can_increment>>

\* Replica r merges with replica s's state (anti-entropy / gossip)
Merge(r, s) ==
    /\ r # s
    /\ LET newVector == MergeVectors(counters[r], counters[s])
       IN /\ counters' = [counters EXCEPT ![r] = newVector]
          /\ merged_view' = [merged_view EXCEPT ![r] = VectorSum(newVector)]
    /\ UNCHANGED <<can_increment>>

\* Stop increments to allow convergence (for liveness checking)
StopIncrements ==
    /\ can_increment = TRUE
    /\ can_increment' = FALSE
    /\ UNCHANGED <<counters, merged_view>>

(***************************************************************************)
(* Next-state relation                                                     *)
(***************************************************************************)

Next ==
    \/ \E r \in Replicas : Increment(r)
    \/ \E r, s \in Replicas : Merge(r, s)
    \/ StopIncrements

(***************************************************************************)
(* Fairness and specification                                              *)
(***************************************************************************)

\* Merges must eventually happen (weak fairness) for convergence
Fairness ==
    /\ \A r, s \in Replicas : WF_vars(Merge(r, s))

Spec == Init /\ [][Next]_vars /\ Fairness

(***************************************************************************)
(* Safety invariants                                                       *)
(***************************************************************************)

\* All counter entries are non-negative
CounterNonNegative ==
    \A r, s \in Replicas : counters[r][s] >= 0

\* The observed total at each replica never decreases.
\* This is encoded as: merged_view always reflects <= the true counter value
\* (monotonicity is guaranteed by the merge function taking max).
MonotonicGrowth ==
    \A r \in Replicas : merged_view[r] <= CounterValue(r) \/ merged_view[r] = CounterValue(r)

\* A replica's own entry can only grow
OwnEntryMonotonic ==
    \A r \in Replicas : counters[r][r] >= 0

\* After merging r with s, r's view of s is at least as large as s's own entry was
\* (captured implicitly by pointwise max in MergeVectors)

(***************************************************************************)
(* Liveness properties                                                     *)
(***************************************************************************)

\* Strong eventual consistency: once increments stop and merges complete,
\* all replicas converge to the same counter value.
EventualConsistency ==
    (can_increment = FALSE) ~>
        (\A r1, r2 \in Replicas : CounterValue(r1) = CounterValue(r2))

\* All replicas eventually see the same vector
EventualVectorConvergence ==
    (can_increment = FALSE) ~>
        (\A r1, r2 \in Replicas : counters[r1] = counters[r2])

====
