import { Board } from '../engine/board.js';
import { parseGrid } from '../engine/grid.js';
import { LEVELS, TECHNIQUE_LEVEL } from '../engine/levels.js';
import { techniqueById } from '../engine/techniques/index.js';
import { BoardView } from './board-view.js';
import { h } from './dom.js';

// Example positions for each technique, data/examples.json, made by scripts/bank.js:
//   { [technique id]: [{ values, cands, givens }] }
// `values` has 81 characters ('.' for empty), `cands` two base-36 characters per cell, and
// `givens` 81 characters with '1' for each clue.
let examples = null;

async function loadExamples() {
  if (examples) return examples;
  try {
    const response = await fetch('data/examples.json');
    if (response.ok) examples = await response.json();
  } catch {
    // No examples: the lesson shows its text only.
  }
  return examples ?? {};
}

function decode({ values, cands, givens }) {
  return new Board(
    parseGrid(values),
    Uint16Array.from({ length: 81 }, (_, i) => parseInt(cands.slice(i * 2, i * 2 + 2), 36)),
    Uint8Array.from(givens, (ch) => (ch === '1' ? 1 : 0)),
  );
}

// A technique's lesson, followed by example positions that step through the technique's hint.
export class LessonScreen {
  constructor(app, id, onBack) {
    this.app = app;
    this.technique = techniqueById(id);
    this.examples = [];
    this.exampleIndex = 0;
    this.stageIndex = 0;
    this.boardView = new BoardView(() => {});
    this.count = h('span', { class: 'count' });
    this.text = h('div', { class: 'text' });
    this.backButton = h('button', { onclick: () => this.moveStage(-1) }, 'Back');
    this.moreButton = h('button', { onclick: () => this.moveStage(1) }, 'More');
    this.nextButton = h('button', { onclick: () => this.showExample(this.exampleIndex + 1) }, 'Another');
    this.exampleEl = h(
      'div',
      { class: 'example', hidden: true },
      h('h2', {}, 'Example', this.count),
      this.boardView.el,
      h('div', { class: 'panel' }, this.text, h('div', { class: 'buttons' }, this.backButton, this.moreButton, this.nextButton)),
    );
    this.el = h(
      'div',
      { class: 'screen' },
      h('button', { class: 'link', onclick: onBack }, '‹ Back'),
      h('h1', {}, this.technique.name),
      h('h2', {}, `Level: ${LEVELS[TECHNIQUE_LEVEL.get(id)].name}`),
      (this.technique.lesson ?? []).map((paragraph) => h('p', {}, paragraph)),
      this.exampleEl,
    );
  }

  mount(root) {
    root.replaceChildren(this.el);
    loadExamples().then((all) => {
      for (const example of all[this.technique.id] ?? []) {
        const board = decode(example);
        const step = this.technique.find(board);
        if (step) this.examples.push({ board, step });
      }
      if (!this.examples.length) return;
      this.exampleEl.hidden = false;
      this.showExample(0);
    });
  }

  showExample(index) {
    this.exampleIndex = index % this.examples.length;
    this.stageIndex = 0;
    this.render();
  }

  moveStage(delta) {
    const { step } = this.examples[this.exampleIndex];
    this.stageIndex = Math.max(0, Math.min(step.stages.length - 1, this.stageIndex + delta));
    this.render();
  }

  render() {
    const { board, step } = this.examples[this.exampleIndex];
    const view = {
      values: board.values,
      isGiven: (cell) => board.givens[cell] === 1,
      shownMarks: (cell) => (board.values[cell] ? 0 : board.cands[cell]),
    };
    const stage = step.stages[this.stageIndex];
    this.boardView.render({ game: view, settings: this.app.settings, stage });
    this.count.textContent = this.examples.length > 1 ? ` ${this.exampleIndex + 1} of ${this.examples.length}` : '';
    this.text.textContent = stage.text;
    this.backButton.disabled = this.stageIndex === 0;
    this.moreButton.disabled = this.stageIndex === step.stages.length - 1;
    this.nextButton.disabled = this.examples.length < 2;
  }
}
