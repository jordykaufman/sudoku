// Offline support: caches every file the app needs, answers requests from the cache first,
// and replaces the cache when VERSION changes. test/sw.test.js checks that FILES lists every
// file the app loads.
const VERSION = '20260918-0924';
const CACHE = `sudoku-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'styles/app.css',
  'data/examples.json',
  'data/puzzles.json',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'src/app/board-view.js',
  'src/app/dom.js',
  'src/app/game.js',
  'src/app/highlights.js',
  'src/app/learn.js',
  'src/app/main.js',
  'src/app/play.js',
  'src/app/puzzles.js',
  'src/app/settings.js',
  'src/app/stats.js',
  'src/app/storage.js',
  'src/engine/board.js',
  'src/engine/generator.js',
  'src/engine/grid.js',
  'src/engine/hint.js',
  'src/engine/levels.js',
  'src/engine/logic.js',
  'src/engine/random.js',
  'src/engine/rating.js',
  'src/engine/solver.js',
  'src/engine/text.js',
  'src/engine/validate.js',
  'src/engine/techniques/advanced.js',
  'src/engine/techniques/chains.js',
  'src/engine/techniques/common.js',
  'src/engine/techniques/fish.js',
  'src/engine/techniques/index.js',
  'src/engine/techniques/intersections.js',
  'src/engine/techniques/order.js',
  'src/engine/techniques/singles.js',
  'src/engine/techniques/subsets.js',
  'src/engine/techniques/uniqueness.js',
  'src/engine/techniques/wings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('sudoku-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then((cached) => cached ?? fetch(event.request)));
});
