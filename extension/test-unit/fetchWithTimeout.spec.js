const { expect } = require('chai')
const { fetchWithTimeout } = require('../../extension/js/lib/fetchWithTimeout')

describe('fetchWithTimeout', () => {
  it('throws when fetch not available', async () => {
    // call with fake fetchFn that rejects
    let called = false
    const fake = async (url, opts) => { called = true; return { ok: true, headers: { get: () => 'image/png' } } }
    const res = await fetchWithTimeout('http://example/', {}, { fetchFn: fake })
    expect(called).to.equal(true)
    expect(res).to.have.property('ok')
  })

  it('retries on failure', async () => {
    let attempts = 0
    const failing = async () => { attempts++; if (attempts < 2) throw new Error('fail'); return { ok: true, headers: { get: () => 'image/png' } } }
    const res = await fetchWithTimeout('http://x/', {}, { fetchFn: failing, retries: 2, timeout: 100 })
    expect(attempts).to.be.greaterThan(1)
    expect(res.ok).to.equal(true)
  })
})
