// Minimal chrome.storage mock for unit tests
const storage = { sync: {}, local: {} }

function get(keys, cb) {
  const out = {}
  const keysArr = Array.isArray(keys) ? keys : (keys ? Object.keys(keys) : [])
  for (const k of keysArr) {
    out[k] = storage.sync[k]
  }
  cb(out)
}

function set(obj, cb) {
  for (const k in obj) storage.sync[k] = obj[k]
  if (cb) cb()
}

// Track calls for tests to assert behavior
const __calls = []
function setWithLog(obj, cb) {
  __calls.push({ method: 'set', args: obj })
  for (const k in obj) storage.sync[k] = obj[k]
  if (cb) cb()
}

// Expose storage.sync and storage.local to match chrome.storage API
module.exports = { storage: { sync: { get, set: setWithLog }, local: { get, set: setWithLog } }, __storage: storage, __calls }
