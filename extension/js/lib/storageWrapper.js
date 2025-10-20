// Promise-based wrapper around chrome.storage that prefers sync and falls back to local.
// Provides get(keys) and set(obj).

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
