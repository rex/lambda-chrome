// Content script (isolated world) for Lambda: bypass site protections
// Runs at document_start in all frames

/**
 * Content script to bypass common site protections.
 *
 * - Reveals password inputs (converts type=password -> type=text) when enabled.
 * - Enables paste and context-menu actions by preventing page handlers from
 *   intercepting these events.
 *
 * The script reads preferences from `chrome.storage.sync` (with local fallback)
 * and responds to runtime messages `{type: 'applyBypassNow', ...}` to apply
 * settings immediately for the current page.
 */
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

  /**
   * Convert existing password inputs to plain text for visibility.
   */
  function revealPasswords() {
    try {
      const inputs = document.querySelectorAll('input[type=password]')
      inputs.forEach((el) => {
        try { el.type = 'text' } catch (e) {}
      })
    } catch (e) {}
  }

  /**
   * Observe DOM mutations to convert newly-added password inputs to text.
   */
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

  /**
   * Ensure paste and context-menu actions are allowed by clearing inline
   * handlers and adding capture-phase listeners that prevent page handlers
   * from blocking default behavior.
   */
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

  // Also accept window.postMessage calls from page for testing/automation
  window.addEventListener('message', (ev) => {
    try {
      const msg = ev.data && ev.data.__lambda_msg
      if (!msg) return
      if (msg.type === 'applyBypassNow') {
        if (msg.revealPasswords) { revealPasswords(); observeForPasswords() }
        if (msg.allowPaste || msg.enableRightClick) enablePasteAndRightClick()
      }
    } catch (e) {}
  })
})();
