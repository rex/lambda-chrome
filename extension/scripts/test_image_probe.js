// Simple smoke test for image-probe parsing helpers

function parseSrcset(srcset) {
  try {
    return srcset.split(',').map(s => s.trim()).map(part => {
      const [url, desc] = part.split(/\s+/)
      if (!desc) return { url, w: 0, x: 1 }
      if (desc.endsWith('w')) return { url, w: parseInt(desc.replace('w',''),10)||0, x:1 }
      if (desc.endsWith('x')) return { url, w: 0, x: parseFloat(desc.replace('x',''))||1 }
      return { url, w:0, x:1 }
    })
  } catch(e) { return [] }
}

function chooseBestSrcsetEntry(entries) {
  if (!entries || !entries.length) return null
  entries.sort((a,b) => (b.w||0)-(a.w||0) || (b.x||0)-(a.x||0))
  return entries[0].url
}

// Tests
const tests = [
  'https://example.com/a.jpg 480w, https://example.com/b.jpg 800w, https://example.com/c.jpg 1600w',
  'https://example.com/a.webp 1x, https://example.com/a@2x.webp 2x',
  'https://example.com/no-desc.jpg'
  ,'https://pbs.twimg.com/media/Example.jpg:large'
]

for (const t of tests) {
  const entries = parseSrcset(t)
  const best = chooseBestSrcsetEntry(entries)
  console.log('SRCSET:', t)
  console.log('PARSED:', entries)
  console.log('BEST :', best)
  console.log('---')
}

// Quick manifest parse
try {
  const mf = require('../manifest.json')
  console.log('Manifest version:', mf.manifest_version, 'Name:', mf.name)
} catch (e) {
  console.error('Failed to parse manifest:', e.message)
}

console.log('Smoke test complete')
