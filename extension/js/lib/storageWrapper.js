/**
 * storageWrapper.js
 * Promise-based wrapper around chrome.storage that prefers sync and falls back to local.
 * Exports: wrap(storage, runtime) -> { get(keys): Promise, set(obj): Promise }
 *
 * Inputs:
 *  - storage: chrome.storage or an object with sync/local get/set methods
 *  - runtime: chrome.runtime (optional) used to inspect runtime.lastError
 *
 * Behavior:
 *  - Attempts sync.get/set first; on runtime.lastError or thrown errors falls back to local
 *  - Always resolves (never rejects) with a best-effort result
 */

function wrap(storage, runtime) {
  // storage: { sync: { get, set }, local: { get, set } }
  return {
    async get(keys) {
      return new Promise((resolve) => {
        try {
          const st = storage && storage.sync ? storage.sync : storage
          st.get(keys || null, (items) => {
            // if runtime.lastError present, fall back
            if (runtime && runtime.lastError) {
              const l = (storage && storage.local) ? storage.local : storage
              l.get(keys || null, (items2) => resolve(items2 || {}))
            } else {
              resolve(items || {})
            }
          })
        } catch (e) {
          try {
            const l = (storage && storage.local) ? storage.local : storage
            l.get(keys || null, (items2) => resolve(items2 || {}))
          } catch (e2) {
            resolve({})
          }
        }
      })
    },
    async set(obj) {
      return new Promise((resolve) => {
        try {
          const st = storage && storage.sync ? storage.sync : storage
          st.set(obj, () => {
            if (runtime && runtime.lastError) {
              const l = (storage && storage.local) ? storage.local : storage
              l.set(obj, () => resolve())
            } else resolve()
          })
        } catch (e) {
          try {
            const l = (storage && storage.local) ? storage.local : storage
            l.set(obj, () => resolve())
          } catch (e2) {
            resolve()
          }
        }
      })
    }
  }
}

module.exports = { wrap }
