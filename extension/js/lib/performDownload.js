/**
 * performDownload
 * Wrapper that invokes chrome.downloads.download via an adapter and returns a Promise.
 *
 * Inputs:
 *  - adapter: object exposing downloads.download (usually chromeAdapter or chrome)
 *  - candidate: { url: string, filename: string }
 *
 * Returns: Promise<{ ok: true, id: downloadId } | { ok: false, error: string }>
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
