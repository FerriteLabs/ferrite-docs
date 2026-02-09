---- MODULE TwoPhaseCommit ----
(***************************************************************************)
(* TLA+ specification for Two-Phase Commit (2PC) as used in Ferrite's     *)
(* distributed transaction coordinator.                                    *)
(*                                                                         *)
(* Safety:                                                                 *)
(*   - ConsistencyInvariant: all participants agree on commit or abort     *)
(*   - NoHalfCommit: it is never the case that some participants have     *)
(*     committed while others have aborted                                 *)
(*   - NoDataLoss: a committed transaction is never rolled back           *)
(*                                                                         *)
(* Liveness:                                                               *)
(*   - EventuallyDecides: the protocol eventually reaches a terminal      *)
(*     state (all committed or all aborted)                                *)
(***************************************************************************)

EXTENDS Integers, FiniteSets, TLC

CONSTANTS
    Participants    \* Set of participant IDs, e.g., {"p1", "p2", "p3"}

VARIABLES
    coordinator_state,   \* State of the coordinator
    participant_states,  \* Function: Participants -> participant state
    decision,            \* Global decision: "none", "commit", "abort"
    prepared,            \* Set of participants that voted "yes"
    msgs                 \* Set of messages in transit

vars == <<coordinator_state, participant_states, decision, prepared, msgs>>

(***************************************************************************)
(* Type definitions                                                        *)
(***************************************************************************)

CoordinatorStates == {"init", "waiting", "committed", "aborted"}
ParticipantStates == {"working", "prepared", "committed", "aborted"}
Decisions == {"none", "commit", "abort"}

MessageTypes == [type : {"prepare", "vote_yes", "vote_no", "do_commit", "do_abort"}]

TypeInvariant ==
    /\ coordinator_state \in CoordinatorStates
    /\ participant_states \in [Participants -> ParticipantStates]
    /\ decision \in Decisions
    /\ prepared \subseteq Participants

(***************************************************************************)
(* Initial state                                                           *)
(***************************************************************************)

Init ==
    /\ coordinator_state = "init"
    /\ participant_states = [p \in Participants |-> "working"]
    /\ decision = "none"
    /\ prepared = {}
    /\ msgs = {}

(***************************************************************************)
(* Coordinator actions                                                     *)
(***************************************************************************)

\* Coordinator sends prepare messages to all participants
Prepare ==
    /\ coordinator_state = "init"
    /\ coordinator_state' = "waiting"
    /\ msgs' = msgs \cup {[type |-> "prepare", dest |-> p] : p \in Participants}
    /\ UNCHANGED <<participant_states, decision, prepared>>

\* Coordinator receives all yes votes and decides to commit
CoordinatorCommit ==
    /\ coordinator_state = "waiting"
    /\ prepared = Participants
    /\ coordinator_state' = "committed"
    /\ decision' = "commit"
    /\ msgs' = msgs \cup {[type |-> "do_commit", dest |-> p] : p \in Participants}
    /\ UNCHANGED <<participant_states, prepared>>

\* Coordinator decides to abort (timeout or received a no vote)
CoordinatorAbort ==
    /\ coordinator_state \in {"init", "waiting"}
    /\ coordinator_state' = "aborted"
    /\ decision' = "abort"
    /\ msgs' = msgs \cup {[type |-> "do_abort", dest |-> p] : p \in Participants}
    /\ UNCHANGED <<participant_states, prepared>>

(***************************************************************************)
(* Participant actions                                                     *)
(***************************************************************************)

\* Participant receives prepare and votes yes
VoteYes(p) ==
    /\ participant_states[p] = "working"
    /\ [type |-> "prepare", dest |-> p] \in msgs
    /\ participant_states' = [participant_states EXCEPT ![p] = "prepared"]
    /\ prepared' = prepared \cup {p}
    /\ msgs' = msgs \cup {[type |-> "vote_yes", src |-> p]}
    /\ UNCHANGED <<coordinator_state, decision>>

\* Participant receives prepare and votes no
VoteNo(p) ==
    /\ participant_states[p] = "working"
    /\ [type |-> "prepare", dest |-> p] \in msgs
    /\ participant_states' = [participant_states EXCEPT ![p] = "aborted"]
    /\ msgs' = msgs \cup {[type |-> "vote_no", src |-> p]}
    /\ UNCHANGED <<coordinator_state, decision, prepared>>

\* Participant receives commit decision
ParticipantCommit(p) ==
    /\ participant_states[p] = "prepared"
    /\ [type |-> "do_commit", dest |-> p] \in msgs
    /\ participant_states' = [participant_states EXCEPT ![p] = "committed"]
    /\ UNCHANGED <<coordinator_state, decision, prepared, msgs>>

\* Participant receives abort decision
ParticipantAbort(p) ==
    /\ participant_states[p] \in {"working", "prepared"}
    /\ [type |-> "do_abort", dest |-> p] \in msgs
    /\ participant_states' = [participant_states EXCEPT ![p] = "aborted"]
    /\ UNCHANGED <<coordinator_state, decision, prepared, msgs>>

(***************************************************************************)
(* Timeout and recovery                                                    *)
(***************************************************************************)

\* Participant times out waiting for decision and aborts
ParticipantTimeout(p) ==
    /\ participant_states[p] = "working"
    /\ coordinator_state # "init"  \* Prepare was sent but no response yet
    /\ participant_states' = [participant_states EXCEPT ![p] = "aborted"]
    /\ UNCHANGED <<coordinator_state, decision, prepared, msgs>>

\* Coordinator recovery: if coordinator crashed while waiting, abort
CoordinatorRecovery ==
    /\ coordinator_state = "waiting"
    /\ coordinator_state' = "aborted"
    /\ decision' = "abort"
    /\ msgs' = msgs \cup {[type |-> "do_abort", dest |-> p] : p \in Participants}
    /\ UNCHANGED <<participant_states, prepared>>

(***************************************************************************)
(* Next-state relation                                                     *)
(***************************************************************************)

Next ==
    \/ Prepare
    \/ CoordinatorCommit
    \/ CoordinatorAbort
    \/ CoordinatorRecovery
    \/ \E p \in Participants :
        \/ VoteYes(p)
        \/ VoteNo(p)
        \/ ParticipantCommit(p)
        \/ ParticipantAbort(p)
        \/ ParticipantTimeout(p)

(***************************************************************************)
(* Fairness and specification                                              *)
(***************************************************************************)

Fairness ==
    /\ WF_vars(Prepare)
    /\ WF_vars(CoordinatorCommit)
    /\ WF_vars(CoordinatorAbort)
    /\ \A p \in Participants :
        /\ WF_vars(VoteYes(p))
        /\ WF_vars(ParticipantCommit(p))
        /\ WF_vars(ParticipantAbort(p))

Spec == Init /\ [][Next]_vars /\ Fairness

(***************************************************************************)
(* Safety invariants                                                       *)
(***************************************************************************)

\* No participant has committed while another has aborted
NoHalfCommit ==
    ~ \E p1, p2 \in Participants :
        /\ participant_states[p1] = "committed"
        /\ participant_states[p2] = "aborted"

\* If coordinator decided commit, no participant can be aborted;
\* if coordinator decided abort, no participant can be committed.
ConsistencyInvariant ==
    /\ (decision = "commit") =>
        (\A p \in Participants : participant_states[p] \in {"prepared", "committed"})
    /\ (decision = "abort") =>
        (\A p \in Participants : participant_states[p] \in {"working", "prepared", "aborted"})

\* Once a participant commits, it stays committed (no data loss)
NoDataLoss ==
    \A p \in Participants :
        (participant_states[p] = "committed") => (decision = "commit")

(***************************************************************************)
(* Liveness properties                                                     *)
(***************************************************************************)

\* The protocol eventually reaches a terminal state
EventuallyDecides ==
    <>(decision \in {"commit", "abort"})

\* All participants eventually reach a terminal state
AllParticipantsTerminate ==
    <>(\A p \in Participants : participant_states[p] \in {"committed", "aborted"})

====
