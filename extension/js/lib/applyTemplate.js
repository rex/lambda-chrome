/**
 * Apply a simple filename template to an URL and base filename.
 *
 * Supported placeholders:
 * - {domain}    -> the request hostname with leading `www.` removed
 * - {basename}  -> the provided filename
 * - {timestamp} -> current epoch ms
 *
 * This is intentionally lightweight and returns the original `filename`
 * on any error during parsing or templating.
 *
 * @param {string} [tpl='{domain}/{basename}'] - Template string.
 * @param {string} url - Resource URL used to extract the domain.
 * @param {string} filename - Base filename to insert into the template.
 * @returns {string} Templated filename (not sanitized). On error returns `filename`.
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
