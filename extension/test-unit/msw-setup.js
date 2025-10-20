// MSW (Mock Service Worker) setup for Node-based tests
// Use dynamic import so this file can be required by Mocha (CommonJS) while still loading MSW (which may be ESM).

let server = null;
let rest = null;

before(function () {
  try {
    // Try several require paths to locate msw's node APIs. Using internal paths is
    // brittle but works around export/entrypoint indirection in some msw releases.
    let msw, mswNode;
    try {
      // prefer documented node entry
      // eslint-disable-next-line global-require
      mswNode = require('msw/node');
      // eslint-disable-next-line global-require
      msw = require('msw');
    } catch (e) {
      // fallback to internal paths
      try {
        // eslint-disable-next-line global-require
        mswNode = require('msw/lib/node');
        // eslint-disable-next-line global-require
        msw = require('msw/lib/core');
      } catch (e2) {
        // last-resort: try explicit files
        // eslint-disable-next-line global-require
        mswNode = require('msw/lib/node/index.js');
        // eslint-disable-next-line global-require
        msw = require('msw/lib/core/index.js');
      }
    }

    // msw v2 exposes `http` helpers instead of `rest`. Use whichever is available.
    const httpHelpers = msw && msw.http ? msw.http : (msw && msw.default ? msw.default.http : null);
    rest = msw && msw.rest ? msw.rest : null;
    const { setupServer } = mswNode && mswNode.setupServer ? mswNode : (mswNode && mswNode.default ? mswNode.default : {});

    if (!setupServer) {
      throw new Error('msw did not expose expected APIs (setupServer)');
    }

    const headHandler = (rest && rest.head) ? rest.head('*', (req, res, ctx) => res(ctx.status(200))) : (httpHelpers && httpHelpers.head ? httpHelpers.head('*', (req, res, ctx) => res(ctx.status(200))) : null);
    const getHandler = (rest && rest.get) ? rest.get('*', (req, res, ctx) => res(ctx.status(200), ctx.body('ok'))) : (httpHelpers && httpHelpers.get ? httpHelpers.get('*', (req, res, ctx) => res(ctx.status(200), ctx.body('ok'))) : null);

    if (!headHandler || !getHandler) {
      throw new Error('msw did not expose expected http/rest helpers (head/get)');
    }

    server = setupServer(headHandler, getHandler);

    server.listen({ onUnhandledRequest: 'warn' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('MSW could not be initialized for tests:', err && err.message ? err.message : err);
    server = null;
    rest = null;
  }
});

afterEach(function () {
  if (server && typeof server.resetHandlers === 'function') {
    server.resetHandlers();
  }
});

after(function () {
  if (server && typeof server.close === 'function') {
    server.close();
  }
});

module.exports = { getServer: () => server, rest };
