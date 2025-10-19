const fs = require('fs')
const path = require('path')
const { expect } = require('chai')

// helper: extract normalizeTwitterUrl from background.js
function loadNormalize() {
  const bgPath = path.resolve(__dirname, '..', 'js', 'background.js')
  const code = fs.readFileSync(bgPath, 'utf8')
  const re = /function normalizeTwitterUrl\([\s\S]*?\n\}/m
  const m = code.match(re)
  if (!m) throw new Error('normalizeTwitterUrl not found')
  const fnSrc = m[0]
  // eslint-disable-next-line no-eval
  return eval('(' + fnSrc + ')')
}

describe('normalizeTwitterUrl', () => {
  const normalizeTwitterUrl = loadNormalize()

  it('should convert small->large and set jpeg filename for jpg format', () => {
    const input = 'https://pbs.twimg.com/media/G3hKysjWYAA15Xl?format=jpg&name=small'
    const out = normalizeTwitterUrl(input, '')
    expect(out.url).to.include('name=large')
    expect(out.filename).to.equal('G3hKysjWYAA15Xl.jpeg')
  })

  it('should preserve png format', () => {
    const input = 'https://pbs.twimg.com/media/G3hKysjWYAA15Xl?format=png&name=small'
    const out = normalizeTwitterUrl(input, '')
    expect(out.url).to.include('name=large')
    expect(out.filename).to.equal('G3hKysjWYAA15Xl.png')
  })

  it('should handle path-suffixed jpg', () => {
    const input = 'https://pbs.twimg.com/media/G3hKysjWYAA15Xl.jpg'
    const out = normalizeTwitterUrl(input, '')
    expect(out.url).to.include('name=large')
    expect(out.filename).to.equal('G3hKysjWYAA15Xl.jpeg')
  })

  it('should handle bare media id', () => {
    const input = 'https://pbs.twimg.com/media/G3hKysjWYAA15Xl'
    const out = normalizeTwitterUrl(input, '')
    expect(out.url).to.include('name=large')
    expect(out.filename).to.equal('G3hKysjWYAA15Xl.jpeg')
  })
})
