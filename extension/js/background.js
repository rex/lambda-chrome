'use strict'

var disableShelf = function() {
  chrome.downloads.setShelfEnabled(false)
}

chrome.runtime.onInstalled.addListener(disableShelf)
chrome.runtime.onStartup.addListener(disableShelf)
