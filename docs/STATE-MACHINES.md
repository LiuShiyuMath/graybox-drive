# Vehicle state machines and verification

`dist/game.js` and `dist/perspective.js` are the runtime source of truth. This
document maps the nine overlapping state groups to executable checks. Race and
camera modes are explicit enums; motion, surfaces and feedback are derived.

| Group | States and transitions | Formal model | Runtime evidence |
| --- | --- | --- | --- |
| Race | ready → running ⇄ paused → finished; restart resets a race; three forward laps finish; reverse does not add laps | Race | drive.cjs, state-contract.cjs, browser-states.cjs, browser_e2e.py |
| Input | 4 actions, 16 action combinations; independent keyboard/pointer sources; pause/fall/finish clear input | Input | All 256 subsets of 8 representative sources, each press/release (4,096 transitions); browser keyboard and CDP touches |
| Motion | stopped, accelerating, coasting, braking, reversing, forward/reverse steering | Hazards abstracts speed sign only | Physics tests and all-camera screenshots; acceleration with real animation |
| Surface | road, curb, runoff, outer edge, fall; return to safety | Hazards abstracts zone crossings | Exact 87/106/160/210 distance boundaries and screenshots |
| Collision | separation, bounce, impact feedback, cooldown, feedback clears | Hazards abstracts sign reversal and cooldown | Forward/reverse/low-speed obstacle contacts and screenshots |
| Recovery | fall begins → advances → automatic recovery +5; manual recovery +3; pause freezes fall | Hazards safety and weak-fair progress | Penalty once, manual recovery cancels pending automatic recovery, paused fall |
| Camera | first / chase / top; change does not mutate race, pose or hazard | Race and Persistence | Three cameras × both orientations; 240 headings, building occlusion and falling camera |
| Feedback | fall takes priority over impact, then surface; road hides warning; pause/finish overlays | Hazard state only; priority/rendering verified in browser | Feedback DOM assertions, screenshots; pixel checks supplement visual review |
| Persistence | best is minimum finish time; slower scores preserve it; valid camera restores; invalid camera falls back | Persistence | Reload, better/slower results and localStorage checks |

```mermaid
stateDiagram-v2
    [*] --> ready
    ready --> running: Start
    running --> paused: Pause or background
    paused --> running: Resume
    running --> finished: Three forward laps
    finished --> running: Replay
    running --> running: Restart
    paused --> running: Restart
```

## Formal scope and finite bounds

TLC explores every reachable state in each checked finite model, with no state
constraint pruning. `Race` uses three abstract sectors per lap, three laps and a
clock saturated at two; it checks lifecycle, reverse direction, inactive-clock
freeze and camera independence. It does not assert an unattended driver will
finish a race. Real track progress is checked separately in JavaScript.
An independent event marker identifies reverse steps; `BuggyReverse=TRUE` must
violate `ReverseCannotAddLap`.

`Input` uses eight representative sources covering all four actions, including
four concurrent throttle sources. The effective action set must equal the union
of held sources, and blocked input must be neutral. `BuggyRelease=TRUE` recreates
the alias-release regression and must violate `ActiveMatchesHeld`.

`Hazards` abstracts speed to stopped/forward/reverse, uses two stages for fall,
impact and cooldown, and allows up to two manual and two automatic recoveries
between resets. It checks exact accumulated penalties, fall/surface consistency,
pause freeze and cooldown suppression. Low contact abstracts separation without
impact feedback; geometric separation is a runtime assertion. Weak fairness of
Tick and AutoRecover guarantees a falling running car reaches recovery or pause.
This assumes simulation ticks continue; it does not require progress while paused.
`AutoPenalty=10` must produce an `ExactRecoveryPenalty` counterexample.
An independent contact event marker checks cooldown behavior;
`BuggyCooldown=TRUE` must violate `CooldownSuppressesFeedback`.

`Persistence` explores scores 1..3 plus no score, all camera modes, invalid saved
camera, repeated finishes and reloads. Best must equal the minimum submitted score.

These models are specifications, not a machine-checked refinement proof of the
JavaScript implementation. `tests/state-contract.cjs` executes the real runtime's
matching operations; existing physics and browser tests cover continuous values,
geometry and pixels. Keep model assumptions and code mappings current.

## Reproduce

Follow `.agents/skills/verify/SKILL.md`, then run `.venv/bin/python tests/verify.py`.
For formal checks alone run `python3 tests/verify_tla.py`. Results and all TLC
counterexamples are written to `verification/latest/tla/`. `verification/latest/`
is regenerated per run and ignored by Git; retain the reviewed run's evidence
with its revision in `verification/` or the CI artifact before reporting PASS.

Official setup references: [TLA+ tools](https://github.com/tlaplus/tlaplus/blob/master/USE.md),
[pinned TLA+ release](https://github.com/tlaplus/tlaplus/releases/tag/v1.7.4),
[Python Playwright browser installation](https://playwright.dev/python/docs/browsers).

## Map 02 Mountain Road

`dist/maps.js` defines the same centreline, height and width thresholds used by the road mesh, terrain, nearest-road projection, driving slope, cliff checks, recovery and minimap. Map 01 remains a three-lap circuit. Map 02 is an open route with five earned checkpoints and a summit finish.

`Mountain.tla` abstracts the mountain route to six sectors and five checkpoints. It checks that the summit cannot finish before all checkpoints, reverse preserves earned checkpoints, automatic/manual recoveries return to the earned checkpoint with +5/+3 penalties, and a paused route freezes. The finite model allows two recoveries between resets. `BuggyFinish=TRUE` must violate `SummitRequiresCheckpoints`. Map selection abstracts a new ready race; per-map best scores are checked by the actual runtime tests.

Mountain geometry uses road/curb/edge/fall thresholds 57/65/77/96 world units (10 units = 1 metre). A continuous mountain-side wall constrains the negative side; the positive cliff side can fall. Physical grades, centreline distance, continuous driving and rendering remain runtime obligations, not TLA claims.

`tests/mountain.cjs` covers these transitions, distinct best storage and a continuous physics-only summit drive. `tests/browser-mountain.cjs` captures 42 scenarios across three cameras and two orientations, checks all 240 chase positions and real keyboard/touch input, then checks Canvas fallback. `tests/browser_e2e.py` uses normal animation for both maps and retains 16 screenshots. The full verification command retains 269 images, both matrices, five models and five counterexamples.
