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
