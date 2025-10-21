/**
 * Determine the best download candidate for an image source URL.
 *
 * Process overview:
 * 1. Validate input and optionally ask a content-script probe for a better URL
 *    and filename (via adapter.tabs.sendMessage).
 * 2. Normalize known provider URLs (e.g. Twitter) to request high-quality
 *    variants.
 * 3. If the filename lacks an extension, attempt a HEAD request to infer the
 *    content-type or parse `Content-Disposition` for a suggested filename.
 * 4. Apply a filename template (via applyTemplateFn) and sanitize the result.
 *
 * @param {{srcUrl: string}} args - Object containing the image source URL.
 * @param {Object} tab - Tab-like object (should expose an `id` property) used
 *   when sending a probe message to the content script.
 * @param {Object} [options] - Optional helpers and overrides.
 * @param {Object} [options.adapter] - Adapter that exposes `tabs.sendMessage`.
 * @param {Function} [options.fetchFn] - Optional fetch implementation to use for HEAD probes.
 * @param {Function} [options.applyTemplateFn] - Async function (url, filename) => templatedFilename.
 * @param {Object} [options.fetchOptions] - Extra options passed to fetchWithTimeout when used.
 * @returns {Promise<{ok: true, url: string, filename: string} | {ok: false, error: string}>}
 *   Resolves with the chosen URL and sanitized filename on success, or an
 *   error object when selection fails.
 */
const { sanitizeFilename } = require('./sanitizeFilename')
const { normalizeTwitterUrl } = require('./normalizeTwitter')
const { fetchWithTimeout } = require('./fetchWithTimeout')
const { parseContentDisposition } = require('./contentDisposition')

// guarded lodash helpers
let _get, _isFunction, _isString
if (typeof require !== 'undefined') {
  try { _get = require('lodash/get'); _isFunction = require('lodash/isFunction'); _isString = require('lodash/isString') } catch (e) {}
}
if (!_get) _get = (o,p,d) => { try { return p.split('.').reduce((a,c)=>a&&a[c], o) } catch(e) { return d } }
if (!_isFunction) _isFunction = (v) => typeof v === 'function'
if (!_isString) _isString = (v) => typeof v === 'string'

async function getBestCandidate({ srcUrl }, tab, { adapter, fetchFn, applyTemplateFn, fetchOptions } = {}) {
  try {
  const src = _isString(srcUrl) ? String(srcUrl) : ''
  if (!src) return { ok: false, error: 'empty_src' }

    // ask content script
    const probe = await new Promise((resolve) => {
      try {
        const send = _get(adapter, 'tabs.sendMessage')
        if (_isFunction(send)) send.call(_get(adapter, 'tabs') || adapter, tab.id, { type: 'probeImage', src }, (resp) => resolve(resp))
        else resolve(null)
      } catch (e) { resolve(null) }
    })

    let url = src
    let filename = ''
    if (probe && probe.ok) {
      url = probe.url || src
      filename = probe.filename || ''
    }

  if (!filename) filename = url.substring(url.lastIndexOf('/') + 1) || 'image'
    ;({ url, filename } = normalizeTwitterUrl(url, filename))

    if (!/\.[a-z0-9]{1,6}(?:$|[?#])/i.test(filename)) {
      try {
        const head = await (fetchFn ? fetchFn(url, { method: 'HEAD' }) : fetchWithTimeout(url, { method: 'HEAD' }, fetchOptions))
          const ct = (head && head.headers && head.headers.get) ? head.headers.get('content-type') || '' : ''
          const cd = (head && head.headers && head.headers.get) ? head.headers.get('content-disposition') || '' : ''
        // prefer content-disposition filename
        const cdName = parseContentDisposition(cd)
        if (cdName) {
          filename = cdName
        } else if (ct) {
          const ext = ct.split('/')[1] || 'bin'
          filename = `${filename}.${ext}`
        }
      } catch (e) {}
    }

    try {
      const templated = await applyTemplateFn(url, filename)
      filename = sanitizeFilename(templated)
    } catch (e) {
      filename = sanitizeFilename(filename)
    }

  return { ok: true, url, filename }
  } catch (e) {
  return { ok: false, error: e && e.message ? e.message : String(e) }
  }
}

module.exports = { getBestCandidate }
