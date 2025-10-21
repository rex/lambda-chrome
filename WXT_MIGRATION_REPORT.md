# WXT Migration Assessment — lambda-chrome

Date: 2025-10-20

This document evaluates converting the lambda-chrome extension to use the WXT framework. It compares two approaches:

- Incremental migration: keep most of the existing code and progressively adapt modules to WXT-compatible patterns.
- Full rewrite: re-implement the extension from scratch using WXT as the native framework.

It covers feasibility, usefulness, pros/cons, benefits, costs, risks, and provides a recommended implementation plan and estimates.

## Executive summary

- The extension code is small (14 runtime JS files + 16 test specs). This means a full rewrite with WXT is feasible and likely faster than in a large project.
- Incremental migration is possible but may add complexity by mixing paradigms (imperative background/service worker logic and WXT reactive components) during the transition.
- Recommendation: For a small extension like this, a full from-scratch rewrite using WXT is often the simplest, cleanest, and lowest-risk path if you want the final codebase to follow WXT idioms. Choose incremental only if you must preserve exact runtime files during a phased deployment or can't afford a rewrite window.

## What is WXT (short)

- WXT is a modern UI/extension framework (assumed here as a minimal, opinionated toolkit that provides structured components, reactive state management, and helpers for extension APIs). If WXT adds bundling/build tooling, manifest wiring helpers, and Chrome API adapters, it will simplify extension code.

## Key dimensions to evaluate

- Runtime model compatibility (service worker vs WXT runtime)
- Size and complexity of the codebase
- Testing and mocks
- Development workflow (build vs no-build)
- Long-term maintainability and contributor ergonomics

## Repository snapshot

- `extension/js` (14 files): main `background.js`, `options.js`, `lib/` helpers.
- `extension/test-unit` (16 spec files): Jest-based tests using `jest-chrome` and MSW.
- Small third-party deps: `ky`, `msw`, `lodash`, `nanoid`, `sanitize-filename`.

## Feasibility

- Very feasible. The runtime surface area is small; re-implementing background logic and options UI with WXT is a small, bounded task.
- WXT likely expects a bundler step to compile components into distributable JS that can be loaded by the extension. Adding a build step is normal for modern extensions.
- Testing can continue under Jest; WXT components may require additional test utilities (renderers, DOM adapters), which are commonly available.

## Usefulness & benefits of WXT (for this project)

- Cleaner UI code: If `options.js` uses DOM manipulation, re-implementing options page with WXT components will reduce manual DOM boilerplate.
- Structured state and lifecycle: easier handling of options state, validation, and UI updates.
- Consistency: a single paradigm across codebase (component model) reduces ad-hoc patterns.
- Potential shared adapters and helper libraries from WXT (Chrome API shims, build-time manifest generation).

## Costs and drawbacks

- Build step required: WXT will likely introduce bundling; you'll need to add dev deps and a small build pipeline.
- Learning curve: team must be familiar with WXT. For small projects this is minor.
- Overkill risk: if the extension is intentionally kept minimal and without build steps, WXT could be unnecessary.

## Incremental migration: feasibility & approach

When to choose incremental

- You must keep the existing build/publishing process unchanged during migration.
- You prefer to minimize one-time effort and migrate modules gradually.

Incremental approach (recommended steps)

1. Add WXT as an optional dependency and configure its build to output compiled JS to a `dist/` folder.
2. Re-implement the `options` UI as WXT components and bundle them into a file that `options.html` includes. Keep background/service worker unchanged.
3. Replace or wrap individual helper modules (e.g., `lib/sanitizeFilename`, `lib/getBestCandidate`) one-by-one with WXT-friendly modules (if any are UI-centric). For pure utility modules, keep existing code; no need to migrate.
4. If desired, later re-implement `background.js` logic in a WXT-friendly pattern (if WXT offers background tooling). Otherwise keep background as-is.

Pros of incremental

- Lower initial risk; small, reversible steps.
- You can keep publishing cadence unchanged.

Cons of incremental

- Mixed paradigms in the codebase.
- Potential tooling duplication (partial bundling setup that needs to coexist with legacy runtime files).

Estimated effort for incremental

- Adding WXT + build + reimplement `options` UI: 1–2 days.
- Migrating additional modules incrementally: variable; each utility module ~0.5 day if refactoring needed.

## Full rewrite from scratch: feasibility & approach

When to choose rewrite

- The codebase is small; cleaner architecture is preferred.
- You want to standardize on WXT idioms and accept a single migration window.

Full rewrite approach (recommended for this repo)

1. Scaffold a WXT project (WXT CLI or simple template) with extension manifest support.
2. Implement the `background` logic in WXT-safe modules (either as plain modules or using WXT's background helpers if available).
3. Rebuild `options` as WXT components and use WXT's bundling to produce `options.html` asset(s).
4. Add dev scripts to build, test, and package the extension. Keep Jest tests ported to WXT components for options and re-use existing unit tests by adapting mocks.
5. Run manual smoke tests in Chrome (load unpacked extension) and adjust manifest entries if build output layout changed.

Pros of full rewrite

- Uniform architecture and consistent developer experience.
- Opportunity to remove legacy hacks and consolidate adapters, types, and tests.
- Faster to reason about for new features.

Cons of full rewrite

- Short-term development window to rewrite and test everything (but small codebase keeps this short).
- Need to ensure feature parity and matching behavior; tests mitigate this.

Estimated effort for full rewrite

- Project scaffold + build config + WXT basics: 0.5–1 day.
- Implement options UI and background logic, and port tests: 1–2 days.
- Testing, polishing, and packaging: 0.5–1 day.
- Total: ~2–4 days of focused work for a single experienced developer.

## Testing & CI notes

- You explicitly said no CI recommendations. Tests should be run locally. WXT components typically test with Jest + suitable renderers; continue using `jest-chrome` mocks.
- Ensure the test setup includes built assets where components rely on compiled code. Alternatively, test against source (ts-jest / babel) so build isn't required for tests.

## Risk matrix & mitigations

- Risk: Manifest mapping and output file naming cause the extension to fail when loaded in Chrome. Mitigation: ensure build emits files matching `manifest.json` or update manifest during package step.
- Risk: WXT opinionated runtime requires refactoring background patterns. Mitigation: keep background logic as plain modules and call them from WXT wrappers.
- Risk: Small incompatibilities between jest environment and WXT components. Mitigation: adapt tests with `jest` setup and maintain `jest-chrome` mocks.

## Recommended path (for this repo)

Because the extension is small, I recommend a full rewrite in WXT **unless** you have strict constraints that prevent a rewrite window.

Concrete plan for full rewrite (6 steps)

1. Scaffold WXT app in a new branch (wxt-scaffold). Ensure manifest and build targets are configurable.
2. Implement `options` UI as WXT components; wire state to chrome storage via a small adapter.
3. Port `background.js` logic to WXT-friendly modules or plain modules used by the WXT build; wire event listeners similarly.
4. Port unit tests: adapt `options` tests to use WXT test renderers; keep helper tests mostly unchanged.
5. Smoke test by loading the unpacked extension in Chrome and executing major flows.
6. Merge and publish once satisfied.

Concrete plan for incremental migration (if you choose that)

1. Add WXT & build tooling configured to output `dist/options.js` and other artifacts.
2. Re-implement `options` as WXT components and switch `options.html` to include the built bundle.
3. Keep background logic unchanged and continue shipping.
4. Gradually move helper code into WXT modules as needed.

Files and tooling I can add for you (if you want me to implement)

- WXT scaffold (starter project files), build scripts, and a working `options` component + adapter.
- Jest adjustments to test WXT components locally.

Next step for me (pick one)

- Create a minimal WXT scaffold and re-implement `options` page as a proof-of-concept and keep `background.js` unchanged (incremental proof).
- Or implement a full rewrite branch that replaces runtime with WXT artifacts and port tests.

Which do you want me to do next?"}
