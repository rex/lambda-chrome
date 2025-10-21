# Lambda Chrome Extension — Documentation Overview

This doc summarizes the extension's functionality and points to API documentation generated from JSDoc comments.

Files

- `DOCS/API.md` — generated API documentation for functions and modules in `extension/js`.
- `docs/` — generated HTML site (open `docs/index.html` in a browser).

Core features

- Options page: UI to configure preferences (filename templates, shelf behavior, reveal passwords, paste settings).
- Background service worker: handles context-menu downloads, commands, and downloads lifecycle (notifications, shelf behavior).
- Utility libraries: `lib/getBestCandidate.js`, `lib/performDownload.js`, `lib/fetchWithTimeout.js`, `lib/sanitizeFilename.js`, `lib/normalizeTwitter.js`, `lib/srcset.js`, `lib/contentDisposition.js`.
- Tests: Jest-based unit tests under `extension/test-unit/`.

How to regenerate docs

- Markdown API (DOCS/API.md):

```bash
npm run docs:md
```

- HTML site (docs/):

```bash
npm run docs:html
```

Notes

- If some modules lack JSDoc comments, `documentation` will still include extracted symbols but the prose will be sparse. You can improve docs by adding JSDoc comments to public functions.
- For better output, consider adding `@module` and `@typedef` annotations to large data shapes (e.g., Candidate objects, download options).
