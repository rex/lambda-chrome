/**
 * Extract a decoded basename from a URL's path component.
 *
 * If the URL is invalid or the path does not contain a basename, returns
 * the fallback string `'image'`.
 *
 * @param {string} url - The URL to extract the basename from.
 * @returns {string} Decoded basename or `'image'` on error.
 */
function basenameFromUrl(url) {
  try {
  const u = new URL(url)
  const path = u.pathname
  let name = path.substring(path.lastIndexOf('/')+1) || 'image'
  return decodeURIComponent(name)
  } catch(e) { return 'image' }
}

/**
 * Extract the URL contained inside a CSS `background-image: url(...)` value.
 *
 * @param {string} str - CSS `background-image` value (e.g. `url("/a.png")`).
 * @returns {string|null} The extracted URL string or null when not present.
 */
function urlFromBackgroundImage(str) {
  if (!str) return null
  const m = /url\((?:"|'|)?(.*?)(?:"|'|)?\)/.exec(str)
  return m ? m[1] : null
}

module.exports = { basenameFromUrl, urlFromBackgroundImage }
