/**
 * Initiate a download using the provided adapter (typically the `chrome`
 * namespace or a test adapter). Returns a promise that resolves when the
 * downloads API callback is invoked.
 *
 * Note: This function uses the adapter pattern to remain testable outside of
 * the real Chrome runtime. It performs guarded checks for the required
 * `downloads.download` function and returns structured errors instead of
 * throwing.
 *
 * @param {Object} adapter - Object exposing `downloads.download` (e.g. chrome).
 * @param {{url: string, filename: string}} candidate - Download candidate with a URL and sanitized filename.
 * @returns {Promise<{ok: true, id: any} | {ok: false, error: string}>} Resolves with download id on success, or an error object.
 */
function performDownload(adapter, candidate) {
  return new Promise((resolve) => {
    // guarded lodash helpers
    let _get, _isFunction
    if (typeof require !== 'undefined') {
      try { _get = require('lodash/get'); _isFunction = require('lodash/isFunction') } catch (e) {}
    }
    if (!_get) _get = (o, p, d) => { try { return p.split('.').reduce((a,c)=>a&&a[c], o) } catch(_) { return d } }
    if (!_isFunction) _isFunction = (v) => typeof v === 'function'

    if (!candidate || !candidate.url) return resolve({ ok: false, error: 'invalid_candidate' })
    const downloader = _isFunction(_get(adapter, 'downloads.download')) ? _get(adapter, 'downloads.download') : null
    if (!downloader) return resolve({ ok: false, error: 'no_adapter' })
    try {
      downloader.call(_get(adapter, 'downloads') || adapter, { url: candidate.url, filename: candidate.filename, saveAs: false }, (downloadId) => {
        resolve({ ok: true, id: downloadId })
      })
    } catch (e) { resolve({ ok: false, error: e && e.message ? e.message : String(e) }) }
  })
}

module.exports = { performDownload }
