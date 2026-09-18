import { load, save } from './storage.js';

// Every setting, its choices and its default. The screen in main.js is built from this list.
export const SETTINGS = [
  { key: 'input', label: 'Input', choices: [['hybrid', 'Either'], ['digit', 'Digit first'], ['cell', 'Cell first']], default: 'hybrid',
    help: 'Digit first: pick a digit, then tap cells. Cell first: pick a cell, then tap digits. Either: whichever you tap first.' },
  { key: 'pencil', label: 'Pencil marks', choices: [['manual', 'Manual'], ['erase', 'Auto erase'], ['auto', 'Automatic']], default: 'erase',
    help: 'Auto erase removes a pencil mark when you place that digit in the same row, column or block. Automatic shows every digit the placed digits allow; you can still turn marks off.' },
  { key: 'mistakes', label: 'Mark mistakes', choices: [['off', 'Off'], ['clash', 'Clashes'], ['wrong', 'Wrong digits']], default: 'clash',
    help: 'Clashes shows a digit in red when its row, column or block already has it. Wrong digits shows any digit that is not in the solution, and adds time for each one.' },
  { key: 'highlight', label: 'Highlight', type: 'switch', default: true,
    help: 'Shades the cells that hold the selected digit, and the cells with a pencil mark for it.' },
  { key: 'singles', label: 'Show singles', type: 'switch', default: true,
    help: 'With a digit highlighted, a cell that is the only place left for it in its row, column or block, or whose only pencil mark is that digit, gets a stronger colour. Hold such a cell to place the digit.' },
  { key: 'fish', label: 'Show fish', type: 'switch', default: true,
    help: 'With a digit highlighted, outlines the cells of an X-Wing, Swordfish or Jellyfish for it that removes a pencil mark: two, three or four rows whose candidates for the digit all sit in as many columns, or the other way round.' },
  { key: 'clock', label: 'Clock', choices: [['never', 'Hidden'], ['end', 'At the end'], ['always', 'Always']], default: 'always' },
  { key: 'showSolvable', label: 'Show solvable', type: 'switch', default: false,
    help: 'Colours the digit buttons green while the board can still be finished and red after a wrong digit. Adds time for each wrong move.' },
  { key: 'blink', label: 'Blink completed', type: 'switch', default: true,
    help: 'Flashes a row, column or block when you fill it, and every copy of a digit when all nine are placed.' },
  { key: 'sounds', label: 'Sounds', type: 'switch', default: false },
  { key: 'keepSaved', label: 'Keep saved positions', type: 'switch', default: false,
    help: 'When off, a saved position is deleted once you restore it.' },
  { key: 'awake', label: 'Keep screen on', type: 'switch', default: false },
  { key: 'skin', label: 'Skin', choices: [['paper', 'Paper'], ['sand', 'Sand'], ['sea', 'Sea'], ['slate', 'Slate'], ['night', 'Night'], ['contrast', 'Contrast']], default: 'paper' },
  { key: 'font', label: 'Digits', choices: [['regular', '1 2 3'], ['bold', 'Bold'], ['serif', 'Serif'], ['kanji', '一 二 三']], default: 'regular' },
  { key: 'markStyle', label: 'Pencil mark style', choices: [['grid', 'Fixed grid'], ['variable', 'Grow when few']], default: 'grid' },
];

const DEFAULTS = Object.fromEntries(SETTINGS.map((s) => [s.key, s.default]));


export function loadSettings() {
  return { ...DEFAULTS, ...load('settings', {}) };
}

export function saveSettings(settings) {
  save('settings', settings);
}
