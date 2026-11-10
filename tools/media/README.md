# Record a real Graybox Drive race

`record-playthrough.cjs` drives Map 01 through three earned laps with ordinary
keyboard input. It reads the live route to steer, as the verified
`tests/browser-slice.cjs` does. It never moves the car directly, calls the finish
function, replaces animation, or changes the clock.

The output is a complete 1280×720 browser recording. The player approaches the
finish, finishes the race, and sees the real saved result for at least 4.5 seconds.
The recorder adds no captions, badges, music, cursor overlays, or synthetic holds.
Playwright captures no audio. A fresh profile leaves the game's sound off.

## Source manifest

Use the exact deployed commit and the `sourceSha256` map from its successful
`/verify` result. Only `dist/*` entries are used. Include every runtime asset.
For production, retain the deployment evidence URL returned by the release flow.
Do not put credentials or private URLs in this file.

```json
{
  "environment": "production",
  "commit": "FULL_40_CHARACTER_DEPLOYED_COMMIT",
  "deployment_url": "https://liushiyumath.github.io/graybox-drive/",
  "deployment_evidence_url": "EXACT_HTTPS_DEPLOYMENT_EVIDENCE_URL",
  "sourceSha256": {
    "dist/index.html": "EXACT_SHA256_FROM_VERIFY",
    "dist/game.js": "EXACT_SHA256_FROM_VERIFY",
    "dist/art.js": "EXACT_SHA256_FROM_VERIFY",
    "dist/perspective.js": "EXACT_SHA256_FROM_VERIFY",
    "dist/presentation.js": "EXACT_SHA256_FROM_VERIFY",
    "dist/dusk-sky.webp": "EXACT_SHA256_FROM_VERIFY"
  }
}
```

The example omits the other runtime entries for readability. Copy all of them
from the verification result. Placeholder strings deliberately fail validation.
The recorder first checks anonymous HTTP response hashes. It then hashes the
responses loaded by the actual recording browser, including versioned script
URLs. A mixed or stale release fails before driving.

For a local rehearsal, use `environment: "local-rehearsal"` and a loopback HTTP
`deployment_url`. Serve the real `dist` directory without changing browser
security. A local rehearsal is not a production rehearsal or recording.

## Rehearse, then record

Run in the repository root on the authorized recording host, with the project's
pinned Playwright and its matching Chromium installed. The normal route is the
user's Mac mini. Use `DRIVE_CHROMIUM_PATH` only for an explicitly verified
compatible browser. Run the project `/verify` and verify deployment first.

Each `MEDIA_OUT` must be new. The recorder refuses to reuse an existing directory.

```bash
DRIVE_URL=https://liushiyumath.github.io/graybox-drive/ \
SOURCE_MANIFEST=/absolute/path/source.json \
MEDIA_OUT=/absolute/path/rehearsal-01 \
RECORD_MODE=rehearse \
node tools/media/record-playthrough.cjs
```

The rehearsal completes the real race without video recording. Confirm its
`result.json` passed and inspect its discovery and finish screenshots. Then run
the same source with a new output directory.

```bash
DRIVE_URL=https://liushiyumath.github.io/graybox-drive/ \
SOURCE_MANIFEST=/absolute/path/source.json \
REHEARSAL_REPORT=/absolute/path/rehearsal-01/result.json \
MEDIA_OUT=/absolute/path/take-01 \
RECORD_MODE=record \
node tools/media/record-playthrough.cjs
```

Recording requires a successful production rehearsal with the same commit,
runtime hashes, and viewport. Every new take repeats the public-byte checks.

## Evidence and the 8-second derivative

| File | Content |
| --- | --- |
| `raw/*.webm` | The browser's original full recording, kept under its original filename and made read-only after closure |
| `source.json` | Declared deployment, exact runtime hashes and anonymous HTTP receipts |
| `discovery.json` | Observed start/menu text, geometry, hit targets and initial state |
| `markers.jsonl` | Monotonic wall-time markers for visible actions, laps, contact, finish and result hold |
| `samples.json` | Read-only driving observations at approximately quarter-second intervals |
| `frames/*.png` | Actual menu, start, laps, contact and finish screenshots |
| `result.json` | Executed gates, final race, saved result, browser-loaded hashes and raw video SHA-256 |

`elapsed_ms` starts immediately before creating the recording page. Playwright
does not expose the exact first encoded frame's wall time. Align the observed
finish marker with decoded video frames before selecting the edit; never claim
wall markers alone are frame-accurate video timestamps.

Preserve the full raw recording. In a separate new edits directory, select one
continuous eight-second interval containing the final approach, finish and at
least three seconds of the readable result. Keep the original speed. Do not
splice unrelated shots, repeat frames to fabricate a hold, or replace gameplay
with a concept image.

Encode H.264, `yuv420p`, limited color range and `faststart` MP4. Probe the actual
output and inspect a contact sheet plus dense finish frames. Verify the source
and derivative hashes. `recorded-needs-visual-review` is not a visual PASS or
publication-ready status. Confirm that the delivered video actually plays and
that its public game URL still serves the captured version before handoff.
