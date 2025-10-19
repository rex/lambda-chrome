function performDownload(adapter, candidate, callback = ()=>{}) {
  if (!candidate || !candidate.url) return
  if (!adapter || !adapter.downloads || !adapter.downloads.download) return
  adapter.downloads.download({ url: candidate.url, filename: candidate.filename, saveAs: false }, (downloadId) => {
    if (typeof callback === 'function') callback(downloadId)
  })
}

module.exports = { performDownload }
