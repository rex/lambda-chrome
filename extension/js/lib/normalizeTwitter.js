/**
 * Normalize Twitter image URLs to request the `large` variant and derive a
 * sensible filename.
 *
 * - Only operates on `pbs.twimg.com` media endpoints whose path begins with
 *   `/media/`.
 * - Ensures the `name=large` query parameter is present and attempts to infer
 *   a file extension from the pathname or `format` query parameter.
 * - Returns the original inputs unchanged if parsing fails or the URL does not
 *   look like a Twitter media resource.
 *
 * @param {string} url - The original image URL.
 * @param {string} filename - An optional candidate filename used as fallback.
 * @returns {{url: string, filename: string}} Object with possibly-updated URL and filename.
 *
 * @example
 * normalizeTwitterUrl('https://pbs.twimg.com/media/ABC123.jpg', 'x.jpg')
 * // => { url: 'https://pbs.twimg.com/media/ABC123.jpg?format=jpg&name=large', filename: 'ABC123.jpeg' }
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
