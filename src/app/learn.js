import { LEVELS, TECHNIQUE_LEVEL } from '../engine/levels.js';
import { techniqueById } from '../engine/techniques/index.js';
import { BoardView } from './board-view.js';
import { h } from './dom.js';
import { decode, loadExamples } from './examples.js';

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
      h('div', { class: 'list' }, h('button', { class: 'row', onclick: () => app.openPractice(id) }, 'Practice this technique', h('span', { class: 'sub' }, 'Position after position, with the answer a button away'))),
      this.exampleEl,
    );
  }

  mount(root) {
    root.replaceChildren(this.el);
    loadExamples().then((all) => {
      // A position where the technique is the next step shows it with nothing easier in the
      // way, which is clearer to learn from, so those come first.
      const examples = (all[this.technique.id] ?? []).slice().sort((a, b) => (b.next ? 1 : 0) - (a.next ? 1 : 0));
      for (const example of examples) {
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
