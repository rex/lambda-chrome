AGENTS.md — extension/tests agent guide

Purpose

Guidance for end-to-end tests and fixtures under `extension/tests/`.

What lives here

- Puppeteer harness and fixtures (local HTML pages) used for smoke/integration tests.

How to run

- Install dev deps: `npm install`.
- Run headful (default): `npm run test:e2e`.
- Headless: `npm run test:e2e:headless` (sets HEADLESS=1).
- Use `USE_SYSTEM_CHROME=1` env var to use an installed Chrome binary instead of Puppeteer's bundled Chromium.

Best practices

- Keep tests deterministic and avoid external network requests.
- Use local fixtures in `extension/tests/fixtures/`.
- Clean up temporary downloads/profiles after tests (scripts may already do this).

Agent tips

- If a test fails intermittently, add retries or better assertions that wait for stable signals (DOM polling, events).
- Use a temporary Chrome profile directory to isolate test runs.
