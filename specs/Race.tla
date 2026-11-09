----------------------------- MODULE Race -----------------------------
EXTENDS Naturals
CONSTANT BuggyReverse
VARIABLES phase, lap, segment, clock, view, event
vars == <<phase, lap, segment, clock, view, event>>
Views == {"first", "chase", "top"}
Init == /\ phase = "ready" /\ lap = 1 /\ segment = 0 /\ clock = 0
        /\ view = "first" /\ event = "init"
Start == /\ event' = "start" /\ phase \in {"ready", "finished"}
         /\ phase' = "running" /\ lap' = 1 /\ segment' = 0 /\ clock' = 0
         /\ UNCHANGED view
Pause == /\ event' = "pause" /\ phase = "running" /\ phase' = "paused"
         /\ UNCHANGED <<lap, segment, clock, view>>
Resume == /\ event' = "resume" /\ phase = "paused" /\ phase' = "running"
          /\ UNCHANGED <<lap, segment, clock, view>>
Restart == /\ event' = "reset" /\ phase' = "running" /\ lap' = 1 /\ segment' = 0 /\ clock' = 0
           /\ UNCHANGED view
Tick == /\ event' = "tick" /\ phase = "running" /\ clock' = IF clock < 2 THEN clock + 1 ELSE 2
        /\ UNCHANGED <<phase, lap, segment, view>>
Forward == /\ event' = "forward" /\ phase = "running"
           /\ IF segment < 2
                 THEN /\ segment' = segment + 1 /\ UNCHANGED <<phase, lap>>
                 ELSE IF lap < 3
                      THEN /\ lap' = lap + 1 /\ segment' = 0 /\ UNCHANGED phase
                      ELSE /\ phase' = "finished" /\ segment' = 3 /\ UNCHANGED lap
           /\ UNCHANGED <<clock, view>>
Reverse == /\ event' = "reverse" /\ phase = "running" /\ segment' = IF segment > 0 THEN segment - 1 ELSE 0
           /\ lap' = IF BuggyReverse /\ lap < 3 THEN lap + 1 ELSE lap
           /\ UNCHANGED <<phase, clock, view>>
ChangeView == /\ event' = "view" /\ view' \in Views /\ UNCHANGED <<phase, lap, segment, clock>>
Next == Start \/ Pause \/ Resume \/ Restart \/ Tick \/ Forward \/ Reverse \/ ChangeView
Spec == Init /\ [][Next]_vars
TypeOK == /\ phase \in {"ready", "running", "paused", "finished"}
          /\ lap \in 1..3 /\ segment \in 0..3 /\ clock \in 0..2 /\ view \in Views
          /\ event \in {"init", "start", "pause", "resume", "reset", "tick", "forward", "reverse", "view"}
FinishOnlyAfterThreeLaps == (phase = "finished") <=> (lap = 3 /\ segment = 3)
ViewPreservesRace == [][(view' # view) => UNCHANGED <<phase, lap, segment, clock>>]_vars
InactiveClockFrozen == [][(phase # "running" /\ phase' = phase) => UNCHANGED clock]_vars
ReverseCannotAddLap == [][(event' = "reverse") => lap' = lap]_vars
=============================================================================
