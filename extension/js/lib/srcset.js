// parseSrcset and chooseBestSrcsetEntry
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

function chooseBestSrcsetEntry(entries) {
  if (!entries || !entries.length) return null
  entries.sort((a,b) => (b.w||0)-(a.w||0) || (b.x||0)-(a.x||0))
  return entries[0].url
}

module.exports = { parseSrcset, chooseBestSrcsetEntry }
