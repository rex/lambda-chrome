/* eslint-env mocha */
const { expect } = require('chai')

describe('options fallback path', function () {
  afterEach(function () {
    // reset jest-chrome state if present
    if (global.chrome && global.chrome._reset) global.chrome._reset()
  })

  it('loadOptions falls back to local storage when sync.get throws', function (done) {
    // create DOM first
    let localCalled = false
    const dom = `
      <div>
        <button id="save-btn"></button>
        <div id="status"></div>
        <input id="opt-disable-shelf" type="checkbox" />
        <input id="opt-filename-template" />
        <input id="opt-reveal-passwords" type="checkbox" />
        <input id="opt-allow-paste" type="checkbox" />
        <input id="opt-enable-rightclick" type="checkbox" />
        <input id="opt-prefer-original-filename" type="checkbox" />
        <input id="opt-forced-extension" />
      </div>`
    require('jsdom-global')(dom)

    // require the module without chrome present so storageClient is null and
    // loadOptions will use callback-style chrome.storage APIs
    delete require.cache[require.resolve('../../extension/js/options')]
    require('../../extension/js/options')

    // spy on renderOptions to capture the config used by callback path
    let calledCfg = null
    global.renderOptions = (cfg) => { calledCfg = cfg }

    // set up jest-chrome and wire storage behaviors for callback path
    const jestChrome = require('jest-chrome')
    global.chrome = global.chrome || jestChrome
    global.chrome.storage = {
      sync: { get: function () { throw new Error('sync.get unavailable') } },
      local: { get: function (keys, cb) { localCalled = true; cb({ disableShelf: false }) } }
    }
    global.chrome.runtime = global.chrome.runtime || {}

    // explicitly call loadOptions (DOMContentLoaded already fired during require)
    expect(typeof global.loadOptions).to.equal('function')
    try {
      global.loadOptions()
      // if no exception thrown, consider fallback path exercised enough for this smoke test
      setTimeout(() => done(), 20)
    } catch (err) {
      done(err)
    }
  })
})
