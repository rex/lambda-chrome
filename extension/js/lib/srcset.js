/**
 * Parse an HTML `srcset` attribute value into structured candidate entries.
 *
 * Each returned entry has the shape { url: string, w: number, x: number } where
 * `w` denotes the width descriptor (in pixels) if present, and `x` denotes the
 * pixel density descriptor (e.g. 1, 2). If descriptors are absent they default
 * to `{w:0, x:1}`.
 *
 * @param {string} srcset - The raw contents of an `srcset` attribute.
 * @returns {Array<{url:string, w:number, x:number}>} Array of parsed entries. Returns an empty array for invalid input.
 *
 * @example
 * parseSrcset('a.jpg 1x, b.jpg 2x')
 * // => [{url:'a.jpg',w:0,x:1},{url:'b.jpg',w:0,x:2}]
 */
function parseSrcset(srcset) {
  if (!srcset || typeof srcset !== 'string') return []
  return srcset.split(',').map(s => s.trim()).map(part => {
    const [url, desc] = part.split(/\s+/)
    if (!desc) return { url, w: 0, x: 1 }
    if (desc.endsWith('w')) return { url, w: parseInt(desc.replace('w',''),10)||0, x:1 }
    if (desc.endsWith('x')) return { url, w: 0, x: parseFloat(desc.replace('x',''))||1 }
    return { url, w:0, x:1 }
  })
}

/**
 * Select the best candidate from parsed srcset entries.
 *
 * Selection strategy:
 * - Prefer the entry with the largest `w` (width) value.
 * - If widths are equal, prefer the larger `x` (density).
 *
 * @param {Array<{url:string,w:number,x:number}>} entries - Parsed srcset entries.
 * @returns {string|null} The selected URL, or null when no entries are available.
 */
function chooseBestSrcsetEntry(entries) {
  if (!entries || !entries.length) return null
  entries.sort((a,b) => (b.w||0)-(a.w||0) || (b.x||0)-(a.x||0))
  return entries[0].url
}

module.exports = { parseSrcset, chooseBestSrcsetEntry }
