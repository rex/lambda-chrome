// Lambda MV3 background service worker (refactored)
// Consolidates install/startup behavior and download helpers.

const IMG_DOWNLOAD_MENU_ID = 'lambda-cm-dl-img'

// Adapter: if a `chromeAdapter` is injected (tests/refactors), use it; otherwise delegate to `chrome`.
const adapter = (typeof chromeAdapter !== 'undefined' && chromeAdapter) ? chromeAdapter : (function(){
  try {
    return {
      storage: chrome.storage,
      downloads: {
        download: (...args) => chrome.downloads.download(...args),
        setShelfEnabled: (v, cb) => chrome.downloads.setShelfEnabled(v, cb),
        onChanged: chrome.downloads.onChanged
      },
      contextMenus: chrome.contextMenus,
      tabs: chrome.tabs,
      notifications: chrome.notifications,
      runtime: chrome.runtime,
      commands: chrome.commands
    }
  } catch (e) {
    // running in non-extension env (tests) — provide minimal stubs to avoid crashing
    return {
      storage: { get: (k,cb)=>cb({}), set: (o,cb)=>cb && cb() },
      downloads: { download: ()=>{}, setShelfEnabled: (v,cb)=>cb && cb(), onChanged: { addListener: ()=>{} } },
      contextMenus: { create: ()=>{} },
      tabs: { sendMessage: ()=>{}, query: ()=>{}, move: ()=>{}, remove: ()=>{} },
      notifications: { create: ()=>{} },
      runtime: { onInstalled: { addListener: ()=>{} }, onStartup: { addListener: ()=>{} }, onMessage: { addListener: ()=>{} } },
      commands: { onCommand: { addListener: ()=>{} } }
    }
  }
})()

const logLastError = (ctx = '') => {
  if (chrome.runtime.lastError) {
    console.warn(ctx, chrome.runtime.lastError && chrome.runtime.lastError.message)
  }
}

function setShelfEnabled(enabled) {
  return new Promise((resolve) => {
    try {
      chrome.downloads.setShelfEnabled(enabled, () => {
        logLastError('setShelfEnabled')
        resolve()
      })
    } catch (err) {
      console.warn('setShelfEnabled exception', err)
      resolve()
    }
  })
}

function createContextMenu() {
  try {
    chrome.contextMenus.create({
    id: IMG_DOWNLOAD_MENU_ID,
    title: 'Download image — Lambda',
      contexts: ['image']
    }, () => logLastError('createContextMenu'))
    // context menu for applying bypass on current page
    try {
      chrome.contextMenus.create({ id: 'lambda-apply-bypass', title: 'Enable Lambda bypass on this page', contexts: ['all'] }, () => logLastError('createContextMenu-bypass'))
    } catch (e) {}
  } catch (err) {
    console.warn('createContextMenu exception', err)
  }
}

async function postInstall(details) {
  // read stored preference for disableShelf (sync preferred)
  try {
    adapter.storage.sync.get(['disableShelf'], async (items) => {
      const disable = items.disableShelf !== undefined ? !!items.disableShelf : true
      // if disable is true => setShelfEnabled(false). So enabled = !disable
      await setShelfEnabled(!disable)
      createContextMenu()
    })
  } catch (e) {
    await setShelfEnabled(false)
    createContextMenu()
  }
}

async function postStartup() {
  try {
    adapter.storage.sync.get(['disableShelf'], async (items) => {
      const disable = items.disableShelf !== undefined ? !!items.disableShelf : true
      await setShelfEnabled(!disable)
    })
  } catch (e) {
    await setShelfEnabled(false)
  }
}

function sanitizeFilename(name) {
  if (!name) return 'download'
  try { name = decodeURIComponent(name) } catch (e) { /* ignore */ }
  // remove trailing modifiers and query-like segments
  name = name.replace(/[:?#].*$/g, '')
  // Replace characters that are invalid on most file systems
  name = name.replace(/[\\/:"<>|?*\x00-\x1F]/g, '_')
  // Limit length
  return name.slice(0, 255) || 'download'
}

function normalizeTwitterUrl(url, filename) {
  try {
    if (!url) return { url, filename }
    const u = new URL(url)
    if (!u.hostname.includes('pbs.twimg.com') || !u.pathname.startsWith('/media/')) return { url, filename }

    // Extract media id from pathname and strip any Twemoji-style suffix like :large
    let seg = u.pathname.split('/').pop() || ''
    seg = seg.replace(/:.*$/, '')
    // seg may be like "G3hKysjWYAA15Xl" or "G3hKysjWYAA15Xl.jpg"
    let id = seg
    let extFromPath = ''
    const m = seg.match(/^(.+?)\.([a-z0-9]+)$/i)
    if (m) { id = m[1]; extFromPath = m[2].toLowerCase() }

    // Prefer explicit format query param if present
    const qFormat = u.searchParams.get('format')
    let format = (qFormat || extFromPath || 'jpg').toLowerCase()

    // Normalize format: prefer 'jpeg' for JPEG files to match typical save-as behaviour
    if (format === 'jpg') format = 'jpeg'

    // Rebuild URL to request the large variant using query params (works for query-style URLs)
    // Clear search and force format/name
    u.search = ''
    u.searchParams.set('format', qFormat || extFromPath || 'jpg')
    u.searchParams.set('name', 'large')
    const newUrl = u.toString()

    // Construct filename as <media-id>.<ext>
    const outFilename = `${id}.${format}`
    return { url: newUrl, filename: outFilename }
  } catch (e) {
    return { url, filename }
  }
}

// Given an initial src and tab, probe content script and network to determine final url/filename
const { getBestCandidate: libGetBest } = require('./lib/getBestCandidate')

async function getBestCandidate(info, tab) {
  const fetchFn = (u, opts) => fetch(u, opts)
  const applyTemplateFn = (url, filename) => new Promise((resolve) => {
    try {
      adapter.storage.sync.get(['filenameTemplate'], (items) => {
        let tpl = items && items.filenameTemplate ? items.filenameTemplate : '{domain}/{basename}'
        if (!tpl) tpl = '{domain}/{basename}'
        try {
          const out = tpl.replace(/\{domain\}/g, new URL(url).hostname.replace(/^www\./, '')).replace(/\{basename\}/g, filename).replace(/\{timestamp\}/g, String(Date.now()))
          resolve(out)
        } catch (e) { resolve(filename) }
      })
    } catch (e) { resolve(filename) }
  })
  return libGetBest(info, tab, { adapter, fetchFn, applyTemplateFn, fetchOptions: { timeout: 4000, retries: 1 } })
}

const { performDownload: libPerformDownload } = require('./lib/performDownload')
async function performDownload(candidate, callback = ()=>{}) {
  console.debug('lambda: performDownload', candidate)
  const res = await libPerformDownload(adapter, candidate)
  if (typeof callback === 'function') callback(res && res.id)
  return res
}

// Apply filename templating if configured
function applyTemplate(url, filename) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(['filenameTemplate'], (items) => {
        let tpl = items && items.filenameTemplate ? items.filenameTemplate : '{domain}/{basename}'
        if (!tpl) tpl = '{domain}/{basename}'
        try {
          const u = new URL(url)
          const domain = u.hostname.replace(/^www\./, '')
          const basename = filename
          const timestamp = Date.now()
          const out = tpl.replace(/\{domain\}/g, domain).replace(/\{basename\}/g, basename).replace(/\{timestamp\}/g, String(timestamp))
          resolve(out)
        } catch (e) {
          resolve(filename)
        }
      })
    } catch (e) {
      resolve(filename)
    }
  })
}

// Place new tabs next to the currently active tab
adapter.tabs.onCreated && adapter.tabs.onCreated.addListener ? adapter.tabs.onCreated.addListener(async (tab) => {
  try {
    // Only act on normal tabs (ignore those without windowId)
    if (!tab || typeof tab.windowId === 'undefined') return
    // find active tab in the same window
    adapter.tabs.query({ active: true, windowId: tab.windowId }, (tabs) => {
      const active = tabs && tabs[0]
      if (!active || active.index === undefined) return
      try {
        adapter.tabs.move(tab.id, { index: active.index + 1 }, () => {
          logLastError('tabs.move')
        })
      } catch (e) {}
    })
  } catch (e) {
    // ignore
  }
}) : (chrome.tabs.onCreated && chrome.tabs.onCreated.addListener(async (tab) => {
  // fallback to chrome.tabs.onCreated if adapter doesn't expose it
  try {
    if (!tab || typeof tab.windowId === 'undefined') return
    chrome.tabs.query({ active: true, windowId: tab.windowId }, (tabs) => {
      const active = tabs && tabs[0]
      if (!active || active.index === undefined) return
      try { chrome.tabs.move(tab.id, { index: active.index + 1 }, () => logLastError('tabs.move')) } catch (e) {}
    })
  } catch (e) {}
}))

// Register event listeners at top-level so MV3 service worker can wake on events
chrome.runtime.onInstalled.addListener(postInstall)
chrome.runtime.onStartup.addListener(postStartup)

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === IMG_DOWNLOAD_MENU_ID) {
    getBestCandidate(info, tab).then((cand) => performDownload(cand))
  }
  if (info.menuItemId === 'lambda-apply-bypass') {
    // instruct content script in the page to apply bypass features
    try {
      adapter.tabs.sendMessage(tab.id, { type: 'applyBypassNow', revealPasswords: true, allowPaste: true, enableRightClick: true }, (resp) => {})
    } catch (e) {}
  }
})

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'save-loaded-image') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0]
      if (!tab) return
      getBestCandidate({ srcUrl: tab.url }, tab).then((cand) => {
        performDownload(cand, () => { if (tab.id) adapter.tabs.remove(tab.id) })
      })
    })
    return
  }
  console.warn('Unknown command', cmd)
})

// Light-weight download state logging (optional improvement)
(adapter.downloads && adapter.downloads.onChanged && adapter.downloads.onChanged.addListener ? adapter.downloads.onChanged.addListener : chrome.downloads.onChanged.addListener)((delta) => {
  if (delta && delta.state && delta.state.current) {
    console.debug('download state', delta.id, delta.state.current)
  }
})

// Notify on download completion/failure
(adapter.downloads && adapter.downloads.onChanged && adapter.downloads.onChanged.addListener ? adapter.downloads.onChanged.addListener : chrome.downloads.onChanged.addListener)((d) => {
  if (!d || !d.state) return
  if (d.state.current === 'complete') {
    chrome.downloads.search({ id: d.id }, (items) => {
      const it = items && items[0]
      if (!it) return
      adapter.notifications.create ? adapter.notifications.create(String(d.id), {
        type: 'basic',
        iconUrl: 'img/icon/lambda-128.png',
        title: 'Download complete',
        message: it.filename || 'Download finished'
      }) : chrome.notifications.create(String(d.id), {
        type: 'basic',
        iconUrl: 'img/icon/lambda-128.png',
        title: 'Download complete',
        message: it.filename || 'Download finished'
      })
    })
  } else if (d.state.current === 'interrupted') {
    if (adapter.notifications.create) {
      adapter.notifications.create(String(d.id), {
        type: 'basic',
        iconUrl: 'img/icon/lambda-128.png',
        title: 'Download interrupted',
        message: 'A download failed or was interrupted.'
      })
    } else {
      chrome.notifications.create(String(d.id), {
        type: 'basic',
        iconUrl: 'img/icon/lambda-128.png',
        title: 'Download interrupted',
        message: 'A download failed or was interrupted.'
      })
    }
  }
})

// Listen for option changes from options page
(adapter.runtime && adapter.runtime.onMessage && adapter.runtime.onMessage.addListener ? adapter.runtime.onMessage.addListener : chrome.runtime.onMessage.addListener)((msg, sender, sendResponse) => {
  if (msg && msg.type === 'applyDisableShelf') {
    const disable = !!msg.value
    // persist preference to sync storage (best effort)
    try {
      chrome.storage.sync.set({ disableShelf: disable }, () => {
        // apply: if disable true => set shelf disabled => setShelfEnabled(!disable)
        setShelfEnabled(!disable)
      })
    } catch (e) {
      chrome.storage.local.set({ disableShelf: disable }, () => {
        setShelfEnabled(!disable)
      })
    }
    sendResponse({ ok: true })
  }
  if (msg && msg.type === 'downloadFromPage') {
    const src = msg.src
    // gather user prefs
    chrome.storage.sync.get(['preferOriginalFilename','forcedExtension'], (items) => {
      const preferOriginal = items && items.preferOriginalFilename !== undefined ? !!items.preferOriginalFilename : true
      const forcedExt = items && items.forcedExtension ? items.forcedExtension : ''
      // build info and call downloadResource
      const info = { srcUrl: src }
      getBestCandidate(info, sender.tab).then((cand) => {
        performDownload(cand, (did) => sendResponse({ ok: true, id: did }))
      })
    })
    return true
  }
})
