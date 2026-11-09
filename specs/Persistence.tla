----------------------------- MODULE Persistence -----------------------------
EXTENDS Naturals, FiniteSets
VARIABLES best, submitted, view, savedView
vars == <<best, submitted, view, savedView>>
Views == {"first", "chase", "top"}
Times == 1..3
Minimum(s) == CHOOSE t \in s : \A x \in s : t <= x
Init == /\ best = 0 /\ submitted = {} /\ view = "first" /\ savedView = "first"
Finish(t) == /\ submitted' = submitted \cup {t}
             /\ best' = IF best = 0 \/ t < best THEN t ELSE best
             /\ UNCHANGED <<view, savedView>>
SelectView(v) == /\ view' = v /\ savedView' = v /\ UNCHANGED <<best, submitted>>
CorruptView == /\ savedView' = "invalid" /\ UNCHANGED <<best, submitted, view>>
Reload == /\ view' = IF savedView \in Views THEN savedView ELSE "first"
          /\ UNCHANGED <<best, submitted, savedView>>
Next == (\E t \in Times : Finish(t)) \/ (\E v \in Views : SelectView(v)) \/ CorruptView \/ Reload
Spec == Init /\ [][Next]_vars
TypeOK == /\ best \in 0..3 /\ submitted \subseteq Times
          /\ view \in Views /\ savedView \in Views \cup {"invalid"}
BestIsMinimum == best = IF submitted = {} THEN 0 ELSE Minimum(submitted)
BestNeverWorsens == [][(best > 0 /\ best' > 0) => best' <= best]_vars
=============================================================================
