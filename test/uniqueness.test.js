import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board } from '../src/engine/board.js';
import { solve } from '../src/engine/solver.js';
import uniqueness from '../src/engine/techniques/uniqueness.js';
import { cellName } from '../src/engine/text.js';
import { checkStep } from '../src/engine/validate.js';

// Boards marked SudokuWiki are the "Load Example" positions of https://www.sudokuwiki.org
// (Unique Rectangles, Hidden Unique Rectangles, Avoidable Rectangles and BUG pages), decoded
// from the page links. Boards marked Sudopedia are copied from
// http://sudopedia.enjoysudoku.com/Uniqueness_Test.html and Avoidable_Rectangle.html.

const technique = (id) => uniqueness.find((t) => t.id === id);

// 'R4C1' to a cell index.
function cell(name) {
  const [, row, column] = /^R(\d)C(\d)$/.exec(name);
  return (row - 1) * 9 + (column - 1);
}

const byCellAndDigit = (x, y) => x[0] - y[0] || x[1] - y[1];
const changes = (list) => list.map(([name, digit]) => [cell(name), digit]).sort(byCellAndDigit);

// A grid with the token of one cell replaced.
function withCell(grid, name, token) {
  const tokens = grid.trim().split(/\s+/);
  tokens[cell(name)] = token;
  return tokens.join(' ');
}

// Puzzle text with one more clue.
const withClue = (clues, name, digit) => clues.slice(0, cell(name)) + digit + clues.slice(cell(name) + 1);

// A board where every cell has all nine candidates except the listed ones.
function openBoard(cells) {
  const tokens = Array(81).fill('123456789');
  for (const [name, token] of cells) tokens[cell(name)] = token;
  return Board.fromCandidateGrid(tokens.join(' '));
}

// Runs find() and checks what every step must satisfy: find() leaves the board alone, the
// step is sound against the solution of the placed digits (when they have exactly one), the
// first stage does not name the technique, highlighted candidates exist, and the last stage
// names and marks every cell that changes.
function find(id, board) {
  const before = board.clone();
  const step = technique(id).find(board);
  assert.deepEqual(board, before, 'find() changed the board');
  if (!step) return null;
  assert.equal(step.technique, id);
  const { count, solution } = solve(board.values, { limit: 2 });
  if (count === 1) assert.deepEqual(checkStep(step, solution, board), []);
  assert.ok(step.stages.length >= 3);
  assert.doesNotMatch(step.stages[0].text, /rectangle|bug|unique|avoidable/i);
  for (const stage of step.stages) {
    for (const [c, role] of stage.cells ?? []) assert.ok(['key', 'target'].includes(role), `${cellName(c)} ${role}`);
    for (const [c, d, role] of stage.marks ?? []) {
      assert.ok(['key', 'elim', 'place'].includes(role), role);
      assert.ok(board.has(c, d), `mark ${d} in ${cellName(c)} is not a candidate`);
    }
  }
  const last = step.stages.at(-1);
  for (const [changes, role] of [
    [step.eliminations, 'elim'],
    [step.placements, 'place'],
  ]) {
    for (const [c, d] of changes) {
      assert.ok(last.text.includes(cellName(c)), `${cellName(c)} is not named in: ${last.text}`);
      assert.ok(last.marks.some(([mc, md, r]) => mc === c && md === d && r === role));
    }
  }
  return step;
}

function assertStep(step, variant, { eliminations = [], placements = [] }) {
  assert.ok(step, 'no step found');
  assert.equal(step.variant, variant);
  assert.deepEqual([...step.eliminations].sort(byCellAndDigit), changes(eliminations));
  assert.deepEqual([...step.placements].sort(byCellAndDigit), changes(placements));
}

test('the uniqueness techniques say that they need a puzzle with one solution', () => {
  assert.deepEqual(
    uniqueness.map((t) => t.id),
    ['unique-rectangle', 'bug-plus-1', 'hidden-unique-rectangle', 'avoidable-rectangle'],
  );
  const empty = Board.fromValues(new Uint8Array(81));
  for (const t of uniqueness) {
    assert.ok(t.name && t.lesson.length >= 2, t.id);
    assert.match(t.lesson[0], /exactly one solution/, t.id);
    assert.equal(t.find(empty), null, t.id);
  }
});

// ---------------------------------------------------------------------------------------
// Unique Rectangle

// SudokuWiki, Unique Rectangles, Figure 2: 2 and 9 can be removed from D1 (R4C1).
const UR_TYPE_1 = `
79 79 6 3 2 4 8 1 5
8 5 23 6 9 1 24 7 34
24 234 1 7 8 5 29 369 36
1259 129 4 59 3 7 6 8 29
3 8 59 59 6 2 1 4 7
29 6 7 4 1 8 3 5 29
24569 249 259 1 7 3 459 69 8
579 379 359 8 4 6 59 2 1
146 14 8 2 5 9 7 36 346`;

test('unique rectangle type 1', () => {
  const step = find('unique-rectangle', Board.fromCandidateGrid(UR_TYPE_1));
  assertStep(step, 'type 1', { eliminations: [['R4C1', 2], ['R4C1', 9]] });
  assert.equal(step.stages[0].text, 'Consider the digits 2 and 9.');
  assert.equal(
    step.stages[2].text,
    'If R4C1 were 2 or 9, these four cells would hold only 2s and 9s, and swapping those digits would give the puzzle a second solution. Remove 2 and 9 from R4C1.',
  );
});

test('a unique rectangle must be in exactly two blocks', () => {
  // R1C1, R1C5, R2C1 and R2C5 are in blocks 1 and 2.
  const twoBlocks = openBoard([['R1C1', '12'], ['R1C5', '12'], ['R2C1', '12'], ['R2C5', '123']]);
  assertStep(find('unique-rectangle', twoBlocks), 'type 1', { eliminations: [['R2C5', 1], ['R2C5', 2]] });
  // R1C1, R1C5, R5C1 and R5C5 are in four blocks, and R1C1, R1C2, R2C1 and R2C2 in one.
  const fourBlocks = openBoard([['R1C1', '12'], ['R1C5', '12'], ['R5C1', '12'], ['R5C5', '123']]);
  const oneBlock = openBoard([['R1C1', '12'], ['R1C2', '12'], ['R2C1', '12'], ['R2C2', '123']]);
  for (const board of [fourBlocks, oneBlock]) {
    assert.equal(find('unique-rectangle', board), null);
    assert.equal(find('hidden-unique-rectangle', board), null);
  }
});

// SudokuWiki, Unique Rectangles, Figure 3: 7 can be removed from A3 and C6.
const UR_TYPE_2 = `
4 2 157 9 157 157 3 8 6
135 6 135 2 1358 158 7 9 4
8 37 9 34 6 47 2 5 1
7 14 168 468 489 3 19 2 5
9 45 58 1 478 2 6 47 3
2 134 136 5 479 4679 19 47 8
13 139 4 38 2 89 5 6 7
6 8 2 7 15 15 4 3 9
35 579 57 346 349 469 8 1 2`;

// SudokuWiki, Unique Rectangles, Figure 5 (floor across two blocks): B7 cannot be 8.
const UR_TYPE_2B = `
27 4 1 8 6 5 3 9 27
278 9 257 13 4 13 578 6 278
68 3 56 7 9 2 4 58 1
36 2 8 135 357 137 9 4 56
5 1 9 6 2 4 78 78 3
346 7 46 9 35 8 2 1 56
1 5 347 34 8 37 6 2 9
247 6 247 45 1 9 578 3 478
9 8 347 2 357 6 1 57 47`;

test('unique rectangle type 2', () => {
  const step = find('unique-rectangle', Board.fromCandidateGrid(UR_TYPE_2));
  assertStep(step, 'type 2', { eliminations: [['R1C3', 7], ['R3C6', 7]] });
  assert.equal(
    step.stages[2].text,
    'If neither R1C5 nor R1C6 were 7, these four cells would hold only 1s and 5s, and swapping those digits would give the puzzle a second solution. So R1C5 or R1C6 is 7, and no other cell in row 1 or block 2 can be 7. Remove 7 from R1C3 and R3C6.',
  );
  assertStep(find('unique-rectangle', Board.fromCandidateGrid(UR_TYPE_2B)), 'type 2', { eliminations: [['R2C7', 8]] });
});

// SudokuWiki, Unique Rectangles, Figure 7: 1 and 7 can be removed from C7 and H7.
const UR_TYPE_3 = `
69 69 128 5 12 3 4 7 18
5 37 12 8 127 4 139 6 39
4 37 18 17 9 6 138 5 2
8 5 7 123 13 9 6 12 4
3 2 4 6 18 7 5 9 18
19 19 6 24 48 5 28 3 7
2 8 5 37 6 1 379 4 39
167 16 9 347 347 8 1237 12 5
17 4 3 9 5 2 17 8 6`;

// SudokuWiki, Unique Rectangles, Figure 8 (roof in one block): 1 can be removed from B5 and 5 from C5.
const UR_TYPE_3B = `
79 17 159 2 15 6 8 4 3
34 18 2 9 138 134 67 5 67
34 6 58 7 358 345 2 1 9
267 4 3 168 9 127 167 68 5
679 5 689 1368 167 137 1367 2 4
1 278 68 3568 4 2357 9 368 67
5 9 4 136 1236 8 36 7 12
26 3 16 15 1257 157 4 9 8
8 12 7 4 36 9 5 36 12`;

// SudokuWiki, Unique Rectangles, "UR 3B example 2": the 6 in E9 can be removed.
const UR_TYPE_3_TRIPLE = `
49 6 3 5 47 8 1 2 79
49 7 2 3 46 1 5689 689 59
5 8 1 9 267 26 367 4 367
7 1 45 246 3 2569 4569 69 8
8 3 9 46 1 56 2 7 456
6 2 45 7 8 59 3459 39 1
1 5 68 268 9 7 3468 368 2346
3 9 68 1 26 4 678 5 267
2 4 7 68 5 3 689 1 69`;

// SudokuWiki, Unique Rectangles, Figure 11. The page shows a type 4 here, but a type 3 comes
// first: R5C6 or R5C7 is 8 or 9, and R5C4, R5C8 and R5C9 have only 1, 6, 8 and 9, so those
// four digits all go in these five cells of row 5 and R5C1 cannot be 6.
const UR_TYPE_3_QUAD = `
7 4 8 3 5 9 1 2 6
359 59 1 7 2 6 8 4 39
39 2 6 4 18 18 7 39 5
2 56 39 169 4 15 359 8 7
56 7 4 689 3 258 259 169 19
1 8 39 69 7 25 25 369 4
4 39 2 15 19 7 6 1359 8
69 1 7 58 689 3 4 59 2
8 369 5 2 169 4 39 7 139`;

test('unique rectangle type 3', () => {
  const step = find('unique-rectangle', Board.fromCandidateGrid(UR_TYPE_3));
  assertStep(step, 'type 3', { eliminations: [['R3C7', 1], ['R8C7', 1], ['R8C7', 7]] });
  assert.equal(step.stages[2].text, 'The other candidates of R2C7 and R7C7 are 1 and 7. In column 7, R9C7 has no candidates other than 1 and 7.');
  assert.equal(
    step.stages[3].text,
    'If R2C7 and R7C7 were both 3 or 9, these four cells would hold only 3s and 9s, and swapping those digits would give the puzzle a second solution. So R2C7 or R7C7 is 1 or 7. R9C7 holds one of the digits 1 and 7, and R2C7 or R7C7 holds the other, so no other cell in column 7 can be 1 or 7. Remove 1 from R3C7. Remove 1 and 7 from R8C7.',
  );
  assertStep(find('unique-rectangle', Board.fromCandidateGrid(UR_TYPE_3B)), 'type 3', { eliminations: [['R2C5', 1], ['R3C5', 5]] });
  assertStep(find('unique-rectangle', Board.fromCandidateGrid(UR_TYPE_3_TRIPLE)), 'type 3', { eliminations: [['R5C9', 6]] });
  assertStep(find('unique-rectangle', Board.fromCandidateGrid(UR_TYPE_3_QUAD)), 'type 3', { eliminations: [['R5C1', 6]] });
});

test('unique rectangle type 3 is not reported for a naked subset that does not need the rectangle', () => {
  const rectangle = [['R1C1', '12'], ['R1C5', '12'], ['R2C1', '123'], ['R2C5', '124']];
  // R2C2 has only 3 and 4, the other candidates of R2C1 and R2C5.
  const pair = openBoard([...rectangle, ['R2C2', '34']]);
  const others = ['R2C3', 'R2C4', 'R2C6', 'R2C7', 'R2C8', 'R2C9'];
  assertStep(find('unique-rectangle', pair), 'type 3', { eliminations: others.flatMap((name) => [[name, 3], [name, 4]]) });
  // R2C2 and R2C3 have only 3 and 5. They are a naked pair on their own.
  assert.equal(find('unique-rectangle', openBoard([...rectangle, ['R2C2', '35'], ['R2C3', '35']])), null);
  // No subset and no conjugate pair.
  assert.equal(find('unique-rectangle', openBoard(rectangle)), null);
});

// SudokuWiki, Unique Rectangles, Figure 10: 7 can be removed from A4 and A6.
const UR_TYPE_4 = `
4 3 257 2567 9 167 18 78 1278
25 18 257 38 257 138 6 9 4
9 18 6 2478 27 1478 3 5 127
235 6 25 1 8 29 7 4 39
38 9 1 67 4 67 5 2 38
28 7 4 29 3 5 89 1 6
1 4 8 39 67 39 2 67 5
7 25 3 245 256 248 19 68 19
6 25 9 2578 1 278 4 3 78`;

test('unique rectangle type 4', () => {
  const step = find('unique-rectangle', Board.fromCandidateGrid(UR_TYPE_4));
  assertStep(step, 'type 4', { eliminations: [['R1C4', 7], ['R1C6', 7]] });
  assert.equal(
    step.stages[2].text,
    'In row 1, 6 can only go in R1C4 and R1C6, so one of them is 6. If the other one were 7, these four cells would hold only 6s and 7s, and swapping those digits would give the puzzle a second solution. Remove 7 from R1C4 and R1C6.',
  );
});

// ---------------------------------------------------------------------------------------
// Hidden Unique Rectangle

// Sudopedia, Uniqueness Test, Hidden Unique Rectangle: candidate 3 can be removed from r2c8.
const HIDDEN_SUDOPEDIA = `
.------------------.------------------.------------------.
| 135   19    6    | 24    27    247  | 8     1359  39   |
| 358   29    23   | 8     6     1    | 379   34579 3479 |
| 17    8     4    | 5     9     3    | 2     17    6    |
:------------------+------------------+------------------:
| 2     3     18   | 149   17    478  | 479   6     5    |
| 4     6     58   | 29    35    278  | 379   379   1    |
| 9     7     15   | 146   35    46   | 34    8     2    |
:------------------+------------------+------------------:
| 18    12    9    | 3     4     5    | 6     27    78   |
| 6     5     23   | 7     8     9    | 1     234   34   |
| 38    4     7    | 126   12    26   | 5     39    389  |
'------------------'------------------'------------------'`;

// SudokuWiki, Hidden Unique Rectangles, Figure 1: 8 can be removed from H1.
const HIDDEN_SUDOKUWIKI = `
4 6 3 17 8 57 159 159 2
9 7 2 6 13 35 158 4 18
5 18 18 2 9 4 3 6 7
1 23 59 49 234 8 245 7 6
7 28 59 149 6 29 12458 158 3
2368 4 68 5 1237 237 128 18 9
238 5 1478 34789 247 6 1789 1389 148
368 9 4678 3478 5 1 78 2 48
238 1238 1478 34789 247 279 6 1389 5`;

test('hidden unique rectangle', () => {
  const step = find('hidden-unique-rectangle', Board.fromCandidateGrid(HIDDEN_SUDOPEDIA));
  assertStep(step, undefined, { eliminations: [['R2C8', 3]] });
  assert.deepEqual(
    step.stages.map((stage) => stage.text),
    [
      'Consider the digits 3 and 4.',
      'R2C8, R2C9, R8C8 and R8C9 are in two rows, two columns and two blocks, and each has the candidates 3 and 4. R8C9 has no other candidates.',
      'In row 2, 4 can only go in R2C8 and R2C9. In column 8, 4 can only go in R2C8 and R8C8.',
      'If R2C8 were 3, R2C9 and R8C8 would both be 4 and R8C9 would be 3, and swapping the 3s and 4s in these four cells would give the puzzle a second solution. Remove 3 from R2C8.',
    ],
  );
  assertStep(find('hidden-unique-rectangle', Board.fromCandidateGrid(HIDDEN_SUDOKUWIKI)), undefined, { eliminations: [['R8C1', 8]] });
});

test('hidden unique rectangle needs a conjugate pair in both the row and the column', () => {
  // R1C1 has only 1 and 2. In row 2 and in column 5, 1 is a candidate only in the rectangle.
  const cells = [['R1C1', '12'], ['R1C5', '123'], ['R2C1', '124'], ['R2C5', '125']];
  for (const column of [2, 3, 4, 6, 7, 8, 9]) cells.push([`R2C${column}`, '23456789']);
  for (const row of [3, 4, 5, 6, 7, 8, 9]) cells.push([`R${row}C5`, '23456789']);
  assertStep(find('hidden-unique-rectangle', openBoard(cells)), undefined, { eliminations: [['R2C5', 2]] });
  assert.equal(find('unique-rectangle', openBoard(cells)), null);
  // With 1 also a candidate in R9C5, the column has no conjugate pair.
  assert.equal(find('hidden-unique-rectangle', openBoard([...cells, ['R9C5', '123456789']])), null);
});

// ---------------------------------------------------------------------------------------
// BUG+1

// SudokuWiki, BUG: F8 (R6C8) must be 3.
const BUG = `
2 8 9 7 4 6 5 1 3
4 3 6 5 9 1 2 7 8
1 7 5 3 2 8 4 9 6
8 5 7 14 6 39 19 34 2
69 4 13 2 8 7 19 36 5
69 2 13 14 5 39 8 346 7
5 9 8 6 7 4 3 2 1
3 6 4 8 1 2 7 5 9
7 1 2 9 3 5 6 8 4`;

test('BUG+1', () => {
  const step = find('bug-plus-1', Board.fromCandidateGrid(BUG));
  assertStep(step, undefined, { placements: [['R6C8', 3]] });
  assert.deepEqual(
    step.stages.map((stage) => stage.text),
    [
      'Count the candidates of each empty cell.',
      'Every empty cell except R6C8 has exactly two candidates, and R6C8 has three: 3, 4 and 6. In every row, column and block, each digit that is still a candidate there is a candidate in exactly two cells. The only exception is 3, which is a candidate in three cells in each of row 6, column 8 and block 6.',
      'If R6C8 were 4 or 6, removing 3 from it would leave two candidates in every empty cell and two cells for each candidate in every row, column and block, and then changing every empty cell to its other candidate would give the puzzle a second solution. R6C8 must be 3.',
    ],
  );
});

test('BUG+1 checks the whole pattern', () => {
  // Two cells with three candidates.
  assert.equal(find('bug-plus-1', Board.fromCandidateGrid(withCell(BUG, 'R4C4', '149'))), null);
  // One cell with three candidates, but 9 is a candidate in three cells of row 4 and 4 in one cell of column 4.
  assert.equal(find('bug-plus-1', Board.fromCandidateGrid(withCell(BUG, 'R4C4', '19'))), null);
});

// ---------------------------------------------------------------------------------------
// Avoidable Rectangle

// Sudopedia, Avoidable Rectangle, type 1 example: 2 can be removed from r5c7. Clues were
// shown in black and solved cells in blue.
const AVOIDABLE_TYPE_1 = `
25 25 8 9 3 1 4 7 6
9 3 7 8 6 4 1 2 5
4 6 1 2 5 7 39 8 39
3 1 2 4 7 9 5 6 8
7 4 5 3 8 6 29 1 29
6 8 9 1 2 5 37 34 347
8 27 6 5 4 3 27 9 1
25 9 3 7 1 8 6 45 24
1 57 4 6 9 2 8 35 37`;
const AVOIDABLE_TYPE_1_CLUES = '......476...86.1.54...5....3........7...8..1...912......6..3.9....71.6....4...8..';

// SudokuWiki, Avoidable Rectangles, the example linked from the March 2026 update.
const AVOIDABLE_SUDOKUWIKI = `
56 17 4 9 57 2 156 3 8
58 17 2 6 3578 37 145 145 9
3 9 568 4 58 1 7 256 25
2569 3 1 8 27 79 56 256 4
2569 26 567 135 4 39 158 12568 1257
4 28 578 15 12 6 3 9 1257
28 248 9 13 13 5 48 7 6
1 46 36 7 9 8 2 45 35
7 5 38 2 6 4 9 18 13`;
const AVOIDABLE_SUDOKUWIKI_CLUES = '..4..2.38..26....939.4..7...318....4.........4....639...9..5.761....82..75.2..9..';

// Sudopedia, Avoidable Rectangle, type 2 example: 8 can be removed from r7c8, r9c8, r8c3 and r8c6.
const AVOIDABLE_TYPE_2 = `
7 26 4 5 68 689 1 3 29
3 56 1 69 2 4 78 58 579
8 25 9 3 1 7 6 4 25
9 7 2 1 4 3 5 6 8
5 8 3 26 7 26 9 1 4
4 1 6 8 9 5 2 7 3
26 3 7 269 568 1 4 2589 56
1 9 58 4 3 268 78 28 567
26 4 58 7 568 2689 3 2589 1`;
const AVOIDABLE_TYPE_2_CLUES = '..45..13.....2....8....76...7.1435.85...7...4.1.8.5....37..1...19.4...........3..';

test('avoidable rectangle type 1', () => {
  const step = find('avoidable-rectangle', Board.fromCandidateGrid(AVOIDABLE_TYPE_1, AVOIDABLE_TYPE_1_CLUES));
  assertStep(step, 'type 1', { eliminations: [['R5C7', 2]] });
  assert.deepEqual(
    step.stages.map((stage) => stage.text),
    [
      'Consider the digits 2 and 5.',
      'R4C3, R4C7, R5C3 and R5C7 are in two rows, two columns and two blocks. R4C3 is 2, R4C7 and R5C3 are both 5, and none of these three cells was a clue.',
      'If R5C7 were 2, swapping the 2s and 5s in these four cells would give the puzzle a second solution, because none of them is a clue. Remove 2 from R5C7.',
    ],
  );
  // R8C4 is 7 and R1C4 and R8C5 are 9, so R1C5 cannot be 7.
  const sudokuwiki = Board.fromCandidateGrid(AVOIDABLE_SUDOKUWIKI, AVOIDABLE_SUDOKUWIKI_CLUES);
  assertStep(find('avoidable-rectangle', sudokuwiki), 'type 1', { eliminations: [['R1C5', 7]] });
});

test('avoidable rectangle type 2', () => {
  const step = find('avoidable-rectangle', Board.fromCandidateGrid(AVOIDABLE_TYPE_2, AVOIDABLE_TYPE_2_CLUES));
  assertStep(step, 'type 2', { eliminations: [['R7C8', 8], ['R8C3', 8], ['R8C6', 8], ['R9C8', 8]] });
  assert.equal(
    step.stages[2].text,
    'If neither R8C7 nor R8C8 were 8, R8C7 would be 7 and R8C8 would be 2, and swapping the 2s and 7s in these four cells would give the puzzle a second solution, because none of them is a clue. So R8C7 or R8C8 is 8, and no other cell in row 8 or block 9 can be 8. Remove 8 from R7C8, R8C3, R8C6 and R9C8.',
  );
});

test('avoidable rectangle type 3', () => {
  // The type 2 board with 5 added back to R8C8. R8C7 or R8C8 is 5 or 8, and R8C3 has only 5
  // and 8, so no other cell in row 8 can be 5 or 8.
  const board = Board.fromCandidateGrid(withCell(AVOIDABLE_TYPE_2, 'R8C8', '258'), AVOIDABLE_TYPE_2_CLUES);
  const step = find('avoidable-rectangle', board);
  assertStep(step, 'type 3', { eliminations: [['R8C6', 8], ['R8C9', 5]] });
  assert.equal(step.stages[2].text, 'The other candidates of R8C7 and R8C8 are 5 and 8. In row 8, R8C3 has no candidates other than 5 and 8.');
});

test('avoidable rectangle does not use a rectangle with a clue in it', () => {
  const cases = [
    [AVOIDABLE_TYPE_1, withClue(AVOIDABLE_TYPE_1_CLUES, 'R4C7', 5)],
    [AVOIDABLE_TYPE_1, withClue(AVOIDABLE_TYPE_1_CLUES, 'R4C3', 2)],
    [AVOIDABLE_TYPE_2, withClue(AVOIDABLE_TYPE_2_CLUES, 'R6C7', 2)],
    [withCell(AVOIDABLE_TYPE_2, 'R8C8', '258'), withClue(AVOIDABLE_TYPE_2_CLUES, 'R6C8', 7)],
    // Without puzzle text, every placed digit counts as a clue.
    [AVOIDABLE_TYPE_1, null],
  ];
  for (const [grid, clues] of cases) assert.equal(find('avoidable-rectangle', Board.fromCandidateGrid(grid, clues)), null);
});
