// Options page logic for Panacea extension

const DEFAULTS = {
  disableShelf: true,
  filenameTemplate: '{domain}/{basename}'
}

function qs(id) { return document.getElementById(id) }

async function saveOptions() {
  const disableShelf = qs('opt-disable-shelf').checked
  const filenameTemplate = qs('opt-filename-template').value || DEFAULTS.filenameTemplate

  // Prefer sync storage so settings can sync between browsers; fallback to local
  await new Promise((resolve) => {
    try {
      chrome.storage.sync.set({ disableShelf, filenameTemplate }, () => {
        if (chrome.runtime.lastError) {
          // fallback
          chrome.storage.local.set({ disableShelf, filenameTemplate }, () => resolve())
        } else resolve()
      })
    } catch (e) {
      chrome.storage.local.set({ disableShelf, filenameTemplate }, () => resolve())
    }
  })

  // tell background to apply shelf setting immediately
  chrome.runtime.sendMessage({ type: 'applyDisableShelf', value: disableShelf })

  const status = qs('status')
  status.textContent = 'Saved'
  setTimeout(() => { status.textContent = '' }, 1500)
}

function renderOptions(cfg = {}) {
  qs('opt-disable-shelf').checked = cfg.disableShelf
  qs('opt-filename-template').value = cfg.filenameTemplate || DEFAULTS.filenameTemplate
}

function loadOptions() {
  try {
    chrome.storage.sync.get(Object.keys(DEFAULTS), (items) => {
      if (chrome.runtime.lastError) {
        chrome.storage.local.get(Object.keys(DEFAULTS), (items2) => {
          const cfg = Object.assign({}, DEFAULTS, items2)
          renderOptions(cfg)
        })
      } else {
        const cfg = Object.assign({}, DEFAULTS, items)
        renderOptions(cfg)
      }
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
  loadOptions()
})
