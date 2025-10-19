const { expect } = require('chai')
const { getBestCandidate } = require('../js/lib/getBestCandidate')

describe('getBestCandidate', () => {
  it('prefers probe result and applies template and content-type', async () => {
    const fakeAdapter = {
      tabs: { sendMessage: (id, msg, cb) => cb({ ok: true, url: 'https://pbs.twimg.com/media/G3hKysjWYAA15Xl?format=png&name=small', filename: '' }) }
    }
    const fakeFetch = async (u, opts) => {
      return { headers: { get: (k) => { if (k.toLowerCase() === 'content-type') return 'image/png' ; return null } } }
    }
    const applyTemplateFn = async (url, filename) => `${filename}`
    const tab = { id: 1 }
    const res = await getBestCandidate({ srcUrl: 'https://pbs.twimg.com/media/G3hKysjWYAA15Xl?format=png&name=small' }, tab, { adapter: fakeAdapter, fetchFn: fakeFetch, applyTemplateFn })
    expect(res).to.be.an('object')
    expect(res.filename).to.match(/G3hKysjWYAA15Xl\.png$/)
  })
})
