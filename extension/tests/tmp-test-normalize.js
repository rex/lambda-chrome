const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(require('path').resolve(__dirname, '..', 'js', 'background.js'), 'utf8');
// Run code in a context and extract normalizeTwitterUrl
const context = { console, setTimeout, clearTimeout };
vm.createContext(context);
vm.runInContext(code + '\nthis.normalizeTwitterUrl = normalizeTwitterUrl;', context);
const fn = context.normalizeTwitterUrl;
if (typeof fn !== 'function') { console.error('normalizeTwitterUrl not found'); process.exit(2); }
const examples = [
  'https://pbs.twimg.com/media/G3hKysjWYAA15Xl?format=jpg&name=small',
  'https://pbs.twimg.com/media/G3hKysjWYAA15Xl?format=jpg&name=large',
  'https://pbs.twimg.com/media/G3hKysjWYAA15Xl.jpg',
  'https://pbs.twimg.com/media/G3hKysjWYAA15Xl',
];
for (const e of examples) {
  try {
    const r = fn(e, '');
    console.log('IN:', e, '\n=>', r, '\n');
  } catch (err) {
    console.error('ERR', err);
  }
}
