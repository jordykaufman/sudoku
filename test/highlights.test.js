import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from '../src/app/game.js';
import { blockSingle, fishCells, forcedCells, singleCells } from '../src/app/highlights.js';
import { Board } from '../src/engine/board.js';
import { formatGrid, parseGrid } from '../src/engine/grid.js';
import { solve } from '../src/engine/solver.js';
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

test('a cell without pencil marks takes no part', () => {
  const board = Board.fromCandidateGrid(XWING);
  const view = { ...viewOf(board), shownMarks: () => 0 };
  for (let digit = 1; digit <= 9; digit++) {
    assert.equal(singleCells(view, digit).size, 0, `no singles for ${digit}`);
    assert.equal(fishCells(view, digit).size, 0, `no fish for ${digit}`);
  }
});

// The position in Jordy's screenshot of 27 Sep 2026: every place a 9 can go is marked, and
// nothing else. The placed digits leave R4C4 as the only place for 8 in column 4, but the
// highlight shows only what the pencil marks say.
test('only the pencil marks on the board count', () => {
  const puzzle = '1.9.8.27......2.3.....4...5....276...3.4.5.9...239....8...7.....2.5......47.6.8.9';
  const game = new Game({ kind: 'random', level: 10, puzzle, solution: formatGrid(solve(parseGrid(puzzle)).solution), pencilMode: 'manual' });
  const cell = (name) => (Number(name[1]) - 1) * 9 + Number(name[3]) - 1;
  for (const name of ['R2C4', 'R2C7', 'R3C4', 'R3C6', 'R3C7', 'R4C1', 'R4C2', 'R7C2', 'R7C4', 'R7C6', 'R8C1', 'R8C6']) {
    game.toggleMark(cell(name), 9);
  }
  assert.equal(singleCells(game, 8).size, 0, 'no cell has an 8 mark');
  // Column 5 already has an 8, so an 8 marked in R5C5 is left out.
  game.toggleMark(cell('R5C5'), 8);
  assert.equal(singleCells(game, 8).size, 0);
  // An 8 marked in R4C4 is the only 8 mark in its row, column and block.
  game.toggleMark(cell('R4C4'), 8);
  assert.deepEqual([...singleCells(game, 8)], [cell('R4C4')]);
});

// The Annoying position in Jordy's screenshot of 28 Sep 2026, with every candidate marked.
const ANNOYING = `
19   19   7    | 248   248  6     | 248  3    5
5    6    2    | 1489  489  3     | 489  7    18
4    3    8    | 1259  259  7     | 269  29   16
8    59   4    | 259   6    259   | 3    1    7
39   7    359  | 24589 1    24589 | 2468 248  68
16   2    16   | 7     3    48    | 5    48   9
2    159  159  | 3     7    1589  | 89   6    4
1369 1459 1356 | 14589 4589 14589 | 7    589  2
7    8    59   | 6     2459 2459  | 1    59   3`;

test('with no digit highlighted, the cells a hold fills are marked', () => {
  const view = viewOf(Board.fromCandidateGrid(ANNOYING));
  // R8C2 holds the only 4 in block 7, and no cell has one pencil mark left.
  assert.deepEqual([...forcedCells(view)], [64]);
  assert.equal(blockSingle(view, 64), 4);
  assert.equal(blockSingle(view, 63), 0, 'R8C1 shares its 3 and 6 with R8C3');
  // With R2C9 down to its 1, it is marked too.
  const lone = viewOf(Board.fromCandidateGrid(ANNOYING.replace('7    18', '7    (1)')));
  assert.deepEqual(sorted(forcedCells(lone)), [17, 64]);
});

test('a cell alone in its block with two digits gets no block digit', () => {
  // Without the 3 and 6 in R8C3, R8C1 holds the only 3 and the only 6 in block 7, which the
  // marks cannot both be right about.
  const view = viewOf(Board.fromCandidateGrid(ANNOYING.replace('1459 1356 |', '1459 15   |')));
  assert.equal(blockSingle(view, 63), 0);
  assert.equal(forcedCells(view).has(63), false);
});

// The Intricate position in Jordy's screenshot of 11 Oct 2026, with the player's own pencil
// marks. The 8 is selected.
const INTRICATE = `
7    9    12   | 16   26   5    | 8    3    4
6    8    15   | (1)  4    3    | 7    2    9
4    3    (2)  | 9    7    28   | 56   156  16
2    5    4    | 7    68   9    | 1    68   3
8    6    7    | 3    1    4    | 2    9    5
9    1    3    | 5    268  26   | 46   468  7
3    2    6    | 48   9    178  | 45   1457 18
1    4    9    | 2    5    678  | 3    67   68
5    7    8    | 46   3    16   | 9    146  2`;

test('with a digit highlighted, a block single for another digit is not a cell a hold fills', () => {
  const view = viewOf(Board.fromCandidateGrid(INTRICATE));
  // R2C3 holds the only 5 mark in block 1.
  assert.equal(blockSingle(view, 11), 5);
  assert.equal(forcedCells(view).has(11), true, 'with nothing highlighted it is');
  // With the 8 highlighted: the cells with one pencil mark left, R2C4 and R3C3.
  assert.deepEqual(sorted(forcedCells(view, 8)), [12, 20]);
  // And the 8s: R3C6 is the only 8 in row 3, and R7C4 the only 8 in column 4.
  assert.deepEqual(sorted(singleCells(view, 8)), [23, 57]);
});
