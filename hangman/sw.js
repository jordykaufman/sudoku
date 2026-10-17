// Offline support for Hangman: caches every file the game needs, answers requests from the
// cache first, and replaces the cache when VERSION changes. test/hangman.test.js checks that
// FILES lists every file the game loads. The Sudoku app's worker shares the origin, so this one
// keeps to caches named hangman-.
const VERSION = '20261017-0250';
const CACHE = `hangman-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'styles.css',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'src/dom.js',
  'src/figure.js',
  'src/game.js',
  'src/main.js',
  'src/storage.js',
];

// Fetched past the browser's cache, for the reason given in the Sudoku app's sw.js.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('hangman-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true, cacheName: CACHE }).then((cached) => cached ?? fetch(event.request)));
});
