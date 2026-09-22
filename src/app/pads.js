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
  // is shown in green. `state` shades the whole row: 'solvable', 'unsolvable' or ''.
  render({ font, selectedDigit = 0, selectedMode = 'place', countOf = () => 0, state = '' }) {
    for (const { mode, buttons } of this.pads) {
      buttons.forEach((button, i) => {
        const digit = i + 1;
        button.textContent = digitLabel(digit, font);
        button.setAttribute('aria-label', `${mode === 'mark' ? 'pencil mark' : 'digit'} ${digit}`);
        const active = digit === selectedDigit && mode === selectedMode;
        const className = [active ? 'active' : '', countOf(digit) === 9 ? 'complete' : ''].join(' ').trim();
        if (button.className !== className) button.className = className;
      });
    }
    const className = `pads ${state}`.trim();
    if (this.el.className !== className) this.el.className = className;
  }
}
