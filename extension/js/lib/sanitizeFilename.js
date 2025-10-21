/**
 * Normalize and sanitize a filename string for cross-platform filesystem use.
 *
 * This function prefers to use the `sanitize-filename` package when available.
 * It falls back to a conservative regex-based sanitizer when the package is
 * not present or decoding fails. The returned value is always a non-empty
 * string suitable for use as a filesystem filename; when input is empty or
 * cannot be normalized, the literal `'download'` is returned.
 *
 * @param {string} name - The input filename or URL segment to sanitize.
 * @returns {string} A sanitized filename (max length 255). Never returns an empty string.
 *
 * @example
 * sanitizeFilename('example.jpg') // => 'example.jpg'
 * @example
 * sanitizeFilename('a/b\c: d?e') // => 'a_b_c_ d_e'
 */
function sanitizeFilename(name) {
  if (!name) return 'download'
  // prefer sanitize-filename package when available
  if (typeof require !== 'undefined') {
    try {
      const sf = require('sanitize-filename')
      try { return sf(String(decodeURIComponent(name))).slice(0, 255) || 'download' } catch (e) { return sf(String(name)).slice(0,255) || 'download' }
    } catch (e) {}
  }
  // fallback: conservative sanitization
  try { name = decodeURIComponent(name) } catch (e) { /* ignore */ }
  name = name.replace(/[:?#].*$/g, '')
  name = name.replace(/[\\/:"<>|?*\x00-\x1F]/g, '_')
  return String(name).slice(0, 255) || 'download'
}

module.exports = { sanitizeFilename }
