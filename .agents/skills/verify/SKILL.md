---
name: verify
description: Verify Graybox Drive before commits and after deployment. Run state-machine runtime checks, exhaustive TLA+ TLC models with regression counterexamples, and real Chromium screenshots with JavaScript and Python Playwright. Use for /verify, verification, state machine changes, renderer/input fixes, and release acceptance in this project.
---

# Verify Graybox Drive

Read project `AGENTS.md` and `docs/STATE-MACHINES.md`. Work on `main`; serialize
writes and do not create PRs or Issues. The project Page records intent and
`docs/ROADMAP.md` records work and evidence.

## Prepare the actual execution environment

ChatGPT Work can install Python Playwright and Chromium binaries. Missing
packages/binaries are setup tasks, not a reason to stop or skip E2E. Use an
ordinary user and a project virtual environment:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/requirements-verify.txt
npm ci
.venv/bin/python -m playwright install --only-shell chromium
```

When system libraries are missing, use Playwright's official
`install --with-deps --only-shell chromium` where permitted, or the environment's
approved system-package installer. Java 17+ and Node are also required. The TLA+
runner downloads the pinned official `tla2tools.jar` and verifies SHA-256 before
execution. Keep binaries, virtual environments and TLC working data out of Git.

On Windows use `.venv/Scripts/python.exe`. Python and JS Playwright versions
must match. An installed compatible binary may be selected explicitly with
`DRIVE_CHROMIUM_PATH`. Do not remove a failing check, disable sandbox policy,
replace Chromium with mocks, or call a dependency-only install an E2E PASS.
If browser startup fails, retain the exact error, diagnose it, and run the same
checks on an authorized environment/CI that can execute Chromium. Distinguish
the blocked host from successful execution elsewhere.

## Run and fix until PASS

From the project root:

```bash
.venv/bin/python tests/verify.py
```

This runs syntax checks, existing race/physics tests, 4,096 implementation input
transitions plus 26 hidden-state contracts, eight exhaustive TLC models, 17 expected
counterexamples, the existing 210-screenshot state matrix, the 42-scene mountain matrix plus Canvas fallback, and Python
Playwright E2E with normal animation, real keyboard input, both orientations,
all five maps, all cameras and 40 screenshots. Also run the cross-map browser
matrix at 844×390, 390×844 and 320×740, including independent touch releases,
signals, traffic, jumps, natural landing, collection and Canvas fallback. Run the
delayed `perspective.js` startup regression on all three new courses; animation
must start only after drawing dependencies initialize. Retain state, input,
focus, errors and a screenshot when normal acceleration times out. Compare
every deployed dist asset with the local SHA-256. Require the 486 vehicle-region
checks and six real-animation impact/fall/recovery recordings from
`tests/browser-effects.cjs`; inspect the videos and affected screenshots. Do not report PASS from a subset. A failed TLC
process is a failure unless the mutation check detects its named invariant.
Review the run-specific evidence linked by `verification/latest/results.json`;
a prior results file is not proof
of the current source. Fix the cause, rerun the affected check, then run the
complete command once the changes settle. Keep models and implementation in
sync. Models are finite abstractions, not a proof of floating-point physics or
pixel rendering. Require runtime checks and inspect screenshots too.

For renderer/input changes, inspect affected original screenshots and contact
sheets in all cameras/orientations, including start-line occlusion, buildings,
collision feedback and early/late falling. One sampled pixel and no-console-error
alone cannot establish visual correctness. Preserve fixture-based matrix tests
and the separate normal-animation Python E2E. Phone emulation does not establish
Android/iPhone physical-device PASS.

After an authorized push, check the exact commit's Actions result, then rerun
browser checks against the public deployment using:

```bash
DRIVE_URL=https://liushiyumath.github.io/graybox-drive/ \
DRIVE_VERIFY_DIR=verification/latest-live .venv/bin/python tests/verify.py
```

Preserve source revision/hashes, commands, real logs, TLC state counts and
counterexample traces, screenshots, browser version and unresolved boundaries.
Update `verification/formal-verification.md`, roadmap and project Page. Report
PASS only for the executed scope; report BLOCKED for unexecuted required checks.

For flicker or renderer changes, require `tests/browser-flicker.cjs` and
`tests/browser-camera.cjs` through the full command. The former checks 540 native
animation frames on five maps and three sizes, pre-event WebGL loss, two
restorations per case, camera/map/viewport changes during loss, and restored
pixels against a fresh renderer (RGB mean error <1 and at most 0.2% of pixels differing by >12; a wrong-map negative control must fail). The latter checks 450 deterministic actual
physics frames around the mountain start beam in both WebGL and software.
Keep beam geometry and depth; a car painted over blockers does not pass.
The complete suite currently retains 471 screenshots plus six recordings.

Review `Rendering.tla` for resource loss/restoration, current mesh/viewport,
startup dependencies, one-pose frames and eligible camera-boom obstruction.
Its current-frame flag abstracts freshness, not the number of car-colored pixels.
A zero car-only image difference can mean stale rendering. Distinguish that from
legal occlusion, deliberate hazard vibration and actual missing geometry.
Retain the original failing beam pose and the loss-before-event failure with the
baseline revision. Do not generalize finite models to continuous geometry or
unmeasured physical-device performance.
