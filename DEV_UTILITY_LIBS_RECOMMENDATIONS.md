# Utility libraries — recommendations for lambda-chrome

Date: 2025-10-20

Purpose: propose small utility libraries that reduce boilerplate, improve safety, and speed development for the Chrome extension codebase. This document focuses on lightweight, focused libraries (not frameworks) that are low-friction to adopt.

Summary table (short):

| Library | Usefulness | Size (approx) | Difficulty to adopt | Why it helps |
|---|---:|---:|---:|---|
| lodash (pick modules) | High | modular (individual functions ~1-3 KB) | Low | Well-tested utilities for arrays, objects, and strings; reduces bug-prone vanilla implementations |
| axios / ky | High | axios ~14KB min+gz, ky ~3KB gz | Low | Simplifies fetch, timeout, retries, interceptors; `ky` is smaller and modern (fetch-based) |
| date-fns / dayjs | Medium | date-fns modular (per fn small) / dayjs ~2-3KB gz | Low | Safer date handling vs Date; small functions for formatting/parsing |
| nanoid | Medium | ~2KB gz | Very low | Small unique id generator (replaces ad-hoc ids) |
| query-string | Medium | ~2KB gz | Low | Robust parsing/stringifying of query params and sources |
| sanitize-filename | High | ~1KB gz | Low | Replaces handcrafted filename sanitizers (safer edge-cases) |
| mime/lite (mime-types) | Medium | small | Low | Determine file extension / content-type mapping reliably |
| msw / nock | High (for tests) | Dev-only | Low-Medium | Mock network calls for unit tests and e2e; msw works well with fetch/ky |
| form-data / file-type | Low-Med | small | Low | Helpful for content-disposition or file-type inference in download flows |

---

Detailed recommendations

1) lodash (or lodash-es modular functions)
- Use-cases in repo: object merges, deep clones, defaults, pick/omit, safer isEmpty/isPlainObject checks for the library code.
- Pros: battle-tested, many convenience helpers, stable APIs, tree-shakable when importing specific functions (e.g. lodash.clonedeep).
- Cons: whole-library can be large if imported incorrectly; prefer direct per-function imports or `lodash-es` with rollup/esbuild tree-shaking.
- Adoption difficulty: Low. Replace small utility snippets one-at-a-time.
- Recommended functions: get, set, debounce, throttle, merge, cloneDeep, isPlainObject.

2) axios or ky (fetch wrapper)
- Use-cases: You already have `fetchWithTimeout` and small retry logic. `ky` is a modern fetch wrapper that provides timeout, retry, hooks, and small size. `axios` is more established and supports node as well.
- Pros ky: small, promise-based, built for Fetch API, easy to mock with MSW. axios: robust features and familiar API.
- Cons ky: depends on fetch; for older environments polyfill needed. axios: heavier.
- Adoption difficulty: Low. Replace local fetchWithTimeout with ky instance configured for default timeout + retry. Keep current wrapper for node tests if needed.

3) date-fns or dayjs
- Use-cases: minimal date manipulations / timestamp formatting used in templates.
- Pros: small, immutable function API, tree-shakable (date-fns). dayjs is very small and moment-like.
- Cons: adds dependency; use only if you need non-trivial date logic.
- Recommendation: keep using Date + helper if formatting needs grow; otherwise adopt date-fns functions as needed.

4) nanoid
- Use-case: generating short unique ids for notifications or temporary keys.
- Pros: tiny, cryptographically strong IDs, no collision headaches.
- Cons: trivial functionality but very small and helpful.

5) query-string
- Use-case: parsing and building query parameters for URLs and template placeholders.
- Pros: Robust edge-case handling for arrays / nested params; easier to read/maintain than hand-rolled regexes.

6) sanitize-filename
- Use-case: filename sanitization is critical in your code (sanitizeFilename in background.js). Using `sanitize-filename` library reduces subtle OS/FS edge-cases and avoids ad-hoc regex errors.
- Pros: small, well-tested, less chance of missing corner cases.
- Cons: none significant; adopt immediately to reduce bugs.

7) mime-types / media-type mapping
- Use-case: fast, reliable mime-to-extension mapping in getBestCandidate / performDownload.
- Pros: avoids brittle string splits and hard-coded assumptions.

8) msw (Mock Service Worker) or nock
- Use-case: unit-testing network probes (HEAD/GET) in getBestCandidate and other network flows.
- Pros MSW: runs in Node and browser-like environments; works well with fetch/ky; lets you assert network interactions deterministically.
- Cons: small learning curve.

9) file-type
- Use-case: determine file mime by inspecting bytes (if you ever have blob/arraybuffer content). Optional for advanced heuristics.

10) tiny helpers: lodash.pick, lodash.get, escape-string-regexp
- Replace pattern-heavy code with robust helpers to reduce bugs.

---

Implementation difficulty estimates
- Very low (installs + 1-2 small code changes): nanoid, sanitize-filename, query-string, lodash.get
- Low (replace wrappers with library calls): ky or axios, lodash modules, mime-types
- Medium (tests + mocks adjustment): msw for network mocking, migrating fetchWithTimeout to ky + msw tests

Work plan (suggested incremental PRs)
1. PR 1 — Add `sanitize-filename`, `nanoid`, `query-string`, `mime-types`:
   - Replace `sanitizeFilename` implementation in `background.js` with `sanitize-filename` for safer behavior.
   - Use `nanoid` where small randomness/ids needed (e.g., notification ids).
2. PR 2 — Add `ky` and replace `fetchWithTimeout` implementation (preserve existing API; simply wrap ky to match options).
3. PR 3 — Add `lodash` small functions (`get`, `set`, `merge`), replace brittle object handling in a couple of modules.
4. PR 4 — Add `msw` to test-dev dependencies and replace network mocking tests to use MSW handlers for HEAD/GET responses in `getBestCandidate` tests.

Notes about size and bundling
- Use esbuild or rollup to tree-shake per-function lodash imports. `ky` and `nanoid` are small and compress well.
- For Chrome extension code, smaller bundles are better — prefer modular imports (`import get from 'lodash/get'`) or use the `lodash-es` package with a bundler.

---

Recommendations (priority order)
1. Add `sanitize-filename` (high impact, low cost) — replace current `sanitizeFilename` helper.
2. Add `ky` (or axios) and migrate `fetchWithTimeout` to ky with retries/timeouts configured (medium impact, low cost). This centralizes network config and makes retries simpler.
3. Add `msw` for controlled network mocking in unit tests (high impact on test reliability).
4. Use `nanoid` for ids and `query-string` for URL query parsing when needed.
5. Add modular `lodash` functions as needed to reduce custom implementations.

---

If you'd like, I can implement PR 1 now (install `sanitize-filename` and replace `sanitizeFilename` implementation), run tests, and show the diff. Or I can start with `ky` + `fetchWithTimeout` migration and add `msw` for tests.
