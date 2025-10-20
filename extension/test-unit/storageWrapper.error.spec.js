const { expect } = require('chai')
const { wrap } = require('../../extension/js/lib/storageWrapper')

describe('storageWrapper error branches', () => {
  it('falls back to local when sync.get throws', async () => {
    const storage = {
      sync: { get: (k, cb) => { throw new Error('boom') }, set: (o, cb) => cb && cb() },
      local: { get: (k, cb) => cb({ x: 9 }), set: (o, cb) => cb && cb() }
    }
    const client = wrap(storage, { lastError: null })
    const items = await client.get(['x'])
    expect(items.x).to.equal(9)
  })

  it('falls back to local when sync.set throws', async () => {
    let localSetCalled = false
    const storage = {
      sync: { get: (k, cb) => cb({}), set: (o, cb) => { throw new Error('fail') } },
      local: { get: (k, cb) => cb({}), set: (o, cb) => { localSetCalled = true; cb && cb() } }
    }
    const client = wrap(storage, { lastError: null })
    await client.set({ y: 2 })
    expect(localSetCalled).to.equal(true)
  })
})
