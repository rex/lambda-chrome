function applyTemplateString(tpl, url, filename) {
  try {
    if (!tpl) tpl = '{domain}/{basename}'
    const u = new URL(url)
    const domain = u.hostname.replace(/^www\./, '')
    const basename = filename
    const timestamp = Date.now()
    const out = tpl.replace(/\{domain\}/g, domain).replace(/\{basename\}/g, basename).replace(/\{timestamp\}/g, String(timestamp))
    return out
  } catch (e) {
    return filename
  }
}

module.exports = { applyTemplateString }
