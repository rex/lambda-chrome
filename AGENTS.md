AGENTS.md — Project-wide agent guide

Purpose

This file exists to help an automated assistant (or a human acting as an agent) quickly understand the repository, common developer flows, testing, and conventions. Keep this short, actionable, and link to more specific guides in subfolders.

Quick facts

- Repo: lambda-chrome
- Type: Chrome extension (Manifest V3) with Node-based test harness
- Primary folders:
  - `extension/` — extension source and assets (manifest, html, css, js)
  - `extension/js/lib/` — pure helper libraries (unit-testable)
  - `extension/test-unit/` — Mocha unit tests
  - `extension/tests/` — end-to-end / Puppeteer harness and fixtures
  - `extension/test-mocks/` — test mocks used by jsdom/mocha tests

How to run tests (local Mac)

1. Install dev deps (one-time):
   - Ensure Node.js is installed (use a stable LTS). On macOS use Homebrew or nvm.
   - Run: `npm install`
2. Run unit tests:
   - `npm test`
   - This runs Mocha tests in `extension/test-unit/**/*.spec.js`.
3. Run coverage (includes tests):
   - `npm run coverage` (this uses nyc to run the test runner and produce a coverage report)
   - By default `coverage/` and `.nyc_output/` are ignored by `.gitignore`.
4. Run e2e harness (optional):
   - `npm run test:e2e` (see `extension/tests/README.md` for configuration and headless flags)

Testing notes for agents

- Unit tests use `jsdom-global` to provide a DOM for options and other DOM-bound code.
- The codebase uses an adapter pattern (see `extension/js/background.js`) to make chrome.\* calls testable; prefer injecting mocks via `chromeAdapter` in tests.
- Avoid network calls in unit tests; use fixtures or mocks.

Code style & conventions

- Keep pure helper functions in `extension/js/lib/` for easy unit testing.
- Prefer dependency injection for APIs (chrome, fetch) so tests can stub them.
- Keep UI code small in `extension/js/options.js`; export functions (e.g. `saveOptions`) so tests can call them directly.

When creating or updating helpers:

- Add a unit test in `extension/test-unit/` with happy path + 1-2 edge cases.
- Run `npm test` and `npm run coverage` locally; aim to increase coverage selectively.

If you change dependencies

- Update `package.json` and run `npm install` locally. Do not commit lockfiles unless project policy requires it.

Where to look for important logic

- `extension/manifest.json` — MV3 manifest and declared scripts/permissions
- `extension/js/background.js` — background/service worker orchestration
- `extension/js/lib/*` — helper functions for download logic and normalization
- `extension/js/options.js` — options page wiring and storage interactions

Contact

- This repository is personal — when in doubt, run tests and ask the owner (project metadata) for policy.
