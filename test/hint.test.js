import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board } from '../src/engine/board.js';
import { bit, parseGrid } from '../src/engine/grid.js';
import { findHint } from '../src/engine/hint.js';
import { solve } from '../src/engine/solver.js';

const puzzle = parseGrid('003020600900305001001806400008102900700000008006708200002609500800203009005010300');
const { solution } = solve(puzzle);
const givens = Uint8Array.from(puzzle, (v) => (v ? 1 : 0));
const wrongDigitForFirstCell = Board.fromValues(puzzle).candidates(0).find((d) => d !== solution[0]);

test('a wrong digit is reported first', () => {
  const values = puzzle.slice();
  values[0] = wrongDigitForFirstCell;
  const hint = findHint({ values, givens, solution });
  assert.equal(hint.kind, 'mistake');
  assert.equal(hint.cell, 0);
  assert.equal(hint.stages[2].text, `R1C1 is not ${wrongDigitForFirstCell}.`);
});

test('pencil marks that leave out the right digit are reported', () => {
  const marks = new Uint16Array(81);
  marks[0] = bit(wrongDigitForFirstCell);
  const hint = findHint({ values: puzzle, givens, solution, marks });
  assert.equal(hint.kind, 'mistake');
  assert.equal(hint.stages[2].text, `R1C1 needs a pencil mark for ${solution[0]}.`);
});

test('a correct position gets the next logical step', () => {
  const hint = findHint({ values: puzzle, givens, solution });
  assert.equal(hint.kind, 'step');
  assert.ok(hint.step.placements.length + hint.step.eliminations.length > 0);
  assert.equal(typeof hint.level, 'number');
});

test('a full correct board is solved', () => {
  assert.equal(findHint({ values: solution, givens, solution }).kind, 'solved');
});
