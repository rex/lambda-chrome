// Options page logic for Lambda extension

const DEFAULTS = {
  disableShelf: true,
  filenameTemplate: '{domain}/{basename}'
}
DEFAULTS.revealPasswords = false
DEFAULTS.allowPaste = true
DEFAULTS.enableRightClickByDefault = false
DEFAULTS.preferOriginalFilename = true
DEFAULTS.forcedExtension = ''

function qs(id) { return document.getElementById(id) }

const optsAdapter = (typeof chromeAdapter !== 'undefined' && chromeAdapter) ? chromeAdapter : (typeof chrome !== 'undefined' ? { storage: chrome.storage, runtime: chrome.runtime } : null)
const { wrap } = require('./lib/storageWrapper')
const storageClient = optsAdapter && optsAdapter.storage ? wrap(optsAdapter.storage, optsAdapter.runtime) : (typeof chrome !== 'undefined' ? wrap(chrome.storage, chrome.runtime) : null)

async function saveOptions() {
  const disableShelf = qs('opt-disable-shelf').checked
  const filenameTemplate = qs('opt-filename-template').value || DEFAULTS.filenameTemplate
  const revealPasswords = qs('opt-reveal-passwords').checked
  const allowPaste = qs('opt-allow-paste').checked
  const enableRightClickByDefault = qs('opt-enable-rightclick').checked
  const preferOriginalFilename = qs('opt-prefer-original-filename').checked
  const forcedExtension = qs('opt-forced-extension').value || ''

  // Prefer sync storage so settings can sync between browsers; wrapper handles fallback
  if (storageClient) {
    try {
      await storageClient.set({ disableShelf, filenameTemplate, revealPasswords, allowPaste, enableRightClickByDefault, preferOriginalFilename, forcedExtension })
    } catch (e) {
      // noop — best effort
    }
  } else {
    await new Promise((resolve) => {
      try {
        chrome.storage.sync.set({ disableShelf, filenameTemplate, revealPasswords, allowPaste, enableRightClickByDefault, preferOriginalFilename, forcedExtension }, () => resolve())
      } catch (e) { resolve() }
    })
  }

  // tell background to apply shelf setting immediately
  const rt = optsAdapter && optsAdapter.runtime ? optsAdapter.runtime : (typeof chrome !== 'undefined' ? chrome.runtime : null)
  rt && rt.sendMessage && rt.sendMessage({ type: 'applyDisableShelf', value: disableShelf })

  const status = qs('status')
  status.textContent = 'Saved'
  setTimeout(() => { status.textContent = '' }, 1500)
}

function renderOptions(cfg = {}) {
  qs('opt-disable-shelf').checked = cfg.disableShelf
  qs('opt-filename-template').value = cfg.filenameTemplate || DEFAULTS.filenameTemplate
  qs('opt-reveal-passwords').checked = cfg.revealPasswords
  qs('opt-allow-paste').checked = cfg.allowPaste
  qs('opt-enable-rightclick').checked = cfg.enableRightClickByDefault
  qs('opt-prefer-original-filename').checked = cfg.preferOriginalFilename
  qs('opt-forced-extension').value = cfg.forcedExtension || ''
}

async function loadOptions() {
  if (storageClient) {
    try {
      const items = await storageClient.get(Object.keys(DEFAULTS).concat(['revealPasswords','allowPaste','enableRightClickByDefault']))
      const cfg = Object.assign({}, DEFAULTS, items)
      renderOptions(cfg)
      return
    } catch (e) {
      // fallback to callback API below
    }
  }
  try {
    chrome.storage.sync.get(Object.keys(DEFAULTS).concat(['revealPasswords','allowPaste','enableRightClickByDefault']), (items) => {
      const cfg = Object.assign({}, DEFAULTS, items)
      renderOptions(cfg)
    })
  } catch (e) {
    chrome.storage.local.get(Object.keys(DEFAULTS), (items2) => {
      const cfg = Object.assign({}, DEFAULTS, items2)
      renderOptions(cfg)
    })
  }
}

function attach() {
  qs('save-btn').addEventListener('click', saveOptions)
}

document.addEventListener('DOMContentLoaded', () => {
  attach()
  // loadOptions may be async
  loadOptions()
})

// Export functions for tests
if (typeof window !== 'undefined') {
  window.saveOptions = saveOptions
  window.loadOptions = loadOptions
  window.renderOptions = renderOptions
}
if (typeof global !== 'undefined') {
  global.saveOptions = saveOptions
  global.loadOptions = loadOptions
  global.renderOptions = renderOptions
}
