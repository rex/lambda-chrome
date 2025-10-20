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
    if (!candidate || !candidate.url) return resolve({ ok: false, error: 'invalid_candidate' })
    if (!adapter || !adapter.downloads || !adapter.downloads.download) return resolve({ ok: false, error: 'no_adapter' })
    try {
      adapter.downloads.download({ url: candidate.url, filename: candidate.filename, saveAs: false }, (downloadId) => {
        resolve({ ok: true, id: downloadId })
      })
    } catch (e) { resolve({ ok: false, error: e && e.message ? e.message : String(e) }) }
  })
}

module.exports = { performDownload }
