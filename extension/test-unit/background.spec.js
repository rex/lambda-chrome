/* eslint-env mocha */
const { expect } = require('chai')

describe('background module (unit)', function () {
  let adapter
  beforeEach(function () {
    // inject adapter before requiring background so module uses it
    adapter = require('../test-mocks/chrome-adapter')
    global.chromeAdapter = adapter
    // ensure global.chrome is present and points at jest-chrome for any direct chrome usage
    const jestChrome = require('jest-chrome')
    global.chrome = global.chrome || jestChrome
    // clear require cache and require background
    delete require.cache[require.resolve('../../extension/js/background')]
    this.bg = require('../../extension/js/background')
  })
  afterEach(function () {
    if (global.chrome && global.chrome._reset) global.chrome._reset()
    delete global.chromeAdapter
  })

  it('setShelfEnabled resolves and calls chrome.downloads.setShelfEnabled', async function () {
    // spy the adapter implementation by setting a flag
    let called = false
    adapter.downloads.setShelfEnabled = (v, cb) => { called = v; if (cb) cb() }
    await this.bg.setShelfEnabled(false)
    expect(called).to.equal(false)
  })

  it('postInstall reads disableShelf and calls setShelfEnabled + createContextMenu', async function () {
    // set storage to disableShelf = true
    adapter.__storage.__store.disableShelf = true
    // spy createContextMenu by replacing it
    let created = false
    this.bg.createContextMenu = () => { created = true }
    await this.bg.postInstall({})
    // after postInstall the createContextMenu should be invoked
    expect(created).to.equal(true)
  })

  it('registers top-level listeners on adapter', function () {
    // ensure the adapter has recorded the registered listeners
    expect(adapter.__listeners.tabsOnCreated).to.be.a('function')
    expect(adapter.__listeners.downloadsOnChanged).to.be.a('function')
    expect(adapter.__listeners.runtimeOnMessage).to.be.a('function')
    expect(adapter.__listeners.commandsOnCommand).to.be.a('function')
    expect(adapter.__listeners.contextMenusOnClicked).to.be.a('function')
  })

  it('context menu click triggers performDownload via getBestCandidate', async function () {
    // spy the adapter.downloads.download to confirm performDownload calls it
    let downloaded = false
    adapter.downloads.download = function (opts, cb) { downloaded = true; if (cb) cb(123); return 123 }
    // trigger the registered contextMenus click listener
    const info = { menuItemId: 'lambda-cm-dl-img', srcUrl: 'https://example.com/image.jpg' }
    const tab = { id: 1 }
    // call the stored listener
    adapter.__listeners.contextMenusOnClicked(info, tab)
    // allow promises microtask to settle
    await new Promise((r) => setTimeout(r, 10))
    expect(downloaded).to.equal(true)
  })

  it('commands save-loaded-image triggers download and removes tab', async function () {
    // spy on adapter.tabs.remove and downloads.download
    let removed = false
    adapter.tabs.remove = function (id) { removed = true }
    adapter.downloads.download = function (opts, cb) { if (cb) cb(77); return 77 }
    // trigger the command listener
    adapter.__listeners.commandsOnCommand('save-loaded-image')
    await new Promise((r) => setTimeout(r, 10))
    expect(removed).to.equal(true)
  })

  it('downloads.onChanged complete triggers notifications.create', function (done) {
    // spy notifications.create
    let created = false
    adapter.notifications.create = function (id, opts) { created = true }
    // simulate the download change to complete
    const d = { id: 1, state: { current: 'complete' } }
    // ensure downloads.search returns an item with filename
    adapter.downloads.search = function (q, cb) { cb([{ filename: 'file.jpg' }]) }
    adapter.__listeners.downloadsOnChanged(d)
    setTimeout(() => {
      expect(created).to.equal(true)
      done()
    }, 10)
  })

  it('runtime onMessage downloadFromPage triggers performDownload and sendResponse', function (done) {
    // prepare storage prefs
    adapter.__storage.__store.preferOriginalFilename = true
    adapter.__storage.__store.forcedExtension = ''
    // spy performDownload by intercepting adapter.downloads.download
    let downloaded = false
    adapter.downloads.download = function (opts, cb) { downloaded = true; if (cb) cb(99); return 99 }
    // construct message and fake sender/tab
    const msg = { type: 'downloadFromPage', src: 'https://example.com/x.jpg' }
    const sender = { tab: { id: 2, url: 'https://example.com/x.jpg' } }
    // call listener with a sendResponse we can inspect
    const sendResponse = function (resp) {
      try {
        expect(resp).to.be.an('object')
        // expect performDownload to have been invoked
        expect(downloaded).to.equal(true)
        done()
      } catch (e) { done(e) }
    }
    adapter.__listeners.runtimeOnMessage(msg, sender, sendResponse)
  })
})
