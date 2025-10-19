require('jsdom-global')()
const { expect } = require('chai')
const fs = require('fs')
const path = require('path')
const chromeMock = require('../test-mocks/chrome-mock')

// load options.html into jsdom
const html = fs.readFileSync(path.resolve(__dirname, '..', 'options.html'), 'utf8')
document.body.innerHTML = html

// spy for runtime messages
let sent = null
global.chromeAdapter = { storage: chromeMock.storage, runtime: { sendMessage: (m) => { sent = m } } }
// also provide global.chrome so options.js loadOptions can call chrome.storage
global.chrome = { storage: chromeMock.storage, runtime: { sendMessage: (m) => { sent = m } } }

// require the options script after wiring chromeAdapter and chrome
require('../js/options')

function waitFor(condFn, timeout = 500) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    ;(function poll() {
      try {
        if (condFn()) return resolve()
      } catch (e) {}
      if (Date.now() - start > timeout) return reject(new Error('timeout'))
      setTimeout(poll, 10)
    })()
  })
}

describe('options save', () => {
  it('saves options to chrome.storage.sync and notifies runtime', async () => {
    // set some values in the DOM
    document.getElementById('opt-disable-shelf').checked = true
    document.getElementById('opt-filename-template').value = '{domain}/{basename}'
    document.getElementById('opt-reveal-passwords').checked = false
    document.getElementById('opt-allow-paste').checked = true
    document.getElementById('opt-enable-rightclick').checked = false
    document.getElementById('opt-prefer-original-filename').checked = true
    document.getElementById('opt-forced-extension').value = ''

  // call saveOptions directly (options.js exposes global saveOptions in tests)
  chromeMock.__calls.length = 0
  await global.saveOptions()

  // assert storage set occurred and runtime message
  expect(chromeMock.__calls.some(c => c.method === 'set')).to.equal(true)
  expect(chromeMock.__storage.sync.disableShelf).to.equal(true)
  expect(sent).to.be.an('object')
  expect(sent.type).to.equal('applyDisableShelf')
  })
})
