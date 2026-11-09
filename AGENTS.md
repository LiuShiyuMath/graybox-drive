# Graybox Drive

Mobile browser driving game. Runtime is standalone HTML/CSS/JavaScript in dist. No paid service, API key, login, package installation, or build is required for players.

- Preserve simultaneous touch steering and pedals, keyboard input, three cameras, race rules and locally stored best times.
- Before committing, run node --check dist/game.js, node --check dist/perspective.js and node tests/drive.cjs.
- Verify changed player interactions with a real browser using mouse, keyboard or touch. Mocked canvas tests do not establish visual correctness.
- For renderer or input changes, run node tests/browser-states.cjs and inspect the affected screenshots. It checks real Canvas pixels, independent input releases, and state transitions. Scenario fixtures do not replace physical-device testing.
- Keep screenshots and explicit verification limitations under verification.
- Deployment: GitHub Actions verifies main, then publishes only dist to GitHub Pages.
- Use relative asset URLs so the game works under the repository subpath.
- Do not include credentials, user data, private hosting configuration or machine paths in public source.

## Required repository workflow — MAIN ONLY (2026-11-09)

- **One branch:** `main` is the only active development branch. Do not create, push or request any secondary branch.
- **Direct commits:** make small, verifiable commits directly to `main`. Never open, merge, draft, or request a pull request. Do not use GitHub Issues for tasks or bug reports. Treat historical PRs/Issues as read-only archives.
- **Product intent:** the [ChatGPT project Page](https://chatgpt.com/space/page_b7e95e0e62948191a47974d9feeddc87) records requirements, discussion, decisions and status; `docs/ROADMAP.md` tracks implementable tasks and acceptance evidence. Update both as needed, rather than using PRs, Issues or Projects as planning surfaces.
- **Before every code commit:** fetch latest `main`, inspect diff and relevant tests, run `node --check dist/game.js`, `node --check dist/perspective.js`, `node tests/drive.cjs`, and for visual/input changes `node tests/browser-states.cjs`. No commit on test failure without a documented blocker and explicit rollback plan.
- **Real runtime verification:** after pushing code, inspect GitHub Actions and verify the deployed GitHub Pages gameplay in a real browser, including screenshots and interaction states. Do not use mock results, HTTP success, or one sampled pixel as proof of visual correctness.
- **Agent coordination:** serialize `main` changes. Re-read the latest head before a write; update stale local state without force pushing. Prefer a narrow, reversible change and recheck the live artifact.
- **Hard settings:** keep repository settings `has_pull_requests=false` and `has_issues=false`. If either becomes true, restore the restriction using authorized repository administration credentials. `AGENTS.md` is agent guidance; GitHub repository feature flags provide the server-side block.
- Keep the game public, free, playable without a backend, and deploy only `dist` after checks.

## Project /verify

- Use `.agents/skills/verify/SKILL.md` before every commit and after deployment. Run the existing checks plus state-machine runtime contracts, TLA+ TLC and real Chromium E2E with `.venv/bin/python tests/verify.py`; fix and rerun until PASS. Preserve exact failures rather than treating skipped checks as passed.
- Update `docs/STATE-MACHINES.md` and `specs/` when state transitions change. TLA+ finite model checks supplement implementation and visual checks; they do not prove continuous physics or Canvas correctness.
- In ChatGPT Work, install Python Playwright and Chromium when missing. Use the pinned versions and commands in `/verify`; actually launch the browser, exercise inputs and inspect screenshots. If the host prevents Chromium execution, retain the error and verify on an authorized executable environment/CI; report host-specific boundaries honestly.
