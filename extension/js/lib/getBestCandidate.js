/**
 * getBestCandidate
 * Probe and determine the best download candidate for an image src.
 *
 * Inputs:
 *  - { srcUrl }: object with srcUrl string
 *  - tab: chrome.tabs.Tab-like object (used for sendMessage probe)
 *  - options: { adapter, fetchFn, applyTemplateFn, fetchOptions }
 *
 * Behavior:
 *  - Optionally asks a content script probe for a better url/filename
 *  - Normalizes twitter image URLs
 *  - HEAD-probes the resource to infer content-type or content-disposition
 *  - Applies filename template via applyTemplateFn and sanitizes the result
 *
 * Returns: Promise resolving to { ok: true, url, filename } or { ok: false, error }
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
