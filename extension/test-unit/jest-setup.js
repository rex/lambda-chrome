// Jest setup: provide `chrome` mock and start MSW server for network tests

// Install jest-chrome global
try {
  // eslint-disable-next-line global-require
  const jestChrome = require('jest-chrome')
  global.chrome = jestChrome
} catch (e) {
  // If jest-chrome isn't installed yet, tests that rely on chrome will need the adapter.
  // We'll log a warning; the test environment may provide adapter-based fallbacks.
  // eslint-disable-next-line no-console
  console.warn('jest-chrome not available during setup:', e && e.message)
}

// Setup MSW server (works in Jest environment)
let server = null
let rest = null

beforeAll(() => {
  try {
    // prefer CommonJS requires
    // eslint-disable-next-line global-require
    const msw = require('msw')
    // eslint-disable-next-line global-require
    const mswNode = require('msw/node')
    // msw v2 may expose http instead of rest
    rest = (msw && msw.rest) ? msw.rest : (msw && msw.http ? msw.http : (msw && msw.default ? (msw.default.rest || msw.default.http) : null))
    const setupServer = (mswNode && mswNode.setupServer) ? mswNode.setupServer : (mswNode && mswNode.default ? mswNode.default.setupServer : null)
    if (!rest || !setupServer) {
      // eslint-disable-next-line no-console
      console.warn('MSW: expected helpers not found; network mocking disabled for Jest')
      return
    }
    server = setupServer(
      rest.head('*', (req, res, ctx) => res(ctx.status(200))),
      rest.get('*', (req, res, ctx) => res(ctx.status(200), ctx.body('ok')))
    )
    server.listen({ onUnhandledRequest: 'warn' })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('MSW could not be initialized in Jest setup:', err && err.message ? err.message : err)
    server = null
    rest = null
  }
})

afterEach(() => {
  if (server && typeof server.resetHandlers === 'function') server.resetHandlers()
})

afterAll(() => {
  if (server && typeof server.close === 'function') server.close()
})

module.exports = { getServer: () => server, rest }
