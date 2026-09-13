import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board } from '../src/engine/board.js';
import singles from '../src/engine/techniques/singles.js';

const technique = (id) => singles.find((t) => t.id === id);

// A board with digits placed at [row, column, digit] (rows and columns from 1).
function boardWith(entries) {
  const values = new Uint8Array(81);
  for (const [r, c, d] of entries) values[(r - 1) * 9 + (c - 1)] = d;
  return Board.fromValues(values);
}

test('full house fills the last cell of a row', () => {
  const board = boardWith([1, 2, 3, 4, 5, 6, 7, 8].map((d, i) => [1, i + 1, d]));
  const step = technique('full-house').find(board);
  assert.deepEqual(step.placements, [[8, 9]]);
  assert.deepEqual(step.eliminations, []);
  assert.equal(step.stages.at(-1).text, 'R1C9 must be 9, the only digit missing from row 1.');
});

test('hidden single in a block', () => {
  // Rows 2 and 3 and columns 2 and 3 already have a 5, so only R1C1 is left in block 1.
  const board = boardWith([[2, 5, 5], [3, 8, 5], [4, 2, 5], [7, 3, 5]]);
  const step = technique('hidden-single-block').find(board);
  assert.deepEqual(step.placements, [[0, 5]]);
  assert.equal(step.stages[1].text, 'Where in block 1 can you put a 5?');
  assert.equal(step.stages[2].text, 'Only R1C1 can be 5.');
});

test('hidden single in a row', () => {
  // Columns 2 to 9 each have a 5, so row 1 has room for a 5 only in R1C1.
  const board = boardWith([[2, 4, 5], [3, 7, 5], [4, 2, 5], [5, 5, 5], [6, 8, 5], [7, 3, 5], [8, 6, 5], [9, 9, 5]]);
  const step = technique('hidden-single').find(board);
  assert.deepEqual(step.placements, [[0, 5]]);
  assert.equal(step.stages[1].text, 'Where in row 1 can you put a 5?');
});

test('naked single', () => {
  // Row 1 has 1 to 4 and column 1 has 5 to 8, so R1C1 can only be 9.
  const board = boardWith([[1, 2, 1], [1, 3, 2], [1, 4, 3], [1, 5, 4], [5, 1, 5], [6, 1, 6], [7, 1, 7], [8, 1, 8]]);
  const step = technique('naked-single').find(board);
  assert.deepEqual(step.placements, [[0, 9]]);
  assert.equal(step.stages[2].text, 'R1C1 can only be 9.');
});

test('singles find nothing on an empty board', () => {
  const board = Board.fromValues(new Uint8Array(81));
  for (const t of singles) assert.equal(t.find(board), null, t.id);
});
