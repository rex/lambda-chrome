/**
 * basenameFromUrl
 * Extracts a decoded base filename from a URL's path.
 *
 * Inputs:
 *  - url: string
 *
 * Outputs:
 *  - string: decoded basename, or 'image' on error
 *
 * Side-effects: none.
 * Error modes: returns 'image' for invalid URLs or parsing errors.
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
 * urlFromBackgroundImage
 * Extracts the URL value from a CSS background-image declaration like `url("...")`.
 *
 * Inputs:
 *  - str: CSS background-image string
 *
 * Outputs:
 *  - string|null: the extracted URL or null if none found
 *
 * Side-effects: none.
 */
function urlFromBackgroundImage(str) {
  if (!str) return null
  const m = /url\((?:"|'|)?(.*?)(?:"|'|)?\)/.exec(str)
  return m ? m[1] : null
}

module.exports = { basenameFromUrl, urlFromBackgroundImage }
