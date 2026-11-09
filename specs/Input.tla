----------------------------- MODULE Input -----------------------------
EXTENDS Naturals, FiniteSets
CONSTANT BuggyRelease
VARIABLES phase, falling, held, active
vars == <<phase, falling, held, active>>
Sources == {"w", "up", "touchGas1", "touchGas2", "a", "left", "s", "d"}
Actions == {"gas", "left", "brake", "right"}
Action(s) == CASE s \in {"w", "up", "touchGas1", "touchGas2"} -> "gas"
              [] s \in {"a", "left"} -> "left"
              [] s = "s" -> "brake"
              [] OTHER -> "right"
Effective(sources) == {Action(s) : s \in sources}
Init == /\ phase = "ready" /\ falling = FALSE /\ held = {} /\ active = {}
Press(s) == /\ phase = "running" /\ ~falling
            /\ held' = held \cup {s} /\ active' = active \cup {Action(s)}
            /\ UNCHANGED <<phase, falling>>
Release(s) == /\ held' = held \ {s}
              /\ active' = IF BuggyRelease THEN active \ {Action(s)} ELSE Effective(held')
              /\ UNCHANGED <<phase, falling>>
Pause == /\ phase = "running" /\ phase' = "paused" /\ held' = {} /\ active' = {}
         /\ UNCHANGED falling
Resume == /\ phase = "paused" /\ phase' = "running"
          /\ UNCHANGED <<falling, held, active>>
Start == /\ phase' = "running" /\ falling' = FALSE /\ held' = {} /\ active' = {}
Fall == /\ phase = "running" /\ ~falling /\ falling' = TRUE
        /\ held' = {} /\ active' = {} /\ UNCHANGED phase
Recover == /\ phase = "running" /\ falling /\ falling' = FALSE
           /\ held' = {} /\ active' = {} /\ UNCHANGED phase
Finish == /\ phase = "running" /\ ~falling /\ phase' = "finished"
          /\ held' = {} /\ active' = {} /\ UNCHANGED falling
Next == (\E s \in Sources : Press(s) \/ Release(s)) \/ Pause \/ Resume \/ Start \/ Fall \/ Recover \/ Finish
Spec == Init /\ [][Next]_vars
TypeOK == /\ phase \in {"ready", "running", "paused", "finished"}
          /\ falling \in BOOLEAN /\ held \subseteq Sources /\ active \subseteq Actions
ActiveMatchesHeld == active = Effective(held)
BlockedInputNeutral == (phase # "running" \/ falling) => (held = {} /\ active = {})
=============================================================================
