import { DIGITS, POPCOUNT, ROW } from '../engine/grid.js';
import { LEVELS } from '../engine/levels.js';
import { techniqueById } from '../engine/techniques/index.js';
import { plural } from '../engine/text.js';
import { BoardView } from './board-view.js';
import { formatTime, h, onPress } from './dom.js';
import { fishCells, singleCells } from './highlights.js';
import { Pads } from './pads.js';

// The digit a hold on a cell places, or 0 when the hold should count as a tap. A cell with
// one pencil mark left can only be that digit, whatever is highlighted; otherwise the cell
// has to be shown as the only place left for the highlighted digit.
export function holdDigit({ value, marks, single, highlightDigit }) {
  if (value) return 0;
  if (POPCOUNT[marks] === 1) return DIGITS[marks][0];
  return single ? highlightDigit : 0;
}

// Four quick taps on the level name at the top make every move that the techniques up to this
// level allow. Nothing on the screen shows it.
const SOLVE_LEVEL = LEVELS.findIndex((level) => level.id === 'intricate');
const TAPS_TO_SOLVE = 4;
const TAP_GAP_MS = 700; // the longest pause between two of those taps


// The game screen. `app` provides: settings, saveGame(game), finishGame(game), openMenu()
// and openLesson(techniqueId).
export class PlayScreen {
  constructor(app, game) {
    this.app = app;
    this.game = game;
    this.selectedCell = -1;
    this.selectedDigit = 0;
    this.selectedMode = 'place'; // what the selected digit does to a cell: 'place' or 'mark'
    this.singles = new Set(); // cells shown as the only place left for the highlighted digit
    this.erasing = false;
    this.panel = 'pad'; // 'pad', 'menu' (hint options), 'hint', 'check' or 'note'
    this.hint = null;
    this.check = null; // the result of Check the board, while it is shown
    this.note = ''; // what the solving shortcut did, while it is shown
    this.titleTaps = 0;
    this.lastTitleTap = 0;
    this.stageIndex = 0;
    this.flash = ''; // 'solvable' or 'unsolvable' for a moment after asking
    this.ticks = 0;

    this.board = new BoardView((cell, held) => this.tapCell(cell, held));
    this.board.onBlinkEnd = () => this.render();
    this.title = h('div', { class: 'title' });
    onPress(this.title, (held) => {
      if (!held) this.tapTitle();
    });
    this.clock = h('div', { class: 'clock' });
    this.pads = new Pads((digit, mode) => this.tapDigit(digit, mode));
    this.padsEl = this.pads.el;
    this.eraseButton = h('button', { onclick: () => this.tapErase() }, 'Erase');
    this.undoButton = h('button', { onclick: () => this.change(() => this.game.undo()) }, 'Undo');
    this.redoButton = h('button', { onclick: () => this.change(() => this.game.redo()) }, 'Redo');
    this.hintButton = h('button', { onclick: () => this.openPanel('menu') }, 'Hint');
    this.tools = h('div', { class: 'tools' }, this.eraseButton, this.undoButton, this.redoButton, this.hintButton);
    this.controls = h('div', { class: 'controls' });
    this.el = h(
      'div',
      { class: 'play' },
      h('div', { class: 'topbar' }, h('button', { class: 'link', onclick: () => app.openMenu() }, 'Menu'), this.title, this.clock),
      this.board.el,
      this.controls,
    );
  }

  mount(container) {
    container.replaceChildren(this.el);
    this.last = performance.now();
    this.timer = setInterval(() => this.tick(), 1000);
    this.onVisibility = () => {
      if (document.hidden) {
        this.tick();
        this.app.saveGame(this.game);
      } else {
        this.last = performance.now();
        this.keepAwake();
      }
    };
    this.onKey = (event) => this.key(event);
    document.addEventListener('visibilitychange', this.onVisibility);
    document.addEventListener('keydown', this.onKey);
    this.keepAwake();
    this.render();
  }

  unmount() {
    this.tick();
    clearInterval(this.timer);
    clearTimeout(this.flashTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    document.removeEventListener('keydown', this.onKey);
    this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
    this.app.saveGame(this.game);
  }

  tick() {
    const now = performance.now();
    if (!document.hidden && !this.game.finished) this.game.elapsed += now - this.last;
    this.last = now;
    this.updateClock();
    if (++this.ticks % 10 === 0) this.app.saveGame(this.game);
  }

  async keepAwake() {
    if (!this.app.settings.awake || !('wakeLock' in navigator) || document.hidden) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      // The browser refused; the screen will dim as usual.
    }
  }

  sound() {
    if (!this.app.settings.sounds) return;
    try {
      this.audio ??= new AudioContext();
      const t = this.audio.currentTime;
      const osc = this.audio.createOscillator();
      const gain = this.audio.createGain();
      osc.frequency.value = 1100;
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.connect(gain).connect(this.audio.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    } catch {
      // No audio available.
    }
  }

  change(action) {
    if (action()) this.afterChange();
  }

  afterChange() {
    this.app.saveGame(this.game);
    this.render();
  }

  // `held` is true for a hold instead of a tap. Holding a cell places the digit it must
  // hold, when there is one; any other hold counts as a tap.
  tapCell(cell, held = false) {
    if (this.panel !== 'pad' || this.game.finished) return;
    if (this.erasing) {
      this.change(() => this.game.erase(cell));
      return;
    }
    if (held) {
      const digit = holdDigit({
        value: this.game.values[cell],
        marks: this.game.shownMarks(cell),
        single: this.singles.has(cell),
        highlightDigit: this.highlightDigit(),
      });
      if (digit) {
        this.act(cell, digit, false);
        return;
      }
    }
    const input = this.app.settings.input;
    if (input !== 'cell' && this.selectedDigit) {
      this.act(cell, this.selectedDigit, this.selectedMode === 'mark');
      return;
    }
    if (input === 'digit') return;
    this.selectedCell = this.selectedCell === cell ? -1 : cell;
    this.render();
  }

  // `mode` is the keypad the digit came from: 'place' or 'mark'.
  tapDigit(digit, mode) {
    if (this.panel !== 'pad' || this.game.finished) return;
    this.erasing = false;
    const input = this.app.settings.input;
    if (input !== 'digit' && this.selectedCell >= 0) {
      this.act(this.selectedCell, digit, mode === 'mark');
      return;
    }
    if (input === 'cell') return;
    if (this.selectedDigit === digit && this.selectedMode === mode) {
      this.selectedDigit = 0;
    } else {
      this.selectedDigit = digit;
      this.selectedMode = mode;
    }
    this.render();
  }

  // Places `digit` in `cell`, or toggles its pencil mark when `mark` is true.
  act(cell, digit, mark) {
    const settings = this.app.settings;
    if (mark) {
      if (this.game.toggleMark(cell, digit)) {
        this.sound();
        this.afterChange();
      }
      return;
    }
    const result = this.game.enter(cell, digit, settings);
    if (!result) return;
    this.sound();
    if (result.placed && settings.blink) this.board.blink(this.game, result.houses, result.digit);
    this.afterMove();
  }

  // Saves and redraws after a move, and ends the game when the move completed the board.
  afterMove() {
    if (this.game.checkFinished()) {
      this.selectedCell = -1;
      this.selectedDigit = 0;
      this.afterChange();
      this.app.finishGame(this.game);
      return;
    }
    this.afterChange();
  }

  tapErase() {
    if (this.selectedCell >= 0 && this.app.settings.input !== 'digit') {
      this.change(() => this.game.erase(this.selectedCell));
      return;
    }
    this.erasing = !this.erasing;
    this.selectedDigit = 0;
    this.render();
  }

  // Keyboard, for playing in a desktop browser: arrows move, a digit places it, Shift and a
  // digit make a pencil mark, Backspace erases.
  key(event) {
    if (this.panel !== 'pad' || event.metaKey || event.ctrlKey) return;
    const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    const code = /^(?:Digit|Numpad)([1-9])$/.exec(event.code ?? '');
    const digit = code ? Number(code[1]) : /^[1-9]$/.test(event.key) ? Number(event.key) : 0;
    if (event.key in moves) {
      const from = this.selectedCell < 0 ? 40 : this.selectedCell;
      const to = from + moves[event.key];
      if (to >= 0 && to < 81 && (Math.abs(moves[event.key]) === 9 || ROW[to] === ROW[from])) this.selectedCell = to;
      this.selectedDigit = 0;
      this.render();
    } else if (digit && this.selectedCell >= 0) {
      this.act(this.selectedCell, digit, event.shiftKey);
    } else if ((event.key === 'Backspace' || event.key === 'Delete') && this.selectedCell >= 0) {
      this.change(() => this.game.erase(this.selectedCell));
    } else {
      return;
    }
    event.preventDefault();
  }

  openPanel(panel) {
    this.panel = panel;
    this.render();
  }

  showHint() {
    this.hint = this.game.hint();
    this.stageIndex = 0;
    this.panel = this.hint.kind === 'solved' ? 'pad' : 'hint';
    this.afterChange();
  }

  stages() {
    return this.hint.kind === 'step' ? this.hint.step.stages : this.hint.stages;
  }

  moveStage(delta) {
    this.stageIndex = Math.max(0, Math.min(this.stages().length - 1, this.stageIndex + delta));
    this.render();
  }

  closeHint() {
    this.hint = null;
    this.panel = 'pad';
    this.render();
  }

  // Makes the move the hint describes, so the player does not have to copy it out.
  applyHint() {
    const result = this.game.applyHint(this.hint);
    this.hint = null;
    this.panel = 'pad';
    if (!result) {
      this.render();
      return;
    }
    this.sound();
    if (result.placed && this.app.settings.blink) this.board.blink(this.game, result.houses, result.digit);
    this.afterMove();
  }

  tapTitle() {
    const now = performance.now();
    this.titleTaps = now - this.lastTitleTap < TAP_GAP_MS ? this.titleTaps + 1 : 1;
    this.lastTitleTap = now;
    if (this.titleTaps < TAPS_TO_SOLVE) return;
    this.titleTaps = 0;
    this.autoSolve();
  }

  // Makes every move the techniques up to SOLVE_LEVEL allow, then says what it did.
  autoSolve() {
    if (this.panel !== 'pad' || this.game.finished) return;
    const result = this.game.autoSolve(SOLVE_LEVEL);
    const name = LEVELS[SOLVE_LEVEL].name;
    if (result.mistake) {
      this.note = 'There is a mistake on the board, so nothing was solved.';
    } else if (!result.steps) {
      this.note = `No technique up to the ${name} level applies here.`;
    } else {
      const placed = result.placed
        ? `, placing ${result.placed} ${plural(result.placed, 'digit', 'digits')}. The pencil marks show the candidates left.`
        : '. No digit could be placed, but the pencil marks now show the candidates left.';
      this.note = `Made every move the techniques up to the ${name} level allow${placed} Undo takes it all back. This game's time will not count in Statistics.`;
      this.sound();
    }
    this.selectedDigit = 0;
    this.selectedCell = -1;
    this.panel = 'note';
    this.afterMove();
  }

  closeNote() {
    this.note = '';
    this.panel = 'pad';
    this.render();
  }

  showCheck() {
    this.check = this.game.checkWork();
    this.panel = 'check';
    this.afterChange();
  }

  closeCheck() {
    this.check = null;
    this.panel = 'pad';
    this.render();
  }

  askSolvable() {
    this.flash = this.game.askSolvable() ? 'solvable' : 'unsolvable';
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.flash = '';
      this.render();
    }, 2000);
    this.panel = 'pad';
    this.afterChange();
  }

  highlightDigit() {
    if (this.selectedDigit) return this.selectedDigit;
    if (this.selectedCell >= 0) return this.game.values[this.selectedCell];
    return 0;
  }

  updateClock() {
    const { clock } = this.app.settings;
    const show = clock === 'always' || (clock === 'end' && this.game.finished);
    const text = show ? formatTime(this.game.seconds) : '';
    if (this.clock.textContent !== text) this.clock.textContent = text;
  }

  render() {
    const { game } = this;
    const settings = this.app.settings;
    this.title.textContent = `${LEVELS[game.level].name}${game.kind === 'daily' ? ' · Daily' : ''}`;
    this.updateClock();
    // The check result highlights its cells the way a hint stage does.
    const stage = this.panel === 'hint' ? this.stages()[this.stageIndex] : this.panel === 'check' ? this.check : null;
    const hl = this.highlightDigit();
    const extras = settings.highlight && hl && !stage && !game.finished;
    this.singles = extras && settings.singles ? singleCells(game, hl) : new Set();
    this.board.render({
      game,
      settings,
      // A hint or the board check draws its own highlights, which a selection would cover.
      selectedCell: stage ? -1 : this.selectedCell,
      highlightDigit: hl,
      stage,
      singles: this.singles,
      fish: extras && settings.fish ? fishCells(game, hl) : new Set(),
      clash: settings.mistakes === 'off' ? new Set() : game.clashCells(),
      // While the check is shown, the digits it calls wrong are drawn in red whatever the
      // Mark mistakes setting says.
      wrong: this.panel === 'check' ? new Set(this.check.wrong) : settings.mistakes === 'wrong' ? game.wrongCells() : new Set(),
    });
    this.renderControls();
  }

  renderControls() {
    const { game } = this;
    const settings = this.app.settings;

    if (this.panel === 'hint') {
      const stages = this.stages();
      const technique = this.hint.kind === 'step' && this.stageIndex > 0 ? techniqueById(this.hint.step.technique) : null;
      const variant = technique && this.hint.step.variant ? ` (${this.hint.step.variant})` : '';
      // The last stage says what to do, so More gives way to Apply, which does it.
      const last = this.stageIndex === stages.length - 1;
      this.controls.replaceChildren(
        h(
          'div',
          { class: 'panel' },
          technique && h('button', { class: 'name', onclick: () => this.app.openLesson(technique.id) }, technique.name + variant),
          h('div', { class: 'text' }, stages[this.stageIndex].text),
          h(
            'div',
            { class: 'buttons' },
            h('button', { onclick: () => this.moveStage(-1), disabled: this.stageIndex === 0 }, 'Back'),
            last
              ? h('button', { class: 'apply', onclick: () => this.applyHint() }, 'Apply')
              : h('button', { onclick: () => this.moveStage(1) }, 'More'),
            h('button', { onclick: () => this.closeHint() }, 'Done'),
          ),
        ),
      );
      return;
    }

    if (this.panel === 'check' || this.panel === 'note') {
      const [text, close] = this.panel === 'check' ? [this.check.text, () => this.closeCheck()] : [this.note, () => this.closeNote()];
      this.controls.replaceChildren(
        h('div', { class: 'panel' }, h('div', { class: 'text' }, text), h('div', { class: 'buttons' }, h('button', { onclick: close }, 'Done'))),
      );
      return;
    }

    if (this.panel === 'menu') {
      const done = (action) => () => {
        action();
        this.panel = 'pad';
        this.afterChange();
      };
      const items = [
        ['Hint', () => this.showHint()],
        ['Check the board', () => this.showCheck()],
        !settings.showSolvable && ['Is the board solvable?', () => this.askSolvable()],
        ['Undo until solvable', done(() => game.undoUntilSolvable())],
        settings.pencil !== 'auto' && ['Fill in pencil marks', done(() => game.fillMarks())],
        ['Show solution', () => {
          if (window.confirm('Show the solution as pencil marks? This adds 10 minutes to the clock.')) done(() => game.showSolution())();
        }],
        ['Back to puzzle', () => this.openPanel('pad')],
      ].filter(Boolean);
      this.controls.replaceChildren(
        h('div', { class: 'panel' }, h('div', { class: 'menu' }, items.map(([label, onclick]) => h('button', { onclick }, label)))),
      );
      return;
    }

    if (this.controls.firstChild !== this.padsEl) this.controls.replaceChildren(this.padsEl, this.tools);
    this.pads.render({
      font: settings.font,
      selectedDigit: this.selectedDigit,
      selectedMode: this.selectedMode,
      countOf: (digit) => game.digitCount(digit),
      state: settings.showSolvable ? (game.isSolvable() ? 'solvable' : 'unsolvable') : this.flash,
    });
    this.eraseButton.className = this.erasing ? 'active' : '';
    this.undoButton.disabled = game.undoStack.length === 0;
    this.redoButton.disabled = game.redoStack.length === 0;
    this.hintButton.disabled = game.finished;
  }
}
