/**
 * background.js — Lambda MV3 service worker
 *
 * Purpose:
 *  - Central background/service-worker logic for the extension: install/startup hooks,
 *    context menu creation, download orchestration, tab behavior, and option propagation.
 *
 * Public behaviors/side-effects:
 *  - Registers `chrome.runtime.onInstalled` and `onStartup` handlers to apply stored preferences.
 *  - Creates context menu entries for image download and bypass actions.
 *  - Wakes on command/menus to probe and download images via `getBestCandidate` and `performDownload`.
 *  - Listens for storage-driven messages (applyDisableShelf) to persist and apply the download-shelf preference.
 *  - Moves newly created tabs to open next to the active tab (no-op in test adapters).
 *
 * Error modes & testing:
 *  - Uses an injected `chromeAdapter` when available for testability; otherwise falls back to the real `chrome` APIs.
 *  - Where APIs may throw (missing `chrome` in tests), the adapter provides minimal stubs and functions become no-ops.
 *  - All interactions with chrome.* are best-effort and avoid throwing; errors are logged via `console.warn`.
 */

const IMG_DOWNLOAD_MENU_ID = 'lambda-cm-dl-img'

// Adapter: if a `chromeAdapter` is injected (tests/refactors), use it; otherwise delegate to `chrome`.
// Support both an explicitly-declared `chromeAdapter` identifier and `global.chromeAdapter` (tests set this).
const adapter = (typeof chromeAdapter !== 'undefined' && chromeAdapter)
  ? chromeAdapter
  : (typeof global !== 'undefined' && global.chromeAdapter)
    ? global.chromeAdapter
    : (function(){
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
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
      console.warn(ctx, chrome.runtime.lastError && chrome.runtime.lastError.message)
    }
  } catch (e) {}
}

function setShelfEnabled(enabled) {
  return new Promise((resolve) => {
    try {
      const _setShelf = (adapter.downloads && typeof adapter.downloads.setShelfEnabled === 'function')
        ? adapter.downloads.setShelfEnabled
        : (typeof chrome !== 'undefined' && chrome.downloads && typeof chrome.downloads.setShelfEnabled === 'function')
          ? chrome.downloads.setShelfEnabled
          : null
      if (_setShelf) {
        _setShelf(enabled, () => {
          logLastError('setShelfEnabled')
          resolve()
        })
      } else {
        // no-op fallback
        resolve()
      }
    } catch (err) {
      console.warn('setShelfEnabled exception', err)
      resolve()
    }
  })
}

function createContextMenu() {
  try {
    const _create = (adapter.contextMenus && typeof adapter.contextMenus.create === 'function')
      ? adapter.contextMenus.create
      : (typeof chrome !== 'undefined' && chrome.contextMenus && typeof chrome.contextMenus.create === 'function')
        ? chrome.contextMenus.create
        : null
    if (_create) {
      _create({ id: IMG_DOWNLOAD_MENU_ID, title: 'Download image — Lambda', contexts: ['image'] }, () => logLastError('createContextMenu'))
    }
    // context menu for applying bypass on current page
    try {
      if (_create) _create({ id: 'lambda-apply-bypass', title: 'Enable Lambda bypass on this page', contexts: ['all'] }, () => logLastError('createContextMenu-bypass'))
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
      // prefer the exported createContextMenu (so tests can override it); fall back to local
      if (typeof module !== 'undefined' && module.exports && typeof module.exports.createContextMenu === 'function') {
        module.exports.createContextMenu()
      } else {
        createContextMenu()
      }
    })
  } catch (e) {
    await setShelfEnabled(false)
    if (typeof module !== 'undefined' && module.exports && typeof module.exports.createContextMenu === 'function') {
      module.exports.createContextMenu()
    } else {
      createContextMenu()
    }
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
      const _storageGet = (adapter.storage && adapter.storage.sync && typeof adapter.storage.sync.get === 'function')
        ? adapter.storage.sync.get
        : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync && typeof chrome.storage.sync.get === 'function')
          ? chrome.storage.sync.get
          : null
      if (_storageGet) {
        _storageGet(['filenameTemplate'], (items) => {
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
      } else {
        resolve(filename)
      }
    } catch (e) {
      resolve(filename)
    }
  })
}

// Place new tabs next to the currently active tab
// Defensive registration: only attempt to access nested addListener if the path exists.
if (adapter && adapter.tabs && adapter.tabs.onCreated && typeof adapter.tabs.onCreated.addListener === 'function') {
  adapter.tabs.onCreated.addListener(async (tab) => {
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
  })
} else if (chrome && chrome.tabs && chrome.tabs.onCreated && typeof chrome.tabs.onCreated.addListener === 'function') {
  chrome.tabs.onCreated.addListener(async (tab) => {
  // fallback to chrome.tabs.onCreated if adapter doesn't expose it
  try {
    if (!tab || typeof tab.windowId === 'undefined') return
    chrome.tabs.query({ active: true, windowId: tab.windowId }, (tabs) => {
      const active = tabs && tabs[0]
      if (!active || active.index === undefined) return
      try { chrome.tabs.move(tab.id, { index: active.index + 1 }, () => logLastError('tabs.move')) } catch (e) {}
    })
  } catch (e) {}
  })
}

;
// Register event listeners at top-level so MV3 service worker can wake on events
const _onInstalledAdder = (adapter.runtime && adapter.runtime.onInstalled && typeof adapter.runtime.onInstalled.addListener === 'function')
  ? adapter.runtime.onInstalled.addListener
  : (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled && typeof chrome.runtime.onInstalled.addListener === 'function')
    ? chrome.runtime.onInstalled.addListener
    : () => {}
_onInstalledAdder(postInstall)

const _onStartupAdder = (adapter.runtime && adapter.runtime.onStartup && typeof adapter.runtime.onStartup.addListener === 'function')
  ? adapter.runtime.onStartup.addListener
  : (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onStartup && typeof chrome.runtime.onStartup.addListener === 'function')
    ? chrome.runtime.onStartup.addListener
    : () => {}
_onStartupAdder(postStartup)

const _onContextMenuClick = (adapter.contextMenus && adapter.contextMenus.onClicked && typeof adapter.contextMenus.onClicked.addListener === 'function')
  ? adapter.contextMenus.onClicked.addListener
  : (typeof chrome !== 'undefined' && chrome.contextMenus && chrome.contextMenus.onClicked && typeof chrome.contextMenus.onClicked.addListener === 'function')
    ? chrome.contextMenus.onClicked.addListener
    : () => {}
_onContextMenuClick((info, tab) => {
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

// Export internals for unit testing. These are non-functional exports used only by tests.
// They do not change runtime behavior when the service worker is loaded by Chrome.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    IMG_DOWNLOAD_MENU_ID,
    adapter,
    setShelfEnabled,
    createContextMenu,
    postInstall,
    postStartup,
    sanitizeFilename,
    normalizeTwitterUrl,
    getBestCandidate,
    performDownload,
    applyTemplate
  }
}

const _onCommandAdder = (adapter.commands && adapter.commands.onCommand && typeof adapter.commands.onCommand.addListener === 'function')
  ? adapter.commands.onCommand.addListener
  : (typeof chrome !== 'undefined' && chrome.commands && chrome.commands.onCommand && typeof chrome.commands.onCommand.addListener === 'function')
    ? chrome.commands.onCommand.addListener
    : () => {}
_onCommandAdder((cmd) => {
  if (cmd === 'save-loaded-image') {
    const _tabsQuery = (adapter.tabs && typeof adapter.tabs.query === 'function') ? adapter.tabs.query : (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.query === 'function') ? chrome.tabs.query : null
    if (_tabsQuery) {
      _tabsQuery({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0]
        if (!tab) return
        getBestCandidate({ srcUrl: tab.url }, tab).then((cand) => {
          performDownload(cand, () => { if (tab.id && adapter.tabs && typeof adapter.tabs.remove === 'function') adapter.tabs.remove(tab.id) })
        })
      })
    }
    return
  }
  console.warn('Unknown command', cmd)
})

// Light-weight download state logging (optional improvement)
const _onDownloadChanged = (adapter.downloads && adapter.downloads.onChanged && typeof adapter.downloads.onChanged.addListener === 'function'
  ? adapter.downloads.onChanged.addListener
  : (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.onChanged && typeof chrome.downloads.onChanged.addListener === 'function')
    ? chrome.downloads.onChanged.addListener
    : () => {})
_onDownloadChanged((delta) => {
  if (delta && delta.state && delta.state.current) {
    console.debug('download state', delta.id, delta.state.current)
  }
})

// Notify on download completion/failure
const _onDownloadChanged2 = (adapter.downloads && adapter.downloads.onChanged && typeof adapter.downloads.onChanged.addListener === 'function'
  ? adapter.downloads.onChanged.addListener
  : (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.onChanged && typeof chrome.downloads.onChanged.addListener === 'function')
    ? chrome.downloads.onChanged.addListener
    : () => {})
_onDownloadChanged2((d) => {
  if (!d || !d.state) return
  if (d.state.current === 'complete') {
    const _dlSearch = (adapter.downloads && typeof adapter.downloads.search === 'function') ? adapter.downloads.search : (typeof chrome !== 'undefined' && chrome.downloads && typeof chrome.downloads.search === 'function') ? chrome.downloads.search : null
    if (_dlSearch) {
      _dlSearch({ id: d.id }, (items) => {
        const it = items && items[0]
        if (!it) return
        if (adapter.notifications && typeof adapter.notifications.create === 'function') {
          adapter.notifications.create(String(d.id), {
            type: 'basic',
            iconUrl: 'img/icon/lambda-128.png',
            title: 'Download complete',
            message: it.filename || 'Download finished'
          })
        } else {
          const _create = (typeof chrome !== 'undefined' && chrome.notifications && typeof chrome.notifications.create === 'function') ? chrome.notifications.create : null
          if (_create) _create(String(d.id), {
            type: 'basic',
            iconUrl: 'img/icon/lambda-128.png',
            title: 'Download complete',
            message: it.filename || 'Download finished'
          })
        }
      })
    }
  } else if (d.state.current === 'interrupted') {
    if (adapter.notifications && typeof adapter.notifications.create === 'function') {
      adapter.notifications.create(String(d.id), {
        type: 'basic',
        iconUrl: 'img/icon/lambda-128.png',
        title: 'Download interrupted',
        message: 'A download failed or was interrupted.'
      })
    } else {
      const _create = (typeof chrome !== 'undefined' && chrome.notifications && typeof chrome.notifications.create === 'function') ? chrome.notifications.create : null
      if (_create) _create(String(d.id), {
        type: 'basic',
        iconUrl: 'img/icon/lambda-128.png',
        title: 'Download interrupted',
        message: 'A download failed or was interrupted.'
      })
    }
  }
})

// Listen for option changes from options page
const _onRuntimeMessage = (adapter.runtime && adapter.runtime.onMessage && typeof adapter.runtime.onMessage.addListener === 'function')
  ? adapter.runtime.onMessage.addListener
  : (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === 'function')
    ? chrome.runtime.onMessage.addListener
    : () => {}
_onRuntimeMessage((msg, sender, sendResponse) => {
  if (msg && msg.type === 'applyDisableShelf') {
    const disable = !!msg.value
    // persist preference to sync storage (best effort)
    try {
      const _set = (adapter.storage && adapter.storage.sync && typeof adapter.storage.sync.set === 'function') ? adapter.storage.sync.set : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync && typeof chrome.storage.sync.set === 'function') ? chrome.storage.sync.set : null
      if (_set) _set({ disableShelf: disable }, () => { setShelfEnabled(!disable) })
    } catch (e) {
      const _localSet = (adapter.storage && adapter.storage.local && typeof adapter.storage.local.set === 'function') ? adapter.storage.local.set : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && typeof chrome.storage.local.set === 'function') ? chrome.storage.local.set : null
      if (_localSet) _localSet({ disableShelf: disable }, () => { setShelfEnabled(!disable) })
    }
    sendResponse({ ok: true })
  }
  if (msg && msg.type === 'downloadFromPage') {
    const src = msg.src
    // gather user prefs
    const _get = (adapter.storage && adapter.storage.sync && typeof adapter.storage.sync.get === 'function') ? adapter.storage.sync.get : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync && typeof chrome.storage.sync.get === 'function') ? chrome.storage.sync.get : null
    if (_get) {
      _get(['preferOriginalFilename','forcedExtension'], (items) => {
        const preferOriginal = items && items.preferOriginalFilename !== undefined ? !!items.preferOriginalFilename : true
        const forcedExt = items && items.forcedExtension ? items.forcedExtension : ''
        // build info and call downloadResource
        const info = { srcUrl: src }
        getBestCandidate(info, sender.tab).then((cand) => {
          performDownload(cand, (did) => sendResponse({ ok: true, id: did }))
        })
      })
    } else {
      // no storage get available — just attempt download
      const info = { srcUrl: src }
      getBestCandidate(info, sender.tab).then((cand) => {
        performDownload(cand, (did) => sendResponse({ ok: true, id: did }))
      })
    }
    return true
  }
})
