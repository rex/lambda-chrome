const { expect } = require('chai')
const { sanitizeFilename } = require('../js/lib/sanitizeFilename')

describe('sanitizeFilename', () => {
  it('sanitizes dangerous chars and trims long strings', () => {
    const inStr = 'a/b\\c:d?e#f%20g'.repeat(20)
    const out = sanitizeFilename(inStr)
    expect(out).to.not.include('/')
    expect(out.length).to.be.at.most(255)
  })

  it('handles empty input', () => {
    expect(sanitizeFilename('')).to.equal('download')
    expect(sanitizeFilename(null)).to.equal('download')
  })
})
