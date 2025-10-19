AGENTS.md — extension/js agent guide

Purpose

Guide for agents editing JS code that powers the extension UI and background logic.

Key files

- `background.js` — service worker orchestration, context menus, download wiring.
- `options.js` — options page DOM wiring, storage interaction.
- `lib/` — pure helpers: `sanitizeFilename.js`, `srcset.js`, `urlutils.js`, `normalizeTwitter.js`, `applyTemplate.js`, `getBestCandidate.js`, `performDownload.js`.

Patterns & Conventions

- Adapter pattern: modules that call `chrome.*` should support an injected `adapter` (or use `chromeAdapter` global in tests).
- Keep side-effect-free logic in `lib/` and export pure functions. This makes unit testing straightforward.
- Export functions to `window`/`global` in UI scripts when needed for jsdom tests (see `options.js`).

Testing guidance

- Unit tests live in `extension/test-unit/` and use Mocha + Chai + jsdom-global.
- For helpers: write synchronous tests using `require('..')` and verify returned values.
- For functions that call `fetch` or `chrome.*`, inject test doubles.

Debugging tips

- Use `console.debug` for low-volume logs; service workers may unload—keep logs focused.
- When testing downloads, use adapter mocks to assert that `chrome.downloads.download` is called with expected args.

Adding new helpers

- Add a file in `lib/` with a small exported API and a matching `*.spec.js` under `test-unit/`.
- Keep each helper focused on a single responsibility.

Agent checklist (before committing JS changes)

- Add or update unit tests for new logic.
- Run `npm test` and `npm run coverage` locally.
- Update `AGENTS.md` if you introduce new architectural patterns.
