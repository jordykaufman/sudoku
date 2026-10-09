import { digitLabel, h } from './dom.js';

// The two keypads under the board: large digits place a digit, small digits make pencil marks.
// `onDigit(digit, mode)` is called with mode 'place' or 'mark'. The game screen and the
// practice screen both use this.
export class Pads {
  constructor(onDigit) {
    const pad = (mode, title) => {
      const buttons = Array.from({ length: 9 }, (_, i) => h('button', { onclick: () => onDigit(i + 1, mode) }));
      const el = h('div', { class: 'pad-col' }, h('div', { class: 'pad-title' }, title), h('div', { class: `pad ${mode}` }, buttons));
      return { mode, buttons, el };
    };
    this.pads = [pad('place', 'Digit'), pad('mark', 'Pencil mark')];
    this.el = h('div', { class: 'pads' }, this.pads.map((p) => p.el));
  }

  // `countOf(digit)` says how many of a digit are placed, so that a digit with all nine placed
  // is shown in green. `marks` are the pencil marks of the selected cell, shaded on the pencil
  // mark pad so they can be turned off without looking at the cell. `state` shades the whole
  // row: 'solvable', 'unsolvable' or ''.
  render({ font, selectedDigit = 0, selectedMode = 'place', countOf = () => 0, marks = 0, state = '' }) {
    for (const { mode, buttons } of this.pads) {
      buttons.forEach((button, i) => {
        const digit = i + 1;
        button.textContent = digitLabel(digit, font);
        button.setAttribute('aria-label', `${mode === 'mark' ? 'pencil mark' : 'digit'} ${digit}`);
        const active = digit === selectedDigit && mode === selectedMode;
        const marked = mode === 'mark' && marks & (1 << i);
        const className = [active ? 'active' : '', countOf(digit) === 9 ? 'complete' : '', marked ? 'marked' : ''].join(' ').trim();
        if (button.className !== className) button.className = className;
      });
    }
    const className = `pads ${state}`.trim();
    if (this.el.className !== className) this.el.className = className;
  }
}
