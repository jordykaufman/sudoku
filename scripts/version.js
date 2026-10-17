// Sets VERSION in sw.js and hangman/sw.js to the current date and time, so that installed
// copies of the apps download the new files. Run before publishing:
//
//   node scripts/version.js

import { readFileSync, writeFileSync } from 'node:fs';

const pattern = /const VERSION = '[^']*';/;
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const version = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

for (const file of ['sw.js', 'hangman/sw.js']) {
  const path = new URL(`../${file}`, import.meta.url);
  const source = readFileSync(path, 'utf8');
  if (!pattern.test(source)) throw new Error(`VERSION not found in ${file}`);
  writeFileSync(path, source.replace(pattern, `const VERSION = '${version}';`));
  console.log(`${file} VERSION is now ${version}`);
}
