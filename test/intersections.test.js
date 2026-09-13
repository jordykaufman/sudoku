import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board } from '../src/engine/board.js';
import { parseGrid } from '../src/engine/grid.js';
import intersections from '../src/engine/techniques/intersections.js';

const technique = (id) => intersections.find((t) => t.id === id);

// The cell index of a row and column numbered from 1.
const cell = (row, column) => (row - 1) * 9 + (column - 1);

// Every digit in `digits` removed from every cell in `cells`, in step order.
const removeAll = (cells, digits) => cells.flatMap((c) => digits.map((d) => [c, d]));

// A board with digits placed at [row, column, digit] (rows and columns from 1).
function boardWith(entries) {
  const values = new Uint8Array(81);
  for (const [r, c, d] of entries) values[cell(r, c)] = d;
  return Board.fromValues(values);
}

// A pencil-mark board in which every cell has all nine candidates except the listed cells,
// for example { R1C4: '12' }.
function candidateBoard(cells) {
  const tokens = Array(81).fill('123456789');
  for (const [name, candidates] of Object.entries(cells)) {
    const [, r, c] = name.match(/^R(\d)C(\d)$/);
    tokens[cell(Number(r), Number(c))] = candidates;
  }
  return Board.fromCandidateGrid(tokens.join(' '));
}

// R1C1 to R2C3 are filled, and the 5 in R5C3 rules out R3C3, so block 1 can only have its 5
// in R3C1 or R3C2. In row 3 outside block 1, block 2 has a 5 (R1C5) and column 9 has a 5
// (R8C9), so R3C7 and R3C8 are the other cells of row 3 that can be 5.
const POINTING = [[1, 1, 1], [1, 2, 2], [1, 3, 3], [1, 5, 5], [2, 1, 4], [2, 2, 6], [2, 3, 7], [5, 3, 5], [8, 9, 5]];

test('ids and names', () => {
  assert.deepEqual(
    intersections.map((t) => [t.id, t.name]),
    [
      ['locked-candidate-direct-pointing', 'Locked Candidate (direct pointing)'],
      ['locked-candidate', 'Locked Candidate'],
      ['almost-locked-candidates', 'Almost Locked Candidates'],
    ],
  );
});

test('locked candidate, pointing', () => {
  const step = technique('locked-candidate').find(boardWith(POINTING));
  assert.equal(step.technique, 'locked-candidate');
  assert.equal(step.variant, 'pointing');
  assert.deepEqual(step.placements, []);
  assert.deepEqual(step.eliminations, [[cell(3, 7), 5], [cell(3, 8), 5]]);
  assert.deepEqual(
    step.stages.map((stage) => stage.text),
    [
      'Consider the digit 5.',
      'Every cell in block 1 that can be 5 is in row 3.',
      'Block 1 needs a 5, and it can only go in R3C1 or R3C2. Both cells are in row 3, so no other cell in row 3 can be 5. Remove 5 from R3C7 and R3C8.',
    ],
  );
});

test('locked candidate, pointing, in the SudokuWiki pointing pairs example', () => {
  // https://www.sudokuwiki.org/Intersection_Removal, "Pointing Pairs", from the start. The page
  // says the 3s of block 3 are only in R2C7 and R2C9 (B7 and B9), so the 3s in row 2 in block 1
  // are removed. Those are R2C1, R2C2 and R2C3.
  const board = Board.fromValues(parseGrid('010903600000080000900000507002010430000402000064070200701000005000030000005601020'));
  const step = technique('locked-candidate').find(board);
  assert.equal(step.variant, 'pointing');
  assert.deepEqual(step.eliminations, removeAll([cell(2, 1), cell(2, 2), cell(2, 3)], [3]));
});

test('locked candidate, claiming', () => {
  // Row 1 has only R1C1 and R1C2 empty, and both are in block 1.
  const board = boardWith([[1, 3, 1], [1, 4, 2], [1, 5, 3], [1, 6, 4], [1, 7, 6], [1, 8, 7], [1, 9, 8]]);
  const step = technique('locked-candidate').find(board);
  assert.equal(step.variant, 'claiming');
  assert.deepEqual(step.placements, []);
  assert.deepEqual(step.eliminations, removeAll([cell(2, 1), cell(2, 2), cell(2, 3), cell(3, 1), cell(3, 2), cell(3, 3)], [5]));
  assert.equal(step.stages[1].text, 'Every cell in row 1 that can be 5 is in block 1.');
  assert.equal(
    step.stages[2].text,
    'Row 1 needs a 5, and it can only go in R1C1 or R1C2. Both cells are in block 1, so no other cell in block 1 can be 5. Remove 5 from R2C1, R2C2, R2C3, R3C1, R3C2 and R3C3.',
  );
});

test('locked candidate finds nothing when no digit is confined', () => {
  // Only two 5s are placed. Every block without a 5 has its candidates for 5 in two or more
  // rows and two or more columns, and every row and column without a 5 has them in two or
  // more blocks. Every other digit can go in every empty cell.
  const board = boardWith([[1, 5, 5], [5, 2, 5]]);
  assert.equal(technique('locked-candidate').find(board), null);
  assert.equal(technique('locked-candidate-direct-pointing').find(board), null);
});

test('locked candidate (direct pointing) places the digit when a house is left with one cell', () => {
  // The pointing board with an 8 in R2C7. Block 3 can then have its 5 only in R2C8, R3C7 and
  // R3C8, so removing 5 from R3C7 and R3C8 leaves R2C8.
  const step = technique('locked-candidate-direct-pointing').find(boardWith([...POINTING, [2, 7, 8]]));
  assert.equal(step.technique, 'locked-candidate-direct-pointing');
  assert.deepEqual(step.placements, [[cell(2, 8), 5]]);
  assert.deepEqual(step.eliminations, [[cell(3, 7), 5], [cell(3, 8), 5]]);
  assert.equal(step.stages[0].text, 'Consider the digit 5.');
  assert.equal(
    step.stages[2].text,
    'Block 1 needs a 5, and it can only go in R3C1 or R3C2. Both cells are in row 3, so no other cell in row 3 can be 5. Remove 5 from R3C7 and R3C8. After that, R2C8 is the only cell in block 3 that can be 5, so it must be 5.',
  );
});

test('locked candidate (direct pointing) finds nothing when no house is left with one cell', () => {
  // On the pointing board, block 3 keeps R2C7 and R2C8 for its 5, and columns 7 and 8 keep
  // two or more cells. Block 1's 8s and 9s are also all in row 3, but removing them from row
  // 3 leaves blocks 2 and 3 and columns 4 to 9 with two or more cells for each digit.
  assert.equal(technique('locked-candidate-direct-pointing').find(boardWith(POINTING)), null);
});

test("almost locked candidates in Ruud's example", () => {
  // From the thread "Variation of Locked Candidates" (http://forum.enjoysudoku.com/viewtopic.php?t=5186),
  // linked from http://sudopedia.enjoysudoku.com/Almost_Locked_Candidates.html. The puzzle is a
  // Sudoku-X, but the move does not use the diagonals. Ruud marks R7C2, R9C1 and R9C2 and says
  // 5 (and 6) can be removed from them; none of the three has a 6.
  const board = Board.fromCandidateGrid(`
    9     1458  1246  346   18    236   7     135   14
    3     148   146   5     9     7     46    18    2
    256   1458  7     346   18    236   3458  1359  69
    4     6     5     2     3     9     1     7     8
    7     9     3     1     6     8     2     4     5
    1     2     8     7     4     5     9     6     3
    56    13457 124   368   57    136   348   12589 69
    8     135   16    9     2     4     56    13    7
    25    13457 9     368   57    136   4568  1258  14`);
  const step = technique('almost-locked-candidates').find(board);
  assert.equal(step.technique, 'almost-locked-candidates');
  assert.deepEqual(step.placements, []);
  assert.deepEqual(step.eliminations, removeAll([cell(7, 2), cell(9, 1), cell(9, 2)], [5]));
  assert.deepEqual(
    step.stages.map((stage) => stage.text),
    [
      'Look at row 8 and block 7.',
      'In row 8, the digits 5 and 6 can only go in R8C2, R8C3 and R8C7. R8C7 has no candidates other than 5 and 6, and neither does R7C1 in block 7.',
      'R8C7 must be 5 or 6, so row 8 has exactly one of 5 and 6 in R8C2 or R8C3. R7C1 must be the other one, since it can only be 5 or 6 and is in block 7 with R8C2 and R8C3. So no other cell in block 7 can be 5 or 6. Remove 5 from R7C2, R9C1 and R9C2.',
    ],
  );
});

test("almost locked candidates in Sudopedia's first illustration", () => {
  // X and Y are 1 and 2. R1C4 and R2C1 have only these candidates, and the other cells of block
  // 1 outside row 1 have neither. The page removes X and Y from R1C5 to R1C9.
  const board = candidateBoard({ R1C4: '12', R2C1: '12', R2C2: '3456789', R2C3: '3456789', R3C1: '3456789', R3C2: '3456789', R3C3: '3456789' });
  const step = technique('almost-locked-candidates').find(board);
  assert.deepEqual(step.eliminations, removeAll([cell(1, 5), cell(1, 6), cell(1, 7), cell(1, 8), cell(1, 9)], [1, 2]));
  assert.equal(
    step.stages[2].text,
    'R2C1 must be 1 or 2, so block 1 has exactly one of 1 and 2 in R1C1, R1C2 or R1C3. R1C4 must be the other one, since it can only be 1 or 2 and is in row 1 with R1C1, R1C2 and R1C3. So no other cell in row 1 can be 1 or 2. Remove 1 and 2 from R1C5, R1C6, R1C7, R1C8 and R1C9.',
  );
});

test("almost locked candidates with three digits in Sudopedia's second illustration", () => {
  // X, Y and Z are 1, 2 and 3. R1C4, R1C5, R2C1 and R2C2 have only these candidates, and the
  // other cells of block 1 outside row 1 have none of them. The page removes X, Y and Z from
  // R1C6 to R1C9.
  const board = candidateBoard({
    R1C4: '123', R1C5: '123', R2C1: '123', R2C2: '123',
    R2C3: '456789', R3C1: '456789', R3C2: '456789', R3C3: '456789',
  });
  const step = technique('almost-locked-candidates').find(board);
  assert.deepEqual(step.eliminations, removeAll([cell(1, 6), cell(1, 7), cell(1, 8), cell(1, 9)], [1, 2, 3]));
});

test('almost locked candidates with three digits, removing from the block', () => {
  // The same four cells, but now R1C6 to R1C9 have no 1, 2 or 3. Row 1 can only have these
  // digits in R1C1 to R1C5, so they are removed from block 1 outside row 1, R2C1 and R2C2.
  const board = candidateBoard({
    R1C4: '123', R1C5: '123', R1C6: '456789', R1C7: '456789', R1C8: '456789', R1C9: '456789',
    R2C1: '123', R2C2: '123',
  });
  const step = technique('almost-locked-candidates').find(board);
  assert.deepEqual(step.eliminations, removeAll([cell(2, 3), cell(3, 1), cell(3, 2), cell(3, 3)], [1, 2, 3]));
  assert.equal(
    step.stages[2].text,
    'R1C4 and R1C5 must be two of 1, 2 and 3, so row 1 has exactly one of these digits in R1C1, R1C2 or R1C3. R2C1 and R2C2 must be the other two, since they can only be 1, 2 or 3 and are in block 1 with R1C1, R1C2 and R1C3. So no other cell in block 1 can be 1, 2 or 3. Remove 1, 2 and 3 from R2C3, R3C1, R3C2 and R3C3.',
  );
});

test('almost locked candidates finds nothing when one more cell has one of the digits', () => {
  // The first illustration with a 1 added to R3C3. Block 1 now has a 1 outside row 1 and R2C1,
  // and row 1 has 1s and 2s in R1C5 to R1C9, so neither removal follows.
  const board = candidateBoard({ R1C4: '12', R2C1: '12', R2C2: '3456789', R2C3: '3456789', R3C1: '3456789', R3C2: '3456789', R3C3: '1456789' });
  assert.equal(technique('almost-locked-candidates').find(board), null);
});

test('find does not change the board', () => {
  const board = boardWith([...POINTING, [2, 7, 8]]);
  const values = board.values.slice();
  const cands = board.cands.slice();
  for (const t of intersections) t.find(board);
  assert.deepEqual(board.values, values);
  assert.deepEqual(board.cands, cands);
});
