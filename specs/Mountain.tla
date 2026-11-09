---------------------------- MODULE Mountain ----------------------------
EXTENDS Naturals
CONSTANT BuggyFinish
VARIABLES phase, sector, checkpoint, falling, penalty, recoveries, event
vars == <<phase, sector, checkpoint, falling, penalty, recoveries, event>>
Init == /\ phase = "ready" /\ sector = 0 /\ checkpoint = 0
        /\ falling = FALSE /\ penalty = 0 /\ recoveries = 0 /\ event = "init"
Reset == /\ phase' = "running" /\ sector' = 0 /\ checkpoint' = 0
         /\ falling' = FALSE /\ penalty' = 0 /\ recoveries' = 0 /\ event' = "reset"
SelectMap == /\ phase' = "ready" /\ sector' = 0 /\ checkpoint' = 0
             /\ falling' = FALSE /\ penalty' = 0 /\ recoveries' = 0 /\ event' = "map"
Pause == /\ phase = "running" /\ phase' = "paused" /\ event' = "pause"
         /\ UNCHANGED <<sector, checkpoint, falling, penalty, recoveries>>
Resume == /\ phase = "paused" /\ phase' = "running" /\ event' = "resume"
          /\ UNCHANGED <<sector, checkpoint, falling, penalty, recoveries>>
Forward == /\ phase = "running" /\ ~falling /\ sector < 6
           /\ sector' = sector + 1
           /\ checkpoint' = IF sector < 5 /\ sector + 1 > checkpoint THEN sector + 1 ELSE checkpoint
           /\ phase' = IF sector = 5 /\ checkpoint = 5 THEN "finished" ELSE phase
           /\ event' = "forward" /\ UNCHANGED <<falling, penalty, recoveries>>
Reverse == /\ phase = "running" /\ ~falling /\ sector > 0
           /\ sector' = sector - 1 /\ event' = "reverse"
           /\ UNCHANGED <<phase, checkpoint, falling, penalty, recoveries>>
TryFinish == /\ phase = "running" /\ ~falling
             /\ (BuggyFinish \/ (sector = 6 /\ checkpoint = 5))
             /\ phase' = "finished" /\ event' = "finish"
             /\ UNCHANGED <<sector, checkpoint, falling, penalty, recoveries>>
Fall == /\ phase = "running" /\ ~falling /\ falling' = TRUE /\ event' = "fall"
        /\ UNCHANGED <<phase, sector, checkpoint, penalty, recoveries>>
Recover(cost, kind) == /\ phase = "running" /\ recoveries < 2
                      /\ (kind # "auto" \/ falling)
                      /\ sector' = checkpoint /\ falling' = FALSE
                      /\ penalty' = penalty + cost /\ recoveries' = recoveries + 1 /\ event' = kind
                      /\ UNCHANGED <<phase, checkpoint>>
Next == Reset \/ SelectMap \/ Pause \/ Resume \/ Forward \/ Reverse \/ TryFinish \/ Fall
        \/ Recover(5, "auto") \/ Recover(3, "manual")
Spec == Init /\ [][Next]_vars
TypeOK == /\ phase \in {"ready", "running", "paused", "finished"}
          /\ sector \in 0..6 /\ checkpoint \in 0..5 /\ falling \in BOOLEAN
          /\ penalty \in 0..10 /\ recoveries \in 0..2
          /\ event \in {"init", "reset", "map", "pause", "resume", "forward", "reverse", "finish", "fall", "auto", "manual"}
SummitRequiresCheckpoints == phase = "finished" => (sector = 6 /\ checkpoint = 5 /\ ~falling)
ReverseKeepsCheckpoint == [][event' = "reverse" => checkpoint' = checkpoint]_vars
RecoveryAtEarnedCheckpoint == [][event' \in {"auto", "manual"} => sector' = checkpoint]_vars
ExactAutoPenalty == [][event' = "auto" => penalty' = penalty + 5]_vars
ExactManualPenalty == [][event' = "manual" => penalty' = penalty + 3]_vars
PausedRouteFrozen == [][(phase = "paused" /\ phase' = "paused") => UNCHANGED <<sector, checkpoint, falling, penalty>>]_vars
=============================================================================
