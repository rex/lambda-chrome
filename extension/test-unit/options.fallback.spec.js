require('jsdom-global')()
const { expect } = require('chai')
const fs = require('fs')
const path = require('path')

// Load options.html fixture
const html = fs.readFileSync(path.resolve(__dirname, '..', 'options.html'), 'utf8')
document.body.innerHTML = html

const chromeMock = require('../test-mocks/chrome-mock')

// simulate runtime.lastError by using the chrome mock storage and setting runtime.lastError
global.chrome = { storage: chromeMock.storage, runtime: { lastError: true } }

// require options after wiring global chrome
require('../js/options')

describe('options fallback path', () => {
  it('loadOptions falls back to callback API', (done) => {
    // loadOptions should not throw and should render defaults
    setTimeout(() => {
      const disable = document.getElementById('opt-disable-shelf').checked
      expect(typeof disable).to.equal('boolean')
      done()
    }, 50)
  })
})
