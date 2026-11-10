-------------------------- MODULE Competitors --------------------------
EXTENDS Naturals, FiniteSets
CONSTANTS BuggyPause, BuggyRecovery, BuggyYield, BuggyContact
VARIABLES subject, map, epoch, phase, roster, clock, penalty, actor, event
vars == <<subject, map, epoch, phase, roster, clock, penalty, actor, event>>
Ids == {"player", "ally", "rival-1", "rival-2"}
Computers == Ids \ {"player"}
Teams == [id \in Ids |-> IF id \in {"player", "ally"} THEN "blue" ELSE "red"]
InitialActor == [status |-> "racing", position |-> 0, checkpoint |-> 0,
    anchor |-> 0, remaining |-> 0, intent |-> "race", near |-> FALSE,
    blocked |-> FALSE, cooldown |-> 0, contacts |-> 0]
Init == /\ subject \in Computers /\ map = "circuit" /\ epoch = 0
        /\ phase = "ready" /\ roster = Teams /\ clock = 0 /\ penalty = 0
        /\ actor = InitialActor /\ event = "init"
Reset(target, newMap, reason) ==
    /\ map' = newMap /\ epoch' = 1 - epoch /\ phase' = target
    /\ roster' = Teams /\ clock' = 0 /\ penalty' = 0
    /\ actor' = InitialActor /\ event' = reason /\ UNCHANGED subject
Start == /\ phase \in {"ready", "finished"} /\ Reset("running", map, "start")
Restart == Reset("running", map, "restart")
Switch == \E target \in {"circuit", "mountain"} : Reset("ready", target, "switch")
Pause == /\ phase = "running" /\ phase' = "paused" /\ event' = "pause"
         /\ UNCHANGED <<subject, map, epoch, roster, clock, penalty, actor>>
Resume == /\ phase = "paused" /\ phase' = "running" /\ event' = "resume"
          /\ UNCHANGED <<subject, map, epoch, roster, clock, penalty, actor>>
PlayerFinish == /\ phase = "running" /\ phase' = "finished" /\ event' = "player-finish"
                /\ UNCHANGED <<subject, map, epoch, roster, clock, penalty, actor>>
PlayerPenalty == /\ phase = "running" /\ penalty < 2 /\ penalty' = penalty + 1
                 /\ event' = "player-penalty"
                 /\ UNCHANGED <<subject, map, epoch, phase, roster, clock, actor>>
Decide == /\ phase = "running" /\ actor.status = "racing"
          /\ \E near \in BOOLEAN, blocked \in BOOLEAN, front \in BOOLEAN :
              actor' = [actor EXCEPT !.near = near, !.blocked = blocked,
                  !.intent = IF near /\ subject = "ally" /\ ~BuggyYield THEN "yield"
                             ELSE IF blocked THEN "brake"
                             ELSE IF near \/ front THEN "pass" ELSE "race"]
          /\ event' = "decide"
          /\ UNCHANGED <<subject, map, epoch, phase, roster, clock, penalty>>
Drive == /\ phase = "running" /\ actor.status = "racing" /\ actor.position < 6
         /\ LET next == actor.position + 1
                earn == (actor.checkpoint = 0 /\ next = 2) \/
                        (actor.checkpoint = 1 /\ next = 4)
            IN actor' = [actor EXCEPT !.position = next,
                 !.checkpoint = IF earn THEN @ + 1 ELSE @,
                 !.anchor = IF earn THEN next ELSE @]
         /\ event' = "drive"
         /\ UNCHANGED <<subject, map, epoch, phase, roster, clock, penalty>>
Bypass == /\ phase = "running" /\ actor.status = "racing" /\ actor.position < 5
          /\ actor' = [actor EXCEPT !.position = @ + 2]
          /\ event' = "bypass"
          /\ UNCHANGED <<subject, map, epoch, phase, roster, clock, penalty>>
Reverse == /\ phase = "running" /\ actor.status = "racing" /\ actor.position > 0
           /\ actor' = [actor EXCEPT !.position = @ - 1]
           /\ event' = "reverse"
           /\ UNCHANGED <<subject, map, epoch, phase, roster, clock, penalty>>
BeginRecovery == /\ phase = "running" /\ actor.status = "racing"
                 /\ actor' = [actor EXCEPT !.status = "recovering", !.remaining = 2,
                      !.intent = "brake"]
                 /\ event' = "begin-recovery"
                 /\ UNCHANGED <<subject, map, epoch, phase, roster, clock, penalty>>
Tick == /\ (phase = "running" \/ (BuggyPause /\ phase = "paused"))
        /\ clock' = (clock + 1) % 3
        /\ actor' = IF actor.status = "finished" THEN actor
              ELSE IF actor.status = "recovering"
              THEN [actor EXCEPT !.remaining = @ - 1,
                  !.status = IF actor.remaining = 1 THEN "racing" ELSE @,
                  !.position = IF actor.remaining = 1
                      THEN IF BuggyRecovery THEN actor.anchor + 1
                           ELSE IF actor.position < actor.anchor THEN actor.position
                                ELSE actor.anchor
                      ELSE @,
                  !.cooldown = 0]
              ELSE [actor EXCEPT !.cooldown = 0]
        /\ event' = "tick"
        /\ UNCHANGED <<subject, map, epoch, phase, roster, penalty>>
Contact == /\ phase = "running" /\ actor.status = "racing" /\ actor.contacts < 2
           /\ actor' = [actor EXCEPT !.cooldown = 1,
                !.contacts = IF actor.cooldown = 0 \/ BuggyContact THEN @ + 1 ELSE @]
           /\ event' = "contact"
           /\ UNCHANGED <<subject, map, epoch, phase, roster, clock, penalty>>
Finish == /\ phase = "running" /\ actor.status = "racing"
          /\ actor.position = 6 /\ actor.checkpoint = 2
          /\ actor' = [actor EXCEPT !.status = "finished", !.intent = "brake"]
          /\ event' = "finish"
          /\ UNCHANGED <<subject, map, epoch, phase, roster, clock, penalty>>
Next == Start \/ Restart \/ Switch \/ Pause \/ Resume \/ PlayerFinish \/ PlayerPenalty
        \/ Decide \/ Drive \/ Bypass \/ Reverse \/ BeginRecovery \/ Tick \/ Contact \/ Finish
Spec == Init /\ [][Next]_vars /\ WF_vars(Tick)
TypeOK == /\ subject \in Computers /\ map \in {"circuit", "mountain"}
          /\ epoch \in 0..1 /\ phase \in {"ready", "running", "paused", "finished"}
          /\ roster \in [Ids -> {"blue", "red"}] /\ clock \in 0..2 /\ penalty \in 0..2
          /\ actor.status \in {"racing", "recovering", "finished"}
          /\ actor.position \in 0..6 /\ actor.checkpoint \in 0..2 /\ actor.anchor \in 0..4
          /\ actor.remaining \in 0..2 /\ actor.cooldown \in 0..1 /\ actor.contacts \in 0..2
          /\ actor.intent \in {"race", "yield", "pass", "brake"}
          /\ actor.near \in BOOLEAN /\ actor.blocked \in BOOLEAN
RosterStable == roster = Teams
ResetClearsCompetitor == event \in {"start", "restart", "switch"} =>
    (actor = InitialActor /\ clock = 0 /\ penalty = 0)
RecoveryIsPending == (actor.status = "recovering") <=> (actor.remaining > 0)
FinishedHasCheckpoints == actor.status = "finished" =>
    (actor.position = 6 /\ actor.checkpoint = 2)
PausedCompetitorsFrozen == [][(phase = "paused" /\ phase' = phase) =>
    UNCHANGED <<actor, clock, penalty, map, epoch, roster>>]_vars
FinishedCompetitorsFrozen == [][(phase = "finished" /\ phase' = phase) =>
    UNCHANGED <<actor, clock, penalty, map, epoch, roster>>]_vars
PenaltyDoesNotMoveComputers == [][event' = "player-penalty" =>
    UNCHANGED <<actor, clock>>]_vars
RecoveryCannotAdvanceProgress == [][(event' = "tick" /\ actor.status = "recovering" /\
    actor.remaining = 1) => (actor'.position <= actor.position /\
                            actor'.position <= actor.anchor)]_vars
AllyYieldsToPlayer == [][(event' = "decide" /\ subject = "ally" /\ actor'.near) =>
    actor'.intent \in {"yield", "brake"}]_vars
CooldownSuppressesContact == [][(event' = "contact" /\ actor.cooldown > 0) =>
    actor'.contacts = actor.contacts]_vars
FinishedActorNeverMoves == [][(actor.status = "finished" /\
    event' \notin {"start", "restart", "switch"}) => UNCHANGED actor]_vars
RecoveryEventuallyEndsOrStops == [](actor.status = "recovering" =>
    <>(actor.status # "recovering" \/ phase # "running"))
=============================================================================
