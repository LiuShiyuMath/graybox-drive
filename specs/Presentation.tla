------------------------- MODULE Presentation -------------------------
EXTENDS Integers
CONSTANTS BuggyToggle, BuggyAudio, BuggyBound, BuggyTrail
VARIABLES phase, quality, sound, particles, audioOn, score, priorScore, event, trails, drifting, airborne
vars == <<phase, quality, sound, particles, audioOn, score, priorScore, event, trails, drifting, airborne>>
Init == /\ phase = "ready" /\ quality = "full" /\ sound = FALSE
        /\ particles = 0 /\ trails = 0 /\ drifting = FALSE /\ airborne = FALSE /\ audioOn = FALSE /\ score = 0 /\ priorScore = 0 /\ event = "init"
Run == /\ phase' = "running" /\ audioOn' = sound
       /\ event' = "run" /\ UNCHANGED <<quality, sound, particles, score, priorScore, trails, drifting, airborne>>
Toggle == /\ quality' = IF quality = "full" THEN "low" ELSE "full"
          /\ particles' = 0 /\ trails' = 0 /\ priorScore' = score
          /\ score' = IF BuggyToggle THEN score + 1 ELSE score
          /\ event' = "toggle" /\ UNCHANGED <<phase, sound, audioOn, drifting, airborne>>
Sound == /\ sound' = ~sound /\ audioOn' = (~sound /\ phase = "running")
         /\ event' = "sound" /\ UNCHANGED <<phase, quality, particles, score, priorScore, trails, drifting, airborne>>
Impact == /\ phase = "running" /\ quality = "full"
          /\ particles' = IF BuggyBound THEN 4 ELSE 3
          /\ event' = "impact" /\ UNCHANGED <<phase, quality, sound, audioOn, score, priorScore, trails, drifting, airborne>>
Decay == /\ particles' = 0 /\ event' = "decay"
         /\ UNCHANGED <<phase, quality, sound, audioOn, score, priorScore, trails, drifting, airborne>>
Pause == /\ phase' = "paused" /\ audioOn' = IF BuggyAudio THEN sound ELSE FALSE
         /\ event' = "pause" /\ UNCHANGED <<quality, sound, particles, score, priorScore, trails, drifting, airborne>>
Finish == /\ phase' = "finished" /\ audioOn' = FALSE /\ event' = "finish"
          /\ UNCHANGED <<quality, sound, particles, score, priorScore, trails, drifting, airborne>>
Reset == /\ phase' = "ready" /\ particles' = 0 /\ trails' = 0 /\ drifting' = FALSE /\ airborne' = FALSE /\ audioOn' = FALSE
         /\ score' = 0 /\ priorScore' = 0 /\ event' = "reset" /\ UNCHANGED <<quality, sound>>
Skid == /\ phase = "running" /\ drifting' = TRUE /\ airborne' = FALSE
        /\ trails' = IF quality = "low" THEN 0 ELSE IF BuggyTrail THEN 4 ELSE 3
        /\ event' = "skid" /\ UNCHANGED <<phase, quality, sound, particles, audioOn, score, priorScore>>
Air == /\ phase = "running" /\ drifting' = FALSE /\ airborne' = TRUE
       /\ event' = "air" /\ UNCHANGED <<phase, quality, sound, particles, audioOn, score, priorScore, trails>>
Ground == /\ phase = "running" /\ drifting' = FALSE /\ airborne' = FALSE
          /\ event' = "ground" /\ UNCHANGED <<phase, quality, sound, particles, audioOn, score, priorScore, trails>>
Next == Skid \/ Air \/ Ground \/ Run \/ Toggle \/ Sound \/ Impact \/ Decay \/ Pause \/ Finish \/ Reset
Spec == Init /\ [][Next]_vars
TypeOK == /\ phase \in {"ready","running","paused","finished"}
          /\ quality \in {"full","low"} /\ sound \in BOOLEAN /\ audioOn \in BOOLEAN
          /\ trails \in 0..4 /\ drifting \in BOOLEAN /\ airborne \in BOOLEAN
          /\ particles \in 0..4 /\ score \in 0..1 /\ priorScore \in 0..1
TogglePreservesScore == event = "toggle" => score = priorScore
QuietOutsideRace == phase # "running" => ~audioOn
BoundedParticles == particles <= 3
BoundedTrails == trails <= 3
LowHasNoTrails == quality = "low" => trails = 0
LowHasNoParticles == quality = "low" => particles = 0
ResetClearsEffects == event = "reset" => (particles = 0 /\ trails = 0 /\ ~drifting /\ ~airborne /\ ~audioOn)
=============================================================================
