const { expect } = require('chai')
const { parseSrcset, chooseBestSrcsetEntry } = require('../js/lib/srcset')

describe('srcset parsing', () => {
  it('parses w descriptors and picks highest width', () => {
    const s = 'a.jpg 100w, b.jpg 200w, c.jpg 50w'
    const entries = parseSrcset(s)
    expect(entries).to.have.length(3)
    const best = chooseBestSrcsetEntry(entries)
    expect(best).to.equal('b.jpg')
  })

  it('parses x descriptors and picks highest x', () => {
    const s = 'a.jpg 1x, b.jpg 2x, c.jpg 1.5x'
    const best = chooseBestSrcsetEntry(parseSrcset(s))
    expect(best).to.equal('b.jpg')
  })
})
