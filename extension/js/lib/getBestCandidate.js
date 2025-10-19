const { sanitizeFilename } = require('./sanitizeFilename')
const { normalizeTwitterUrl } = require('./normalizeTwitter')

async function getBestCandidate({ srcUrl }, tab, { adapter, fetchFn, applyTemplateFn }) {
  try {
    const src = srcUrl ? String(srcUrl) : ''
    if (!src) return null

    // ask content script
    const probe = await new Promise((resolve) => {
      try {
        adapter.tabs.sendMessage(tab.id, { type: 'probeImage', src }, (resp) => resolve(resp))
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
        const head = await fetchFn(url, { method: 'HEAD' })
        const ct = head.headers.get('content-type') || ''
        if (ct) {
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

    return { url, filename }
  } catch (e) {
    return null
  }
}

module.exports = { getBestCandidate }
