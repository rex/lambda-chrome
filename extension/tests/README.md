Lambda extension test suite

Overview

This directory contains end-to-end tests and fixtures for the Lambda Chrome extension. Tests are implemented using Puppeteer and a small set of local fixtures to allow reliable, repeatable runs.

Files

- puppeteer_test.js — Headful Puppeteer test that loads the extension, opens a local test fixture, triggers the content script to probe and download a visible image, and asserts that the image file was written to disk.
- fixtures/test-page.html — Local HTML fixture containing a direct image and a dynamically-created blob image (canvas -> blob) used to validate blob -> download flows.
- tmp-downloads/ — Temporary downloads directory created by the tests. This directory is ignored by .gitignore.
- tmp-profile/ — Temporary Chromium profile used by Puppeteer; ignored by .gitignore.

How the tests communicate with the extension

The content scripts in the extension listen for two integration points used by the tests:

1. chrome.runtime messaging: content scripts respond to messages like { type: 'probeImage', src } to probe a particular URL.
2. window.postMessage automation hook: content scripts accept window.postMessage({ \_\_lambda_msg: { type: 'probeAndDownloadVisible' } }) to find a large visible image on the page and send a background download request.

Extending the test suite (boilerplate scenarios)

- Twitter / X

  - Navigate to a tweet URL containing an image.
  - Wait for the image element to be visible (use page.waitForSelector with a robust selector).
  - Trigger the content script either by sending a postMessage (if content script supports it) or by invoking `chrome.runtime.sendMessage` via page.evaluate.
  - Consider mocking network responses or running with a test account.

- Reddit gallery

  - Reddit uses dynamic JS; wait for gallery controls to load and then select the current visible image element.
  - Trigger the probe/download via postMessage.

- Imgur / direct image hosts
  - Navigate to the image URL and trigger probe/download. For direct hosts the background HEAD/ranged requests are likely sufficient.

CI considerations

- Running in CI may require headless mode and adjusted Chrome flags. Loading the unpacked extension in headless Chromium is limited; prefer a headful runner or use remote debugging for CI.
- Cache puppeteer-installed Chromium between runs to reduce CI time.

Debugging tips

- If a test hangs, inspect the temporary profile under `tmp-profile/` and the browser window launched by Puppeteer.
- Use `console.log` in both background and content script; Puppeteer can capture console events with `page.on('console', ...)`.

Contributing

Add new fixtures in `fixtures/` and new test files in this directory. Keep tests deterministic and avoid external network dependencies where possible — prefer local fixtures or recorded responses.

Unit tests for utility functions

normalizeTwitterUrl

- File: `normalize_twitter.test.js`
- Purpose: unit-test the `normalizeTwitterUrl` helper in `extension/js/background.js` which normalizes pbs.twimg.com image URLs to request the large variant and create a sensible filename.
- To add a new test case: edit `normalize_twitter.test.js` and add entries to the `cases` array; each entry has:
  - `in`: input URL string
  - `expectUrlContains`: substring expected to appear in the normalized URL (e.g., `name=large`)
  - `expectFilename`: expected normalized filename (e.g., `G3hKysjWYAA15Xl.jpeg`)
- Run: `node extension/tests/normalize_twitter.test.js`

Note: The unit test extracts the function text from `background.js` at runtime, so if you modify `normalizeTwitterUrl` make sure the function signature remains `function normalizeTwitterUrl(...)`.

New libs and test helpers

- `extension/js/lib/` now contains small, pure helper modules:

  - `sanitizeFilename.js`
  - `srcset.js` (parseSrcset, chooseBestSrcsetEntry)
  - `urlutils.js` (basenameFromUrl, urlFromBackgroundImage)
  - `normalizeTwitter.js` (same logic as in background)
  - `applyTemplate.js` (template application helper)

- `extension/test-mocks/chrome-mock.js` is a tiny helper to simulate `chrome.storage` in unit tests. Import and use in tests to stub storage.

Adding tests

- Put mocha tests under `extension/test-unit/*.spec.js` (examples already included).
- Run all unit tests with `npm test`.
