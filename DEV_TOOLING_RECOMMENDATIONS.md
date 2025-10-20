## Developer tooling recommendations — lambda-chrome

Date: 2025-10-20

This document summarizes recommended tooling to simplify development and testing for this Chrome extension codebase. It focuses especially on the two items you asked about: WXT for development and `jest-chrome` for testing. It also lists complementary tools, pros/cons, and a concrete migration / next-steps plan you can follow incrementally.

---

## Goals
- Reduce repetitive, error-prone vanilla-JS patterns.
- Improve iteration speed (hot-reload, faster builds).
- Make unit tests easier to write and more reliable (mocking chrome.* safely).
- Improve developer ergonomics with linting, type-safety, and predictable builds.

## Quick executive summary
- Use a focused WebExtension development tool (either `wxt` or Mozilla's `web-ext`) to run, reload, and package the extension quickly.
- Migrate unit tests from Mocha/Chai to Jest and adopt `jest-chrome` (or `sinon-chrome` if you prefer Sinon style). `jest-chrome` provides ready-made mocks of the Chrome Extension APIs that integrate with Jest's mocking and snapshotting capabilities.
- Add `webextension-polyfill` (and its types) to normalize Promise-based behavior across browsers and simplify code that uses callbacks.
- Consider a gradual migration to TypeScript (or at least add JSDoc + ESLint + types) to catch errors earlier.
- Use a modern bundler (esbuild/rollup/webpack) or the build-in WXT pipeline to bundle modules and enable HMR for quicker iteration.

---

## About WXT (and alternatives)

What is WXT?
- `wxt` (WebExtensions Toolkit) is one of several community tools that provide a development server and build pipeline for browser extensions. It focuses on developer ergonomics: launching the extension into a browser, watching files, building versions, and packaging. If you want a single tool that handles manifest merging, reloading and producing builds for different targets, WXT is a sensible choice.

Alternatives
- `web-ext` (Mozilla) — the official CLI for WebExtensions. Stable, well-supported, and focused on running/packaging extensions and signing for AMO.
- Custom setups using bundlers (esbuild/webpack/rollup) — gives more control but requires more configuration.

Pros of adopting WXT / web-ext
- Fast dev loop: watch + reload extension on file change.
- Built-in packaging and manifest handling.
- Less boilerplate than a custom rollup/webpack setup.

Cons / caveats
- Adds another dev-dependency and its own conventions; learning curve.
- Some WXT plugins/presets may not be as actively maintained as core bundlers.
- If your build needs are unique, a hand-rolled bundler + script may be more flexible.

Recommendation
- Try `wxt` first for rapid iteration (dev server + reload + packaging). If you need signing or closer alignment with Mozilla, use `web-ext` for packaging and QA runs. Both can coexist: use `wxt` for local dev and `web-ext` for publishing tasks.

---

## About Jest and jest-chrome (testing)

What is `jest-chrome`?
- `jest-chrome` is a library that provides jest-friendly mocks for the Chrome extension APIs (chrome.*). It plugs into Jest's mocking system so tests can call or spy on `chrome.runtime.sendMessage`, `chrome.storage`, `chrome.downloads`, etc., without needing a running browser.

Why switch to Jest + jest-chrome?
- Jest is fast, provides built-in mocking, snapshotting, and watch mode.
- `jest-chrome` gives nearly drop-in chrome.* mocks so tests are easier to write and more consistent.
- Jest has excellent TypeScript support (`ts-jest`) if you migrate later.

Pros of Jest + jest-chrome
- Faster unit-test runs and better mocking ergonomics than hand-rolled mocks.
- Easier to write and reason about tests that depend on chrome.* APIs.
- Rich ecosystem (coverage, watch mode, snapshot tests).

Cons / caveats
- Migrating tests from Mocha/Chai requires re-writing assertions and setup/teardown.
- `jest-chrome` is a mock — it doesn't emulate extension runtime fully; for integration/e2e you still need Puppeteer/WebDriver or `web-ext run`.
- Some very specific edge-cases in chrome runtime behavior may require custom extensions of the mock.

Recommendation
- Convert unit tests to Jest and use `jest-chrome` for chrome API mocks. Keep Puppeteer (already in `devDependencies`) for e2e tests and `web-ext`/`wxt` for manual QA.

Example Jest setup (high level)
1. Install packages:

```bash
# from repo root (zsh)
npm install -D jest jest-environment-jsdom jest-chrome @types/jest
# If using TypeScript: npm install -D ts-jest typescript @types/chrome
```

2. Minimal `jest.config.js`:

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['jest-chrome'],
  testMatch: ['<rootDir>/extension/test-unit/**/*.spec.(js|ts)'],
}
```

3. Replace mocha test helpers with Jest equivalents and use `global.chrome` mocks provided by `jest-chrome`.

Notes about `jest-chrome` vs `sinon-chrome`:
- `jest-chrome` is tailored to Jest. `sinon-chrome` is handy if you prefer Sinon spies/stubs. Both are valid; prefer `jest-chrome` if you move to Jest.

---

## Complementary libraries and tools

- `webextension-polyfill` — normalize extension APIs to Promise-based `browser.*` calls. Makes async code cleaner and easier to test. Use with `import browser from 'webextension-polyfill'` and optionally `@types/firefox-webext-browser` for types.
- `@types/chrome` — if migrating to TypeScript, this provides Chrome API types.
- `esbuild` or `rollup` — lightning-fast bundlers. `esbuild` is simplest to set up and can be integrated into WXT or a small npm script.
- `eslint` + `eslint-plugin-security` + `prettier` — enforce consistent style and catch common mistakes early.
- `husky` + `lint-staged` — pre-commit hooks to run lint/tests locally.
- `ts-node` / `ts-jest` — if you decide to convert to TypeScript gradually.

---

## Migration / next-steps (recommended incremental plan)

Priority: low-risk, high ROI steps you can take in small PRs.

1) Add `webextension-polyfill` and prefer `browser`-style promises in new code
- Install:

```bash
npm install webextension-polyfill
```

- Replace callback-based storage/downloads usage with Promise-based `browser.storage.sync.get(...).then(...)` where convenient. This simplifies tests and avoids callback hell.

2) Add `jest` + `jest-chrome` and convert a small subset of tests
- Install:

```bash
npm install -D jest jest-environment-jsdom jest-chrome @types/jest
```

- Add `jest.config.js` and convert a couple of your Mocha tests to Jest (start with `extension/test-unit/performDownload.spec.js` and `background.spec.js`). Use the adapter pattern you already have, or lean on `jest-chrome`'s global `chrome` mock.

3) Add a dev-runner: try `wxt` (or `web-ext` if you prefer)
- Install and configure a small `wxt.config.js` or use `web-ext run` scripts. This gives fast reloads and a simple developer workflow.

Example quick commands:

```bash
# install wxt (try it locally first)
npm install -D wxt
# run dev server (example -- refer to wxt docs)
npx wxt run

# alternatively use web-ext for running in Firefox / packaging
npm install -D web-ext
npx web-ext run --chromium
```

4) Add a bundler / HMR pipeline
- If WXT doesn't satisfy your bundling needs, add `esbuild` or `rollup` and wire it to output into the `extension/` folder. `esbuild` is the easiest to start with and very fast.

5) Gradual TypeScript adoption (optional)
- Add TypeScript and `ts-jest` and convert a few modules at a time. Start with pure-library modules in `extension/js/lib/` (these have no chrome dependency) to get immediate type-coverage benefits.

6) Improve linting and CI (later)
- Add `eslint` with a recommended config, plus Prettier. Add `npm test` to CI once local flow is smooth.

---

## Practical notes for this repository (tailored suggestions)

- You already have `puppeteer` for e2e — keep it for integration tests. Using `jest` for unit tests + puppeteer for e2e is a common, effective pairing.
- Your current tests use a custom `chromeAdapter` mock. If you adopt `jest-chrome` you can simplify or remove some of the custom mock code and rely on the standard mocked `chrome` object instead. However, keep the adapter abstraction in code — it’s valuable for test injection and for non-browser environments.
- The background script required a few defensive changes to be test-friendly; the proposed tooling will reduce the need for those defensive gymnastics (jest-chrome provides stable mocks and `webextension-polyfill` helps with promise-based flows).

---

## Risks and mitigations

- Risk: Large migration work if you change test runner and introduce TypeScript. Mitigation: do it incrementally. Convert a couple of tests first; add tooling but keep Mocha scripts until Jest is stable.
- Risk: Test behavior divergence between `jest-chrome` mocks and real Chrome. Mitigation: keep Puppeteer / web-ext e2e tests to validate critical flows.

---

## Suggested immediate next PRs (small, reviewable)
1. Add `webextension-polyfill` and a small utility wrapper to expose `browser`-style APIs; update a couple of helper libs to use it.
2. Add `jest` + `jest-chrome` and convert 2–3 unit tests to Jest to validate migration path.
3. Add `wxt` (or `web-ext`) with a short README line showing how to run the extension in dev mode.

Each PR should be small and focused so you can revert easily if desired.

---

## References & links
- jest-chrome: https://www.npmjs.com/package/jest-chrome
- webextension-polyfill: https://github.com/mozilla/webextension-polyfill
- web-ext (Mozilla): https://github.com/mozilla/web-ext
- esbuild: https://esbuild.github.io/
- wxt (community WebExtensions Toolkit) — check the npm registry and docs for current options and configuration examples.

---

If you want, I can implement the first PR now:
- Option A: Add `jest` + `jest-chrome`, a `jest.config.js`, and convert two focused tests to Jest.
- Option B: Add `wxt` dev script and a minimal `wxt` config so you can run and auto-reload the extension during development.

Tell me which you'd like and I'll implement it (small PR style) and run tests.
