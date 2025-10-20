/**
 * fetchWithTimeout
 * A thin wrapper around fetch supporting timeout (via AbortController) and retries.
 *
 * Params:
 *  - url: string
 *  - init: fetch init object
 *  - opts: { timeout(ms)=5000, retries=1, fetchFn=optional fetch implementation }
 *
 * Throws if no fetch implementation is available or all retries fail.
 */
async function fetchWithTimeout(url, init = {}, { timeout = 5000, retries = 1, fetchFn = (typeof fetch !== 'undefined' ? fetch : null) } = {}) {
  // Prefer ky when available (ky wraps fetch and provides timeout/retry helpers)
  let _ky
  if (typeof require !== 'undefined') {
    try { _ky = require('ky').default || require('ky') } catch (e) { _ky = null }
  }

  // If caller provided a fetchFn, prefer it. Otherwise fall back to global fetch or ky.
  const actualFetch = fetchFn || (typeof fetch !== 'undefined' ? fetch : null)
  const useKy = !_ky ? false : (typeof fetchFn === 'undefined' || fetchFn === null)
  if (!useKy && !actualFetch && !_ky) throw new Error('fetch not available')

  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
  if (useKy && _ky) {
        // ky handles timeout via option; we still do retries loop for parity
        const res = await _ky(url, { timeout, retry: 0, method: init && init.method ? init.method : 'GET', headers: init && init.headers ? init.headers : undefined, body: init && init.body ? init.body : undefined })
        return res
      }
  const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)
      try {
        const res = await actualFetch(url, Object.assign({}, init, { signal: controller.signal }))
        clearTimeout(timer)
        return res
      } catch (e) {
        lastErr = e
        clearTimeout(timer)
        if (attempt === retries) throw lastErr
        // small backoff
        await new Promise(r => setTimeout(r, 50 * (attempt + 1)))
      }
    } catch (e) {
      lastErr = e
      if (attempt === retries) throw lastErr
      await new Promise(r => setTimeout(r, 50 * (attempt + 1)))
    }
  }
}

module.exports = { fetchWithTimeout }
