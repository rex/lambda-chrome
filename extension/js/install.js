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

chrome.runtime.onInstalled.addListener(postInstall)
chrome.runtime.onStartup.addListener(postStartup)
