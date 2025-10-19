AGENTS.md — extension/test-mocks agent guide

Purpose

Describe the test mocks available and guidance for creating new mocks.

Current mocks

- `chrome-mock.js` — minimal implementation of `chrome.storage.sync`/`local` and call tracking.

Guidance

- Keep mocks small and predictable. They should support the methods the tests use (`get`, `set`, and `__calls` for assertions).
- Avoid emulating too much browser behavior—mocks are for narrow, fast unit tests. For integration, use Puppeteer.

Adding a mock

- Export the mock object and `__calls` if call-tracking is needed.
- Provide synchronous `get/set` semantics unless the code under test expects asynchronous callbacks. Match the real API shape (callbacks where appropriate).

Agent checklist

- Add new mock files to `extension/test-mocks/` and require them in tests.
- Document new mock behavior in this AGENTS.md when adding complex behavior.
