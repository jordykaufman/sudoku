import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname;

function filesUnder(dir, extension) {
  if (!existsSync(join(ROOT, dir))) return [];
  const files = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(path, extension));
    else if (entry.name.endsWith(extension)) files.push(path);
  }
  return files;
}

test('the service worker caches every file the app loads', () => {
  const source = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const listed = [...source.matchAll(/^\s+'([^']+)',$/gm)].map((match) => match[1]);
  const expected = [
    './',
    'index.html',
    'manifest.webmanifest',
    ...filesUnder('styles', '.css'),
    ...filesUnder('icons', '.png'),
    ...filesUnder('data', '.json'),
    ...filesUnder('src', '.js'),
  ];
  assert.deepEqual([...listed].sort(), [...expected].sort());
});
