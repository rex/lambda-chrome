AGENTS.md — extension/js/lib agent guide

Purpose

Describes expectations for helper modules under `extension/js/lib/`.

Guidelines

- Pure functions only: avoid accessing `window`, `document`, or `chrome` directly inside these modules.
- Provide clear contracts in the header comments (inputs, outputs, error modes).
- Return plain objects/values; throw or return errors consistently.

Unit testing

- Each file should have a corresponding `extension/test-unit/<name>.spec.js`.
- Tests should cover happy path and at least one edge case (empty/invalid input).

Naming and exports

- Name files using kebab-case, export via CommonJS (`module.exports =`) matching the rest of the project.
- Keep files < 200 lines when reasonable.

Examples of responsibilities

- `getBestCandidate.js` — probe + candidate selection, injectable `fetchFn` and `applyTemplateFn`.
- `performDownload.js` — adapter-aware download execution.
- `normalizeTwitter.js` — URL normalization and filename inference for Twitter images.

Agent checklist

- Add documentation comments at top of file with expected param shapes.
- Add tests covering all branches that matter to correctness.
