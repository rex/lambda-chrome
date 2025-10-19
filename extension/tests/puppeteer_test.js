/**
 * Puppeteer test harness for Lambda extension image download flows
 *
 * Purpose
 * - Launches a Chromium instance with the unpacked Lambda extension loaded.
 * - Opens a local fixture page that contains a visible <img> and a dynamically-created blob image.
 * - Triggers the content script via window.postMessage({ __lambda_msg: { type: 'probeAndDownloadVisible' } })
 *   which causes the content script to locate a visible image and ask the background service worker to download it.
 * - Waits for the downloaded file(s) to appear in a configured temporary download directory and performs assertions.
 *
 * Assertions performed
 * - At least one file appears in the download directory within a timeout.
 * - Filenames match a permissive image filename pattern (contain an extension common to images).
 * - The downloaded file has non-zero size.
 *
 * Extending this test
 * - To test real websites (Twitter/Reddit/Imgur) add navigation steps, optional login flows, and robust wait/selector logic.
 * - Use page.evaluate to trigger actions in-page, or use puppeteer's click()/keyboard.type() to interact with UI.
 * - For Twitter-like images, prefer triggering the extension with a direct image src (content script probe will normalize :large suffixes).
 *
 * Usage:
 *   npm install
 *   npm run test:e2e
 */

const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')
const os = require('os')

async function waitForFile(dir, timeout = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const files = fs.readdirSync(dir)
    if (files && files.length) return files
    await new Promise(r => setTimeout(r, 200))
  }
  return []
}

async function run() {
  const extensionPath = path.resolve(__dirname, '..')
  const downloadDir = path.resolve(__dirname, 'tmp-downloads')
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true })

  const useSystem = !!process.env.USE_SYSTEM_CHROME
  const headless = !!process.env.HEADLESS

  const launchOpts = { headless: headless }
  launchOpts.args = []

  if (!headless) {
    // load extension only in headful mode
    launchOpts.args.push(`--disable-extensions-except=${extensionPath}`)
    launchOpts.args.push(`--load-extension=${extensionPath}`)
    launchOpts.userDataDir = path.resolve(__dirname, 'tmp-profile')
  }

  if (useSystem) {
    // prefer system chrome to avoid downloading puppeteer Chromium
    const platform = os.platform()
    // common paths (macOS, linux, windows)
    const possible = []
    if (platform === 'darwin') possible.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    if (platform === 'linux') possible.push('/usr/bin/google-chrome', '/usr/bin/chromium-browser')
    if (platform === 'win32') possible.push('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    for (const p of possible) {
      if (fs.existsSync(p)) { launchOpts.executablePath = p; break }
    }
    if (!launchOpts.executablePath) console.warn('USE_SYSTEM_CHROME requested but executable not found; falling back to bundled Chromium')
  }

  const browser = await puppeteer.launch(launchOpts)

  const page = await browser.newPage()
  // Configure downloads to the test folder
  const client = await page.target().createCDPSession()
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir })


  // Define test scenarios
  const scenarios = [
    { name: 'local-fixture', url: 'file://' + path.resolve(__dirname, 'fixtures', 'test-page.html'), trigger: 'probeAndDownloadVisible' },
    // placeholders for live sites — replace with real URLs when running live tests
    { name: 'twitter-example', url: process.env.TWITTER_URL || 'https://twitter.com/', trigger: 'probeAndDownloadVisible' },
    { name: 'reddit-example', url: process.env.REDDIT_URL || 'https://www.reddit.com/', trigger: 'probeAndDownloadVisible' },
    { name: 'imgur-example', url: process.env.IMGUR_URL || 'https://imgur.com/', trigger: 'probeAndDownloadVisible' }
  ]

  for (const s of scenarios) {
    console.log('Running scenario', s.name, s.url)
    await page.goto(s.url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.warn('goto failed', e && e.message))

    // If headless, we cannot load extensions reliably; simulate content script behavior for local-fixture only
    if (headless) {
      if (s.name === 'local-fixture') {
        console.log('Headless mode: simulate probe trigger via page.evaluate')
        await page.evaluate(() => {
          // emulate the content script's visible-image probe that sends a background message
          const imgs = Array.from(document.getElementsByTagName('img')).filter(i => i.width > 10 && i.height > 10)
          const img = imgs[0]
          if (!img) return
          // create an XHR to download (simulate background)
          fetch(img.src, { method: 'GET' }).then(r => r.blob()).then(b => {
            // no-op: we can't save to disk from page context in headless; signal success via console
            console.log('__lambda_headless_sim_download__', img.src)
          }).catch(e => console.error('headless fetch failed', e))
        })
        // wait briefly for simulated action
        await page.waitForTimeout(1000)
        continue
      } else {
        console.log('Headless mode: skipping live-site scenario (requires extension/context and interactivity)')
        continue
      }
    }

    // In headful mode with extension loaded, use postMessage to trigger content script
    console.log('Triggering probe via postMessage')
    await page.evaluate(() => {
      window.postMessage({ __lambda_msg: { type: 'probeAndDownloadVisible' } }, '*')
    })

    console.log('Waiting for download to appear in', downloadDir)
    const files = await waitForFile(downloadDir, 15000)
    console.log('Files in download dir:', files)

    // Assertions (same as before)
    if (!files || files.length === 0) {
      console.error('Assertion failed: no files downloaded for scenario', s.name)
      await browser.close()
      process.exit(2)
    }

    const imgExtPattern = /\.(png|jpe?g|webp|gif|bmp|svg)$/i
    let passed = false
    for (const f of files) {
      const fp = path.join(downloadDir, f)
      try {
        const st = fs.statSync(fp)
        if (st.size > 0 && imgExtPattern.test(f)) {
          passed = true
          console.log('Found downloaded image for', s.name, ':', f, st.size)
          break
        }
      } catch (e) {}
    }

    if (!passed) {
      console.error('Assertion failed: no downloaded image file with expected extension and non-zero size for scenario', s.name)
      console.error('Files:', files)
      await browser.close()
      process.exit(3)
    }
  }

  console.log('Waiting for download to appear in', downloadDir)
  const files = await waitForFile(downloadDir, 15000)
  console.log('Files in download dir:', files)

  // Assertions
  if (!files || files.length === 0) {
    console.error('Assertion failed: no files downloaded')
    await browser.close()
    process.exit(2)
  }

  // Check file patterns and non-zero size
  const imgExtPattern = /\.(png|jpe?g|webp|gif|bmp|svg)$/i
  let passed = false
  for (const f of files) {
    const fp = path.join(downloadDir, f)
    try {
      const st = fs.statSync(fp)
      if (st.size > 0 && imgExtPattern.test(f)) {
        passed = true
        console.log('Found downloaded image:', f, st.size)
        break
      }
    } catch (e) {
      // ignore stat errors
    }
  }

  if (!passed) {
    console.error('Assertion failed: no downloaded image file with expected extension and non-zero size')
    console.error('Files:', files)
    await browser.close()
    process.exit(3)
  }

  await browser.close()
  console.log('Puppeteer e2e test passed')
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
