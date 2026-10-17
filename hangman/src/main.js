import { h, svgBox } from './dom.js';
import { figureSvg, stepsFor } from './figure.js';
import {
  MAX_LENGTH, MAX_PARTS, MIN_PARTS,
  cleanWord, count, giveUp, guessLetter, guessWord, guesser, isLetter, misses, newMatch, newRound, nextRound,
  restoreMatch, scoreRound, shown, status, wordProblem,
} from './game.js';
import { load, save } from './storage.js';

const root = document.getElementById('app');
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const DEFAULT_NAMES = ['Player 1', 'Player 2'];
const NAME_LENGTH = 16;

const clampParts = (n) => (Number.isInteger(n) ? Math.min(MAX_PARTS, Math.max(MIN_PARTS, n)) : 8);

function loadSettings() {
  const saved = load('settings', {});
  const names = Array.isArray(saved.names) ? saved.names : [];
  return {
    names: DEFAULT_NAMES.map((name, i) => (typeof names[i] === 'string' ? names[i].slice(0, NAME_LENGTH) : '')),
    parts: clampParts(saved.parts),
  };
}

const app = {
  settings: loadSettings(),
  match: restoreMatch(load('match', null)),
  setup: false, // the setup screen is open over a match
  solving: false, // the box for guessing the whole word is open
  message: '', // what the last guess found
  fresh: false, // the last guess drew a part, so it is drawn in
};

const name = (player) => app.settings.names[player].trim() || DEFAULT_NAMES[player];
const plural = (n, word, words = `${word}s`) => `${n} ${n === 1 ? word : words}`;
const saveSettings = () => save('settings', app.settings);
const saveMatch = () => save('match', app.match);

// Text inputs with hidden characters, so the word isn't on show while it is typed. A password
// input would do it too, but Safari then offers to save the word as a password.
const MASK = typeof CSS !== 'undefined' && CSS.supports('-webkit-text-security', 'disc');

function render() {
  const { match } = app;
  let screen;
  if (!match || app.setup) screen = setupScreen();
  else if (!match.round) screen = wordScreen();
  else if (status(match.round) === 'playing') screen = guessScreen();
  else screen = overScreen();
  root.replaceChildren(screen);
  app.fresh = false;
  screen.querySelector('[autofocus]')?.focus();
}

const button = (label, onclick, className = 'button') => h('button', { type: 'button', class: className, onclick }, label);

// --- Setup: the players' names and the number of body parts.

function setupScreen() {
  const { settings, match } = app;
  const preview = h('div', { class: 'preview' });
  const caption = h('p', { class: 'muted center' });
  const value = h('output', { class: 'value' });
  const slider = h('input', {
    type: 'range', min: MIN_PARTS, max: MAX_PARTS, step: 1, value: settings.parts, 'aria-label': 'Body parts',
    oninput: () => setParts(Number(slider.value)),
  });
  const less = button('−', () => setParts(settings.parts - 1), 'step');
  const more = button('+', () => setParts(settings.parts + 1), 'step');
  less.setAttribute('aria-label', 'Fewer body parts');
  more.setAttribute('aria-label', 'More body parts');

  function setParts(parts) {
    settings.parts = clampParts(parts);
    slider.value = settings.parts;
    value.textContent = settings.parts;
    less.disabled = settings.parts === MIN_PARTS;
    more.disabled = settings.parts === MAX_PARTS;
    const steps = stepsFor(settings.parts);
    preview.replaceChildren(svgBox('figure-box', figureSvg(steps, steps.length)));
    caption.textContent = `${plural(settings.parts, 'wrong guess', 'wrong guesses')} complete the figure.`;
    saveSettings();
  }
  setParts(settings.parts);

  const nameInput = (player) =>
    h(
      'label',
      { class: 'field' },
      h('span', {}, `${DEFAULT_NAMES[player]} name`),
      h('input', {
        type: 'text', value: settings.names[player], placeholder: DEFAULT_NAMES[player], maxlength: NAME_LENGTH,
        autocomplete: 'off', autocapitalize: 'words', enterkeyhint: 'done',
        oninput: (event) => {
          settings.names[player] = event.target.value;
          saveSettings();
        },
      }),
    );

  const start = () => {
    app.match = newMatch();
    app.setup = false;
    saveMatch();
    render();
  };
  const resume = () => {
    app.setup = false;
    render();
  };

  return h(
    'main',
    { class: 'screen setup' },
    h('h1', {}, 'Hangman'),
    h('p', { class: 'muted' }, 'One player chooses a word and the other guesses it a letter at a time. Every wrong guess draws a body part. Take turns at choosing.'),
    nameInput(0),
    nameInput(1),
    h('div', { class: 'field' }, h('span', {}, 'Body parts'), h('div', { class: 'stepper' }, less, value, more), slider),
    preview,
    caption,
    match && h('p', { class: 'muted center' }, 'A new number of body parts starts with the next word.'),
    h(
      'div',
      { class: 'actions' },
      match ? button('Back to the game', resume, 'button primary') : button('Start', start, 'button primary'),
      match && button('New game, scores back to 0–0', start),
    ),
  );
}

// --- The scores, at the top of every screen of a match.

function topBar() {
  const { match } = app;
  const player = (i) =>
    h(
      'div',
      { class: `player${i === match.setter ? '' : ' guessing'}` },
      h('span', { class: 'name' }, name(i)),
      h('span', { class: 'score' }, match.scores[i]),
      h('span', { class: 'role' }, i === match.setter ? 'chooses' : 'guesses'),
    );
  const settings = button('Settings', () => {
    app.setup = true;
    app.solving = false;
    render();
  }, 'link');
  return h('header', { class: 'bar' }, h('div', { class: 'players' }, player(0), player(1)), settings);
}

// --- Choosing the word.

function wordScreen() {
  const { match, settings } = app;
  const word = h('input', {
    type: MASK ? 'text' : 'password', class: MASK ? 'masked' : '', maxlength: MAX_LENGTH + 10,
    autocomplete: 'off', autocorrect: 'off', autocapitalize: 'characters', spellcheck: 'false', enterkeyhint: 'go', autofocus: true,
  });
  const clue = h('input', { type: 'text', maxlength: 40, autocomplete: 'off', enterkeyhint: 'go' });
  const error = h('p', { class: 'error', role: 'alert' });
  const reveal = h('input', {
    type: 'checkbox',
    onchange: () => {
      if (MASK) word.classList.toggle('masked', !reveal.checked);
      else word.type = reveal.checked ? 'text' : 'password';
    },
  });

  const submit = (event) => {
    event.preventDefault();
    const text = cleanWord(word.value);
    const problem = wordProblem(text);
    if (problem) {
      error.textContent = problem;
      word.focus();
      return;
    }
    word.blur();
    clue.blur();
    match.round = newRound({ word: text, clue: clue.value.trim(), parts: settings.parts });
    app.message = '';
    saveMatch();
    render();
  };

  return h(
    'main',
    { class: 'screen' },
    topBar(),
    h('h2', {}, `${name(match.setter)}, choose a word`),
    h('p', { class: 'muted' }, `${name(guesser(match))}, look away.`),
    h(
      'form',
      { class: 'stack', onsubmit: submit, autocomplete: 'off' },
      h('label', { class: 'field' }, h('span', {}, 'Word or phrase'), word),
      h('label', { class: 'check' }, reveal, 'Show the word'),
      h('label', { class: 'field' }, h('span', {}, 'Clue (optional)'), clue),
      error,
      h('p', { class: 'muted' }, `The figure has ${plural(settings.parts, 'body part')}, one for each wrong guess.`),
      h('button', { type: 'submit', class: 'button primary' }, 'Start guessing'),
    ),
  );
}

// --- Guessing.

function figure(round, { lost = false } = {}) {
  const steps = stepsFor(round.parts);
  return svgBox('figure-box', figureSvg(steps, Math.min(misses(round), steps.length), { lost, fresh: app.fresh }));
}

// The word as slots, a word to a line where it fits. Slots are smaller for a longer phrase, so
// it takes fewer lines, and for a longer word, so the word fits across the screen. With
// `reveal`, the letters nobody guessed are shown too, marked as missed.
function wordView(round, reveal = false) {
  const words = round.word.split(' ');
  const longest = Math.max(...words.map((w) => w.length));
  const size = round.word.length > 24 ? 20 : round.word.length > 12 ? 24 : 30;
  const slot = (char) => {
    if (!isLetter(char)) return h('span', { class: 'slot mark' }, char);
    if (shown(round, char)) return h('span', { class: 'slot' }, char);
    return reveal ? h('span', { class: 'slot missed' }, char) : h('span', { class: 'slot' });
  };
  return h(
    'div',
    { class: 'word', style: `--longest: ${longest}; --size: ${size}px`, 'aria-label': [...round.word].map((c) => (shown(round, c) || reveal ? c : 'blank')).join(' ') },
    words.map((w) => h('span', { class: 'group' }, [...w].map(slot))),
  );
}

function afterGuess(result, found) {
  const { match } = app;
  if (result === null) return;
  app.fresh = result === 'miss';
  app.message = found;
  if (status(match.round) !== 'playing') {
    scoreRound(match);
    app.solving = false;
  }
  saveMatch();
  render();
}

function onLetter(letter) {
  const { round } = app.match;
  const result = guessLetter(round, letter);
  const n = count(round, letter);
  afterGuess(result, result === 'hit' ? `${n === 1 ? 'There is one' : `There are ${n}`} ${letter}${n === 1 ? '' : 's'}.` : `No ${letter}.`);
}

function keyboard(round) {
  const key = (letter) => {
    const used = round.letters.includes(letter);
    const state = used ? (round.word.includes(letter) ? ' hit' : ' miss') : '';
    return h('button', { type: 'button', class: `key${state}`, disabled: used, 'aria-label': letter, onclick: () => onLetter(letter) }, letter);
  };
  return h('div', { class: 'keyboard' }, KEY_ROWS.map((row) => h('div', { class: 'keys' }, [...row].map(key))));
}

function solveForm(round) {
  const input = h('input', {
    type: 'text', class: 'solve-input', maxlength: MAX_LENGTH + 10, autocomplete: 'off', autocorrect: 'off',
    autocapitalize: 'characters', spellcheck: 'false', enterkeyhint: 'go', autofocus: true, 'aria-label': 'The whole word',
  });
  const submit = (event) => {
    event.preventDefault();
    const text = cleanWord(input.value);
    const result = guessWord(round, text);
    if (result === null) {
      app.message = text ? `${text} was already wrong.` : '';
      input.select();
      return render();
    }
    input.blur();
    app.solving = false;
    afterGuess(result, result === 'hit' ? '' : `It isn't ${text}.`);
  };
  const cancel = () => {
    app.solving = false;
    render();
  };
  return h(
    'form',
    { class: 'solve', onsubmit: submit },
    h('p', { class: 'muted' }, 'A wrong guess draws a body part, like a wrong letter.'),
    input,
    h('div', { class: 'actions row' }, h('button', { type: 'submit', class: 'button primary' }, 'Guess'), button('Cancel', cancel)),
  );
}

function guessScreen() {
  const { match } = app;
  const { round } = match;
  const wrongWords = round.words.length > 0 && h('p', { class: 'muted center' }, `Not ${round.words.join(', ')}`);
  const giveUpNow = () => {
    if (!confirm(`Give up? ${name(match.setter)} gets the point.`)) return;
    giveUp(round);
    afterGuess('give up', '');
  };
  return h(
    'main',
    { class: 'screen play' },
    topBar(),
    h('p', { class: 'turn' }, `${name(guesser(match))} is guessing`, round.clue && h('span', { class: 'clue' }, `Clue: ${round.clue}`)),
    figure(round),
    h('p', { class: 'tally' }, `${misses(round)} of ${plural(round.parts, 'wrong guess', 'wrong guesses')}`),
    wrongWords,
    wordView(round),
    h('p', { class: 'message', 'aria-live': 'polite' }, app.message),
    app.solving ? solveForm(round) : keyboard(round),
    !app.solving &&
      h(
        'div',
        { class: 'actions row' },
        button('Guess the word', () => {
          app.solving = true;
          app.message = '';
          render();
        }),
        button('Give up', giveUpNow),
      ),
  );
}

// --- The end of a round.

function overScreen() {
  const { match } = app;
  const { round } = match;
  const won = status(round) === 'won';
  const wrong = misses(round);
  const next = guesser(match);
  let title;
  if (won) title = `${name(guesser(match))} guessed it`;
  else if (round.gaveUp) title = `${name(guesser(match))} gave up`;
  else title = `${name(match.setter)} wins the round`;
  const detail = won ? `${wrong} of ${plural(round.parts, 'wrong guess', 'wrong guesses')}.` : 'The word was';
  const nextRoundNow = () => {
    nextRound(match);
    saveMatch();
    render();
  };
  return h(
    'main',
    { class: 'screen play' },
    topBar(),
    h('h2', { class: `result ${won ? 'won' : 'lost'}` }, title),
    figure(round, { lost: !won }),
    h('p', { class: 'muted center' }, detail),
    wordView(round, true),
    round.clue && h('p', { class: 'muted center' }, `Clue: ${round.clue}`),
    h('div', { class: 'actions' }, button(`Next word: ${name(next)} chooses`, nextRoundNow, 'button primary')),
  );
}

// Letters typed on a hardware keyboard are guesses too.
document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest?.('input, textarea')) return;
  const round = app.match?.round;
  if (app.setup || app.solving || !round || status(round) !== 'playing') return;
  const letter = event.key.length === 1 ? event.key.toUpperCase() : '';
  if (!isLetter(letter) || round.letters.includes(letter)) return;
  event.preventDefault();
  onLetter(letter);
});

// Keeps an installed copy up to date, the way the Sudoku app does (keepUpdated in
// src/app/main.js there): the worker looks for new files whenever the page comes to the
// foreground and takes over once it has them, and the page then reloads. The game is saved
// after every move, so nothing is lost.
function keepUpdated() {
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!('serviceWorker' in navigator) || local) return;
  // The Sudoku app's worker can be in charge of this page until ours is installed, so only a
  // change from our own worker means new files.
  const ours = new URL('sw.js', document.baseURI).href;
  const hadWorker = navigator.serviceWorker.controller?.scriptURL === ours;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadWorker || reloading) return;
    reloading = true;
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
      // No service worker: the game still runs, but only online.
    });
}

render();
keepUpdated();
