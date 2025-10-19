function basenameFromUrl(url) {
  try {
    const u = new URL(url)
    const path = u.pathname
    let name = path.substring(path.lastIndexOf('/')+1) || 'image'
    return decodeURIComponent(name)
  } catch(e) { return 'image' }
}

function urlFromBackgroundImage(str) {
  if (!str) return null
  const m = /url\((?:"|'|)?(.*?)(?:"|'|)?\)/.exec(str)
  return m ? m[1] : null
}

module.exports = { basenameFromUrl, urlFromBackgroundImage }
