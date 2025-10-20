/**
 * applyTemplateString
 * Applies a filename template to a URL and base filename.
 *
 * Inputs:
 *  - tpl: template string, e.g. '{domain}/{basename}'
 *  - url: resource URL used to extract the domain
 *  - filename: base filename (basename)
 *
 * Outputs:
 *  - string: templated filename path (not sanitized)
 *
 * Side-effects: none.
 * Error modes: returns the original `filename` if URL parsing or template application fails.
 */
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
