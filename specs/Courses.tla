---------------------------- MODULE Courses ----------------------------
EXTENDS Naturals, FiniteSets
CONSTANTS BuggyCheckpoint, BuggyFinish
VARIABLES map, phase, lap, cp, air, collected, signal, crossed, penalties, event
vars == <<map, phase, lap, cp, air, collected, signal, crossed, penalties, event>>
Maps == {"proving", "city", "offroad"}
Init == /\ map = "proving" /\ phase = "ready" /\ lap = 1 /\ cp = 0
        /\ air = 0 /\ collected = {} /\ signal = "green" /\ crossed = FALSE
        /\ penalties = 0 /\ event = "init"
Start == /\ phase \in {"ready", "finished"} /\ phase' = "running"
         /\ lap' = 1 /\ cp' = 0 /\ air' = 0 /\ collected' = {}
         /\ crossed' = FALSE /\ penalties' = 0 /\ event' = "start"
         /\ UNCHANGED <<map, signal>>
Switch == /\ map' \in Maps /\ phase' = "ready" /\ lap' = 1 /\ cp' = 0
          /\ air' = 0 /\ collected' = {} /\ crossed' = FALSE /\ penalties' = 0
          /\ event' = "switch" /\ UNCHANGED signal
Pause == /\ phase = "running" /\ phase' = "paused" /\ event' = "pause"
         /\ UNCHANGED <<map, lap, cp, air, collected, signal, crossed, penalties>>
Resume == /\ phase = "paused" /\ phase' = "running" /\ event' = "resume"
          /\ UNCHANGED <<map, lap, cp, air, collected, signal, crossed, penalties>>
Checkpoint == /\ phase = "running" /\ cp < 2 /\ cp' = cp + 1 /\ event' = "checkpoint"
              /\ UNCHANGED <<map, phase, lap, air, collected, signal, crossed, penalties>>
CompleteLap == /\ phase = "running" /\ (cp = 2 \/ BuggyCheckpoint)
               /\ IF lap < 3
                     THEN /\ lap' = lap + 1 /\ cp' = 0 /\ UNCHANGED phase
                     ELSE /\ phase' = "finished" /\ cp' = (IF BuggyFinish THEN 0 ELSE cp) /\ UNCHANGED lap
               /\ event' = "lap"
               /\ UNCHANGED <<map, air, collected, signal, crossed, penalties>>
Jump == /\ phase = "running" /\ map = "offroad" /\ air = 0 /\ air' = 2
        /\ event' = "jump" /\ UNCHANGED <<map, phase, lap, cp, collected, signal, crossed, penalties>>
Land == /\ phase = "running" /\ air > 0 /\ air' = air - 1
        /\ event' = "land" /\ UNCHANGED <<map, phase, lap, cp, collected, signal, crossed, penalties>>
Recover == /\ phase = "running" /\ air' = 0 /\ event' = "recover"
           /\ UNCHANGED <<map, phase, lap, cp, collected, signal, crossed, penalties>>
Collect == /\ phase = "running" /\ map = "offroad"
           /\ \E token \in {1, 2}: collected' = collected \cup {token}
           /\ event' = "collect" /\ UNCHANGED <<map, phase, lap, cp, air, signal, crossed, penalties>>
Signal == /\ phase = "running" /\ signal' \in {"green", "red"} /\ event' = "signal"
          /\ UNCHANGED <<map, phase, lap, cp, air, collected, crossed, penalties>>
Cross == /\ phase = "running" /\ map = "city" /\ ~crossed /\ crossed' = TRUE
         /\ penalties' = (IF signal = "red" THEN 1 ELSE 0) /\ event' = "cross"
         /\ UNCHANGED <<map, phase, lap, cp, air, collected, signal>>
Next == Start \/ Switch \/ Pause \/ Resume \/ Checkpoint \/ CompleteLap \/ Jump \/ Land \/ Recover \/ Collect \/ Signal \/ Cross
Spec == Init /\ [][Next]_vars
TypeOK == /\ map \in Maps /\ phase \in {"ready", "running", "paused", "finished"}
          /\ lap \in 1..3 /\ cp \in 0..2 /\ air \in 0..2 /\ collected \subseteq {1, 2}
          /\ signal \in {"green", "red"} /\ crossed \in BOOLEAN /\ penalties \in 0..1
FinishedHasCheckpoints == phase = "finished" => (lap = 3 /\ cp = 2)
EveryLapRequiresCheckpoints == [][(lap' > lap) => cp = 2]_vars
SwitchClearsRun == event = "switch" => (phase = "ready" /\ lap = 1 /\ cp = 0 /\ air = 0 /\ collected = {})
PausedWorldFrozen == [][(phase = "paused" /\ phase' = phase) => UNCHANGED <<lap, cp, air, collected, signal, crossed, penalties>>]_vars
RedCrossingCharged == [][(event' = "cross") => penalties' = (IF signal = "red" THEN 1 ELSE 0)]_vars
=============================================================================
