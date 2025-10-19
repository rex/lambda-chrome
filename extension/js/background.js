// Lambda MV3 background service worker (refactored)
// Consolidates install/startup behavior and download helpers.

const IMG_DOWNLOAD_MENU_ID = 'lambda-cm-dl-img'

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
      title: 'Download Image',
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
    chrome.storage.sync.get(['disableShelf'], async (items) => {
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
    chrome.storage.sync.get(['disableShelf'], async (items) => {
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
  if (url && url.startsWith('https://pbs.twimg.com/media')) {
    if (filename.endsWith('.jpg:large')) filename = filename.replace('.jpg:large', '.jpg')
    else if (filename.endsWith('.jpg-large')) filename = filename.replace('.jpg-large', '.jpg')
    if (!url.endsWith(':large')) url = `${url}:large`
  }
  return { url, filename }
}

async function downloadResource(info, tab, callback = () => {}) {
  try {
    let url = info && info.srcUrl ? String(info.srcUrl).replace(/\?.+$/gi, '') : ''
    let filename = url ? url.substring(url.lastIndexOf('/') + 1) : 'download'

    ;({ url, filename } = normalizeTwitterUrl(url, filename))

    // Apply templating (async) before sanitizing
    try {
      const templated = await applyTemplate(url, filename)
      filename = sanitizeFilename(templated)
    } catch (e) {
      filename = sanitizeFilename(filename)
    }

  console.debug('lambda: download', { url, filename })

    chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
      logLastError('downloads.download')
      if (typeof callback === 'function') callback(downloadId)
    })
  } catch (err) {
    console.error('downloadResource error', err)
  }
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
chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    // Only act on normal tabs (ignore those without windowId)
    if (!tab || typeof tab.windowId === 'undefined') return
    // find active tab in the same window
    chrome.tabs.query({ active: true, windowId: tab.windowId }, (tabs) => {
      const active = tabs && tabs[0]
      if (!active || active.index === undefined) return
      // move the newly created tab to active.index + 1
      try {
        chrome.tabs.move(tab.id, { index: active.index + 1 }, () => {
          logLastError('tabs.move')
        })
      } catch (e) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }
})

// Register event listeners at top-level so MV3 service worker can wake on events
chrome.runtime.onInstalled.addListener(postInstall)
chrome.runtime.onStartup.addListener(postStartup)

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === IMG_DOWNLOAD_MENU_ID) downloadResource(info, tab)
  if (info.menuItemId === 'lambda-apply-bypass') {
    // instruct content script in the page to apply bypass features
    try {
      chrome.tabs.sendMessage(tab.id, { type: 'applyBypassNow', revealPasswords: true, allowPaste: true, enableRightClick: true }, (resp) => {})
    } catch (e) {}
  }
})

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'save-loaded-image') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0]
      if (!tab) return
      downloadResource({ srcUrl: tab.url }, tab, () => {
        if (tab.id) chrome.tabs.remove(tab.id)
      })
    })
    return
  }
  console.warn('Unknown command', cmd)
})

// Light-weight download state logging (optional improvement)
chrome.downloads.onChanged.addListener((delta) => {
  if (delta && delta.state && delta.state.current) {
    console.debug('download state', delta.id, delta.state.current)
  }
})

// Notify on download completion/failure
chrome.downloads.onChanged.addListener((d) => {
  if (!d || !d.state) return
  if (d.state.current === 'complete') {
    chrome.downloads.search({ id: d.id }, (items) => {
      const it = items && items[0]
      if (!it) return
      chrome.notifications.create(String(d.id), {
        type: 'basic',
        iconUrl: 'img/icon/lambda-128.png',
        title: 'Download complete',
        message: it.filename || 'Download finished'
      })
    })
  } else if (d.state.current === 'interrupted') {
    chrome.notifications.create(String(d.id), {
      type: 'basic',
      iconUrl: 'img/icon/lambda-128.png',
      title: 'Download interrupted',
      message: 'A download failed or was interrupted.'
    })
  }
})

// Listen for option changes from options page
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
})
