-------------------------- MODULE VehicleWorld --------------------------
EXTENDS Integers, FiniteSets
CONSTANTS BuggyRecovery, BuggyCrossing, BuggyFeedback, BuggyToast, BuggyCollection
VARIABLES group, phase, held, world, event
vars == <<group, phase, held, world, event>>
Groups == {"motion", "jump", "traffic", "collection", "feedback"}
Phases == {"ready", "running", "paused", "finished"}
Speeds == {"stopped", "forward", "reverse"}
Materials == {"asphalt", "grass", "gravel", "mud"}
Ground == {"road", "curb", "runoff", "edge"}
Dec(n) == IF n > 0 THEN n - 1 ELSE 0
Signal(clock) == IF clock < 6 THEN "green" ELSE IF clock = 6 THEN "amber" ELSE "red"
Feedback(kind, fall, impact) ==
    IF BuggyFeedback /\ impact > 0 THEN "impact"
    ELSE IF fall > 0 THEN "fall" ELSE IF impact > 0 THEN "impact" ELSE kind
InitialWorld == [speed |-> "stopped", steer |-> 0, material |-> "asphalt", slip |-> 0,
    air |-> 0, ramp |-> "none", clock |-> 0, side |-> "before", crossings |-> 0,
    violations |-> 0, penalty |-> 0, approach |-> FALSE, stopped |-> FALSE,
    direction |-> "out", collected |-> {}, kind |-> "road", fall |-> 0,
    impact |-> 0, dust |-> 0, shown |-> "road", generation |-> 0,
    timers |-> {}, toast |-> FALSE]
Physics == <<world.speed, world.steer, world.material, world.slip, world.air, world.ramp,
    world.clock, world.side, world.crossings, world.violations, world.penalty,
    world.approach, world.stopped, world.direction, world.collected,
    world.kind, world.fall, world.impact, world.dust, world.shown>>
Init == /\ group \in Groups /\ phase = "ready" /\ held = FALSE
        /\ world = InitialWorld /\ event = "init"
NewRun(target, reason) == /\ phase' = target /\ held' = FALSE
                         /\ world' = InitialWorld /\ event' = reason /\ UNCHANGED group
Start == /\ phase \in {"ready", "finished"} /\ NewRun("running", "start")
Restart == NewRun("running", "reset")
SelectMap == NewRun("ready", "map")
Pause == /\ phase = "running" /\ phase' = "paused" /\ held' = FALSE
         /\ event' = "pause" /\ UNCHANGED <<group, world>>
Resume == /\ phase = "paused" /\ phase' = "running" /\ event' = "resume"
          /\ UNCHANGED <<group, held, world>>
LoseFocus == /\ phase' = IF phase = "running" THEN "paused" ELSE phase
             /\ held' = FALSE /\ event' = "focus" /\ UNCHANGED <<group, world>>
Finish == /\ phase = "running" /\ world.fall = 0 /\ phase' = "finished"
          /\ held' = FALSE /\ event' = "finish" /\ UNCHANGED <<group, world>>
Press == /\ phase = "running" /\ world.fall = 0 /\ held' = TRUE
         /\ event' = "press" /\ UNCHANGED <<group, phase, world>>
Release == /\ held' = FALSE /\ event' = "release" /\ UNCHANGED <<group, phase, world>>
Recover == /\ phase = "running" /\ held' = FALSE /\ event' = "recover"
           /\ world' = [world EXCEPT !.slip = IF BuggyRecovery THEN @ ELSE 0,
                !.air = IF BuggyRecovery THEN @ ELSE 0, !.fall = 0, !.impact = 0,
                !.kind = "road", !.dust = 0, !.shown = "road"]
           /\ UNCHANGED <<group, phase>>
Drive == /\ group = "motion" /\ phase = "running" /\ event' = "drive"
         /\ \E speed \in Speeds, steer \in -1..1, material \in Materials :
              world' = [world EXCEPT !.speed = speed, !.steer = steer, !.material = material,
                !.slip = IF material = "asphalt" \/ speed = "stopped" \/ steer = 0
                          THEN Dec(@) ELSE 2]
         /\ UNCHANGED <<group, phase, held>>
Launch == /\ group = "jump" /\ phase = "running" /\ world.air = 0
          /\ \E ramp \in {"A", "B"} :
               /\ ramp # world.ramp /\ world' = [world EXCEPT !.air = 2, !.ramp = ramp]
          /\ event' = "launch" /\ UNCHANGED <<group, phase, held>>
AirTick == /\ group = "jump" /\ phase = "running" /\ world.air > 0
           /\ world' = [world EXCEPT !.air = @ - 1]
           /\ event' = "air" /\ UNCHANGED <<group, phase, held>>
LeaveRamp == /\ group = "jump" /\ phase = "running" /\ world.air = 0
             /\ world.ramp # "none" /\ world' = [world EXCEPT !.ramp = "none"]
             /\ event' = "leave-ramp" /\ UNCHANGED <<group, phase, held>>
SignalTick == /\ group = "traffic" /\ phase = "running"
              /\ world' = [world EXCEPT !.clock = (@ + 1) % 12]
              /\ event' = "signal" /\ UNCHANGED <<group, phase, held>>
Cross == /\ group = "traffic" /\ phase = "running" /\ world.crossings < 2
         /\ (world.side = "before" \/ BuggyCrossing)
         /\ world' = [world EXCEPT !.side = "after", !.crossings = @ + 1,
              !.violations = @ + IF Signal(world.clock) = "green" THEN 0 ELSE 1,
              !.penalty = @ + IF Signal(world.clock) = "green" THEN 0 ELSE 3,
              !.clock = IF Signal(world.clock) = "green" THEN @ ELSE (@ + 3) % 12]
         /\ event' = "cross" /\ UNCHANGED <<group, phase, held>>
ReverseCross == /\ group = "traffic" /\ phase = "running" /\ world.side = "after"
                /\ world' = [world EXCEPT !.side = "before"]
                /\ event' = "reverse-cross" /\ UNCHANGED <<group, phase, held>>
Approach == /\ group = "traffic" /\ phase = "running"
            /\ \E approaching \in BOOLEAN : world' = [world EXCEPT !.approach = approaching]
            /\ event' = "approach" /\ UNCHANGED <<group, phase, held>>
TrafficTick == /\ group = "traffic" /\ phase = "running"
               /\ world' = [world EXCEPT !.stopped = world.approach /\ Signal(world.clock) # "red"]
               /\ event' = "traffic" /\ UNCHANGED <<group, phase, held>>
TurnAround == /\ group = "traffic" /\ phase = "running"
              /\ world' = [world EXCEPT !.direction = IF @ = "out" THEN "back" ELSE "out"]
              /\ event' = "turn" /\ UNCHANGED <<group, phase, held>>
Collect == /\ group = "collection" /\ phase = "running"
           /\ \E token \in {1, 2} : world' = [world EXCEPT !.collected =
                IF BuggyCollection /\ token \in @ THEN @ \ {token} ELSE @ \cup {token}]
           /\ event' = "collect" /\ UNCHANGED <<group, phase, held>>
Surface == /\ group = "feedback" /\ phase = "running" /\ world.fall = 0
           /\ \E kind \in Ground : world' = [world EXCEPT !.kind = kind,
                !.shown = Feedback(kind, world.fall, world.impact)]
           /\ event' = "surface" /\ UNCHANGED <<group, phase, held>>
Contact == /\ group = "feedback" /\ phase = "running" /\ world.fall = 0
           /\ world' = [world EXCEPT !.impact = 2, !.shown = "impact"]
           /\ event' = "contact" /\ UNCHANGED <<group, phase, held>>
Fall == /\ group = "feedback" /\ phase = "running" /\ world.fall = 0
        /\ world' = [world EXCEPT !.fall = 1, !.kind = "fall",
             !.shown = Feedback("fall", 1, world.impact)]
        /\ held' = FALSE /\ event' = "fall" /\ UNCHANGED <<group, phase>>
FeedbackTick == /\ group = "feedback" /\ phase = "running"
                /\ LET fall == IF world.fall > 0 THEN 2 ELSE 0
                       impact == Dec(world.impact)
                   IN world' = [world EXCEPT !.fall = fall, !.impact = impact,
                       !.dust = IF fall > 0 THEN @ ELSE IF world.kind = "runoff" THEN 2 ELSE Dec(@),
                       !.shown = Feedback(world.kind, fall, impact)]
                /\ event' = "feedback" /\ UNCHANGED <<group, phase, held>>
ShowToast == /\ group = "feedback" /\ phase = "running" /\ world.generation < 2
             /\ LET next == world.generation + 1
                IN world' = [world EXCEPT !.generation = next, !.toast = TRUE,
                    !.timers = IF BuggyToast THEN @ \cup {next} ELSE {next}]
             /\ event' = "toast" /\ UNCHANGED <<group, phase, held>>
ExpireToast == /\ group = "feedback" /\ \E timer \in world.timers :
                    world' = [world EXCEPT !.timers = @ \ {timer}, !.toast = FALSE]
               /\ event' = "expire" /\ UNCHANGED <<group, phase, held>>
Next == Start \/ Restart \/ SelectMap \/ Pause \/ Resume \/ LoseFocus \/ Finish \/ Press \/ Release
        \/ Recover \/ Drive \/ Launch \/ AirTick \/ LeaveRamp \/ SignalTick \/ Cross \/ ReverseCross
        \/ Approach \/ TrafficTick \/ TurnAround \/ Collect \/ Surface \/ Contact \/ Fall
        \/ FeedbackTick \/ ShowToast \/ ExpireToast
Spec == Init /\ [][Next]_vars /\ WF_vars(AirTick)
TypeOK == /\ group \in Groups /\ phase \in Phases /\ held \in BOOLEAN
          /\ world \in [speed : Speeds, steer : -1..1, material : Materials, slip : 0..2,
              air : 0..2, ramp : {"none", "A", "B"}, clock : 0..11,
              side : {"before", "after"}, crossings : 0..2, violations : 0..2,
              penalty : {0, 3, 6}, approach : BOOLEAN, stopped : BOOLEAN,
              direction : {"out", "back"}, collected : SUBSET {1, 2},
              kind : Ground \cup {"fall"}, fall : 0..2, impact : 0..2, dust : 0..2,
              shown : Ground \cup {"fall", "impact"}, generation : 0..2,
              timers : SUBSET {1, 2}, toast : BOOLEAN]
BlockedInputNeutral == (phase # "running" \/ world.fall > 0) => ~held
RecoveryClearsFlightAndSlip == event = "recover" =>
    (world.air = 0 /\ world.slip = 0 /\ world.fall = 0 /\ world.impact = 0 /\ world.dust = 0)
ExactCrossingPenalty == world.penalty = 3 * world.violations
FallDominatesImpact == world.fall > 0 => world.shown = "fall"
FeedbackMatchesPriority == world.shown =
    IF world.fall > 0 THEN "fall" ELSE IF world.impact > 0 THEN "impact" ELSE world.kind
NewToastOwnsTimeout == world.timers \subseteq {world.generation}
MapClearsHiddenState == event = "map" => world = InitialWorld
FocusLossClearsInput == event = "focus" => ~held
PausedSimulationFrozen == [][(phase = "paused" /\ phase' = phase) => UNCHANGED Physics]_vars
RecoveryPreservesRampLock == [][event' = "recover" => world.ramp' = world.ramp]_vars
RecoveryPreservesCollections == [][event' = "recover" => world.collected' = world.collected]_vars
SameRampCannotRelaunch == [][event' = "launch" => world.ramp' # world.ramp]_vars
CrossingRequiresNegativeSide == [][event' = "cross" => world.side = "before"]_vars
NonGreenCrossingCharged == [][event' = "cross" => world.penalty' = world.penalty +
    IF Signal(world.clock) = "green" THEN 0 ELSE 3]_vars
CrossingPenaltyAdvancesSignal == [][event' = "cross" => world.clock' =
    IF Signal(world.clock) = "green" THEN world.clock ELSE (world.clock + 3) % 12]_vars
ReverseCrossingHasNoPenalty == [][event' = "reverse-cross" =>
    UNCHANGED <<world.penalty, world.violations>>]_vars
TrafficTickHonorsSignal == [][event' = "traffic" =>
    world.stopped' = (world.approach /\ Signal(world.clock) # "red")]_vars
CollectionNeverShrinks == [][event' = "collect" => world.collected \subseteq world.collected']_vars
AsphaltCannotCreateSlip == [][(event' = "drive" /\ world.slip = 0 /\ world.material' = "asphalt")
    => world.slip' = 0]_vars
FallingFreezesRawDust == [][(event' = "feedback" /\ world.fall > 0) => world.dust' = world.dust]_vars
FlightEventuallyLandsOrStops == (group = "jump" /\ phase = "running" /\ world.air > 0)
    ~> (world.air = 0 \/ phase # "running")
=============================================================================
