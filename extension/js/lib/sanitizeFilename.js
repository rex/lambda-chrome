/**
 * sanitizeFilename
 * Normalize and sanitize a filename string for cross-platform filesystem use.
 *
 * Inputs:
 *  - name: string
 *
 * Outputs:
 *  - string: sanitized filename (safe characters, length-limited)
 *
 * Side-effects: none.
 * Error modes: returns 'download' for empty or irreparably invalid input.
 */
function sanitizeFilename(name) {
  if (!name) return 'download'
  try { name = decodeURIComponent(name) } catch (e) { /* ignore */ }
  name = name.replace(/[:?#].*$/g, '')
  name = name.replace(/[\/:"<>|?*\x00-\x1F]/g, '_')
  return name.slice(0, 255) || 'download'
}

module.exports = { sanitizeFilename }
