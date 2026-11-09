# Five-map integration acceptance

Goal: retain Map 02 and formal verification contributions, complete the cloud-testable
map features, then pass full /verify before publication and again on GitHub Pages.

Local runtime limitation: /usr/bin/chromium cannot open its singleton socket (EPERM).
Official installed headless shell starts a minimal page but crashes when loading the
full game. Both JavaScript and Python Playwright have been attempted; logs are retained
in the run-specific /verify output. Do not report local browser PASS.

Delivery uses the project's documented executable-environment fallback: run the unchanged
full /verify on GitHub Actions before the deploy job. A failed verification prevents
publication. The live job checks all dist asset hashes and reruns browser scenarios.
Rollback is a normal revert of the integration commit on main, followed by the same
verification/deploy workflow. No force push, PR, Issue or secondary branch is used.

Android/iPhone physical-device performance and touch behavior are not established by
Chromium mobile viewport emulation. Visual target here remains a playable 3D graybox
with depth-tested roads, fog, terrain and clear feedback; photorealistic art is not
claimed by these tests.

## Executed precommit result

The final candidate built on `b9c6a2f` passed the complete command on the authorized
executable host. `integration-results.json` retains the exact tested source hashes
and clearly labels the dirty precommit candidate rather than presenting the base
revision as its code. The 37 source hashes were compared with this working tree
before publishing.

| Executed check | Result |
| --- | --- |
| Original circuit | 210 screenshot scenarios and 30 transitions, PASS |
| Mountain Road | 42 scenes, Canvas fallback and 51 checks, PASS |
| Five maps, delayed-script startup and three viewport sizes | 56 cross-map checks, 76 screenshots, PASS |
| Python normal animation, five maps/two orientations | 30 checks, 40 screenshots, PASS |
| Full vehicle region comparison | 486 regions, PASS |
| Collision/fall/recovery recordings | Six videos, 12 screenshots, PASS |
| TLA+ | Six finite models and seven specified counterexamples, PASS |
| Total screenshots | 381 |

Reviewed [five-map views](five-map-views.jpg), [Canvas fallback and jumps](fallback-jump-review.jpg),
[recording frames including recovery](recording-review.jpg), the permanent
[combined six-recording video](collision-fall-recovery.mp4), and the
[before/after terrain occlusion fix](fallback-before-after.jpg).

The new closed courses count a lap after all ordered checkpoints and an actual
forward crossing of the finish on the road. Legitimate offroad detours do not erase
a lap. City stop-line pixels and crossing penalties share the same geometry;
visible cross streets and shortcuts use their actual material and elevation.
The non-WebGL renderer uses a bounded software depth buffer to retain terrain
occlusion on climbing bends.

The repository's verify → deploy → verify-live workflow must pass for the exact
published commit. CI retains the complete screenshots, original recordings, logs
and source manifests as artifacts. Physical phones and photorealistic art remain
outside this graybox acceptance.

## Startup race found by release verification

The first integration release, `898a879`, was blocked by [Linux CI](https://github.com/LiuShiyuMath/graybox-drive/actions/runs/42608354430)
at normal offroad acceleration. A repeated Python run also captured a running, focused,
visible page with throttle held, zero elapsed time, zero speed, and
`drawMinimap is not defined`. The next external script had not initialized before the
first drawing frame; that exception prevented the next frame from being scheduled.

The deterministic browser regression delays `perspective.js` for two native frames.
It fails on the old source with that exact error and checks normal acceleration on all
three new courses after the fix. `DOMContentLoaded` now starts the single animation loop
after the ordinary scripts initialize. Speed thresholds and release gates are unchanged.
