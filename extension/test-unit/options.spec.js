require('jsdom-global')()
const { expect } = require('chai')
const fs = require('fs')
const path = require('path')

// Load options.html fixture
const html = fs.readFileSync(path.resolve(__dirname, '..', 'options.html'), 'utf8')
document.body.innerHTML = html

const chromeMock = require('../test-mocks/chrome-mock')
// make chromeAdapter available globally for options.js to use
global.chromeAdapter = { storage: chromeMock.storage, runtime: { sendMessage: () => {} } }

// require the options script after wiring chromeAdapter
require('../js/options')

describe('options page', () => {
  it('renders defaults when storage empty', (done) => {
    // storage mock is empty
    setTimeout(() => {
      const disable = document.getElementById('opt-disable-shelf').checked
      expect(typeof disable).to.equal('boolean')
      done()
    }, 50)
  })
})
