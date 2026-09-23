import { BOX, COL, POPCOUNT, ROW, bit } from '../engine/grid.js';
import { digitLabel, h, onPress } from './dom.js';

const SVG = 'http://www.w3.org/2000/svg';
const BLINK_MS = 950;

// The 9x9 board. `onCell(cell, held)` is called when a cell is tapped (held = false) or held.
export class BoardView {
  constructor(onCell) {
    this.cells = [];
    this.blinks = new Map(); // cell -> class name, while a blink animation runs
    this.blinkTimer = 0;
    this.onBlinkEnd = null;
    const boxes = Array.from({ length: 9 }, () => h('div', { class: 'box' }));
    for (let cell = 0; cell < 81; cell++) {
      const digit = h('span', { class: 'digit' });
      const marks = Array.from({ length: 9 }, () => h('span', { class: 'mark' }));
      const marksEl = h('div', { class: 'marks' }, marks);
      const el = h('div', { class: 'cell', 'aria-label': `R${ROW[cell] + 1}C${COL[cell] + 1}` }, digit, marksEl);
      onPress(el, (held) => onCell(cell, held));
      boxes[BOX[cell]].append(el);
      this.cells.push({ el, digit, marks, marksEl });
    }
    this.links = document.createElementNS(SVG, 'svg');
    this.links.setAttribute('class', 'links');
    this.el = h('div', { class: 'board-wrap' }, h('div', { class: 'board' }, boxes), this.links);
  }

  // view: { game, settings, selectedCell, highlightDigit, stage, wrong, clash, singles, fish }
  // `stage` is the hint stage being shown, or null. While a stage is shown its highlights
  // replace the normal digit highlighting. The selected cell is drawn either way, so a screen
  // that wants the selection hidden during a stage, as the game does during a hint, passes -1. `singles` and `fish` are cells to
  // mark for the highlighted digit (src/app/highlights.js); they are ignored during a hint.
  render({ game, settings, selectedCell = -1, highlightDigit = 0, stage = null, wrong = new Set(), clash = new Set(), singles = new Set(), fish = new Set() }) {
    const houses = new Set(stage?.houses ?? []);
    const cellRoles = new Map((stage?.cells ?? []).map(([cell, role]) => [cell, role]));
    const markRoles = new Map((stage?.marks ?? []).map(([cell, digit, role]) => [cell * 10 + digit, role]));
    // A digit a hint places is drawn full size and faded; other hint marks are drawn as pencil marks.
    const hintMarks = new Map();
    const placing = new Map();
    for (const [cell, digit, role] of stage?.marks ?? []) {
      if (role === 'place') placing.set(cell, digit);
      else hintMarks.set(cell, (hintMarks.get(cell) ?? 0) | bit(digit));
    }
    const hl = stage ? (stage.digit ?? 0) : settings.highlight ? highlightDigit : 0;
    const variable = settings.markStyle === 'variable';

    for (let cell = 0; cell < 81; cell++) {
      const { el, digit, marks, marksEl } = this.cells[cell];
      const value = game.values[cell];
      const shown = value ? 0 : game.shownMarks(cell);
      const cls = ['cell'];
      if (game.isGiven(cell)) cls.push('given');
      if (houses.has(ROW[cell]) || houses.has(9 + COL[cell]) || houses.has(18 + BOX[cell])) cls.push('house');
      if (cell === selectedCell) cls.push('selected');
      if (hl && value === hl) cls.push('hl-digit');
      if (hl && shown & bit(hl)) cls.push('hl-mark');
      if (hl && !stage && singles.has(cell)) cls.push('hl-single');
      if (hl && !stage && fish.has(cell)) cls.push('hl-fish');
      const role = cellRoles.get(cell);
      if (role) cls.push(role === 'a' || role === 'b' ? `color-${role}` : role);
      if (value && !game.isGiven(cell) && (wrong.has(cell) || clash.has(cell))) cls.push('wrong');
      if (this.blinks.has(cell)) cls.push(this.blinks.get(cell));
      const ghost = value ? 0 : placing.get(cell) ?? 0;
      if (ghost) cls.push('ghost');
      const className = cls.join(' ');
      if (el.className !== className) el.className = className;

      const label = value || ghost ? digitLabel(value || ghost, settings.font) : '';
      if (digit.textContent !== label) digit.textContent = label;

      const markMask = value ? 0 : shown | (hintMarks.get(cell) ?? 0);
      const count = POPCOUNT[markMask];
      marksEl.className = variable ? `marks variable${count <= 2 ? ' few' : count <= 4 ? ' some' : ''}` : 'marks';
      for (let d = 1; d <= 9; d++) {
        const span = marks[d - 1];
        const on = (markMask & bit(d)) !== 0;
        span.textContent = on ? digitLabel(d, settings.font) : '';
        span.style.display = variable && !on ? 'none' : '';
        const markRole = on ? markRoles.get(cell * 10 + d) : undefined;
        span.className = markRole ? `mark ${markRole}` : 'mark';
      }
    }
    requestAnimationFrame(() => this.drawLinks(stage?.links ?? []));
  }

  // Lines between candidates, for chains.
  drawLinks(links) {
    this.links.replaceChildren();
    if (!links.length) return;
    const origin = this.el.getBoundingClientRect();
    this.links.setAttribute('viewBox', `0 0 ${origin.width} ${origin.height}`);
    const centre = (cell, digit) => {
      const { el, marks } = this.cells[cell];
      const mark = marks[digit - 1];
      const rect = mark.style.display === 'none' || !mark.textContent ? el.getBoundingClientRect() : mark.getBoundingClientRect();
      return [rect.left + rect.width / 2 - origin.left, rect.top + rect.height / 2 - origin.top];
    };
    for (const [cellA, digitA, cellB, digitB, strong] of links) {
      const [x1, y1] = centre(cellA, digitA);
      const [x2, y2] = centre(cellB, digitB);
      const line = document.createElementNS(SVG, 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      if (!strong) line.setAttribute('class', 'weak');
      this.links.append(line);
    }
  }

  // Flashes the cells of completed houses, and every copy of a completed digit.
  blink(game, houses, digit) {
    for (const house of houses) {
      for (let cell = 0; cell < 81; cell++) {
        if (ROW[cell] === house || 9 + COL[cell] === house || 18 + BOX[cell] === house) this.blinks.set(cell, 'blink-house');
      }
    }
    if (digit) for (let cell = 0; cell < 81; cell++) if (game.values[cell] === digit) this.blinks.set(cell, 'blink-digit');
    if (!this.blinks.size) return;
    clearTimeout(this.blinkTimer);
    this.blinkTimer = setTimeout(() => {
      this.blinks.clear();
      this.onBlinkEnd?.();
    }, BLINK_MS);
  }
}
