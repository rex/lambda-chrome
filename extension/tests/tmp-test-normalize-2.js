const fs = require('fs');
const code = fs.readFileSync('extension/js/background.js','utf8');
const re = /function normalizeTwitterUrl\([\s\S]*?\n\}/m;
const m = code.match(re);
if (!m) { console.error('not found'); process.exit(2); }
const fnSrc = m[0];
const wrapped = '(' + fnSrc + ')';
const fn = eval(wrapped);
const examples = [
  'https://pbs.twimg.com/media/G3hKysjWYAA15Xl?format=jpg&name=small',
  'https://pbs.twimg.com/media/G3hKysjWYAA15Xl?format=jpg&name=large',
  'https://pbs.twimg.com/media/G3hKysjWYAA15Xl.jpg',
  'https://pbs.twimg.com/media/G3hKysjWYAA15Xl',
];
for (const e of examples) {
  console.log('IN:', e, '\n=>', fn(e, ''))
}
