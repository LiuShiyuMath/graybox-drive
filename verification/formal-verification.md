# State-machine and TLA+ verification

The latest camera/body release and its exact acceptance scope are tracked in [camera stability and vehicle feedback](camera-verification.md). Computer-team evidence is retained in [computer teammates and rivals](teams-verification.md). The earlier sections below retain their original release evidence.

Date: 2026-11-09. Full project `/verify`: **PASS** on the authorized Mac mini,
using Python Playwright 1.51.0 and its installed Chromium Headless Shell.
The pre-commit base is `f25a8e7`; the exact tested runtime, models, scripts,
dependency lock and skill hashes are in `formal-runtime-results.json`.

| Check | Result | Evidence |
| --- | --- | --- |
| Race, Input, Hazards, Persistence TLC models | PASS, 3,516 distinct reachable states across four finite models | 532 + 261 + 2,675 + 48; no model-checking errors |
| Regression detection | PASS, all four injected defects rejected | Alias release, duplicate recovery charge, reverse lap increment, cooldown feedback retrigger; named counterexamples |
| Real JavaScript state contracts | PASS | 4,096 input-source transitions plus race, paused fall, recovery, camera and best-score operations |
| Existing physics and race rules | PASS | `node tests/drive.cjs` and syntax checks |
| Chromium state matrix | PASS | 210 screenshots, 30 transition/pixel checks, zero failures |
| Python Playwright real-animation E2E | PASS | 6 acceptance checks, 8 screenshots; acceleration, full pause snapshot freeze, keyboard aliases, all cameras and reload persistence |
| Visual review | PASS for reviewed scope | All 8 new normal-animation screenshots inspected in both orientations; chase body covers the start-line paint |
| Android/iPhone physical devices | Not tested | Browser emulation is not physical-device evidence |

The new normal-animation screenshots are in `verification/python-e2e/`. The
original full state matrix is in `verification/state-machines/`. CI regenerates
the entire matrix and saves each run's raw logs, hashes, TLC counterexamples,
browser version and screenshots as an Actions artifact.

## ChatGPT Work setup and host boundary

Python Playwright and official Chromium binaries were installed in Work. The
four models and four negative checks passed there too. The full browser run on
that particular Work host failed at `page.goto` with `Page crashed`; this host is
**BLOCKED for browser E2E**, not PASS. The same unchanged source passed the full
suite on the authorized Mac mini. Do not generalize this one host failure to all
ChatGPT Work environments; install and attempt browser execution before deciding.

## Continuous gate and reproduction

Follow `.agents/skills/verify/SKILL.md` and run `.venv/bin/python tests/verify.py`.
`.github/workflows/pages.yml` runs the exact full command before deployment,
then again against the public GitHub Pages game. The live Python test hashes
downloaded assets and compares them with the checkout before accepting gameplay.
Inspect the exact commit's [Actions run](https://github.com/LiuShiyuMath/graybox-drive/actions)
and its `verification-<sha>` / `live-verification-<sha>` artifacts for CI results.
Only `dist` is deployed; models and test dependencies do not change player costs.

TLC establishes these bounded specifications, not an unbounded theorem or a
refinement proof of JavaScript, floating-point physics or visual rendering.
See `docs/STATE-MACHINES.md` for bounds, fairness assumptions and implementation
mapping. Models and runtime checks must evolve together when maps or rules change.


## Map 02 Mountain Road extension

The complete project verification passed for the Mountain Road candidate on Mac mini using pinned Python/JavaScript Playwright 1.51.0. Its 29 measured source-file SHA-256 values were compared with and matched the cloud workspace candidate before publication.

- 4,096 implementation input-source transitions passed.
- Five exhaustive TLC models passed: Race, Input, Hazards, Persistence and Mountain, with 4,371 distinct states across the independent models.
- All five named regression counterexamples were detected, including premature summit finish without checkpoints.
- The circuit matrix passed 210 scenarios and 30 checks; the mountain matrix passed 42 scenarios and 51 checks, plus a Canvas-fallback capture.
- Python real-animation E2E passed 12 checks across both maps, both orientations and all cameras, retaining 16 images.
- The complete run retained 269 browser screenshots. Continuous mountain physics driving separately reached the summit in 45.68 seconds without teleporting, collisions or falls.

[Machine-readable evidence and source hashes](mountain-full-verify.json) · [Map 02 scenes and screenshots](mountain-road.md).

The cloud JavaScript scene matrices passed, but normal-animation Python Chromium exited/crashed on this Work host. The complete PASS above belongs to the Mac mini execution with matching source hashes. CI and deployed-source verification remain separate release gates. Physical Android/iPhone validation is still outstanding.

## Five-map integration

The integration adds `Courses` while retaining the original four models and
`Mountain`. All six finite models and seven specified negative mutations pass
through the same `tests/verify.py` gate. The course model checks every lap's
checkpoint precondition as an action property, as well as terminal completion,
map reset, paused world, jump stages, token idempotence and a bounded city crossing.

See [integration acceptance](integration-check.md) and its exact-source
[precommit manifest](integration-results.json). Complete browser verification
includes 381 screenshots, 486 vehicle-region comparisons and six normal-animation
collision/fall/recovery recordings. This is the tested graybox scope; physical-phone
performance and photorealistic art are not established. The exact main commit's
[Actions](https://github.com/LiuShiyuMath/graybox-drive/actions) repeats the full gate
before deployment and against the public site's exact asset hashes.

The first five-map CI run exposed a startup race outside the finite physics models:
an animation frame could call `drawMinimap` before `perspective.js` initialized and
stop scheduling subsequent frames. A captured failure and deterministic delayed-script
negative check are recorded in [startup-race-regression.json](startup-race-regression.json).
The browser regression holds the script for two native frames after the game has
initialized, then requires real keyboard acceleration on all three new courses.
Startup now waits for `DOMContentLoaded`. This regression supplements the models;
the existing acceleration thresholds and complete release gates remain unchanged.


## Hidden-state and flicker candidate, 2026-11-10

The 27-group audit extends the required gate to eight finite models and 17 named
negative controls, 26 additional implementation contracts, 540 native animation
frames, and 450 deterministic camera/beam frames. The exact candidate full command
passed on Mac mini with 471 screenshots and six recordings; all 44 tested source
hashes match. Separate model graphs contain 84,174 distinct states in aggregate.
See [reproduction, before/after, scope and candidate manifest](flicker-verification.md),
[full state inventory](../docs/STATE-MACHINES.md) and [TLC traces](flicker-tla/).
The release workflow independently gates Linux verification, deployment and the
complete live-site rerun. The project Page records that release outcome.


The hidden-state/flicker runtime `547f808` is now published. Linux `verify`,
Pages `deploy`, and full public-site `verify-live` all passed in
[workflow 42674668709](https://github.com/LiuShiyuMath/graybox-drive/actions/runs/42674668709).
Both retained artifact manifests match all 44 precommit source hashes and contain
471 screenshots, six recordings, 990 new temporal/fixture frame checks, eight
normal models and 17 named negative controls. All seven deployed assets match.
[Release manifests](flicker-release.json) and [full result](flicker-verification.md).

## Camera/body release, 2026-11-10

Runtime `ba0e6bd` and verification revision `8d7e9cc` pass the complete Mac,
Linux pre-publication and public-site checks. The [final workflow](https://github.com/LiuShiyuMath/graybox-drive/actions/runs/42793331323)
reports success for verify, deploy and verify-live. All 54 runtime/model/test
source hashes match across those full runs, and every one of the eight deployed
assets is compared with the checkout.

The suite checks 11 finite models and 27 named counterexamples. The independent
finite model graphs contain 1,089,131 reachable states, including 5,077 in
CameraFeedback. This model checks output isolation; it does not prove continuous
suspension, geometry or JavaScript refinement.

Mac and Linux pre-publication runs retain 542 screenshots each; the public run
retains 545. Each retains seven recordings. The public native-animation flicker
probe encounters five real terrain-occluded frames and requires a visible actual
automatic recovery. Both rendering backends also replay the exact deep-fall
fixture and reject the open-road missing-car negative control. Grounded
visibility thresholds and all 540 native frames remain required.

See [the acceptance report](camera-verification.md) and
[machine-readable manifests](camera-evidence.json) for the initial failure,
root cause, final source hashes and actual screenshots. Physical phones,
Safari/Firefox and this Work host's failing browser path remain outside PASS.

## Original concept implementation, 2026-11-10

The frozen candidate passes the full verifier with 64 matching source hashes,
562 screenshots, eight recordings, 12 finite models and 31 deliberate failures.
A 75.60-second natural keyboard race earns three laps and records 13 AI contacts.
Trail capacity, pause/reset, physical ramp air time and four HUD viewports are
covered by the new concept suite. See [the actual evidence](concept-release/verification.md).
Runtime `de688eb` passes Linux verify, deployment and the full public-site verify-live in [workflow 42851855197](https://github.com/LiuShiyuMath/graybox-drive/actions/runs/42851855197). All three runs retain 562 screenshots and eight recordings, all 64 source hashes match and all 12 deployed assets agree. Public natural race: 68.03 seconds, 20 AI contacts. See the [release receipt](concept-release/release.json).

Normal-animation frame timing on this shared Work host was p50 66.6 ms and p95
133.3 ms. Functional acceptance is not a 60 FPS or phone-performance claim.
