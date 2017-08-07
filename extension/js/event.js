const imgDownloadMenuId = 'panacea-cm-dl-img'

// A generic onclick callback function.
function downloadResource(info, tab) {
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

  chrome.downloads.download({ url: url, filename: filename, saveAs: false })
}

chrome.contextMenus.onClicked.addListener(downloadResource)
