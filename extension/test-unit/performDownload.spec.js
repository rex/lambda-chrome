const { expect } = require('chai')
const { performDownload } = require('../js/lib/performDownload')

describe('performDownload', () => {
  it('calls adapter.downloads.download with correct args', (done) => {
    const fakeAdapter = { downloads: { download: (opts, cb) => { try { expect(opts.url).to.equal('https://example.com/a.png'); expect(opts.filename).to.equal('a.png'); } catch (e) { return done(e) } cb(123); done() } } }
    const candidate = { url: 'https://example.com/a.png', filename: 'a.png' }
    performDownload(fakeAdapter, candidate, (id) => {})
  })
})
