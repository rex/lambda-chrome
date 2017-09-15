const imgDownloadMenuId = 'panacea-cm-dl-img'

// A generic onclick callback function.
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

chrome.contextMenus.onClicked.addListener(downloadResource)

chrome.commands.getAll((commands) => {
  // console.log('All registered commands', commands)
})

chrome.commands.onCommand.addListener((cmd) => {
  // console.log(`Command heard: ${cmd}`, cmd)
  switch (cmd) {
    case 'save-loaded-image':
      // console.log('SAVE LOADED IMAGE', cmd)
      chrome.tabs.getSelected((tab) => {
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
