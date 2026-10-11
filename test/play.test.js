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

test('with no digit highlighted, holding a cell with the only pencil mark for a digit in its block places that digit', () => {
  assert.equal(hold({ marks: bit(2) | bit(8), blockDigit: 8 }), 8);
  assert.equal(hold({ marks: bit(2) | bit(8), single: true, highlightDigit: 0, blockDigit: 8 }), 8, 'a single needs a highlighted digit');
});

test('with a digit highlighted, a hold places only that digit', () => {
  // The 8 is selected and R2C3 holds the only 5 mark in its block (Jordy, 11 Oct 2026).
  assert.equal(hold({ marks: bit(1) | bit(5), highlightDigit: 8, blockDigit: 5 }), 0, 'a block single for another digit');
  assert.equal(hold({ marks: bit(2) | bit(8), single: true, highlightDigit: 2, blockDigit: 8 }), 2, 'the highlighted single');
});

test('any other hold counts as a tap', () => {
  assert.equal(hold({ marks: bit(2) | bit(9) }), 0, 'two marks and nothing highlighted');
  assert.equal(hold({ marks: bit(2) | bit(9), highlightDigit: 9 }), 0, 'highlighted but not a single');
  assert.equal(hold({ marks: 0 }), 0, 'no pencil marks');
  assert.equal(hold({ value: 5, marks: bit(4), single: true, highlightDigit: 4 }), 0, 'the cell already holds a digit');
});
