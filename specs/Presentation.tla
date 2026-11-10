------------------------- MODULE Presentation -------------------------
EXTENDS Integers
CONSTANTS BuggyToggle, BuggyAudio, BuggyBound
VARIABLES phase, quality, sound, particles, audioOn, score, priorScore, event
vars == <<phase, quality, sound, particles, audioOn, score, priorScore, event>>
Init == /\ phase = "ready" /\ quality = "full" /\ sound = FALSE
        /\ particles = 0 /\ audioOn = FALSE /\ score = 0 /\ priorScore = 0 /\ event = "init"
Run == /\ phase' = "running" /\ audioOn' = sound
       /\ event' = "run" /\ UNCHANGED <<quality, sound, particles, score, priorScore>>
Toggle == /\ quality' = IF quality = "full" THEN "low" ELSE "full"
          /\ particles' = 0 /\ priorScore' = score
          /\ score' = IF BuggyToggle THEN score + 1 ELSE score
          /\ event' = "toggle" /\ UNCHANGED <<phase, sound, audioOn>>
Sound == /\ sound' = ~sound /\ audioOn' = (~sound /\ phase = "running")
         /\ event' = "sound" /\ UNCHANGED <<phase, quality, particles, score, priorScore>>
Impact == /\ phase = "running" /\ quality = "full"
          /\ particles' = IF BuggyBound THEN 4 ELSE 3
          /\ event' = "impact" /\ UNCHANGED <<phase, quality, sound, audioOn, score, priorScore>>
Decay == /\ particles' = 0 /\ event' = "decay"
         /\ UNCHANGED <<phase, quality, sound, audioOn, score, priorScore>>
Pause == /\ phase' = "paused" /\ audioOn' = IF BuggyAudio THEN sound ELSE FALSE
         /\ event' = "pause" /\ UNCHANGED <<quality, sound, particles, score, priorScore>>
Finish == /\ phase' = "finished" /\ audioOn' = FALSE /\ event' = "finish"
          /\ UNCHANGED <<quality, sound, particles, score, priorScore>>
Reset == /\ phase' = "ready" /\ particles' = 0 /\ audioOn' = FALSE
         /\ score' = 0 /\ priorScore' = 0 /\ event' = "reset" /\ UNCHANGED <<quality, sound>>
Next == Run \/ Toggle \/ Sound \/ Impact \/ Decay \/ Pause \/ Finish \/ Reset
Spec == Init /\ [][Next]_vars
TypeOK == /\ phase \in {"ready","running","paused","finished"}
          /\ quality \in {"full","low"} /\ sound \in BOOLEAN /\ audioOn \in BOOLEAN
          /\ particles \in 0..4 /\ score \in 0..1 /\ priorScore \in 0..1
TogglePreservesScore == event = "toggle" => score = priorScore
QuietOutsideRace == phase # "running" => ~audioOn
BoundedParticles == particles <= 3
LowHasNoParticles == quality = "low" => particles = 0
ResetClearsEffects == event = "reset" => (particles = 0 /\ ~audioOn)
=============================================================================
