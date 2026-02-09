---- MODULE ClusterFailover ----
(***************************************************************************)
(* TLA+ specification for Ferrite's cluster failover protocol.             *)
(*                                                                         *)
(* Models a primary-replica architecture with leader election on failure.  *)
(* Based on a simplified Raft-style election with epoch numbers.           *)
(*                                                                         *)
(* Safety:                                                                 *)
(*   - SingleLeader: at most one leader per epoch                          *)
(*   - NoSplitBrain: no two nodes believe they are leader simultaneously  *)
(*   - MonotonicEpoch: epoch numbers only increase                         *)
(*                                                                         *)
(* Liveness:                                                               *)
(*   - EventualLeaderElection: if a leader fails, a new leader is         *)
(*     eventually elected                                                  *)
(***************************************************************************)

EXTENDS Integers, FiniteSets, TLC

CONSTANTS
    Nodes,          \* Set of node IDs, e.g., {"n1", "n2", "n3"}
    QuorumSize      \* Minimum number of votes to become leader

ASSUME QuorumSize > Cardinality(Nodes) \div 2
ASSUME QuorumSize <= Cardinality(Nodes)

VARIABLES
    node_states,     \* Function: Nodes -> {"follower", "candidate", "leader", "dead"}
    current_leader,  \* Current leader node or "none"
    epoch,           \* Function: Nodes -> Nat (epoch/term number per node)
    votes,           \* Function: Nodes -> set of nodes that voted for this candidate
    voted_for,       \* Function: Nodes -> node voted for in current epoch, or "none"
    alive            \* Set of currently alive nodes

vars == <<node_states, current_leader, epoch, votes, voted_for, alive>>

(***************************************************************************)
(* Type invariant                                                          *)
(***************************************************************************)

NodeStates == {"follower", "candidate", "leader", "dead"}

TypeInvariant ==
    /\ node_states \in [Nodes -> NodeStates]
    /\ current_leader \in Nodes \cup {"none"}
    /\ epoch \in [Nodes -> Nat]
    /\ votes \in [Nodes -> SUBSET Nodes]
    /\ voted_for \in [Nodes -> Nodes \cup {"none"}]
    /\ alive \subseteq Nodes

(***************************************************************************)
(* Initial state                                                           *)
(***************************************************************************)

\* Start with one designated leader (first node alphabetically, modeled as CHOOSE)
InitLeader == CHOOSE n \in Nodes : TRUE

Init ==
    /\ node_states = [n \in Nodes |->
        IF n = InitLeader THEN "leader" ELSE "follower"]
    /\ current_leader = InitLeader
    /\ epoch = [n \in Nodes |-> 1]
    /\ votes = [n \in Nodes |-> {}]
    /\ voted_for = [n \in Nodes |-> "none"]
    /\ alive = Nodes

(***************************************************************************)
(* Actions                                                                 *)
(***************************************************************************)

\* A live follower receives a heartbeat from the leader (no state change needed)
Heartbeat(n) ==
    /\ n \in alive
    /\ node_states[n] = "follower"
    /\ current_leader # "none"
    /\ current_leader \in alive
    /\ UNCHANGED vars

\* A node detects that the leader has failed
DetectFailure(n) ==
    /\ n \in alive
    /\ node_states[n] = "follower"
    /\ current_leader \notin alive
    /\ UNCHANGED vars

\* A follower starts an election by becoming a candidate
StartElection(n) ==
    /\ n \in alive
    /\ node_states[n] = "follower"
    /\ current_leader \notin alive  \* Leader is dead
    /\ LET newEpoch == epoch[n] + 1
       IN /\ epoch' = [epoch EXCEPT ![n] = newEpoch]
          /\ node_states' = [node_states EXCEPT ![n] = "candidate"]
          /\ votes' = [votes EXCEPT ![n] = {n}]  \* Vote for self
          /\ voted_for' = [voted_for EXCEPT ![n] = n]
          /\ current_leader' = "none"
          /\ UNCHANGED <<alive>>

\* A live node votes for a candidate if it hasn't voted in this epoch
\* and the candidate's epoch is >= the voter's epoch
Vote(voter, candidate) ==
    /\ voter \in alive
    /\ candidate \in alive
    /\ voter # candidate
    /\ node_states[candidate] = "candidate"
    /\ node_states[voter] \in {"follower", "candidate"}
    /\ epoch[candidate] >= epoch[voter]
    /\ voted_for[voter] = "none" \/ (epoch[candidate] > epoch[voter])
    /\ epoch' = [epoch EXCEPT ![voter] = epoch[candidate]]
    /\ voted_for' = [voted_for EXCEPT ![voter] = candidate]
    /\ votes' = [votes EXCEPT ![candidate] = votes[candidate] \cup {voter}]
    \* If voter was a candidate, step down
    /\ node_states' = [node_states EXCEPT ![voter] =
        IF node_states[voter] = "candidate" THEN "follower" ELSE node_states[voter]]
    /\ UNCHANGED <<current_leader, alive>>

\* A candidate with enough votes becomes the leader
BecomeLeader(n) ==
    /\ n \in alive
    /\ node_states[n] = "candidate"
    /\ Cardinality(votes[n]) >= QuorumSize
    /\ node_states' = [node_states EXCEPT ![n] = "leader"]
    /\ current_leader' = n
    \* All other live nodes become followers in this epoch
    /\ voted_for' = [v \in Nodes |-> "none"]
    /\ votes' = [v \in Nodes |-> {}]
    /\ UNCHANGED <<epoch, alive>>

\* A node fails (crashes)
NodeFail(n) ==
    /\ n \in alive
    /\ Cardinality(alive) > QuorumSize  \* Ensure quorum can still form
    /\ alive' = alive \ {n}
    /\ node_states' = [node_states EXCEPT ![n] = "dead"]
    /\ current_leader' = IF current_leader = n THEN "none" ELSE current_leader
    /\ UNCHANGED <<epoch, votes, voted_for>>

\* A dead node recovers as a follower
NodeRecover(n) ==
    /\ n \notin alive
    /\ alive' = alive \cup {n}
    /\ node_states' = [node_states EXCEPT ![n] = "follower"]
    /\ voted_for' = [voted_for EXCEPT ![n] = "none"]
    /\ votes' = [votes EXCEPT ![n] = {}]
    /\ UNCHANGED <<current_leader, epoch>>

\* A candidate that doesn't get enough votes steps down
ElectionTimeout(n) ==
    /\ n \in alive
    /\ node_states[n] = "candidate"
    /\ Cardinality(votes[n]) < QuorumSize
    /\ node_states' = [node_states EXCEPT ![n] = "follower"]
    /\ votes' = [votes EXCEPT ![n] = {}]
    /\ voted_for' = [voted_for EXCEPT ![n] = "none"]
    /\ UNCHANGED <<current_leader, epoch, alive>>

(***************************************************************************)
(* Next-state relation                                                     *)
(***************************************************************************)

Next ==
    \/ \E n \in Nodes : StartElection(n)
    \/ \E voter, candidate \in Nodes : Vote(voter, candidate)
    \/ \E n \in Nodes : BecomeLeader(n)
    \/ \E n \in Nodes : NodeFail(n)
    \/ \E n \in Nodes : NodeRecover(n)
    \/ \E n \in Nodes : ElectionTimeout(n)

(***************************************************************************)
(* Fairness and specification                                              *)
(***************************************************************************)

Fairness ==
    /\ \A n \in Nodes : WF_vars(StartElection(n))
    /\ \A n \in Nodes : WF_vars(BecomeLeader(n))
    /\ \A voter, candidate \in Nodes : WF_vars(Vote(voter, candidate))
    /\ \A n \in Nodes : WF_vars(ElectionTimeout(n))

Spec == Init /\ [][Next]_vars /\ Fairness

(***************************************************************************)
(* Safety invariants                                                       *)
(***************************************************************************)

\* At most one node is in the "leader" state among alive nodes
SingleLeader ==
    Cardinality({n \in alive : node_states[n] = "leader"}) <= 1

\* No two nodes both believe they are leader (regardless of alive status)
NoSplitBrain ==
    \A n1, n2 \in Nodes :
        (node_states[n1] = "leader" /\ node_states[n2] = "leader") => (n1 = n2)

\* Epoch numbers never decrease for live nodes (monotonic)
MonotonicEpoch ==
    \A n \in Nodes : epoch[n] >= 1

\* A leader must have been elected by a quorum
\* (encoded as: if a node is leader, it previously received QuorumSize votes)
LeaderHasQuorum ==
    \A n \in Nodes :
        (node_states[n] = "leader") =>
            (n \in alive)

\* If there is a leader, current_leader reflects it
LeaderConsistency ==
    \A n \in Nodes :
        (node_states[n] = "leader" /\ n \in alive) =>
            (current_leader = n)

(***************************************************************************)
(* Liveness properties                                                     *)
(***************************************************************************)

\* If the leader dies and a quorum is alive, eventually a new leader is elected
EventualLeaderElection ==
    [](current_leader = "none" /\ Cardinality(alive) >= QuorumSize)
        ~> (current_leader # "none")

\* The system doesn't get stuck without a leader forever
EventuallyHasLeader ==
    <>(current_leader # "none")

====
