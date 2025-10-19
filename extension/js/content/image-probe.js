// Content script to help background extract the best image URL and filename
// Listens for messages: {type: 'probeImage', src: <url>, elementSelector: <optional selector>}
// Responds with {ok:true, url:, filename:, contentType:}

(function(){
  function basenameFromUrl(url) {
    try {
      const u = new URL(url)
      const path = u.pathname
      let name = path.substring(path.lastIndexOf('/')+1) || 'image'
      // If name has no extension, try to infer from pathname segments
      return decodeURIComponent(name)
    } catch(e) { return 'image' }
  }

  async function probeUrl(url) {
    // Try to fetch headers (HEAD) to get content-type and content-disposition
    try {
      const resp = await fetch(url, { method: 'HEAD', mode: 'cors' })
      const ct = resp.headers.get('content-type') || ''
      const cd = resp.headers.get('content-disposition') || ''
      let filename = ''
      const m = cd && cd.match(/filename\*?=([^;]+)/i)
      if (m) {
        filename = m[1].replace(/^(UTF-8'')?/, '').replace(/"/g,'')
      }
      if (!filename) filename = basenameFromUrl(url)
      // if HEAD gives no useful info, attempt a ranged GET to coax headers
      if (!ct) {
        try {
          const r = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1023' }, mode: 'cors' })
          const ct2 = r.headers.get('content-type') || ''
          const cd2 = r.headers.get('content-disposition') || ''
          if (ct2) return { ok:true, url, filename, contentType: ct2 }
          if (cd2) {
            const m2 = cd2.match(/filename\*?=([^;]+)/i)
            if (m2) filename = m2[1].replace(/^(UTF-8'')?/, '').replace(/"/g,'')
          }
        } catch (e) { /* ignore ranged GET failure */ }
      }
      return { ok:true, url, filename, contentType: ct }
    } catch (e) {
      // fallback to infer from URL
      // If it's a blob URL, try to fetch and convert to data URL
      try {
        if (url && url.startsWith('blob:')) {
          const resp = await fetch(url)
          const blob = await resp.blob()
          const ct = blob.type || ''
          // convert to data URL
          const reader = new FileReader()
          const dataUrl = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result)
            reader.readAsDataURL(blob)
          })
          const ext = ct.split('/')[1] || 'bin'
          const filename = `image.${ext}`
          return { ok:true, url: dataUrl, filename, contentType: ct }
        }
      } catch (e) { /* ignore blob handling errors */ }
      return { ok:true, url, filename: basenameFromUrl(url), contentType: '' }
    }
  }

  function parseSrcset(srcset) {
    // returns array of {url, w, x}
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
    // prefer highest width, then highest x
    entries.sort((a,b) => (b.w||0)-(a.w||0) || (b.x||0)-(a.x||0))
    return entries[0].url
  }

  function urlFromBackgroundImage(str) {
    if (!str) return null
    const m = /url\((?:\"|\')?(.*?)(?:\"|\')?\)/.exec(str)
    if (m) return m[1]
    return null
  }

  function findBestCandidateInDom(src) {
    try {
      // direct matches
      const imgs = Array.from(document.getElementsByTagName('img'))
      for (const img of imgs) {
        try {
          if (img.src && img.src === src) {
            // prefer srcset highest
            if (img.srcset) {
              const best = chooseBestSrcsetEntry(parseSrcset(img.srcset))
              if (best) return best
            }
            // dataset fallbacks
            const ds = img.dataset || {}
            if (ds.srcset) {
              const best = chooseBestSrcsetEntry(parseSrcset(ds.srcset))
              if (best) return best
            }
            if (ds.src) return ds.src
            return img.src
          }
          // srcset contains src
          if (img.srcset && img.srcset.indexOf(src) !== -1) {
            const best = chooseBestSrcsetEntry(parseSrcset(img.srcset))
            if (best) return best
          }
        } catch(e){}
      }

      // check data- attributes
      for (const img of imgs) {
        const ds = img.dataset || {}
        if (ds && (ds.original || ds.src || ds.image || ds.file)) {
          const cand = ds.original || ds.src || ds.image || ds.file
          if (cand && cand.indexOf(src) !== -1) return cand
        }
      }

      // check background-image usage
      const all = Array.from(document.getElementsByTagName('*'))
      for (const el of all) {
        try {
          const style = getComputedStyle(el)
          if (!style) continue
          const bi = style.getPropertyValue('background-image')
          const u = urlFromBackgroundImage(bi)
          if (u && (u === src || u.indexOf(src) !== -1 || src.indexOf(u) !== -1)) return u
        } catch(e){}
      }
    } catch(e) {}
    return null
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== 'probeImage') return
    const src = msg.src
    // If data: url, infer filename and type without network
    if (src && src.startsWith('data:')) {
      try {
        const m = /^data:([^;]+);/.exec(src)
        const ct = m && m[1] ? m[1] : ''
        const ext = ct.split('/')[1] || 'bin'
        const filename = `image.${ext}`
        sendResponse({ ok:true, url: src, filename, contentType: ct })
        return
      } catch(e) {}
    }

    // try to find a better candidate from the DOM
    try {
      const best = findBestCandidateInDom(src)
      if (best && best !== src) {
        probeUrl(best).then(sendResponse).catch((e)=> sendResponse({ok:false}))
        return true
      }
    } catch(e) {}

    probeUrl(src).then(sendResponse).catch((e)=> sendResponse({ok:false}))
    return true
  })

  // Helper: find a large visible image on the page
  function findVisibleImage() {
    try {
      const imgs = Array.from(document.getElementsByTagName('img'))
      // filter visible and non-zero area
      const visibles = imgs.filter(img => {
        try {
          const r = img.getBoundingClientRect()
          return r.width > 20 && r.height > 20 && getComputedStyle(img).visibility !== 'hidden'
        } catch (e) { return false }
      })
      // prefer largest
      visibles.sort((a,b) => (b.naturalWidth*b.naturalHeight) - (a.naturalWidth*a.naturalHeight))
      return visibles[0]
    } catch (e) { return null }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== 'probeAndDownloadVisible') return
    const img = findVisibleImage()
    if (!img) { sendResponse({ ok:false }); return }
    // ask background to download this image
    try {
      chrome.runtime.sendMessage({ type: 'downloadFromPage', src: img.src }, (resp) => {
        sendResponse(resp)
      })
    } catch (e) { sendResponse({ ok:false }) }
    return true
  })
})();
