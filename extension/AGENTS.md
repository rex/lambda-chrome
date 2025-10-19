AGENTS.md — extension/ agent guide

Purpose

This document explains the layout and developer flows specific to the `extension/` folder and what an agent should do when making changes to the Chrome extension part.

Structure

- `manifest.json` — chrome MV3 manifest (permissions, service worker, options page)
- `popup.html`, `options.html` — UI pages
- `js/` — extension JavaScript (service worker background, content scripts, helpers)
- `css/`, `img/`, `icon/` — assets

Important practices for agents

- MV3: the background script runs as a service worker — avoid blocking I/O in the worker and prefer event-driven flows.
- Use `chrome.storage.sync` where available; test using `chromeAdapter` or the `test-mocks/chrome-mock.js`.
- When changing background behavior (downloads, tabs), add a unit test when possible and an integration test in `extension/tests/` if it affects runtime behavior.

Testing & local iteration

- To test UI pages, load the unpacked extension in Chrome from `extension/` directory (Developer mode → Load unpacked).
- Use console logging in the background/service worker for quick debugging; note that service worker lifecycle means logs may disappear—use `chrome://serviceworker-internals` or the extension inspect view.

Packaging

- Keep icons under `extension/img/icon/`. If you regenerate icons, update `manifest.json` icons keys.

When adding permissions

- Be conservative. Add only permissions necessary for new features and update `manifest.json` accordingly.
- Document the change in code comments and tests.

Agent tips

- Prefer small, testable changes. If a change requires network or browser feature testing, add a Puppeteer test in `extension/tests/`.
- Use the adapter pattern (see `js/background.js`) to avoid direct chrome.\* dependencies in unit-tested modules.
