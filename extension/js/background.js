// Panacea Chrome Extension - Manifest V3 Background Script
// Combines functionality from event.js and install.js

const imgDownloadMenuId = 'panacea-cm-dl-img'

// Helper functions from install.js
const disableShelf = () => {
  console.log('Disabling download shelf')
  chrome.downloads.setShelfEnabled(false)
};

const createContextMenu = () => {
  chrome.contextMenus.create({
    id: 'panacea-cm-dl-img',
    title: 'Download Image',
    contexts: [
      'image'
    ]
  }, () => {
    console.log('DL Image installed!', chrome.runtime.lastError)
  })
}

const postInstall = () => {
  disableShelf()
  createContextMenu()
}

const postStartup = () => {
  disableShelf()
}

// Download resource function from event.js (updated for MV3)
function downloadResource(info, tab, callback = () => {}) {
  var url = info['srcUrl'].replace(/\?.+$/gi, (match) => {
    // console.log("Match/1/2/3", match)
    return ''
  })

  var filename = url.substring(url.lastIndexOf('/')+1)

  if (url.startsWith('https://pbs.twimg.com/media')) {
    // console.log("Url is a twitter image", url)
    if (filename.endsWith('.jpg:large')) {
      // console.log('filename ends in jpg:large', filename)
      filename = filename.replace('.jpg:large', '.jpg');
    } else if (filename.endsWith('.jpg-large')) {
      // console.log('filename ends in jpg-large', filename)
      filename = filename.replace('.jpg-large', '.jpg');
    }
    if (!url.endsWith(':large')) {
      // console.log('url does not end in jpg:large', url)
      url = `${url}:large`
    }
  }

  console.log(`url: ${url}`)
  console.log(`filename: ${filename}`)

  // return false

  chrome.downloads.download({ url, filename, saveAs: false }, callback)
}

// Event listeners
chrome.runtime.onInstalled.addListener(postInstall)
chrome.runtime.onStartup.addListener(postStartup)

chrome.contextMenus.onClicked.addListener(downloadResource)

chrome.commands.getAll((commands) => {
  // console.log('All registered commands', commands)
})

chrome.commands.onCommand.addListener((cmd) => {
  // console.log(`Command heard: ${cmd}`, cmd)
  switch (cmd) {
    case 'save-loaded-image':
      // console.log('SAVE LOADED IMAGE', cmd)
      // Updated API call for MV3: chrome.tabs.getSelected is deprecated
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const tab = tabs[0];
        // console.log(`URL OF TAB: ${tab.url}`, tab)
        downloadResource({ srcUrl: tab.url }, tab, () => {
          // console.log('Download complete!')
          chrome.tabs.remove(tab.id, () => {
            // console.log('Tab closed!', tab)
          })
        })
      })
      break;
    default:
      console.error(`Invalid command? wtf? ${cmd}`)
      break;
  }
})