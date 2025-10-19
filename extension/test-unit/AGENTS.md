AGENTS.md — extension/test-unit agent guide

Purpose

Practical notes for writing and running unit tests in `extension/test-unit/`.

Framework

- Mocha + Chai
- jsdom-global for DOM tests

Structure

- Test files use `*.spec.js` naming and live directly under this folder.
- Use `require('../test-mocks/chrome-mock')` to stub `chrome.storage` and other chrome APIs.

Writing tests

- Prefer small, focused tests. Each `it()` should test one behavior.
- For DOM tests, populate `document.body.innerHTML` with the relevant HTML fixture and wire `global.chromeAdapter` before requiring the module under test.
- Use a `waitFor` helper or test-friendly exported functions (the codebase already exports `saveOptions` from `options.js`).

Edge cases

- Test storage fallback: simulate `chrome.runtime.lastError` to ensure code falls back to local storage.
- Test adapter injection by creating a spy adapter and asserting `download` or `runtime.sendMessage` invocations.

Agent checklist

- Run `npm test` locally; ensure nothing relies on network access.
- Avoid flaky timers—use polling or explicit exported functions where possible.
