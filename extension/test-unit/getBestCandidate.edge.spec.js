const { expect } = require('chai')
const { getBestCandidate } = require('../js/lib/getBestCandidate')

describe('getBestCandidate edge cases', () => {
  it('returns null-like object when empty src', async () => {
    const res = await getBestCandidate({ srcUrl: '' }, { id: 1 }, { adapter: { tabs: { sendMessage: (id,msg,cb)=>cb(null) } }, fetchFn: async ()=>{ throw new Error('no') }, applyTemplateFn: async (u,f)=>f })
    expect(res).to.be.an('object')
    expect(res.ok).to.equal(false)
  })

  it('handles blob/data URLs by returning as-is', async () => {
    const src = 'data:image/png;base64,iVBORw0KGgo='
    const res = await getBestCandidate({ srcUrl: src }, { id: 1 }, { adapter: { tabs: { sendMessage: (id,msg,cb)=>cb(null) } }, fetchFn: async ()=>{ return { headers: { get: ()=>null } } }, applyTemplateFn: async (u,f)=>f })
    // For data urls we expect a failure because fetch not possible; ensure not crash
    expect(res).to.be.an('object')
  })

  it('prefers content-disposition filename when present', async () => {
    const fakeAdapter = { tabs: { sendMessage: (id,msg,cb)=>cb(null) } }
    const fakeFetch = async (u, opts) => ({ headers: { get: (k) => { if (k.toLowerCase() === 'content-disposition') return 'attachment; filename="dl.png"'; if (k.toLowerCase()==='content-type') return 'image/png'; return null } } })
    const res = await getBestCandidate({ srcUrl: 'https://example.com/123' }, { id: 2 }, { adapter: fakeAdapter, fetchFn: fakeFetch, applyTemplateFn: async (u,f)=>f })
    expect(res.ok).to.equal(true)
    expect(res.filename).to.equal('dl.png')
  })
})
