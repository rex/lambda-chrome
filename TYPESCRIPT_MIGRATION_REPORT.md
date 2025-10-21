# TypeScript Migration Assessment — lambda-chrome

Date: 2025-10-20

## Summary

This document assesses the feasibility, costs, benefits, and risks of converting the lambda-chrome codebase to TypeScript (TS). It includes a recommended incremental migration plan, concrete configuration examples (tsconfig, Jest), libraries/types to add, and time/effort estimates tailored to the current repository layout.

## High-level conclusion

- Feasibility: High — the codebase that matters (the Chrome extension source under `extension/js` and unit tests) is small (~14 source JS files and ~16 test files). That makes an incremental migration practical and low-risk.
- Usefulness: Medium–High — TypeScript will catch many classes of bugs earlier (API misuse, wrong data shapes), improve IDE experience (auto-complete, refactoring), and improve long-term maintainability for this extension.
- Recommended approach: Gradual migration using `allowJs: true` and mixed JS/TS, convert a small pilot module first, add types for Chrome APIs and tests, then convert the rest. Keep Jest-based test workflow and `jest-chrome` mocks.

## Repository snapshot (relevant size & shape)

- Extension runtime sources: `extension/js/` — ~14 JS files (business logic + entry `background.js`).
- Tests: `extension/test-unit/` — ~16 spec files (now running under Jest + jest-chrome).
- Dev tooling: Jest (v27 + ts-jest possible), babel-jest currently used for transforms in earlier work.
- Third-party libs in use (relevant): `ky`, `msw`, `nanoid`, `lodash`, `sanitize-filename`, `jest-chrome`.

## Why migrate (benefits)

- Stronger correctness guarantees: static typing prevents many runtime errors (incorrect property access, wrong function args).
- Better editor/IDE UX: autocompletion, jump-to-definition, inferred types for functions and exports.
- Safer refactoring: renaming, moving functions, changing signatures become less error-prone.
- Docs-as-types: types document expected shapes (e.g., candidate objects for downloads), fewer surprises during maintenance.
- Improved onboarding: types reduce cognitive load for new contributors.

## Potential drawbacks / costs

- Upfront workload: converting files, writing type definitions for Chrome APIs and some third-party modules without types.
- Test tooling churn: Jest + ts-jest needs config changes; some transforms (msw ESM) might need attention.
- Slightly longer dev iteration if types or compiler settings block quick hacks (mitigated with `allowJs` and loosening flags initially).
- If you want zero bundling/no build step for extensions, compiled output and mapping must be handled carefully.

## Feasibility details and edge cases

1. Code size and complexity

- The extension runtime code is small — conversion is tractable. The large number of `.js` files seen earlier is from node_modules/coverage; the real source to convert is compact.

2. Chrome MV3 constraints

- The extension uses an MV3 service worker (`extension/js/background.js`). MV3 expects files referenced from `manifest.json`. TypeScript source must be compiled/transpiled into JS files that are published in the extension bundle. You can either:
  - Compile .ts -> .js (no bundler) and keep the same file layout that manifest references, or
  - Use a bundler (esbuild/rollup/webpack) to produce a curated bundle (recommended for larger codebases, but optional here).
- If you do not want any bundler or build step in dev, TS still requires `tsc` to emit `.js`. That is okay: a simple `tsc` step can be added to dev scripts; it does not require CI.

3. Tests & jest-chrome

- Tests currently run under Jest (v27) with `jest-chrome`. To run TypeScript tests, use `ts-jest` or Babel plus `@babel/preset-typescript`. `ts-jest` will be the simpler route for typing and tooling.
- `jest-chrome` might not ship types; you may need a tiny `types/jest-chrome.d.ts` declaring the module, or rely on `declare module 'jest-chrome'` in your global types.

4. Third‑party types

- Many libraries used have TypeScript types (lodash, ky, msw, nanoid). A few may not; either install `@types/*` or write minimal module declarations.

## Migration strategy (recommended, incremental)

Phased plan focusing on low-risk steps that keep the repo runnable and tests green at every step.

Phase 0 — Preparation (few hours)

- Add TypeScript and test runtime dependencies (dev):
  - typescript, ts-jest, @types/jest (match Jest v27), @types/node, chrome-types or @types/chrome, optionally @types/jest-chrome (if available) or add a manual declaration.
- Add a `tsconfig.json` with `allowJs: true`, `checkJs: false` to allow mixed files.
- Add `types/` folder for global declarations (e.g., `global.d.ts`, `jest-chrome.d.ts`, `chrome-adapter.d.ts`) and point `tsconfig` at it.
- Keep `package.json` `test` script as `jest` and install `ts-jest` to handle `.ts` tests.

Phase 1 — Pilot (1–2 days)

- Pick 1 non-trivial but self-contained module (for example `extension/js/lib/normalizeTwitter.js` or `sanitizeFilename.js`).
- Rename to `.ts` and fix immediate type errors. Use `any` liberally at first for unknown shapes; refine types later.
- Update imports/exports to be ES modules if you want strict ESM; otherwise let tsc emit CommonJS and keep `require()` calls.
- Run Jest and ensure tests pass for the pilot. Add type definitions for any third-party modules used by the pilot.

Phase 2 — Expand iteratively (2–5 days)

- Convert more modules in logical groups (lib helpers, then background, then options UI code).
- After each group, run tests and fix compile/test issues.
- Migrate tests: rename spec files to `.ts` only after corresponding modules are converted or when you want type checking in tests.

Phase 3 — Cleanup and stricter checking (1–2 days)

- Turn on stricter tsconfig flags progressively: `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`.
- Replace remaining `any` with precise types.
- Add linting / TypeScript ESLint rules if desired.

Phase 4 — Optional bundling (if desired) (1–2 days)

- If you prefer a single service-worker bundle or want to apply optimizations, add esbuild or rollup.
- Ensure source maps and manifest paths are updated.

## Concrete tsconfig (starter)

Use this as a starting `tsconfig.json` in the repo root. It supports gradual migration and compiles to an outDir (e.g., `dist/`) so you can inspect emitted files.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020", "DOM"],
    "outDir": "dist",
    "rootDir": ".",
    "allowJs": true,
    "checkJs": false,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "strict": false,
    "noEmitOnError": false,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["extension/js/**/*", "extension/test-unit/**/*", "types/**/*"],
  "exclude": ["node_modules", "dist", "coverage"]
}
```

Notes on compiler options

- `allowJs: true` lets you keep existing JS files and emit JS from them if you want; use it to migrate incrementally.
- `module: CommonJS` helps keep compatibility for tests and Node-based tooling; you can change to `ESNext` for an ESM-based extension build if you also adjust tests.
- `skipLibCheck: true` reduces friction when third-party types are slightly off.

## Jest + ts-jest quick config

- Install dev deps: `npm i -D typescript ts-jest @types/jest @types/node chrome-types`
- Init ts-jest config: `npx ts-jest config:init` (generates `jest.config.js`).
- Ensure `setupFilesAfterEnv` still points to `extension/test-unit/jest-setup.js` for jest-chrome & msw.
- If any node modules are ESM (e.g., `msw` v2), keep the existing transformIgnorePatterns tweaks or add `babel-jest` for ESM transformation.

## Type libraries to add

- `typescript` — compiler.
- `ts-jest` — test transformer for Jest.
- `@types/jest` — jest types (choose v27 to match current jest runtime).
- `@types/node` — node types for test environment.
- `chrome-types` or `@types/chrome` — types for the Chrome extension platform (I prefer `chrome-types` as it focuses on MV3 APIs; either is fine).
- Optionally `@types/lodash`, `@types/jsdom`, etc., if not already present.
- If `jest-chrome` lacks types, add a declaration in `types/jest-chrome.d.ts`:

```ts
// types/jest-chrome.d.ts
declare module "jest-chrome" {
  const chrome: any;
  export = chrome;
}
```

## Type strategy for runtime adapter

- Keep the `chromeAdapter` abstraction and define an interface for it in `types/chrome-adapter.d.ts`.
- Use that interface in modules consuming `chromeAdapter` so tests and runtime code share the same contract.

## Dealing with guarded requires and runtime-only code

- The repo currently uses guarded `require()` and runtime fallbacks to keep the MV3 service worker runnable without bundling. TypeScript plays nicely with this if you:
  - Leave guarded `require()` calls as-is (they will stay in emitted JS when using `module: CommonJS`).
  - Or convert to `import()` dynamic imports in TS when targeting ESM.
- For type-checking, use `declare const require: any;` or include `node` types to satisfy the compiler.

## Estimates (based on current repo shape)

These are rough, assuming one developer familiar with the codebase and TypeScript.

Small repo case (your repo):

- Setup + pilot conversion (1 module, tsconfig, tooling): 4–8 hours.
- Convert all runtime modules (14 files): 1–2 days (8–16 hours), depending on how many `any`/edge types you accept.
- Convert tests (16 spec files): 4–8 hours to migrate, plus ts-jest setup and fixing mocks.
- Add types for chrome and polish (interfaces, fix strictness): 4–8 hours.
- Total: ~2–4 days for a comfortable, tested conversion. If you want perfect strictness and zero `any`, add another 1–2 days.

## Risks & mitigations

- Risk: Manifest references service worker filename that must be kept in published extension. Mitigation: compile to the same file names or update `manifest.json` build step to point to compiled outputs.
- Risk: Third-party ESM packages (msw v2) can conflict with Jest transforms. Mitigation: preserve the existing jest transform settings and only add `ts-jest`; keep `babel-jest` for ESM node_modules if necessary.
- Risk: Tests that mock Chrome APIs may need type shims. Mitigation: add small ambient declaration files for `jest-chrome` and `chromeAdapter` interfaces.

## Concrete minimal starter steps (copy-paste safe)

1. Add dev deps:

```bash
npm install -D typescript ts-jest @types/jest @types/node chrome-types
```

2. Add `tsconfig.json` (starter above).

3. Add `types/jest-chrome.d.ts` and `types/chrome-adapter.d.ts` (minimal declarations) and include them in `tsconfig` `include`.

4. Configure Jest via ts-jest (or use `npx ts-jest config:init`) and ensure `setupFilesAfterEnv` still references `extension/test-unit/jest-setup.js`.

5. Pilot-convert one file: rename `extension/js/lib/sanitizeFilename.js` -> `extension/js/lib/sanitizeFilename.ts`, fix imports, run `npm test`.

6. Iterate until all modules/tests are converted and types are reasonably tight.

## Non-recommended paths

- Full rewrite in one pass: Not necessary here and introduces unnecessary risk. Prefer incremental migration.
- Switching to Jest v29 only to avoid downgrading jest-chrome: you would need to replace jest-chrome or maintain a shim — more work.

## Appendix: Example `types/jest-chrome.d.ts`

```ts
// types/jest-chrome.d.ts
declare module "jest-chrome" {
  type Listener = (...args: any[]) => any;
  const chrome: {
    storage?: any;
    runtime?: {
      sendMessage?: (...args: any[]) => any;
      lastError?: any;
    };
    tabs?: any;
    downloads?: any;
    contextMenus?: any;
    notifications?: any;
    _reset?: () => void;
  };
  export = chrome;
}
```

## Final recommendations

- Proceed with a gradual migration. Given the small surface area of the extension runtime code, the cost vs. benefit is favorable.
- Start with `allowJs: true` and `ts-jest`. Convert one helper as a pilot and confirm tests pass. Then convert the rest in small batches.
- Add minimal ambient types for `jest-chrome` and the `chromeAdapter` to reduce friction.
- Keep the current Jest workflow; do not add CI unless you change your mind.

If you want, I will:

- Create a working `tsconfig.json` and `types/` declarations in the repo, plus `devDependencies` suggestions added to `package.json`.
- Convert a single pilot module and adjust tests to show the process end-to-end.

Tell me which of the above you'd like me to execute next and I'll update the todo list and implement it.
