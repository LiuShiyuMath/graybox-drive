# Graybox Drive vertical slice

The first art pass uses Map 01 and one lime sports coupe. The existing five maps,
three cameras, 2v2 AI, collision geometry, input rules, clocks and finish rules remain
the gameplay baseline. The target is a complete 60–90 second, three-lap race driven
through normal keyboard input.

## Work and acceptance

| Phase | Artifact | Acceptance |
| --- | --- | --- |
| P0 | Baseline cdf296f, original screenshot, source manifest | Capture before edits on real Chromium |
| P1 | Screenshot paintover and fidelity table | Same chase camera, unchanged road width and vehicle positions |
| P2 | Procedural sports coupe, circuit art, sunset backdrop | Actual meshes in both depth paths; no new collision objects |
| P3 | Bounded effects, Web Audio, lightweight mode | Read real physics events; pause is silent; effects cannot change race state |
| P4 | Native-animation three-lap recording | Start, real AI, physical contact, ordered laps, natural finish and saved score |
| P5 | Existing full verify, new presentation checks, CI and deployed hash comparison | No skipped required check; Android and iPhone remain separate |

## Design decision

Two designs were reviewed. A new material and asset system would require three
rendering backends to change together. The selected design adds colored meshes
through existing geometry functions and keeps effects in a separate observer.
The renderer still owns depth. The simulation still owns all race state.

The presentation model contains settings, an event cursor, bounded particles,
optional audio nodes. It reads vehicle and race facts.
It never assigns vehicle, camera, timer, lap, checkpoint or competitor fields.
The existing game snapshot stays limited to gameplay state.

## Fidelity table

| Element | Original runtime | Paintover target | Implemented scope |
| --- | --- | --- | --- |
| Player car | Two boxes | Sports coupe | Four wheels, lime roof panel, lights, diffuser, spoiler |
| AI cars | Two boxes | Matching team cars | Same detail geometry and existing team colors |
| Circuit | Gray-green strips | Graphite road, teal and cream curbs | Procedural palette and unchanged road dimensions |
| Environment | Empty field | Pines, grandstands, route signs | Static faceted meshes beyond the road |
| Lighting | Flat green sky | Apricot sky, layered teal mountains | Procedural backdrop and face shading |
| Feedback | Basic hazard tint | Readable localized feedback | Real-event sparks, skid smoke, speed lines, finish celebration |
| Materials | Flat color | Detailed stylized surfaces | Flat shaded first pass; no photographic textures |

## Decision trail

- The actual Work-host Chromium navigation crashed. The authorized Mac mini
  Chromium opened the exact baseline and produced the original screenshot.
- Map 01 is the demonstration course. Its three-lap path is about 8,369 world
  units, allowing a 60–90 second race without changing race rules.
- Player-visibility probes hide the complete `playerCarMesh` function. Hiding
  only the original two box dimensions would leave new wheels and spoilers
  visible, invalidating missing-car negative controls.
- Artwork is a stylized first pass. The paintover is a target and is labelled
  separately from real runtime evidence. It is not a photorealistic final asset.


## Verification stages

The first complete suite is a diagnostic run. Source files were refined while
it was running, so its initial source manifest is not an exact release proof.
After all edits settle, rerun the complete suite against frozen source hashes.
Only that frozen run may support the code commit. CI and the deployed run must
report the same file hashes. Preserve the diagnostic evidence separately.

The desktop profile initially ran alongside the full visual matrix. Its frame
intervals are affected by concurrent workload. Retain that attempt as a loaded
measurement and make no stable-frame-rate or speedup claim from it.


## Desktop timing observations

Five alternating trials per side used Chromium 134 at 1000×600 without recording.
Each trial warmed up for 25 frames and measured 120 normal animation intervals.
The baseline and art candidate both had a median trial p50 frame interval of
66.6 ms and p95 of 133.4 ms. Candidate synchronous draw time had trial medians
of 2.1 ms at p50 and 5.1 ms at p95; the baseline was 0.8 ms and 1.8 ms.
These durations exclude asynchronous raster and GPU completion.

The shared Mac had load averages near 12.8 on 10 cores. The earlier concurrent
attempt and this attempt both show large frame-delivery delays. The cause of
those delays is not fully attributed. Stable 60 FPS and a general performance
comparison are INCONCLUSIVE on this host. No phone performance is inferred.
Raw trials are retained in `verification/slice/profile.json` and the loaded
attempt in `verification/slice/loadedProfile.json`.


The first art precommit at a84a657 passed all 27 commands with 61 matching source hashes,
554 screenshots and eight recordings. Its natural keyboard race finished in
66.75 seconds with four physical AI contacts. The release proof is
`verification/slice/precommit.json`; CI and live gates are recorded separately.


Media review of a84a657 found that the new event-message layer duplicated the
existing toast, hazard HUD and finish overlay. The final polish removes that
layer. Existing gameplay owns all visible event messages; the observer only
adds particles, sound, progress and celebration. Physics and race rules are
unchanged. Profile trials above refer to a84a657 before this HUD subtraction.


The HUD-polished source passed a fresh complete precommit run with 61 matching
source hashes, 551 screenshots, eight recordings and a 66.50 second real-keyboard
three-lap race with two physical AI contacts. The first candidate's Linux run
independently matched all 61 source hashes and recorded 3,977 frames with a
16.7 ms p95 interval. That Linux timing refers to a84a657; the polished release
receives its own workflow and timing evidence.
