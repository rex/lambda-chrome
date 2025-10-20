// Spyable chromeAdapter mock for background.js unit tests
const listeners = {
  downloadsOnChanged: null,
  runtimeOnMessage: null,
  tabsOnCreated: null,
  commandsOnCommand: null,
  contextMenusOnClicked: null
}

const storage = { __store: {}, sync: {}, local: {} }

function syncGet(keys, cb) {
  const out = {}
  const keysArr = Array.isArray(keys) ? keys : (keys ? Object.keys(keys) : [])
  for (const k of keysArr) out[k] = storage.__store[k]
  if (cb) cb(out)
}

function syncSet(obj, cb) {
  for (const k in obj) storage.__store[k] = obj[k]
  if (cb) cb()
}

const adapter = {
  storage: { sync: { get: syncGet, set: syncSet }, local: { get: syncGet, set: syncSet } },
  downloads: {
    download: function (opts, cb) { if (cb) cb(42); return 42 },
    setShelfEnabled: function (v, cb) { if (cb) cb(); },
    onChanged: { addListener: (fn) => { listeners.downloadsOnChanged = fn } },
    search: function (q, cb) { if (cb) cb([]) }
  },
  contextMenus: { create: function () {}, onClicked: { addListener: (fn) => { listeners.contextMenusOnClicked = fn } } },
  tabs: {
  sendMessage: function (tabId, msg, cb) { if (typeof cb === 'function') cb(null) },
    query: function (q, cb) { cb([{ id: 1, index: 2, url: 'https://example.com/x.jpg' }]) },
    move: function () {},
    remove: function () {},
    onCreated: { addListener: (fn) => { listeners.tabsOnCreated = fn } }
  },
  notifications: { create: function () {} },
  runtime: {
    onInstalled: { addListener: function () {} },
    onStartup: { addListener: function () {} },
    onMessage: { addListener: (fn) => { listeners.runtimeOnMessage = fn } },
    lastError: null
  },
  commands: { onCommand: { addListener: (fn) => { listeners.commandsOnCommand = fn } } },
  __listeners: listeners,
  __storage: storage
}

module.exports = adapter
