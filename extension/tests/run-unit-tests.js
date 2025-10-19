// Simple unit test runner: runs all *.test.js in this folder
const path = require('path')
const fs = require('fs')
const cp = require('child_process')

const testsDir = __dirname
const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js'))
if (files.length === 0) {
  console.log('No unit tests found')
  process.exit(0)
}

let failed = false
for (const f of files) {
  const p = path.join(testsDir, f)
  console.log('Running', f)
  try {
    cp.execFileSync(process.execPath, [p], { stdio: 'inherit' })
  } catch (e) {
    failed = true
  }
}
process.exit(failed ? 1 : 0)
