// Puppeteer test harness for Lambda extension image download flows
// Usage:
//   npm install
//   npm run test:e2e

const puppeteer = require('puppeteer')
const path = require('path')

async function run() {
  const extensionPath = path.resolve(__dirname, '..')
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  const page = await browser.newPage()
  // Test 1: Twitter image (note: use a real tweet URL with a visible image for a real run)
  console.log('Open a tweet with image and then close browser when satisfied')
  await page.goto('https://twitter.com/')

  // Pause for manual action / observation
  await page.waitForTimeout(20000)

  await browser.close()
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
