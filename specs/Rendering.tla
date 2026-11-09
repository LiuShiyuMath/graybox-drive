--------------------------- MODULE Rendering ---------------------------
EXTENDS Naturals, Integers
CONSTANTS BuggyLoss, BuggyRestore, BuggyMesh, BuggyBoot, BuggyCamera
VARIABLES boot, loop, backend, context, resources, mesh, uploaded, viewport,
          gpuViewport, view, pose, framePose, frameMesh, fresh, frameBackend, obstruction, boom, presentation, event
vars == <<boot, loop, backend, context, resources, mesh, uploaded, viewport,
          gpuViewport, view, pose, framePose, frameMesh, fresh, frameBackend, obstruction, boom, presentation, event>>
Init == /\ boot = "loading" /\ loop = FALSE /\ backend = "cold"
        /\ context = "valid" /\ resources = FALSE /\ mesh = 0 /\ uploaded = -1
        /\ viewport = 0 /\ gpuViewport = -1 /\ view = "chase" /\ pose = 0
        /\ framePose = 0 /\ frameMesh = 0 /\ fresh = FALSE
        /\ frameBackend = "none" /\ obstruction = "clear" /\ boom = "full"
        /\ presentation = "none" /\ event = "init"
Ready == /\ boot = "loading" /\ boot' = "ready" /\ loop' = TRUE /\ event' = "ready"
         /\ UNCHANGED <<backend, context, resources, mesh, uploaded, viewport,
                        gpuViewport, view, pose, framePose, frameMesh, fresh, frameBackend, obstruction, boom, presentation>>
EarlyFrame == /\ BuggyBoot /\ boot = "loading" /\ event' = "draw"
              /\ fresh' = FALSE /\ frameBackend' = "none"
              /\ UNCHANGED <<boot, loop, backend, context, resources, mesh, uploaded,
                             viewport, gpuViewport, view, pose, framePose, frameMesh, obstruction, boom, presentation>>
Initialize(gpu) == /\ boot = "ready" /\ backend = "cold"
                   /\ backend' = IF gpu THEN "webgl" ELSE "software"
                   /\ resources' = gpu /\ event' = "initialize"
                   /\ UNCHANGED <<boot, loop, context, mesh, uploaded, viewport,
                                  gpuViewport, view, pose, framePose, frameMesh, fresh, frameBackend, obstruction, boom, presentation>>
Lose == /\ backend = "webgl" /\ context = "valid" /\ context' = "lost"
        /\ resources' = FALSE /\ uploaded' = -1 /\ gpuViewport' = -1 /\ event' = "lost"
        /\ UNCHANGED <<boot, loop, backend, mesh, viewport, view, pose,
                       framePose, frameMesh, fresh, frameBackend, obstruction, boom, presentation>>
Restore == /\ backend = "webgl" /\ context = "lost" /\ context' = "valid"
           /\ event' = "restored"
           /\ UNCHANGED <<boot, loop, backend, resources, mesh, uploaded, viewport,
                          gpuViewport, view, pose, framePose, frameMesh, fresh, frameBackend, obstruction, boom, presentation>>
MapChange == /\ mesh' = 1 - mesh /\ pose' = 0 /\ event' = "map"
             /\ UNCHANGED <<boot, loop, backend, context, resources, uploaded, viewport,
                            gpuViewport, view, framePose, frameMesh, fresh, frameBackend, obstruction, boom, presentation>>
Resize == /\ viewport' = 1 - viewport /\ event' = "resize"
          /\ UNCHANGED <<boot, loop, backend, context, resources, mesh, uploaded,
                         gpuViewport, view, pose, framePose, frameMesh, fresh, frameBackend, obstruction, boom, presentation>>
Camera == /\ view' \in {"first", "chase", "top"} /\ event' = "camera"
          /\ UNCHANGED <<boot, loop, backend, context, resources, mesh, uploaded, viewport,
                         gpuViewport, pose, framePose, frameMesh, fresh, frameBackend, obstruction, boom, presentation>>
Physics == /\ pose' = 1 - pose /\ event' = "physics"
           /\ UNCHANGED <<boot, loop, backend, context, resources, mesh, uploaded, viewport,
                          gpuViewport, view, framePose, frameMesh, fresh, frameBackend, obstruction, boom, presentation>>
Obstruction == /\ obstruction' \in {"clear", "near", "legal"} /\ event' = "obstruction"
               /\ UNCHANGED <<boot, loop, backend, context, resources, mesh, uploaded, viewport,
                              gpuViewport, view, pose, framePose, frameMesh, fresh, frameBackend, boom, presentation>>
Draw == /\ boot = "ready" /\ loop /\ backend # "cold" /\ event' = "draw"
        /\ LET gpu == view # "top" /\ backend = "webgl" /\ (context = "valid" \/ BuggyLoss)
               rebuilt == resources \/ ~BuggyRestore
           IN /\ frameBackend' = IF view = "top" THEN "top" ELSE IF gpu THEN "webgl" ELSE "software"
              /\ resources' = IF gpu /\ context = "valid" THEN rebuilt ELSE resources
              /\ uploaded' = IF gpu /\ context = "valid" /\ ~BuggyMesh THEN mesh ELSE uploaded
              /\ gpuViewport' = IF gpu /\ context = "valid" THEN viewport ELSE gpuViewport
              /\ fresh' = (~gpu \/ (context = "valid" /\ rebuilt))
              /\ frameMesh' = IF gpu THEN uploaded' ELSE mesh
        /\ framePose' = pose
        /\ boom' = IF view = "chase" /\ obstruction = "near" /\ ~BuggyCamera THEN "retracted" ELSE "full"
        /\ presentation' = CASE view = "first" -> "cockpit"
                               [] view = "top" -> "top"
                               [] obstruction = "legal" \/ (obstruction = "near" /\ BuggyCamera) -> "occluded"
                               [] OTHER -> "car"
        /\ UNCHANGED <<boot, loop, backend, context, mesh, viewport, view, pose, obstruction>>
Next == Ready \/ EarlyFrame \/ (\E gpu \in BOOLEAN : Initialize(gpu)) \/ Lose \/ Restore
        \/ MapChange \/ Resize \/ Camera \/ Physics \/ Obstruction \/ Draw
Spec == Init /\ [][Next]_vars
TypeOK == /\ boot \in {"loading", "ready"} /\ loop \in BOOLEAN
          /\ backend \in {"cold", "webgl", "software"} /\ context \in {"valid", "lost"}
          /\ resources \in BOOLEAN /\ mesh \in 0..1 /\ uploaded \in -1..1
          /\ viewport \in 0..1 /\ gpuViewport \in -1..1
          /\ view \in {"first", "chase", "top"} /\ pose \in 0..1 /\ framePose \in 0..1
          /\ frameMesh \in -1..1 /\ fresh \in BOOLEAN
          /\ frameBackend \in {"none", "top", "webgl", "software"}
          /\ obstruction \in {"clear", "near", "legal"} /\ boom \in {"full", "retracted"}
          /\ presentation \in {"none", "car", "occluded", "cockpit", "top"}
DependenciesBeforeDrawing == event = "draw" => (boot = "ready" /\ loop)
NoStaleFrame == event = "draw" => fresh
CurrentMeshPresented == event = "draw" => frameMesh = mesh
SinglePosePresented == event = "draw" => framePose = pose
NearCameraKeepsCar == (event = "draw" /\ view = "chase" /\ obstruction # "legal") => presentation = "car"
ObstructionRetractsCamera == (event = "draw" /\ view = "chase" /\ obstruction = "near") => boom = "retracted"
ValidGPUFrame == (event = "draw" /\ frameBackend = "webgl") =>
                 (context = "valid" /\ resources /\ uploaded = mesh /\ gpuViewport = viewport)
CameraPreservesPose == [][event' = "camera" => UNCHANGED <<pose, mesh>>]_vars
=============================================================================
