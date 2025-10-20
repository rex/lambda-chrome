const { expect } = require('chai')
const { parseContentDisposition } = require('../../extension/js/lib/contentDisposition')

describe('parseContentDisposition', () => {
  it('parses quoted filename', () => {
    const h = 'attachment; filename="example.png"'
    expect(parseContentDisposition(h)).to.equal('example.png')
  })

  it('parses filename* UTF-8', () => {
    const h = "attachment; filename*=UTF-8''%E2%82%AC%20rates.png"
    expect(parseContentDisposition(h)).to.equal('€ rates.png')
  })

  it('returns null for empty', () => {
    expect(parseContentDisposition(null)).to.equal(null)
  })
})
