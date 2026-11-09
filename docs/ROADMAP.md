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

- [x] Map all nine state groups to formal and runtime checks in `docs/STATE-MACHINES.md`.
- [x] Add four finite TLA+ models and four named regression counterexamples; all checked with TLC.
- [x] Add the real runtime's 4,096 input-source transition checks and Python Playwright normal-animation E2E.
- [x] Add project `.agents/skills/verify/SKILL.md`, Work dependency installation, isolated evidence with source hashes, and full local/deployed CI gates.
- [x] Record full `/verify` evidence in `verification/formal-verification.md`; the project Page links the exact commit CI/deployment result.

## P0 — Stability (first)

- [ ] Reproduce and fix chase-view car/road overlap and clipping in the live renderer, test obstacles and occlusion, near-plane projection, car height and terrain alignment.
- [ ] Extend tests beyond one chase-deck pixel to a vehicle silhouette/region, across 240 headings, bends, start location, obstacles and falling.
- [ ] Capture three cameras × landscape and portrait for each relevant state, plus impact and fall recordings; inspect screenshots in a real Chromium browser and document browser console errors.
- [ ] Test state transitions: ready, running, paused, resumed, finished; driving, reverse, steering, acceleration and brake; curb, runoff, edge, fall and recovery; collision cooldown, multi-touch, background pause, view persistence and lap tracking.
- [ ] Execute `node --check dist/game.js`, `node --check dist/perspective.js`, `node tests/drive.cjs`, `node tests/browser-states.cjs` and retain results. This migration alone is not a new PASS.
- [ ] Test Android and iPhone **physical devices** in portrait and landscape: simultaneous steering+throttle, background pause, all cameras, collision/fall feedback; record OS, browser and performance. From [Issue #2](https://github.com/LiuShiyuMath/graybox-drive/issues/2).

## P1 — Shared map data and driving test ground

- [ ] Define a reusable `MapDefinition`: spline control points, sampled centerline, per-segment width/elevation/bank/material, collision zones, spawn/checkpoints and objects.
- [ ] Drive visible road Mesh, shoulder geometry, nearest-road calculations, physical collision, edge conditions, respawn and minimap from the same map data.
- [ ] Create test ground with straights, S curves, slopes, guardrails and asphalt/grass/mud friction.

## P2 — Mountain and circuit

- [ ] Add a second course with bends, obstacles and readable routes, migrating [Issue #3](https://github.com/LiuShiyuMath/graybox-drive/issues/3).
- [ ] Add mountain hairpins, cliffs, falls, slopes, course checkpoints, timing, best result and reverse-lap prevention.

## P3 — City and off-road

- [ ] City intersections, traffic lights, AI traffic and routing.
- [ ] Off-road rocks/mud/jumps, wheel slip/drifting, collectibles, shortcuts and exploration goals.

## P4 — Visuals and performance

- [ ] Realistic visual treatment of roads, materials, lighting and environment.
- [ ] Preserve smooth mobile rendering, clear feedback and practical touchscreen controls.

## Historical reference / migration

- [Issue #1](https://github.com/LiuShiyuMath/graybox-drive/issues/1) — public launch, completed.
- [Issue #2](https://github.com/LiuShiyuMath/graybox-drive/issues/2) — real-phone acceptance, still outstanding above.
- [Issue #3](https://github.com/LiuShiyuMath/graybox-drive/issues/3) — second track, still outstanding above.
- [PR #4](https://github.com/LiuShiyuMath/graybox-drive/pull/4) — closed and already contained in `main`.
- [Issue #5](https://github.com/LiuShiyuMath/graybox-drive/issues/5) — complete P0–P4 expansion plan, migrated above.

Closing a historical Issue means **migrated to docs**, not completed. Do not erase original discussions.

## Definition of done

A code change passes only when the changed behavior was actually tested and the evidence was recorded. CI success, HTTP 200, or a screenshot of an untouched UI is insufficient. Phone emulation is not physical-device validation.
