# NIGHT_RUN 2026 1111 — Graybox Drive P1

This delivery continues the original-concept implementation in `de688eb`.
The four archived generated images remain the visual targets. The game uses
actual geometry, normal race physics and event-driven presentation.

## Visual change

The published concept implementation shipped a 235 × 145 sky crop, but the
renderer still sampled from x = 870 as if it were the full original image.
The source rectangle was entirely outside that asset. A real-pixel negative
control reproduced this: loading the asset and deliberately blocking it produced
identical backdrop pixels.

The renderer now uses a centered, aspect-preserving cover crop of the actual
image. The script cache version changes to `art.js?v=13`. Missing-image fallback
keeps the existing gradient and sun. Four viewport/backend comparisons pass:
1280 × 720, 844 × 390, 390 × 844 and software rendering at 844 × 390. The
changed-pixel ratios exceed 99%; initial gameplay snapshots stay identical.
The complete cloud/fallback scene pairs were visually inspected. No stretching,
seam, new car occlusion or unreachable controls was found in those captures.

Local verification now serves `dist` from a temporary loopback HTTP server.
That matches the deployed asset origin and allows real bitmap-pixel checks
without disabling browser security. All existing verification commands remain.

## Shot comparison

| Shot | Existing concept target | Actual playable implementation | Boundary |
| --- | --- | --- | --- |
| City turn and checkpoint | Red coupe, sunset, ring landmark, cyan gates and orange arrows | Map 01 geometry, actual cloud image, low chase camera and four physical cars | Flat-shaded stylized geometry; no photorealistic reflections or boost reward |
| Drift | Tire smoke, marks and drift readout | Existing physical skid condition drives bounded smoke, tire trails and elapsed drift time | Diagnostic scene entry is a fixture; it is separate from the natural race recording |
| Jump | Air time and landing response | Existing Wild Trail ramp produces physical flight and landing feedback | Map 05 ramp; the concept's suspended city jump track is not implemented |
| Finish | Finish line, confetti and real results | Three earned laps, saved best time and frozen four-car standings | Report the actual result; completion is not automatically a win |

See the [archived originals and actual captures](https://chatgpt.com/space/page_250e5db70e1c8191906045b0cd11e64d)
and [precise concept scope](../../docs/CONCEPT-FIDELITY.md).

## Verification history

The first complete candidate run stopped at an existing mobile map-persistence
navigation with `net::ERR_ABORTED`. Its failure is retained. An unmodified
diagnostic rerun passed all 56 cross-map checks and 76 screenshots. The cause
of that single cancellation is not established. The test now saves request,
frame, connection and page-state evidence on that failure path, then throws the
original error. It has no automatic retry and retains every assertion.

A separate Mac software fixture then reported five changed pixels with the
player mesh absent from both frames. The original missing-player sequence
reproduces that failure. Declaring `willReadFrequently: true` at 2D context
creation produces zero changed pixels and passes the same zero-pixel assertion.
Only this exact pixel fixture uses the explicit readback configuration; all
540 native-animation frames keep the browser default. The independent body and
world-isolation suite also passes all four viewport/backend combinations.
See [the targeted observations](readback-reproduction.json) and the
[HTML Standard's readback setting](https://html.spec.whatwg.org/dev/canvas.html).
This is a test readback configuration change, not a gameplay or threshold change.

The final complete `.venv/bin/python tests/verify.py` passes all 29 commands.
All 65 source hashes match the frozen candidate before and after execution.
The run retains 570 screenshots and eight recordings, including 540 native
animation frames, 450 camera steps, 93 team-race checks and four sky cases.
The natural three-lap race takes 66.46 seconds, records two AI contacts and
finishes at rank 2 of 4 with a 5:5 team score. See [the full result](precommit.json)
and [the natural-race observation](race.json). Interrupted or failed runs are
not counted as a pass. Deployment and public media receipts follow separately.

## Real recording contract

`tools/media/record-playthrough.cjs` uses ordinary mouse/keyboard input, read-only
route observations and the game's native animation. It cannot teleport, call
finish directly or replace the game clock. Production rehearsal and recording
both verify anonymous public resources and browser-loaded response bytes against
the exact deployed source manifest.

The full original WebM is preserved read-only with its SHA-256. The eight-second
MP4 is one continuous original-speed interval, with at least three seconds of
real results on screen. There are no added titles, music, artificial holds or
concept frames. The capture has no audio track; Web Audio has separate functional
verification. Final media status requires decoded-frame inspection and playback.

Physical Android/iPhone performance and photorealistic material parity remain
outside the executed desktop Chromium scope. No universal 60 FPS claim is made.
