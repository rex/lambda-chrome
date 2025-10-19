<h1 align="center">
  <img src="https://github.com/rex/lambda-chrome/blob/master/extension/img/cyberpunk-glitch-lambda-logo.png"><br />
  lambda-chrome
</h1>

<p align="center">
The extension <strong>by</strong> <em>me</em>, <strong>for</strong> <em>me</em>, to tweak Chrome <em>juuuuuuust</em> the way I like it.
</p>

## Manifest V3 Migration

This extension has been updated to use **Manifest V3** for compatibility with modern Chrome browsers.

### Key Changes Made:

- Updated `manifest_version` from 2 to 3
- Replaced `background.scripts` with `background.service_worker`
- Changed `browser_action` to `action`
- Combined background scripts (`event.js` and `install.js`) into a single `background.js` service worker
- Updated deprecated API calls (e.g., `chrome.tabs.getSelected` → `chrome.tabs.query`)

### Features:

- **Context Menu Download**: Right-click on images to download them directly
- **Keyboard Shortcut**: `Ctrl+Shift+E` (or `Cmd+Shift+E` on Mac) to save the current image and close the tab
- **Twitter Image Enhancement**: Automatically downloads high-resolution versions of Twitter images
- **Download Shelf Management**: Automatically disables the Chrome download shelf
- **Options UI**: A dark-themed options page to toggle behaviors and set filename templates (`options.html`)
- **Filename Templating**: Use templates like `{domain}/{basename}` to organize downloads into folders and name files automatically
- **Download Notifications**: Desktop notifications on download complete or interrupted
- **Code Cleanup**: Consolidated background logic and removed legacy duplicated files for maintainability
