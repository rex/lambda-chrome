const { expect } = require('chai')
const { performDownload } = require('../../extension/js/lib/performDownload')

describe('performDownload', () => {
  it('returns error on invalid candidate', async () => {
    const res = await performDownload({}, null)
    expect(res.ok).to.equal(false)
  })

  it('calls adapter downloads and returns id', async () => {
    const fakeAdapter = { downloads: { download: (opts, cb) => cb(12345) } }
    const candidate = { url: 'https://example.com/img.png', filename: 'img.png' }
    const res = await performDownload(fakeAdapter, candidate)
    expect(res.ok).to.equal(true)
    expect(res.id).to.equal(12345)
  })

})
