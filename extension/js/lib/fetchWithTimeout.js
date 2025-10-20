// Simple fetch wrapper with timeout and retry
async function fetchWithTimeout(url, init = {}, { timeout = 5000, retries = 1, fetchFn = (typeof fetch !== 'undefined' ? fetch : null) } = {}) {
  const actualFetch = fetchFn || (typeof fetch !== 'undefined' ? fetch : null)
  if (!actualFetch) throw new Error('fetch not available')

  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
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
  }
}

module.exports = { fetchWithTimeout }
