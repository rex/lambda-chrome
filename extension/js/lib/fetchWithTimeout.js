/**
 * Perform a fetch with a timeout and optional retry behavior.
 *
 * - Uses an injected `fetchFn` when provided (useful for testing).
 * - Prefers `ky` when available and no `fetchFn` is supplied. Falls back to
 *   the global `fetch` if present. Throws if no fetch implementation can be
 *   found.
 * - Implements a simple retry/backoff loop for transient failures.
 *
 * @param {string} url - Resource URL to fetch.
 * @param {RequestInit} [init] - Standard fetch init options (method, headers, body, etc.).
 * @param {Object} [opts] - Additional options.
 * @param {number} [opts.timeout=5000] - Timeout in milliseconds before aborting the request.
 * @param {number} [opts.retries=1] - Number of retry attempts on failure (0 = no retries).
 * @param {Function|null} [opts.fetchFn] - Optional fetch implementation to use instead of global fetch/ky.
 * @returns {Promise<Response>} Resolves with the fetch Response when successful.
 * @throws {Error} If no fetch implementation is available or all retries fail.
 *
 * @example
 * // use global fetch with 3s timeout and 2 retries
 * await fetchWithTimeout('https://example.com/image.jpg', {}, { timeout: 3000, retries: 2 })
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
