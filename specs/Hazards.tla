----------------------------- MODULE Hazards -----------------------------
EXTENDS Naturals
CONSTANTS AutoPenalty, BuggyCooldown
VARIABLES phase, surface, fall, impact, cooldown, motion, manual, automatic, penalty, event
vars == <<phase, surface, fall, impact, cooldown, motion, manual, automatic, penalty, event>>
Ground == {"road", "curb", "runoff", "edge"}
Dec(n) == IF n > 0 THEN n - 1 ELSE 0
Init == /\ phase = "running" /\ surface = "road" /\ fall = 0
        /\ impact = 0 /\ cooldown = 0 /\ motion = "stopped"
        /\ manual = 0 /\ automatic = 0 /\ penalty = 0 /\ event = "init"
Reset == /\ event' = "reset" /\ phase' = "running" /\ surface' = "road" /\ fall' = 0
         /\ impact' = 0 /\ cooldown' = 0 /\ motion' = "stopped"
         /\ manual' = 0 /\ automatic' = 0 /\ penalty' = 0
Pause == /\ event' = "pause" /\ phase = "running" /\ phase' = "paused"
         /\ UNCHANGED <<surface, fall, impact, cooldown, motion, manual, automatic, penalty>>
Resume == /\ event' = "resume" /\ phase = "paused" /\ phase' = "running"
          /\ UNCHANGED <<surface, fall, impact, cooldown, motion, manual, automatic, penalty>>
Move == /\ event' = "move" /\ phase = "running" /\ fall = 0 /\ motion' \in {"stopped", "forward", "reverse"}
        /\ surface' \in Ground
        /\ UNCHANGED <<phase, fall, impact, cooldown, manual, automatic, penalty>>
BeginFall == /\ event' = "fall" /\ phase = "running" /\ fall = 0 /\ automatic < 2
             /\ fall' = 1 /\ surface' = "fall"
             /\ UNCHANGED <<phase, impact, cooldown, motion, manual, automatic, penalty>>
Tick == /\ event' = "tick" /\ phase = "running" /\ fall < 2
        /\ fall' = IF fall = 1 THEN 2 ELSE 0
        /\ impact' = Dec(impact) /\ cooldown' = Dec(cooldown)
        /\ UNCHANGED <<phase, surface, motion, manual, automatic, penalty>>
AutoRecover == /\ event' = "auto" /\ phase = "running" /\ fall = 2 /\ automatic < 2
               /\ automatic' = automatic + 1 /\ penalty' = penalty + AutoPenalty
               /\ fall' = 0 /\ surface' = "road" /\ impact' = 0 /\ motion' = "stopped"
               /\ UNCHANGED <<phase, cooldown, manual>>
ManualRecover == /\ event' = "manual" /\ phase = "running" /\ manual < 2
                 /\ manual' = manual + 1 /\ penalty' = penalty + 3
                 /\ fall' = 0 /\ surface' = "road" /\ impact' = 0 /\ motion' = "stopped"
                 /\ UNCHANGED <<phase, cooldown, automatic>>
Contact(high) == /\ event' = "contact" /\ phase = "running" /\ fall = 0
                 /\ motion' = CASE motion = "forward" -> "reverse"
                                    [] motion = "reverse" -> "forward"
                                    [] OTHER -> "stopped"
                 /\ impact' = IF high /\ motion # "stopped" /\ (cooldown = 0 \/ BuggyCooldown) THEN 2 ELSE impact
                 /\ cooldown' = IF high /\ motion # "stopped" /\ (cooldown = 0 \/ BuggyCooldown) THEN 2 ELSE cooldown
                 /\ UNCHANGED <<phase, surface, fall, manual, automatic, penalty>>
Next == Reset \/ Pause \/ Resume \/ Move \/ BeginFall \/ Tick \/ AutoRecover \/ ManualRecover
        \/ (\E high \in BOOLEAN : Contact(high))
Spec == Init /\ [][Next]_vars /\ WF_vars(Tick) /\ WF_vars(AutoRecover)
TypeOK == /\ phase \in {"running", "paused"} /\ surface \in Ground \cup {"fall"}
          /\ fall \in 0..2 /\ impact \in 0..2 /\ cooldown \in 0..2
          /\ motion \in {"stopped", "forward", "reverse"}
          /\ event \in {"init", "reset", "pause", "resume", "move", "fall", "tick", "auto", "manual", "contact"}
          /\ manual \in 0..2 /\ automatic \in 0..2 /\ penalty \in 0..20
ExactRecoveryPenalty == penalty = 3 * manual + 5 * automatic
FallMatchesSurface == (fall > 0) <=> (surface = "fall")
PausedHazardFrozen == [][(phase = "paused" /\ phase' = "paused") =>
                         UNCHANGED <<surface, fall, impact, cooldown, motion, manual, automatic, penalty>>]_vars
CooldownSuppressesFeedback == [][(cooldown > 0 /\ event' = "contact") => impact' = impact]_vars
RecoveryProgress == (phase = "running" /\ fall > 0) ~> (fall = 0 \/ phase = "paused")
=============================================================================
