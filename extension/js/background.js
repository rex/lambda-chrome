/**
 * background.js — Lambda MV3 service worker
 *
 * Module summary
 * This module contains the top-level background/service-worker logic for the
 * extension. It wires Chrome runtime events, provides the context menu and
 * commands for user-initiated downloads, coordinates probing & filename
 * selection, and delegates the final download to the downloads API. The file
 * is written defensively so it can be executed in unit tests (via the
 * `chromeAdapter` test shim) or in a real Chrome MV3 environment.
 *
 * Exported surface (for tests)
 * - IMG_DOWNLOAD_MENU_ID (string): id used for the context menu item
 * - adapter (object): runtime adapter used (real `chrome` or test shim)
 * - setShelfEnabled(enabled): Promise<void> — enable/disable the download shelf
 * - createContextMenu(): void — create extension context menu entries
 * - postInstall(details): Promise<void> — install-time initialization
 * - postStartup(): Promise<void> — startup-time initialization
 * - sanitizeFilename(name): string — conservative filename sanitizer (SW fallback)
 * - normalizeTwitterUrl(url, filename): {url,filename} — normalize pbs.twimg.com image URLs
 * - getBestCandidate(info, tab): Promise<{ok:boolean,url?:string,filename?:string,error?:string}> — select a download candidate
 * - performDownload(candidate, callback?): Promise<{ok:boolean,id?:any,error?:string}> — trigger the download
 * - applyTemplate(url, filename): Promise<string> — apply filename template from storage
 *
 * Contracts & data shapes
 * - Candidate: { url: string, filename: string }
 * - Probe result: { ok: true, url: string, filename: string } or { ok: false, error: string }
 *
 * Design notes
 * - Defensive adapters: the `adapter` object abstracts chrome.* APIs so tests
 *   can inject a lightweight shim. The code always checks that nested
 *   functions (e.g. adapter.downloads.download) exist before calling them.
 * - Guarded optional deps: where useful the module prefers small helper
 *   libs (e.g. lodash helpers) when available at runtime, but defines
 *   in-file fallbacks so the unbundled MV3 service worker can load.
 * - Error handling: methods attempt to return structured error objects rather
 *   than throwing to make background logic easier to test and resilient at
 *   runtime.
 *
 * Edge cases considered
 * - Missing or malformed URLs, blob/data: URLs, redirected responses, missing
 *   headers (Content-Type / Content-Disposition), CDN-hosted images (Twitter),
 *   and content scripts that may provide improved candidates.
 *
 * Testing helpers
 * - The module exports internal helpers (getBestCandidate, performDownload,
 *   etc.) so unit tests can call and assert behavior without side effects.
 *
 * @module extension/background
 */

const IMG_DOWNLOAD_MENU_ID = 'lambda-cm-dl-img'

// Lodash helpers (guarded so background service worker can load unbundled)
let _get, _isFunction, _isString, _truncate
if (typeof require !== 'undefined') {
  try {
    _get = require('lodash/get')
    _isFunction = require('lodash/isFunction')
    _isString = require('lodash/isString')
    _truncate = require('lodash/truncate')
  } catch (e) {}
}
if (!_get) {
  _get = (obj, path, def) => {
    if (!obj) return def
    const parts = String(path || '').split('.')
    let cur = obj
    for (const p of parts) {
      if (cur == null) return def
      cur = cur[p]
    }
    return cur === undefined ? def : cur
  }
}
if (!_isFunction) _isFunction = (v) => typeof v === 'function'
if (!_isString) _isString = (v) => typeof v === 'string'
if (!_truncate) _truncate = (s, opts = {}) => {
  const len = (opts && opts.length) || 255
  const omission = (opts && opts.omission) || ''
  if (!s) return s
  return String(s).length > len ? String(s).slice(0, len) + omission : String(s)
}

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

/**
 * Set the download shelf visibility via the downloads API.
 *
 * This function attempts to call the platform API exposed at
 * `adapter.downloads.setShelfEnabled(enabled, cb)` and resolves after the
 * callback runs. When the API is not available the function resolves
 * immediately (no-op). Errors are caught and logged; the returned promise
 * always resolves to allow best-effort application at install/startup.
 *
 * @param {boolean} enabled - true to show the download shelf, false to hide it.
 * @returns {Promise<void>} Resolves after the API invocation or immediately when not available.
 */
function setShelfEnabled(enabled) {
  return new Promise((resolve) => {
    try {
      const _setShelf = _isFunction(_get(adapter, 'downloads.setShelfEnabled'))
        ? _get(adapter, 'downloads.setShelfEnabled')
        : (_isFunction(_get(globalThis, 'chrome.downloads.setShelfEnabled')) ? _get(globalThis, 'chrome.downloads.setShelfEnabled') : null)
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

/**
 * Create the extension context menu entries used for image download and
 * bypass actions.
 *
 * This function prefers `adapter.contextMenus.create` when provided; it
 * performs defensive checks so it is safe to call in headless tests.
 *
 * @returns {void}
 */
function createContextMenu() {
  try {
    const _create = _isFunction(_get(adapter, 'contextMenus.create'))
      ? _get(adapter, 'contextMenus.create')
      : (_isFunction(_get(globalThis, 'chrome.contextMenus.create')) ? _get(globalThis, 'chrome.contextMenus.create') : null)
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

/**
 * Handle runtime.onInstalled event.
 *
 * Responsibilities:
 * - Read persisted preference for the download-shelf (`disableShelf`) and
 *   apply it via `setShelfEnabled`.
 * - Ensure the extension context menu entries are created.
 *
 * The function uses `adapter.storage.sync.get` when available and falls back
 * to safe defaults. It never throws; errors are logged and handled.
 *
 * @param {Object} details - onInstalled details object provided by Chrome.
 * @returns {Promise<void>}
 */
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

/**
 * Handle runtime.onStartup event.
 *
 * Reads the `disableShelf` preference and applies the shelf setting. This is
 * invoked when the service worker starts and is resilient to missing storage
 * APIs.
 *
 * @returns {Promise<void>}
 */
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

/**
 * Conservative filename sanitizer used by the service worker.
 *
 * Behavior:
 * - Prefers the shared `./lib/sanitizeFilename` implementation when available
 *   (keeps a single canonical sanitizer in the lib). If the lib is not
 *   available, this function performs a conservative fallback sanitization.
 * - Attempts to decode URI components, strips query and fragment-like
 *   fragments, replaces filesystem-problematic characters with underscores,
 *   and truncates to a safe maximum (255 bytes/characters).
 *
 * @param {string} name - Input filename or URL segment to sanitize.
 * @returns {string} A sanitized filename suitable for saving; never an empty string.
 */
function sanitizeFilename(name) {
  if (!name) return 'download'
  // prefer shared lib implementation when available
  if (typeof require !== 'undefined') {
    try {
      const lib = require('./lib/sanitizeFilename')
      if (lib && typeof lib.sanitizeFilename === 'function') return lib.sanitizeFilename(name)
    } catch (e) {}
  }
  try { name = decodeURIComponent(name) } catch (e) { /* ignore */ }
  // remove trailing modifiers and query-like segments
  name = String(name).replace(/[:?#].*$/g, '')
  // Replace characters that are invalid on most file systems
  name = name.replace(/[\/:"<>|?*\x00-\x1F]/g, '_')
  // Limit length using truncate helper
  return _truncate(name, { length: 255, omission: '' }) || 'download'
}

// ...existing code...

/**
 * Normalize Twitter `pbs.twimg.com` media URLs to request a higher-quality
 * variant and derive a consistent filename.
 *
 * - If the URL is not a Twitter media URL this function returns the inputs
 *   unchanged.
 * - Ensures query parameters include `name=large` and `format` when known.
 * - Infers a sensible file extension when possible and normalizes `jpg` -> `jpeg`.
 *
 * @param {string} url - Source URL possibly pointing at Twitter media CDN.
 * @param {string} filename - Candidate filename to use as a fallback.
 * @returns {{url:string,filename:string}} Normalized URL and filename.
 */
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
let libGetBest
if (typeof require !== 'undefined') {
  /* Node (tests) or bundled env */
  try { libGetBest = require('./lib/getBestCandidate').getBestCandidate } catch (e) { libGetBest = null }
} else if (globalThis && globalThis.__libGetBest) {
  libGetBest = globalThis.__libGetBest
} else {
  // Browser/service-worker runtime without bundling: provide a lightweight functional fallback
  libGetBest = async (info, tab, opts = {}) => {
    try {
      const src = info && info.srcUrl ? String(info.srcUrl) : ''
      if (!src) return { ok: false, error: 'empty_src' }
      const u = new URL(src, (typeof location !== 'undefined' && location.href) ? location.href : src)
      let filename = u.pathname.split('/').pop() || 'image'
      filename = filename.replace(/[:?#].*$/g, '')
      filename = filename.replace(/[\\/:"<>|?*\x00-\x1F]/g, '_')
      filename = filename.slice(0, 255) || 'download'

      // attempt to apply filename template via storage if available
      const storage = (opts && opts.adapter && opts.adapter.storage) || (adapter && adapter.storage)
  const getFn = _isFunction(_get(storage, 'sync.get')) ? _get(storage, 'sync.get') : null
      if (getFn) {
        return await new Promise((resolve) => {
          try {
            getFn(['filenameTemplate'], (items) => {
              let tpl = items && items.filenameTemplate ? items.filenameTemplate : '{domain}/{basename}'
              if (!tpl) tpl = '{domain}/{basename}'
              try {
                const domain = u.hostname.replace(/^www\./, '')
                const basename = filename
                const out = tpl.replace(/\{domain\}/g, domain).replace(/\{basename\}/g, basename).replace(/\{timestamp\}/g, String(Date.now()))
                const safe = out.replace(/[\\/:"<>|?*\x00-\x1F]/g, '_').slice(0, 255) || 'download'
                resolve({ ok: true, url: src, filename: safe })
              } catch (e) { resolve({ ok: true, url: src, filename }) }
            })
          } catch (e) { resolve({ ok: true, url: src, filename }) }
        })
      }
      return { ok: true, url: src, filename }
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) }
    }
  }
}

/**
 * High-level selector for the best download candidate for a given image
 * resource. This function orchestrates content-script probing, provider
 * normalization (Twitter), HEAD probes to infer content-type or
 * content-disposition filename hints, application of the filename template,
 * and final sanitization.
 *
 * Contract:
 * - Accepts `info` with `{ srcUrl }` and a `tab` object used for content
 *   script messaging.
 * - Returns { ok: true, url, filename } on success or { ok: false, error }
 *   when unable to select a candidate.
 *
 * Error & edge handling:
 * - If the content script probe is unavailable or returns null, the function
 *   falls back to network probing.
 * - Network HEAD probes are performed with `fetchWithTimeout` (defaults used
 *   elsewhere) and will be skipped if no fetch implementation is provided.
 *
 * @param {{srcUrl:string}} info - Object containing image `srcUrl`.
 * @param {Object} tab - Tab-like object (must expose `id`) used to message content scripts.
 * @returns {Promise<{ok:boolean,url?:string,filename?:string,error?:string}>}
 */
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

let libPerformDownload
if (typeof require !== 'undefined') {
  try { libPerformDownload = require('./lib/performDownload').performDownload } catch (e) { libPerformDownload = null }
} else if (globalThis && globalThis.__libPerformDownload) {
  libPerformDownload = globalThis.__libPerformDownload
} else {
  // lightweight fallback: call adapter.downloads.download or chrome.downloads.download if available
  libPerformDownload = async (adapterArg, candidate) => {
    try {
      if (!candidate || !candidate.url) return { ok: false, error: 'invalid_candidate' }
      const ad = adapterArg || adapter
  const downloader = _isFunction(_get(ad, 'downloads.download')) ? _get(ad, 'downloads.download') : (_isFunction(_get(globalThis, 'chrome.downloads.download')) ? _get(globalThis, 'chrome.downloads.download') : null)
      if (!downloader) return { ok: false, error: 'no_download_api' }
      return await new Promise((resolve) => {
        try {
          downloader({ url: candidate.url, filename: candidate.filename, saveAs: false }, (id) => {
            resolve({ ok: true, id })
          })
        } catch (e) { resolve({ ok: false, error: e && e.message ? e.message : String(e) }) }
      })
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) }
    }
  }
}

async function performDownload(candidate, callback = ()=>{}) {
  console.debug('lambda: performDownload', candidate)
  const res = await libPerformDownload(adapter, candidate)
  if (_isFunction(callback)) callback(res && res.id)
  return res
}

// Apply filename templating if configured
function applyTemplate(url, filename) {
  return new Promise((resolve) => {
    try {
  const _storageGet = _isFunction(_get(adapter, 'storage.sync.get')) ? _get(adapter, 'storage.sync.get') : (_isFunction(_get(globalThis, 'chrome.storage.sync.get')) ? _get(globalThis, 'chrome.storage.sync.get') : null)
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
const _onInstalledTarget = (adapter.runtime && adapter.runtime.onInstalled && typeof adapter.runtime.onInstalled.addListener === 'function')
  ? adapter.runtime.onInstalled
  : (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled && typeof chrome.runtime.onInstalled.addListener === 'function')
    ? chrome.runtime.onInstalled
    : null
if (_onInstalledTarget && typeof _onInstalledTarget.addListener === 'function') _onInstalledTarget.addListener(postInstall)

const _onStartupTarget = (adapter.runtime && adapter.runtime.onStartup && typeof adapter.runtime.onStartup.addListener === 'function')
  ? adapter.runtime.onStartup
  : (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onStartup && typeof chrome.runtime.onStartup.addListener === 'function')
    ? chrome.runtime.onStartup
    : null
if (_onStartupTarget && typeof _onStartupTarget.addListener === 'function') _onStartupTarget.addListener(postStartup)

const _onContextMenuTarget = (adapter.contextMenus && adapter.contextMenus.onClicked && typeof adapter.contextMenus.onClicked.addListener === 'function')
  ? adapter.contextMenus.onClicked
  : (typeof chrome !== 'undefined' && chrome.contextMenus && chrome.contextMenus.onClicked && typeof chrome.contextMenus.onClicked.addListener === 'function')
    ? chrome.contextMenus.onClicked
    : null
if (_onContextMenuTarget && typeof _onContextMenuTarget.addListener === 'function') _onContextMenuTarget.addListener((info, tab) => {
  if (info.menuItemId === IMG_DOWNLOAD_MENU_ID) {
    getBestCandidate(info, tab).then((cand) => {
      if (!cand || !cand.ok) {
        console.error('getBestCandidate failed for context menu', cand)
        return
      }
      performDownload(cand).then((res) => {
        if (!res || !res.ok) console.error('performDownload failed for context menu', res)
      })
    }).catch((e)=> console.error('getBestCandidate threw', e))
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
/**
 * Exports for unit testing and runtime introspection.
 *
 * The exported values are intentionally the minimal surface needed by tests
 * so the background service worker can remain side-effect free while under
 * test control. Test suites may override `adapter` or call `getBestCandidate`
 * and `performDownload` directly.
 */
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

const _onCommandTarget = (adapter.commands && adapter.commands.onCommand && typeof adapter.commands.onCommand.addListener === 'function')
  ? adapter.commands.onCommand
  : (typeof chrome !== 'undefined' && chrome.commands && chrome.commands.onCommand && typeof chrome.commands.onCommand.addListener === 'function')
    ? chrome.commands.onCommand
    : null
if (_onCommandTarget && typeof _onCommandTarget.addListener === 'function') _onCommandTarget.addListener((cmd) => {
  if (cmd === 'save-loaded-image') {
    const _tabsQuery = (adapter.tabs && typeof adapter.tabs.query === 'function') ? adapter.tabs.query : (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.query === 'function') ? chrome.tabs.query : null
    if (_tabsQuery) {
      _tabsQuery({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0]
        if (!tab) return
        getBestCandidate({ srcUrl: tab.url }, tab).then((cand) => {
          if (!cand || !cand.ok) { console.error('getBestCandidate (command) failed', cand); return }
          performDownload(cand).then((r) => {
            if (!r || !r.ok) console.error('performDownload (command) failed', r)
            else if (tab.id && adapter.tabs && typeof adapter.tabs.remove === 'function') adapter.tabs.remove(tab.id)
          })
        }).catch(e => console.error('getBestCandidate (command) threw', e))
      })
    }
    return
  }
  console.warn('Unknown command', cmd)
})

// Light-weight download state logging (optional improvement)
const _onDownloadChangedTarget = (adapter.downloads && adapter.downloads.onChanged && typeof adapter.downloads.onChanged.addListener === 'function')
  ? adapter.downloads.onChanged
  : (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.onChanged && typeof chrome.downloads.onChanged.addListener === 'function')
    ? chrome.downloads.onChanged
    : null
if (_onDownloadChangedTarget && typeof _onDownloadChangedTarget.addListener === 'function') _onDownloadChangedTarget.addListener((delta) => {
  if (delta && delta.state && delta.state.current) {
    console.debug('download state', delta.id, delta.state.current)
  }
})

// Notify on download completion/failure
const _onDownloadChangedTarget2 = (adapter.downloads && adapter.downloads.onChanged && typeof adapter.downloads.onChanged.addListener === 'function')
  ? adapter.downloads.onChanged
  : (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.onChanged && typeof chrome.downloads.onChanged.addListener === 'function')
    ? chrome.downloads.onChanged
    : null
if (_onDownloadChangedTarget2 && typeof _onDownloadChangedTarget2.addListener === 'function') _onDownloadChangedTarget2.addListener((d) => {
  if (!d || !d.state) return
  // lazy nanoid import for notification id fallback
  let _nanoid
  if (typeof require !== 'undefined') {
    try { _nanoid = require('nanoid').nanoid } catch (e) { try { _nanoid = require('nanoid') } catch (e2) {} }
  }
  if (d.state.current === 'complete') {
    const _dlSearch = (adapter.downloads && typeof adapter.downloads.search === 'function') ? adapter.downloads.search : (typeof chrome !== 'undefined' && chrome.downloads && typeof chrome.downloads.search === 'function') ? chrome.downloads.search : null
    if (_dlSearch) {
      _dlSearch({ id: d.id }, (items) => {
        const it = items && items[0]
        if (!it) return
        if (adapter.notifications && typeof adapter.notifications.create === 'function') {
          const nid = d && d.id ? String(d.id) : (_nanoid ? _nanoid() : String(Date.now()))
          adapter.notifications.create(nid, {
            type: 'basic',
            iconUrl: 'img/icon/lambda-128.png',
            title: 'Download complete',
            message: it.filename || 'Download finished'
          })
        } else {
          const _create = (typeof chrome !== 'undefined' && chrome.notifications && typeof chrome.notifications.create === 'function') ? chrome.notifications.create : null
          const nid = d && d.id ? String(d.id) : (_nanoid ? _nanoid() : String(Date.now()))
          if (_create) _create(nid, {
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
      const nid = d && d.id ? String(d.id) : (_nanoid ? _nanoid() : String(Date.now()))
      adapter.notifications.create(nid, {
        type: 'basic',
        iconUrl: 'img/icon/lambda-128.png',
        title: 'Download interrupted',
        message: 'A download failed or was interrupted.'
      })
    } else {
      const _create = (typeof chrome !== 'undefined' && chrome.notifications && typeof chrome.notifications.create === 'function') ? chrome.notifications.create : null
      const nid = d && d.id ? String(d.id) : (_nanoid ? _nanoid() : String(Date.now()))
      if (_create) _create(nid, {
        type: 'basic',
        iconUrl: 'img/icon/lambda-128.png',
        title: 'Download interrupted',
        message: 'A download failed or was interrupted.'
      })
    }
  }
})

// Listen for option changes from options page
const _onRuntimeMessageTarget = (adapter.runtime && adapter.runtime.onMessage && typeof adapter.runtime.onMessage.addListener === 'function')
  ? adapter.runtime.onMessage
  : (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === 'function')
    ? chrome.runtime.onMessage
    : null
if (_onRuntimeMessageTarget && typeof _onRuntimeMessageTarget.addListener === 'function') _onRuntimeMessageTarget.addListener((msg, sender, sendResponse) => {
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
          if (!cand || !cand.ok) {
            console.error('getBestCandidate (runtime) failed', cand)
            sendResponse({ ok: false, error: cand && cand.error ? cand.error : 'getBestCandidate-failed' })
            return
          }
          performDownload(cand).then((didRes) => {
            if (!didRes || !didRes.ok) {
              console.error('performDownload (runtime) failed', didRes)
              sendResponse({ ok: false, error: didRes && didRes.error ? didRes.error : 'performDownload-failed' })
            } else {
              sendResponse({ ok: true, id: didRes.id })
            }
          }).catch(e => { console.error('performDownload (runtime) threw', e); sendResponse({ ok: false, error: String(e) }) })
        }).catch(e => { console.error('getBestCandidate (runtime) threw', e); sendResponse({ ok:false, error: String(e) }) })
      })
    } else {
      // no storage get available — just attempt download
      const info = { srcUrl: src }
      getBestCandidate(info, sender.tab).then((cand) => {
        if (!cand || !cand.ok) { console.error('getBestCandidate (runtime-no-storage) failed', cand); sendResponse({ ok:false, error: cand && cand.error ? cand.error : 'getBestCandidate-failed' }); return }
        performDownload(cand).then((didRes) => {
          if (!didRes || !didRes.ok) { console.error('performDownload (runtime-no-storage) failed', didRes); sendResponse({ ok:false, error: didRes && didRes.error ? didRes.error : 'performDownload-failed' }); return }
          sendResponse({ ok: true, id: didRes.id })
        }).catch(e => { console.error('performDownload (runtime-no-storage) threw', e); sendResponse({ ok:false, error: String(e) }) })
      }).catch(e => { console.error('getBestCandidate (runtime-no-storage) threw', e); sendResponse({ ok:false, error: String(e) }) })
    }
    return true
  }
})
