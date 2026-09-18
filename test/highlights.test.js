import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fishCells, singleCells } from '../src/app/highlights.js';
import { Board } from '../src/engine/board.js';
import { findBasicFishFor } from '../src/engine/techniques/fish.js';

// The X-Wing example from test/fish.test.js: 5 in rows 2 and 5, columns 5 and 8, removes 5 from R4C5.
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

// What the board view gets from a game, built from a pencil-mark grid.
const viewOf = (board) => ({
  values: Array.from(board.values),
  givens: Array.from(board.givens),
  shownMarks: (cell) => board.cands[cell],
  allowed: (cell) => board.cands[cell],
});

test('the fish finder for one digit finds the X-Wing and nothing for a digit without one', () => {
  const board = Board.fromCandidateGrid(XWING);
  const step = findBasicFishFor(board, 5);
  assert.equal(step.technique, 'x-wing');
  assert.deepEqual(step.eliminations, [[31, 5]]);
  assert.equal(findBasicFishFor(board, 2), null, 'the 2s form a Swordfish that removes nothing');
});

test('fish cells are the four cells of the X-Wing', () => {
  const view = viewOf(Board.fromCandidateGrid(XWING));
  assert.deepEqual([...fishCells(view, 5)].sort((a, b) => a - b), [13, 16, 40, 43]);
  assert.equal(fishCells(view, 2).size, 0);
});

test('single cells are where a digit has one place left in a row or column', () => {
  assert.equal(singleCells(viewOf(Board.fromCandidateGrid(XWING)), 1).size, 0, 'every 1 has two places in its lines');
  // Take the 1 out of R2C5: R2C4 is then the only 1 in row 2, and R5C5 the only 1 in column 5.
  const view = viewOf(Board.fromCandidateGrid(XWING.replace('158  3', '58   3')));
  assert.deepEqual([...singleCells(view, 1)].sort((a, b) => a - b), [12, 40]);
});

test('a cell without pencil marks counts as every digit the placed digits allow', () => {
  const board = Board.fromCandidateGrid(XWING);
  const view = { ...viewOf(board), shownMarks: () => 0, allowed: (cell) => board.cands[cell] };
  assert.deepEqual([...fishCells(view, 5)].sort((a, b) => a - b), [13, 16, 40, 43]);
});
