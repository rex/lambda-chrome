const { expect } = require('chai')
const { wrap } = require('../../extension/js/lib/storageWrapper')

describe('storageWrapper', () => {
  it('get and set using sync storage', async () => {
    const storage = { sync: { get: (k, cb) => cb({ a: 1 }), set: (obj, cb) => cb() }, local: { get: (k, cb) => cb({}), set: (o, cb) => cb() } }
    const runtime = { lastError: null }
    const client = wrap(storage, runtime)
    await client.set({ a: 1 })
    const items = await client.get(['a'])
    expect(items.a).to.equal(1)
  })

  it('falls back to local when runtime.lastError is set', async () => {
    const storage = { sync: { get: (k, cb) => cb({}), set: (obj, cb) => cb() }, local: { get: (k, cb) => cb({ b: 2 }), set: (o, cb) => cb() } }
    const runtime = { lastError: true }
    const client = wrap(storage, runtime)
    await client.set({ b: 2 })
    const items = await client.get(['b'])
    expect(items.b).to.equal(2)
  })
})
