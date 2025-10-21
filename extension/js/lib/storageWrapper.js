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
  /**
   * Wrap the provided storage object (chrome.storage) into a promise-based
   * API that prefers `sync` and falls back to `local` when errors occur.
   *
   * The returned object exposes `get(keys)` and `set(obj)` which both resolve
   * successfully even on underlying errors (best-effort semantics).
   */
  return {
    async get(keys) {
      return new Promise((resolve) => {
        try {
          // guarded lodash/get for safe nested access
          let _get
          if (typeof require !== 'undefined') {
            try { _get = require('lodash/get') } catch (e) {}
          }
          if (!_get) _get = (o, p, d) => { try { return p.split('.').reduce((a,c)=>a&&a[c], o) } catch(_) { return d } }
          const st = _get(storage, 'sync') ? _get(storage, 'sync') : storage
          st.get(keys || null, (items) => {
            // if runtime.lastError present, fall back
            if (runtime && runtime.lastError) {
              const l = _get(storage, 'local') ? _get(storage, 'local') : storage
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
  /**
   * Persist an object to storage. Attempts `sync.set` first, falling back to
   * `local.set` on failure. Always resolves (never rejects).
   * @param {Object} obj - Key/value map to persist.
   * @returns {Promise<void>}
   */
  async set(obj) {
      return new Promise((resolve) => {
        try {
          const st = _get(storage, 'sync') ? _get(storage, 'sync') : storage
          st.set(obj, () => {
            if (runtime && runtime.lastError) {
              const l = _get(storage, 'local') ? _get(storage, 'local') : storage
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
