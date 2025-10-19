// sanitizeFilename: normalize and sanitize a filename string for filesystem use
function sanitizeFilename(name) {
  if (!name) return 'download'
  try { name = decodeURIComponent(name) } catch (e) { /* ignore */ }
  name = name.replace(/[:?#].*$/g, '')
  name = name.replace(/[\\/:"<>|?*\x00-\x1F]/g, '_')
  return name.slice(0, 255) || 'download'
}

module.exports = { sanitizeFilename }
