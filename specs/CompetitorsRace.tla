------------------------ MODULE CompetitorsRace ------------------------
EXTENDS Naturals, FiniteSets, Sequences
CONSTANTS BuggyFinish, BuggyReset, BuggyRank
VARIABLES map, phase, progress, checkpoint, finishOrder, event
vars == <<map, phase, progress, checkpoint, finishOrder, event>>
Ids == {"player", "ally", "rival-1", "rival-2"}
Blue == {"player", "ally"}
Priority(id) == CASE id = "ally" -> 1 [] id = "player" -> 2
                    [] id = "rival-1" -> 3 [] OTHER -> 4
Members(order) == {order[i] : i \in 1..Len(order)}
Place(id) == CHOOSE i \in 1..Len(finishOrder) : finishOrder[i] = id
Before(a, b) ==
    IF a \in Members(finishOrder)
    THEN IF b \in Members(finishOrder) THEN Place(a) < Place(b) ELSE TRUE
    ELSE IF b \in Members(finishOrder) THEN FALSE
         ELSE progress[a] > progress[b] \/
              (progress[a] = progress[b] /\ ~BuggyRank /\ Priority(a) < Priority(b))
Rank(id) == 1 + Cardinality({other \in Ids : Before(other, id)})
Points(id) == 5 - Rank(id)
BluePoints == Points("player") + Points("ally")
RedPoints == Points("rival-1") + Points("rival-2")
Init == /\ map = "circuit" /\ phase = "ready"
        /\ progress = [id \in Ids |-> 0] /\ checkpoint = [id \in Ids |-> 0]
        /\ finishOrder = <<>> /\ event = "init"
Reset(target, newMap, reason) ==
    /\ map' = newMap /\ phase' = target
    /\ progress' = [id \in Ids |-> 0] /\ checkpoint' = [id \in Ids |-> 0]
    /\ finishOrder' = IF BuggyReset THEN finishOrder ELSE <<>>
    /\ event' = reason
Start == /\ phase \in {"ready", "finished"} /\ Reset("running", map, "start")
Restart == Reset("running", map, "restart")
Switch == \E target \in {"circuit", "mountain"} : Reset("ready", target, "switch")
Pause == /\ phase = "running" /\ phase' = "paused" /\ event' = "pause"
         /\ UNCHANGED <<map, progress, checkpoint, finishOrder>>
Resume == /\ phase = "paused" /\ phase' = "running" /\ event' = "resume"
          /\ UNCHANGED <<map, progress, checkpoint, finishOrder>>
Advance(id) == /\ phase = "running" /\ id \notin Members(finishOrder)
               /\ progress[id] < 2
               /\ progress' = [progress EXCEPT ![id] = @ + 1]
               /\ checkpoint' = [checkpoint EXCEPT ![id] = @ + 1]
               /\ event' = "advance" /\ UNCHANGED <<map, phase, finishOrder>>
Bypass(id) == /\ phase = "running" /\ id \notin Members(finishOrder)
              /\ progress[id] < 2 /\ progress' = [progress EXCEPT ![id] = 2]
              /\ event' = "bypass" /\ UNCHANGED <<map, phase, checkpoint, finishOrder>>
Finish(id) == /\ phase = "running" /\ id \notin Members(finishOrder)
              /\ progress[id] = 2 /\ (checkpoint[id] = 2 \/ BuggyFinish)
              /\ finishOrder' = Append(finishOrder, id)
              /\ phase' = IF id = "player" THEN "finished" ELSE phase
              /\ event' = "finish" /\ UNCHANGED <<map, progress, checkpoint>>
Next == Start \/ Restart \/ Switch \/ Pause \/ Resume \/
        (\E id \in Ids : Advance(id) \/ Bypass(id) \/ Finish(id))
Spec == Init /\ [][Next]_vars
TypeOK == /\ map \in {"circuit", "mountain"}
          /\ phase \in {"ready", "running", "paused", "finished"}
          /\ progress \in [Ids -> 0..2] /\ checkpoint \in [Ids -> 0..2]
          /\ finishOrder \in Seq(Ids) /\ Len(finishOrder) <= 4
FinishOrderUnique == Cardinality(Members(finishOrder)) = Len(finishOrder)
FinishRequiresCheckpoints == \A id \in Members(finishOrder) :
    progress[id] = 2 /\ checkpoint[id] = 2
EveryRankUnique == {Rank(id) : id \in Ids} = 1..4
TeamScoreConserved == BluePoints + RedPoints = 10
ResetClearsResults == event \in {"start", "restart", "switch"} =>
    (progress = [id \in Ids |-> 0] /\ checkpoint = [id \in Ids |-> 0] /\ finishOrder = <<>>)
FinishOrderIsStable == [][(event' \notin {"start", "restart", "switch"}) =>
    SubSeq(finishOrder', 1, Len(finishOrder)) = finishOrder]_vars
FinishedProgressFrozen == [][(event' \notin {"start", "restart", "switch"}) =>
    (\A id \in Members(finishOrder) :
        progress'[id] = progress[id] /\ checkpoint'[id] = checkpoint[id])]_vars
StoppedRaceFrozen == [][(phase \in {"ready", "paused", "finished"} /\ phase' = phase /\
    event' \notin {"switch", "start", "restart"}) =>
        UNCHANGED <<map, progress, checkpoint, finishOrder>>]_vars
=============================================================================
