import { LEVELS, TECHNIQUE_LEVEL } from '../engine/levels.js';
import { techniqueById } from '../engine/techniques/index.js';
import { ORDER } from '../engine/techniques/order.js';
import { formatTime, h } from './dom.js';
import { Game } from './game.js';
import { LessonScreen } from './learn.js';
import { PlayScreen } from './play.js';
import { PracticeScreen } from './practice.js';
import { getPuzzle, today } from './puzzles.js';
import { SETTINGS, loadSettings, saveSettings } from './settings.js';
import { dailyDone, loadStats, recordFinish, recordStart, resetStats } from './stats.js';
import { load, remove, save } from './storage.js';

const root = document.getElementById('app');

const app = {
  settings: loadSettings(),
  stats: loadStats(),
  game: null,
  play: null,
  screen: null,
  saveGame(game) {
    save('current', game);
  },
  finishGame(game) {
    recordFinish(this.stats, game);
    showFinished(game);
  },
  openMenu() {
    showHome();
  },
  openLesson(id) {
    showLesson(id, resumeGame);
  },
  openPractice(id) {
    showPractice(id, () => showLesson(id, () => showLearn(showHome)));
  },
};

function show(screen, { keepScroll = false } = {}) {
  if (app.screen !== screen) app.screen?.unmount?.();
  app.screen = screen;
  if (screen.mount) screen.mount(root);
  else root.replaceChildren(screen.el);
  if (!keepScroll) window.scrollTo(0, 0);
}

const page = (...children) => ({ el: h('div', { class: 'screen' }, children) });

const row = (label, sub, onclick, extra = '') =>
  h('button', { class: `row ${extra}`.trim(), onclick, disabled: !onclick }, label, sub && h('span', { class: 'sub' }, sub));

const back = (onclick) => h('button', { class: 'link', onclick }, '‹ Back');

function applyAppearance() {
  document.documentElement.className = `skin-${app.settings.skin} font-${app.settings.font}`;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

const inProgress = (game) => game && !game.finished && game.values.some((v, cell) => v && !game.isGiven(cell));

function showHome() {
  const game = app.game;
  const saved = load('saved', null);
  show(
    page(
      h('h1', {}, 'Sudoku'),
      h(
        'div',
        { class: 'list' },
        game && !game.finished && row(`Continue ${LEVELS[game.level].name}`, `${game.kind === 'daily' ? 'Daily game' : 'Random game'} · ${formatTime(game.seconds)}`, resumeGame),
        row('New game', 'Choose a level', showNewGame),
        game && !game.finished && row('Save this position', 'You can come back to it with Restore', savePosition),
        saved && row('Restore saved position', `${LEVELS[saved.level].name} · ${formatTime(Math.floor(saved.elapsed / 1000) + saved.penalty)}`, restoreSaved),
        row('Learn', 'The techniques, level by level', () => showLearn(showHome)),
        row('Practice', 'One technique, position after position', () => showPracticeList(showHome)),
        row('Statistics', null, showStats),
        row('Settings', null, showSettings),
      ),
    ),
  );
}

function showNewGame() {
  const kind = load('kind', 'random');
  const date = today();
  const choose = (value) => () => {
    save('kind', value);
    showNewGame();
  };
  const levels = LEVELS.map((level, index) => {
    const names = ORDER.filter((id) => TECHNIQUE_LEVEL.get(id) === index).map((id) => techniqueById(id)?.name ?? id);
    const done = kind === 'daily' && dailyDone(app.stats, date, index);
    return row(level.name, names.join(', '), () => newGame(index, kind, date), done ? 'done' : '');
  });
  show(
    page(
      back(showHome),
      h('h1', {}, 'New game'),
      h(
        'div',
        { class: 'segmented' },
        h('button', { class: kind === 'random' ? 'on' : '', onclick: choose('random') }, 'Random'),
        h('button', { class: kind === 'daily' ? 'on' : '', onclick: choose('daily') }, 'Daily'),
      ),
      h('h2', {}, kind === 'daily' ? `One game per level for ${date}` : 'A new game at any level'),
      h('div', { class: 'list' }, levels),
    ),
  );
}

function newGame(level, kind, date) {
  if (inProgress(app.game) && !window.confirm('Start a new game? The game in progress will be lost.')) return;
  show(page(h('p', {}, 'Getting a puzzle...')));
  getPuzzle({ level, kind, date }).then((made) => {
    if (!made) {
      window.alert('No puzzle was found. Please try again.');
      showNewGame();
      return;
    }
    const game = new Game({
      kind,
      level: made.level,
      date: kind === 'daily' ? date : null,
      puzzle: made.puzzle,
      solution: made.solution,
      pencilMode: app.settings.pencil,
    });
    recordStart(app.stats, game);
    startGame(game);
  });
}

function startGame(game) {
  app.game = game;
  app.play = new PlayScreen(app, game);
  app.saveGame(game);
  show(app.play);
}

function resumeGame() {
  if (!app.game) {
    showHome();
    return;
  }
  if (!app.play || app.play.game !== app.game) app.play = new PlayScreen(app, app.game);
  show(app.play);
}

function savePosition() {
  save('saved', app.game);
  showHome();
}

function restoreSaved() {
  const saved = load('saved', null);
  if (!saved) return;
  if (inProgress(app.game) && !window.confirm('Restore the saved position? The game in progress will be replaced.')) return;
  if (!app.settings.keepSaved) remove('saved');
  const game = new Game(saved);
  game.setPencilMode(app.settings.pencil);
  startGame(game);
}

function showFinished(game) {
  const level = LEVELS[game.level];
  const best = app.stats.levels[level.id]?.bestSeconds;
  const close = () => overlay.remove();
  const overlay = h(
    'div',
    { class: 'overlay' },
    h(
      'div',
      { class: 'sheet' },
      h('h2', {}, 'Solved'),
      h('div', { class: 'sub' }, `${level.name} in ${formatTime(game.seconds)}${game.penalty ? `, including ${formatTime(game.penalty)} added for help` : ''}.`),
      best !== null && best !== undefined && h('div', { class: 'sub' }, `Your best time at this level: ${formatTime(best)}.`),
      game.hints > 0 && h('div', { class: 'sub' }, `Hints used: ${game.hints}.`),
      h('button', { class: 'row', onclick: () => { close(); showNewGame(); } }, 'New game'),
      h('button', { class: 'row', onclick: () => { close(); showHome(); } }, 'Menu'),
      h('button', { class: 'row', onclick: close }, 'Look at the board'),
    ),
  );
  document.body.append(overlay);
}

function showSettings() {
  const items = SETTINGS.map((setting) => {
    const value = app.settings[setting.key];
    const set = (next) => {
      app.settings[setting.key] = next;
      saveSettings(app.settings);
      if (setting.key === 'pencil' && app.game) {
        app.game.setPencilMode(next);
        app.saveGame(app.game);
      }
      applyAppearance();
      showSettings();
    };
    const help = setting.help && h('div', { class: 'sub' }, setting.help);
    if (setting.type === 'switch') {
      return h(
        'div',
        { class: 'setting' },
        h('label', { onclick: () => set(!value) }, h('span', {}, setting.label), h('span', { class: `switch${value ? ' on' : ''}`, role: 'switch', 'aria-checked': String(value) })),
        help,
      );
    }
    return h(
      'div',
      { class: 'setting' },
      h('div', {}, setting.label),
      h(
        'div',
        { class: `segmented${setting.choices.length > 3 ? ' wrap' : ''}` },
        setting.choices.map(([choice, label]) => h('button', { class: choice === value ? 'on' : '', onclick: () => set(choice) }, label)),
      ),
      help,
    );
  });
  const target = app.game && !app.game.finished ? resumeGame : showHome;
  showSettings.screen = page(back(target), h('h1', {}, 'Settings'), h('div', { class: 'list' }, items));
  // Re-rendering after a change builds a new page object, so show it in place of the old one.
  show(showSettings.screen, { keepScroll: app.screen?.isSettings });
  showSettings.screen.isSettings = true;
}

function showStats() {
  const rows = LEVELS.map((level) => {
    const s = app.stats.levels[level.id];
    return h(
      'tr',
      {},
      h('td', {}, level.name),
      h('td', {}, s?.finished ?? 0),
      h('td', {}, s?.bestSeconds !== null && s?.bestSeconds !== undefined ? formatTime(s.bestSeconds) : '-'),
      h('td', {}, s?.timed ? formatTime(Math.round(s.totalSeconds / s.timed)) : '-'),
      h('td', {}, s?.hints ?? 0),
    );
  });
  show(
    page(
      back(showHome),
      h('h1', {}, 'Statistics'),
      h(
        'table',
        { class: 'stats' },
        h('thead', {}, h('tr', {}, ['Level', 'Solved', 'Best', 'Average', 'Hints'].map((title) => h('th', {}, title)))),
        h('tbody', {}, rows),
      ),
      h('p', { class: 'sub' }, 'Times include the time added for help. Best and average times leave out games where you used Show solution.'),
      h('div', { class: 'list' }, row('Reset statistics', null, () => {
        if (window.confirm('Reset all statistics?')) {
          app.stats = resetStats();
          showStats();
        }
      })),
    ),
  );
}

// The techniques, grouped by the level that adds them. `onPick(id)` opens one.
function techniqueSections(onPick) {
  return LEVELS.flatMap((level, index) => {
    const ids = ORDER.filter((id) => TECHNIQUE_LEVEL.get(id) === index);
    if (!ids.length) return [];
    return [
      h('h2', {}, level.name),
      h(
        'div',
        { class: 'list' },
        ids.map((id) => {
          const technique = techniqueById(id);
          return row(technique?.name ?? id, technique ? null : 'Not written yet', technique && (() => onPick(id)));
        }),
      ),
    ];
  });
}

function showLearn(onBack) {
  show(
    page(
      back(onBack),
      h('h1', {}, 'Learn'),
      h('p', {}, 'Each level adds the techniques listed under it. A level can also need any technique from an easier level.'),
      techniqueSections((id) => showLesson(id, () => showLearn(onBack))),
    ),
  );
}

function showPracticeList(onBack) {
  show(
    page(
      back(onBack),
      h('h1', {}, 'Practice'),
      h('p', {}, 'Pick a technique. Each position has that technique in it, waiting to be found and played. Use Pattern to have it marked for you, and practise making the move alone.'),
      techniqueSections(showPracticeFromList(onBack)),
    ),
  );
}

const showPracticeFromList = (onBack) => (id) => showPractice(id, () => showPracticeList(onBack));

function showPractice(id, onBack) {
  if (techniqueById(id)) show(new PracticeScreen(app, id, onBack));
}

function showLesson(id, onBack) {
  if (techniqueById(id)) show(new LessonScreen(app, id, onBack));
}

function boot() {
  applyAppearance();
  const current = load('current', null);
  if (current) {
    try {
      app.game = new Game(current);
      app.game.setPencilMode(app.settings.pencil);
    } catch {
      remove('current');
    }
  }
  if (app.game && !app.game.finished) resumeGame();
  else showHome();

  window.addEventListener('pagehide', saveProgress);

  stopZoom();
  keepUpdated();
}

// Keeps the page at the size it opens at. The viewport tag in index.html and touch-action in
// app.css ask for that, but Safari lets people pinch to zoom anyway, so pinches are cancelled
// here: Safari's own gesture events, and any touch move with two or more fingers.
function stopZoom() {
  for (const type of ['gesturestart', 'gesturechange']) {
    document.addEventListener(type, (event) => event.preventDefault());
  }
  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) event.preventDefault();
    },
    { passive: false },
  );
}

function saveProgress() {
  if (app.screen === app.play) app.play?.tick();
  if (app.game) app.saveGame(app.game);
}

// Keeps an installed copy up to date. Tapping the Home Screen icon usually resumes the page
// that is already running, so the app asks the service worker to look for new files whenever
// it comes to the foreground. The worker replaces its cache as soon as it has them all and
// takes over, and the app then saves the game and loads the new files.
function keepUpdated() {
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!('serviceWorker' in navigator) || local) return;
  // Without a worker yet, the first one takes over with nothing new to show.
  const hadWorker = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadWorker || reloading) return;
    reloading = true;
    saveProgress();
    location.reload();
  });
  navigator.serviceWorker
    .register('sw.js', { updateViaCache: 'none' })
    .then((registration) => {
      const check = () => {
        if (!document.hidden) registration.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', check);
      check();
    })
    .catch(() => {
      // No service worker: the app still runs, but only online.
    });
}

boot();
