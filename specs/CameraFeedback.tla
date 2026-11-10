------------------------- MODULE CameraFeedback -------------------------
EXTENDS Integers
CONSTANTS BuggyJump, BuggyShake, BuggyBody
VARIABLES ground, jump, feedback, mode, cameraHeight, worldShift, bodyHeight, event
vars == <<ground, jump, feedback, mode, cameraHeight, worldShift, bodyHeight, event>>
Init == /\ ground = 0 /\ jump = 0 /\ feedback = 0 /\ mode = "chase"
        /\ cameraHeight = 0 /\ worldShift = 0 /\ bodyHeight = 0 /\ event = "init"
Terrain == /\ ground' \in -1..1 /\ event' = "terrain"
           /\ UNCHANGED <<jump, feedback, mode, cameraHeight, worldShift, bodyHeight>>
Flight == /\ jump' \in 0..2 /\ event' = "flight"
          /\ UNCHANGED <<ground, feedback, mode, cameraHeight, worldShift, bodyHeight>>
Feedback == /\ feedback' \in 0..2 /\ event' = "feedback"
            /\ UNCHANGED <<ground, jump, mode, cameraHeight, worldShift, bodyHeight>>
Camera == /\ mode' \in {"first", "chase", "top"} /\ event' = "camera"
          /\ UNCHANGED <<ground, jump, feedback, cameraHeight, worldShift, bodyHeight>>
Recover == /\ jump' = 0 /\ feedback' = 0 /\ event' = "recover"
           /\ UNCHANGED <<ground, mode, cameraHeight, worldShift, bodyHeight>>
Draw == /\ cameraHeight' = ground + IF BuggyJump THEN jump ELSE 0
        /\ worldShift' = IF BuggyShake THEN feedback ELSE 0
        /\ bodyHeight' = ground + jump + IF BuggyBody THEN 0 ELSE feedback
        /\ event' = "draw"
        /\ UNCHANGED <<ground, jump, feedback, mode>>
Next == Terrain \/ Flight \/ Feedback \/ Camera \/ Recover \/ Draw
Spec == Init /\ [][Next]_vars
TypeOK == /\ ground \in -1..1 /\ jump \in 0..2 /\ feedback \in 0..2
          /\ mode \in {"first", "chase", "top"}
          /\ cameraHeight \in -1..3 /\ worldShift \in 0..2 /\ bodyHeight \in -1..5
CameraFollowsSupport == event = "draw" => cameraHeight = ground
WorldRemainsStable == event = "draw" => worldShift = 0
BodyPresentsFeedback == event = "draw" => bodyHeight = ground + jump + feedback
RecoveryClearsFeedback == event = "recover" => (jump = 0 /\ feedback = 0)
=============================================================================
