# Graybox Drive — Roadmap and verification

**Source of truth:** [ChatGPT project Page](https://chatgpt.com/space/page_b7e95e0e62948191a47974d9feeddc87) for product requirements and decisions; this file for executable tasks and evidence. GitHub PRs and Issues are historical archives, not the work queue.

## Workflow: main only

1. Record goals and decisions in the ChatGPT Page, and keep this roadmap in sync.
2. Read `AGENTS.md`, inspect `main`, implement the smallest verified change and commit directly to `main`.
3. Before each commit, run required syntax, unit and browser tests. Inspect actual screenshots for rendering changes. After push, check Actions and the public deployed game.
4. Report evidence and limitations in `verification/` and in the ChatGPT Page.
5. Never create a pull request, issue, or secondary branch for this repository. If an external contributor submits an item, migrate useful content into this roadmap/Page.
6. Serialize concurrent agents' writes: refresh `main` immediately before committing; reconcile conflicts; do not force push.

## Existing deliverables

- [x] Free public browser driving game, touch controls, three camera modes, three laps, off-road/collision/fall feedback; original [Issue #1](https://github.com/LiuShiyuMath/graybox-drive/issues/1).
- [x] The code from [PR #4](https://github.com/LiuShiyuMath/graybox-drive/pull/4) is already in `main`; that PR was closed. Prior test evidence does not replace a fresh visual regression test.

## State-machine verification

- [x] Audit 27 explicit, derived and temporal state groups in `docs/STATE-MACHINES.md`.
- [x] Add eight finite TLA+ models and 17 named regression counterexamples, including renderer freshness, camera obstruction and hidden gameplay partitions.
- [x] Add the real runtime's 4,096 input-source transition checks and Python Playwright normal-animation E2E.
- [x] Add project `.agents/skills/verify/SKILL.md`, Work dependency installation, isolated evidence with source hashes, and full local/deployed CI gates.
- [x] Record full `/verify` evidence in `verification/formal-verification.md`; the project Page links the exact commit CI/deployment result.

## P0 — Stability (first)

- [x] Reproduce and fix chase-view car/road overlap and clipping in the live renderer, test obstacles and occlusion, near-plane projection, car height and terrain alignment.
- [x] Extend tests beyond one chase-deck pixel to a vehicle silhouette/region, across 240 headings, bends, start location, obstacles and falling.
- [x] Capture three cameras × landscape and portrait for each relevant state, plus impact and fall recordings; inspect screenshots in a real Chromium browser and document browser console errors.
- [x] Test state transitions: ready, running, paused, resumed, finished; driving, reverse, steering, acceleration and brake; curb, runoff, edge, fall and recovery; collision cooldown, multi-touch, background pause, view persistence and lap tracking.
- [x] Execute `node --check dist/game.js`, `node --check dist/perspective.js`, `node tests/drive.cjs`, `node tests/browser-states.cjs` and retain results. This migration alone is not a new PASS.
- [ ] Test Android and iPhone **physical devices** in portrait and landscape: simultaneous steering+throttle, background pause, all cameras, collision/fall feedback; record OS, browser and performance. From [Issue #2](https://github.com/LiuShiyuMath/graybox-drive/issues/2).

## P1 — Shared map data and driving test ground

- [x] Define a reusable `MapDefinition`: spline control points, sampled centerline, per-segment width/elevation/bank/material, collision zones, spawn/checkpoints and objects.
- [x] Drive visible road Mesh, shoulder geometry, nearest-road calculations, physical collision, edge conditions, respawn and minimap from the same map data. Map 02 uses the same sampled centreline and elevation for these systems; see [verification](../verification/mountain-road.md).
- [x] Create Map 03 Proving Ground with straights, S curves, slopes, guardrails and asphalt/grass/mud friction; road bank changes mesh and physical ground height.

## P2 — Mountain and circuit

- [x] Add Map 02 — Mountain Road with S bends, collision posts, mountain wall and readable route, migrating [Issue #3](https://github.com/LiuShiyuMath/graybox-drive/issues/3).
- [x] Add mountain S bends, cliffs, falls, physical slopes, five course checkpoints, summit timing, separate best result and ordered-route finish checks. [42 scenes and runtime evidence](../verification/mountain-road.md).

## P3 — City and off-road

- [x] Map 04 City Blocks: connected cross streets, visible stop lines, timed traffic lights, crossing AI vehicles, physical collisions and once-per-crossing red/amber penalties.
- [x] Map 05 Wild Trail: rocks, gravel/mud/grass friction and slip, ramp flight and natural landing, six optional markers and a marked 3D shortcut. Five ordered checkpoints plus a valid forward finish-line crossing complete each lap; legal terrain detours do not erase a lap.

## P4 — Visuals and performance

- [ ] Photorealistic visual treatment remains a separate art upgrade. The delivered playable graybox has depth-tested roads, terrain, building faces, fog and a Canvas fallback; these are not a photorealism claim.
- [x] Verify clear feedback and reachable simultaneous controls in Chromium at 844×390, 390×844 and 320×740 across all five maps.
- [ ] Measure rendering performance and touch behavior on physical Android/iPhone devices. Headless viewport results do not establish real-device smoothness.

## Historical reference / migration

- [Issue #1](https://github.com/LiuShiyuMath/graybox-drive/issues/1) — public launch, completed.
- [Issue #2](https://github.com/LiuShiyuMath/graybox-drive/issues/2) — real-phone acceptance, still outstanding above.
- [Issue #3](https://github.com/LiuShiyuMath/graybox-drive/issues/3) — second track, completed as Map 02 above.
- [PR #4](https://github.com/LiuShiyuMath/graybox-drive/pull/4) — closed and already contained in `main`.
- [Issue #5](https://github.com/LiuShiyuMath/graybox-drive/issues/5) — complete P0–P4 expansion plan, migrated above.

Closing a historical Issue means **migrated to docs**, not completed. Do not erase original discussions.

## Definition of done

A code change passes only when the changed behavior was actually tested and the evidence was recorded. CI success, HTTP 200, or a screenshot of an untouched UI is insufficient. Phone emulation is not physical-device validation.

## Map 02 — Mountain Road

- [x] About 716 m point-to-point route with 102 m of actual elevation gain.
- [x] Mountain-side collision, cliff warning, falling and checkpoint recovery penalties.
- [x] Map selection, three cameras, separate local best times, keyboard and simultaneous touch controls.
- [x] WebGL depth-tested terrain, adjacent road ribbons and slope-compensated cameras, with Canvas fallback.
- [x] Local verification: 42 mountain scene captures, 51 checks, 240 chase poses, continuous physics summit drive without teleporting.
After publishing main, the exact commit’s Actions run and the project Page retain the deployment and public-browser acceptance evidence.
- [ ] Physical Android/iPhone testing remains outstanding.

## Five-map cloud acceptance

The integration retains the separate Map 02 and formal-verification commits.
`tests/verify.py` runs the complete original checks, both map matrices, eight TLA+
models with 17 named regression traces, continuous course drives, cross-map
input/persistence checks, two orientations of Python normal-animation E2E,
486 vehicle-region comparisons and six actual collision/fall/recovery recordings.
It checks every deployed dist asset hash and repeats the same command after deployment.
See [integration acceptance](../verification/integration-check.md),
[three-camera views](../verification/five-map-views.jpg) and the exact commit's
[Actions evidence](https://github.com/LiuShiyuMath/graybox-drive/actions).

The cloud acceptance goal is a complete playable five-map graybox with all executable
checks green. Physical-phone verification and photorealistic art remain explicitly
open and must not be silently marked complete.

## Flicker and hidden-state audit, 2026-11-10

- [x] Reproduce the mountain start crossbar hiding almost the entire chase car at tick 60; retain old-source failure, exact pose and original Canvas images.
- [x] Keep the crossbar and depth ordering; derive one camera pose for WebGL/software and retract before eligible nearby geometry with geometric easing.
- [x] Reproduce lost WebGL still reporting successful drawing while output is stale; use software during loss and recreate GPU resources on restoration on the same context.
- [x] Add 26 actual-runtime hidden-state contracts, 540 native animation frames, 450 deterministic beam frames, and repeated loss/restore/map/resize/fresh-renderer comparisons to the required verification command.
- [x] Full candidate verification, direct main publication and full live verification passed for runtime commit `547f808`. [All three release gates](https://github.com/LiuShiyuMath/graybox-drive/actions/runs/42674668709). [Reproduction and exact-source evidence](../verification/flicker-verification.md).

Finite model checking is not a JavaScript refinement proof. Continuous geometry,
cross-partition combinations and physical-phone/GPU-driver behavior keep the
explicit boundaries in `docs/STATE-MACHINES.md`.
