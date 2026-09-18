import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fishCells, singleCells } from '../src/app/highlights.js';
import { Board } from '../src/engine/board.js';
import { findBasicFishFor } from '../src/engine/techniques/fish.js';

// Examples from test/fish.test.js.
// X-Wing: 5 in rows 2 and 5, columns 5 and 8, removes 5 from R4C5.
const XWING = `
| 58  4   1 | 7    2    9    | 68  3   56 |
| 7   6   9 | 18   158  3    | 4   58  2  |
| 58  3   2 | 6    4    58   | 7   1   9  |
| 4   28  3 | 9    58   2568 | 1   7   56 |
| 6   28  7 | 128  158  4    | 9   58  3  |
| 1   9   5 | 3    7    68   | 68  2   4  |
| 2   1   4 | 5    6    7    | 3   9   8  |
| 3   7   6 | 28   9    28   | 5   4   1  |
| 9   5   8 | 4    3    1    | 2   6   7  |`;

// Swordfish: 2 in rows 2, 3 and 9, columns 1, 5 and 8, removes 2 from R6C8 and R7C1.
const SWORDFISH = `
| 1     6    29  | 5   4   3  | 289   7    28 |
| 29    7    8   | 6   29  1  | 4     3    5  |
| 4     3    5   | 8   29  7  | 6     29   1  |
| 7     2    13  | 4   5   8  | 13    6    9  |
| 6     48   34  | 9   1   2  | 38    5    7  |
| 589   589  19  | 3   7   6  | 128   28   4  |
| 2589  1    6   | 27  3   59 | 2789  4    28 |
| 3     459  249 | 27  8   59 | 279   1    6  |
| 289   89   7   | 1   6   4  | 5     289  3  |`;

// What the board view gets from a game, built from a pencil-mark grid.
const viewOf = (board) => ({
  values: Array.from(board.values),
  givens: Array.from(board.givens),
  shownMarks: (cell) => board.cands[cell],
  allowed: (cell) => board.cands[cell],
});

const sorted = (cells) => [...cells].sort((a, b) => a - b);

test('the fish finder for one digit finds the X-Wing and nothing for a digit without one', () => {
  const board = Board.fromCandidateGrid(XWING);
  const step = findBasicFishFor(board, 5);
  assert.equal(step.technique, 'x-wing');
  assert.deepEqual(step.eliminations, [[31, 5]]);
  assert.equal(findBasicFishFor(board, 2), null, 'the 2s form a Swordfish that removes nothing');
});

test('an X-Wing with a corner missing is not reported', () => {
  // Without the 5 in R2C8, the 5s of rows 2 and 5 still sit in columns 5 and 8, but R2C5 is a
  // hidden single, not one corner of a rectangle. What is left is a Swordfish in columns 1, 6
  // and 9, which does not use R2C5.
  const board = Board.fromCandidateGrid(XWING.replace('4   58  2', '4   8   2'));
  const step = findBasicFishFor(board, 5);
  assert.equal(step.technique, 'swordfish');
  assert.deepEqual(step.eliminations, [[31, 5]]);
  assert.deepEqual(sorted(fishCells(viewOf(board), 5)), [0, 8, 18, 23, 32, 35]);
});

test('a Swordfish is found when there is no X-Wing, and its six cells are outlined', () => {
  const board = Board.fromCandidateGrid(SWORDFISH);
  const step = findBasicFishFor(board, 2);
  assert.equal(step.technique, 'swordfish');
  assert.deepEqual(step.eliminations, [[52, 2], [54, 2]]);
  assert.deepEqual(sorted(fishCells(viewOf(board), 2)), [9, 13, 22, 25, 72, 79]);
});

test('fish cells are the four cells of the X-Wing', () => {
  const view = viewOf(Board.fromCandidateGrid(XWING));
  assert.deepEqual(sorted(fishCells(view, 5)), [13, 16, 40, 43]);
  assert.equal(fishCells(view, 2).size, 0);
});

test('single cells are where a digit has one place left in a row, column or block', () => {
  assert.equal(singleCells(viewOf(Board.fromCandidateGrid(XWING)), 1).size, 0, 'every 1 has two places in each of its houses');
  // Take the 1 out of R2C5: R2C4 is then the only 1 in row 2, and R5C5 the only 1 in column 5.
  const rowAndColumn = viewOf(Board.fromCandidateGrid(XWING.replace('158  3', '58   3')));
  assert.deepEqual(sorted(singleCells(rowAndColumn, 1)), [12, 40]);
  // Take the 5s out of R4C5 and R4C6: R5C5 is then the only 5 in block 5, while its row and
  // column still have two. R4C9 becomes the only 5 in row 4, and R3C6 the only 5 in column 6.
  const block = viewOf(Board.fromCandidateGrid(XWING.replace('| 4   28  3 | 9    58   2568 |', '| 4   28  3 | 9    8    268  |')));
  assert.deepEqual(sorted(singleCells(block, 5)), [23, 35, 40]);
});

test('a cell whose only pencil mark is the digit is a single too', () => {
  // R2C4 keeps only its 1. Its row, column and block each still have another 1, so it is a
  // single only because nothing else can go there.
  const view = viewOf(Board.fromCandidateGrid(XWING.replace('| 7   6   9 | 18   158  3', '| 7   6   9 | (1)  158  3')));
  assert.deepEqual(sorted(singleCells(view, 1)), [12]);
  assert.equal(singleCells(view, 5).size, 0);
});

test('a cell without pencil marks counts as every digit the placed digits allow', () => {
  const board = Board.fromCandidateGrid(XWING);
  const view = { ...viewOf(board), shownMarks: () => 0, allowed: (cell) => board.cands[cell] };
  assert.deepEqual(sorted(fishCells(view, 5)), [13, 16, 40, 43]);
});
