// Unit test for normalizeTwitterUrl in background.js
// Usage: node normalize_twitter.test.js

const fs = require('fs')
const path = require('path')
const vm = require('vm')

// Load function source from background.js by extracting the function text
const bgPath = path.resolve(__dirname, '..', 'js', 'background.js')
const code = fs.readFileSync(bgPath, 'utf8')
const re = /function normalizeTwitterUrl\([\s\S]*?\n\}/m
const m = code.match(re)
if (!m) {
  console.error('normalizeTwitterUrl not found in', bgPath)
  process.exit(2)
}
const fnSrc = m[0]
const wrapped = '(' + fnSrc + ')'
const normalizeTwitterUrl = eval(wrapped)

const cases = [
  {
    in: 'https://pbs.twimg.com/media/G3hKysjWYAA15Xl?format=jpg&name=small',
    expectUrlContains: 'name=large',
    expectFilename: 'G3hKysjWYAA15Xl.jpeg'
  },
  {
    in: 'https://pbs.twimg.com/media/G3hKysjWYAA15Xl?format=png&name=small',
    expectUrlContains: 'name=large',
    expectFilename: 'G3hKysjWYAA15Xl.png'
  },
  {
    in: 'https://pbs.twimg.com/media/G3hKysjWYAA15Xl.jpg',
    expectUrlContains: 'name=large',
    expectFilename: 'G3hKysjWYAA15Xl.jpeg'
  },
  {
    in: 'https://pbs.twimg.com/media/G3hKysjWYAA15Xl',
    expectUrlContains: 'name=large',
    expectFilename: 'G3hKysjWYAA15Xl.jpeg'
  }
]

let failed = false
for (const c of cases) {
  const res = normalizeTwitterUrl(c.in, '')
  console.log('\nIN:', c.in)
  console.log('OUT:', res)
  if (c.expectUrlContains && !res.url.includes(c.expectUrlContains)) {
    console.error('FAIL: expected url to contain', c.expectUrlContains)
    failed = true
  }
  if (c.expectFilename && res.filename !== c.expectFilename) {
    console.error('FAIL: expected filename', c.expectFilename)
    failed = true
  }
}

if (failed) {
  console.error('\nSome tests failed')
  process.exit(1)
}
console.log('\nAll normalizeTwitterUrl tests passed')
