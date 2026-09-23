import { DIGITS, bit } from '../engine/grid.js';
import { techniqueById } from '../engine/techniques/index.js';
import { cellList, plural } from '../engine/text.js';
import { rearrange } from '../engine/transform.js';
import { BoardView } from './board-view.js';
import { h } from './dom.js';
import { decode, loadExamples } from './examples.js';
import { Pads } from './pads.js';
import { load, save } from './storage.js';

// Compares what the player has done with the position they started from and the step they are
// looking for. `right` counts the edits that belong to the step, and `wrong` lists the cells
// they changed that do not. The practice board never changes a cell the player did not touch,
// so every difference is the player's own.
export function practiceProgress(start, board, step) {
  const wantPlace = new Map(step.placements.map(([cell, digit]) => [cell, digit]));
  const wantRemove = new Set(step.eliminations.map(([cell, digit]) => cell * 10 + digit));
  const wrong = new Set();
  let right = 0;
  for (let cell = 0; cell < 81; cell++) {
    if (board.values[cell] !== start.values[cell]) {
      if (wantPlace.get(cell) === board.values[cell]) right++;
      else wrong.add(cell);
      continue;
    }
    if (board.values[cell]) continue;
    if (board.cands[cell] & ~start.cands[cell]) wrong.add(cell);
    for (const digit of DIGITS[start.cands[cell] & ~board.cands[cell]]) {
      if (wantRemove.has(cell * 10 + digit)) right++;
      else wrong.add(cell);
    }
  }
  return { done: !wrong.size && right === wantPlace.size + wantRemove.size, right, wrong: [...wrong] };
}

// Position after position where one technique applies, to practise finding it and making its
// move. `app` provides settings and openLesson(techniqueId).
export class PracticeScreen {
  constructor(app, id, onBack) {
    this.app = app;
    this.technique = techniqueById(id);
    this.positions = []; // a board for each example of this technique, rearranged when dealt
    this.index = 0;
    this.start = null; // the position as it was handed out
    this.board = null; // the position as the player has left it
    this.step = null;
    this.selectedCell = -1;
    this.selectedDigit = 0;
    this.selectedMode = 'mark';
    this.showPattern = load('practice-pattern', false); // skip the finding and mark the pattern
    this.answer = false;

    this.boardView = new BoardView((cell) => this.tapCell(cell));
    this.pads = new Pads((digit, mode) => this.tapDigit(digit, mode));
    this.count = h('div', { class: 'clock' });
    this.note = h('div', { class: 'practice-note' });
    this.patternButton = h('button', { onclick: () => this.togglePattern() });
    this.answerButton = h('button', { onclick: () => this.showAnswer() }, 'Answer');
    this.resetButton = h('button', { onclick: () => this.reset() }, 'Reset');
    this.nextButton = h('button', { onclick: () => this.show(this.index + 1) }, 'Another');
    this.tools = h('div', { class: 'tools' }, this.patternButton, this.answerButton, this.resetButton, this.nextButton);
    this.el = h(
      'div',
      { class: 'play practice' },
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'link', onclick: onBack }, '‹ Back'),
        h('button', { class: 'title link', onclick: () => app.openLesson(id) }, this.technique.name),
        this.count,
      ),
      this.boardView.el,
      this.note,
      h('div', { class: 'controls' }, this.pads.el, this.tools),
    );
  }

  mount(root) {
    root.replaceChildren(this.el);
    this.note.textContent = 'Looking for positions...';
    loadExamples().then((all) => {
      // A different order every time, so that coming back to a technique is not the same round
      // of positions in the same sequence.
      const examples = (all[this.technique.id] ?? []).slice();
      for (let i = examples.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [examples[i], examples[j]] = [examples[j], examples[i]];
      }
      for (const example of examples) {
        const position = decode(example);
        if (this.technique.find(position.clone())) this.positions.push(position);
      }
      if (!this.positions.length) {
        this.note.textContent = `There are no practice positions for ${this.technique.name} yet.`;
        return;
      }
      this.show(0);
    });
  }

  show(index) {
    this.index = index % this.positions.length;
    // Renaming the digits and rearranging the rows and columns leaves the technique where it
    // was, on cells that have moved, so a position never comes up looking the same twice.
    const position = this.positions[this.index];
    let start = rearrange(position);
    let step = this.technique.find(start.clone());
    if (!step) {
      start = position.clone();
      step = this.technique.find(start.clone());
    }
    this.start = start;
    this.board = start.clone();
    this.step = step;
    this.selectedCell = -1;
    this.selectedDigit = 0;
    this.answer = false;
    this.render();
  }

  reset() {
    this.board = this.start.clone();
    this.selectedCell = -1;
    this.answer = false;
    this.render();
  }

  togglePattern() {
    this.showPattern = !this.showPattern;
    save('practice-pattern', this.showPattern);
    this.render();
  }

  showAnswer() {
    this.answer = true;
    this.render();
  }

  tapCell(cell) {
    if (!this.board) return;
    if (this.selectedDigit) this.edit(cell, this.selectedDigit, this.selectedMode);
    else this.selectedCell = this.selectedCell === cell ? -1 : cell;
    this.render();
  }

  tapDigit(digit, mode) {
    if (!this.board) return;
    if (this.selectedCell >= 0) {
      this.edit(this.selectedCell, digit, mode);
    } else if (this.selectedDigit === digit && this.selectedMode === mode) {
      this.selectedDigit = 0;
    } else {
      this.selectedDigit = digit;
      this.selectedMode = mode;
    }
    this.render();
  }

  // Places a digit or turns a pencil mark on and off. Clues and solved cells stay as they are.
  edit(cell, digit, mode) {
    if (this.board.givens[cell]) return;
    if (mode === 'place') {
      if (this.board.values[cell] === digit) {
        this.board.values[cell] = 0;
        this.board.cands[cell] = this.start.cands[cell];
      } else if (!this.board.values[cell] || !this.start.values[cell]) {
        this.board.values[cell] = digit;
        this.board.cands[cell] = 0;
      }
      return;
    }
    if (this.board.values[cell]) return;
    this.board.cands[cell] ^= bit(digit);
  }

  render() {
    const settings = this.app.settings;
    if (!this.board) return;
    const { done, wrong } = practiceProgress(this.start, this.board, this.step);
    const name = this.technique.name + (this.step.variant ? ` (${this.step.variant})` : '');
    const view = {
      values: this.board.values,
      givens: this.board.givens,
      isGiven: (cell) => this.board.givens[cell] === 1,
      shownMarks: (cell) => (this.board.values[cell] ? 0 : this.board.cands[cell]),
    };

    const mistakes = wrong.map((cell) => [cell, 'mistake']);
    const source = this.answer || done ? this.step.stages.at(-1) : this.showPattern ? this.step.stages[1] : null;
    const stage = source
      ? { ...source, cells: [...(source.cells ?? []), ...mistakes] }
      : mistakes.length
        ? { digit: this.selectedDigit, cells: mistakes }
        : null;
    this.boardView.render({
      game: view,
      settings,
      selectedCell: this.selectedCell,
      highlightDigit: this.selectedDigit,
      stage,
    });

    let note;
    if (done) note = `Right. ${this.step.stages.at(-1).text}`;
    else if (this.answer) note = this.step.stages.at(-1).text;
    else if (wrong.length) note = `${cellList(wrong)} ${plural(wrong.length, 'is', 'are')} not part of this ${this.technique.name}.`;
    else if (this.showPattern) note = `The ${name} is marked. Make the move it allows.`;
    else note = `Find the ${name} in this position, then make the move it allows.`;
    this.note.textContent = note;
    this.note.className = `practice-note${done ? ' done' : wrong.length ? ' wrong' : ''}`;

    this.count.textContent = `${this.index + 1} of ${this.positions.length}`;
    // One label either way, green while it is on, as the Erase button does in the game.
    this.patternButton.textContent = 'Pattern';
    this.patternButton.className = this.showPattern ? 'active' : '';
    this.answerButton.disabled = this.answer || done;
    this.pads.render({
      font: settings.font,
      selectedDigit: this.selectedDigit,
      selectedMode: this.selectedMode,
      countOf: (digit) => this.board.values.reduce((n, v) => n + (v === digit ? 1 : 0), 0),
    });
  }
}
