const { expect } = require('chai')
const { basenameFromUrl, urlFromBackgroundImage } = require('../js/lib/urlutils')

describe('urlutils', () => {
  it('basenameFromUrl decodes percent encoding', () => {
    const inUrl = 'https://example.com/path/image%20name.png'
    expect(basenameFromUrl(inUrl)).to.equal('image name.png')
  })

  it('urlFromBackgroundImage extracts quoted url', () => {
    const s = 'url("https://example.com/a.png")'
    expect(urlFromBackgroundImage(s)).to.equal('https://example.com/a.png')
  })
})
