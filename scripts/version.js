// Sets VERSION in sw.js to the current date and time, so that installed copies of the app
// download the new files. Run before publishing:
//
//   node scripts/version.js

import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../sw.js', import.meta.url);
const pattern = /const VERSION = '[^']*';/;
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const version = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

const source = readFileSync(path, 'utf8');
if (!pattern.test(source)) throw new Error('VERSION not found in sw.js');
writeFileSync(path, source.replace(pattern, `const VERSION = '${version}';`));
console.log(`sw.js VERSION is now ${version}`);
