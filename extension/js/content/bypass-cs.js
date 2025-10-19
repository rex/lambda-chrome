// Content script (isolated world) for Panacea: bypass site protections
// Runs at document_start in all frames

(function () {
  const DEFAULTS = {
    revealPasswords: false,
    allowPaste: true,
    enableRightClickByDefault: false
  }

  // Utility
  function safeGetSync(keys, cb) {
    try {
      chrome.storage.sync.get(keys, (items) => {
        if (chrome.runtime.lastError) {
          chrome.storage.local.get(keys, cb)
        } else cb(items)
      })
    } catch (e) {
      chrome.storage.local.get(keys, cb)
    }
  }

  // Apply password reveal to existing inputs
  function revealPasswords() {
    try {
      const inputs = document.querySelectorAll('input[type=password]')
      inputs.forEach((el) => {
        try { el.type = 'text' } catch (e) {}
      })
    } catch (e) {}
  }

  // Observe additions and attribute changes
  function observeForPasswords() {
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((n) => {
            if (n && n.querySelectorAll) {
              const ins = n.querySelectorAll('input[type=password]')
              ins.forEach((el) => { try { el.type = 'text' } catch(e){} })
            }
          })
        } else if (m.type === 'attributes' && m.attributeName === 'type') {
          const target = m.target
          if (target && target.getAttribute && target.getAttribute('type') === 'password') {
            try { target.type = 'text' } catch(e){}
          }
        }
      }
    })
    mo.observe(document.documentElement || document, { childList: true, subtree: true, attributes: true, attributeFilter: ['type'] })
  }

  // Prevent sites from blocking paste and right-click by intercepting capture phase and stopping propagation
  function enablePasteAndRightClick() {
    // remove inline handlers
    try { document.onpaste = null } catch (e) {}
    try { document.oncontextmenu = null } catch (e) {}

    // add capture-phase listeners to stop page handlers from preventing default
    window.addEventListener('paste', (e) => {
      // allow
    }, true)

    window.addEventListener('beforeinput', (e) => {
      // allow
    }, true)

    // ensure contextmenu is allowed
    window.addEventListener('contextmenu', (e) => {
      // allow default
    }, true)
  }

  // Run according to preferences
  safeGetSync(['revealPasswords','allowPaste','enableRightClickByDefault'], (items) => {
    const cfg = Object.assign({}, DEFAULTS, items)
    if (cfg.revealPasswords) {
      revealPasswords()
      observeForPasswords()
    }
    if (cfg.allowPaste || cfg.enableRightClickByDefault) {
      enablePasteAndRightClick()
    }
  })

  // Also listen for runtime messages to enable for current page
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return
    if (msg.type === 'applyBypassNow') {
      if (msg.revealPasswords) {
        revealPasswords(); observeForPasswords()
      }
      if (msg.allowPaste || msg.enableRightClick) {
        enablePasteAndRightClick()
      }
      sendResponse({ok:true})
    }
  })
})();
