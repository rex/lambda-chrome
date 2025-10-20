// Minimal parser for Content-Disposition header to extract filename
function parseContentDisposition(header) {
  if (!header || typeof header !== 'string') return null
  // RFC 6266 simple parsing: look for filename* or filename tokens
  // filename*=utf-8''%E2%82%AC%20rates -> decodeURI component
  const mStar = header.match(/filename\*=(?:UTF-8'')?([^;\n\r]+)/i)
  if (mStar) {
    try {
      return decodeURIComponent(mStar[1].trim())
    } catch (e) {}
  }
  const m = header.match(/filename=(?:"([^"]+)"|([^;\n\r]+))/i)
  if (m) return (m[1] || m[2] || '').trim()
  return null
}

module.exports = { parseContentDisposition }
