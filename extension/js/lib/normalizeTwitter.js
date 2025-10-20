/**
 * normalizeTwitterUrl
 * Normalize twitter image URLs (pbs.twimg.com) to request the 'large' variant and
 * produce a reasonable filename.
 *
 * Inputs:
 *  - url: string
 *  - filename: current filename candidate
 *
 * Outputs:
 *  - { url, filename }
 *
 * Side-effects: none.
 * Error modes: returns the original inputs if parsing fails.
 */
function normalizeTwitterUrl(url, filename) {
  try {
    if (!url) return { url, filename }
    const u = new URL(url)
    if (!u.hostname.includes('pbs.twimg.com') || !u.pathname.startsWith('/media/')) return { url, filename }

    let seg = u.pathname.split('/').pop() || ''
    seg = seg.replace(/:.*$/, '')
    let id = seg
    let extFromPath = ''
    const m = seg.match(/^(.+?)\.(.+)$/)
    if (m) { id = m[1]; extFromPath = m[2].toLowerCase() }

    const qFormat = u.searchParams.get('format')
    let format = (qFormat || extFromPath || 'jpg').toLowerCase()
    if (format === 'jpg') format = 'jpeg'

    u.search = ''
    u.searchParams.set('format', qFormat || extFromPath || 'jpg')
    u.searchParams.set('name', 'large')
    const newUrl = u.toString()

    const outFilename = `${id}.${format}`
    return { url: newUrl, filename: outFilename }
  } catch (e) {
    return { url, filename }
  }
}

module.exports = { normalizeTwitterUrl }
