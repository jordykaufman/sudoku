import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bit } from '../src/engine/grid.js';
import { holdDigit } from '../src/app/play.js';

const hold = (options) => holdDigit({ value: 0, marks: 0, single: false, highlightDigit: 0, ...options });

test('holding a cell with one pencil mark places that digit, whatever is highlighted', () => {
  assert.equal(hold({ marks: bit(4) }), 4);
  assert.equal(hold({ marks: bit(4), highlightDigit: 7 }), 4, 'the mark wins over the highlighted digit');
  assert.equal(hold({ marks: bit(4), single: true, highlightDigit: 7 }), 4);
});

test('holding a cell shown as the only place left for the highlighted digit places it', () => {
  assert.equal(hold({ marks: bit(2) | bit(9), single: true, highlightDigit: 9 }), 9);
});

test('any other hold counts as a tap', () => {
  assert.equal(hold({ marks: bit(2) | bit(9) }), 0, 'two marks and nothing highlighted');
  assert.equal(hold({ marks: bit(2) | bit(9), highlightDigit: 9 }), 0, 'highlighted but not a single');
  assert.equal(hold({ marks: 0 }), 0, 'no pencil marks');
  assert.equal(hold({ value: 5, marks: bit(4), single: true, highlightDigit: 4 }), 0, 'the cell already holds a digit');
});
