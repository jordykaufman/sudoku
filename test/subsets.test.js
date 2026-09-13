import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board } from '../src/engine/board.js';
import { parseGrid } from '../src/engine/grid.js';
import subsets from '../src/engine/techniques/subsets.js';

const technique = (id) => subsets.find((t) => t.id === id);

// The cell index of a row and column numbered from 1.
const cell = (row, column) => (row - 1) * 9 + (column - 1);

// [[cell, [digits]], ...] as a list of eliminations in step order.
const removals = (list) => list.flatMap(([c, digits]) => digits.map((d) => [c, d]));

const fromValues = (text) => Board.fromValues(parseGrid(text));

// A pencil-mark board in which every cell has all nine candidates except the listed cells,
// for example { R1C1: '12' }.
function candidateBoard(cells) {
  const tokens = Array(81).fill('123456789');
  for (const [name, candidates] of Object.entries(cells)) {
    const [, r, c] = name.match(/^R(\d)C(\d)$/);
    tokens[cell(Number(r), Number(c))] = candidates;
  }
  return Board.fromCandidateGrid(tokens.join(' '));
}

test('ids and names', () => {
  assert.deepEqual(
    subsets.map((t) => [t.id, t.name]),
    [
      ['naked-pair', 'Naked Pair'],
      ['naked-triple', 'Naked Triple'],
      ['naked-quad', 'Naked Quad'],
      ['hidden-pair', 'Hidden Pair'],
      ['hidden-triple', 'Hidden Triple'],
      ['hidden-quad', 'Hidden Quad'],
    ],
  );
});

test('naked pair in a row and a block, from SudokuWiki', () => {
  // https://www.sudokuwiki.org/Naked_Candidates, "Naked Pairs examples", loaded position.
  // R1C2 and R1C3 (A2 and A3) have only 1 and 6. The page removes the other 1s and 6s of row 1,
  // which are in R1C4, R1C5 and R1C6, and the 1 in R3C1 (C1), which is in block 1 with the pair.
  const step = technique('naked-pair').find(fromValues('400000938032094100095300240370609004529001673604703090957008300003900400240030709'));
  assert.equal(step.technique, 'naked-pair');
  assert.deepEqual(step.placements, []);
  assert.deepEqual(step.eliminations, removals([[cell(1, 4), [1]], [cell(1, 5), [1, 6]], [cell(1, 6), [6]], [cell(3, 1), [1]]]));
  assert.deepEqual(
    step.stages.map((stage) => stage.text),
    [
      'Look at row 1.',
      'In row 1, R1C2 and R1C3 have no candidates other than 1 and 6. Both cells are also in block 1.',
      'R1C2 and R1C3 must be 1 and 6 in some order, so no other cell in row 1 or block 1 can be 1 or 6. Remove 1 from R1C4, R1C5 and R3C1. Remove 6 from R1C5 and R1C6.',
    ],
  );
});

test('naked pair finds nothing when two cells have three digits together', () => {
  assert.equal(technique('naked-pair').find(candidateBoard({ R1C1: '12', R1C2: '13' })), null);
});

test('naked triple, from SudokuWiki', () => {
  // https://www.sudokuwiki.org/Naked_Candidates, "Naked Triple", loaded position. R5C4, R5C5
  // and R5C6 (E4, E5 and E6) have 5, 8 and 9, 5 and 8, and 5 and 9. The page removes these
  // digits from the rest of row 5.
  const step = technique('naked-triple').find(fromValues('070408029002000004854020007008374200020000000003261700000093612200000403130642070'));
  assert.equal(step.technique, 'naked-triple');
  assert.deepEqual(
    step.eliminations,
    removals([[cell(5, 1), [5, 9]], [cell(5, 3), [5, 9]], [cell(5, 7), [5, 8, 9]], [cell(5, 8), [5, 8, 9]], [cell(5, 9), [5, 8]]]),
  );
  assert.equal(step.stages[1].text, 'In row 5, R5C4, R5C5 and R5C6 have no candidates other than 5, 8 and 9.');
});

test('naked triple with removals only in its block is given as a block hint', () => {
  // https://www.sudokuwiki.org/Naked_Candidates, "Naked Triples", loaded position. R4C1, R5C1
  // and R6C1 are the last empty cells of column 1 and have only 1, 5 and 8. The page says the
  // removals are in the block only, since column 1 has nothing else to remove.
  const step = technique('naked-triple').find(fromValues('294513006600842319300697254000056000040080060000470000730164005900735001400928637'));
  assert.equal(step.stages[0].text, 'Look at block 4.');
  assert.deepEqual(
    step.eliminations,
    removals([[cell(4, 2), [1, 8]], [cell(4, 3), [1, 8]], [cell(5, 3), [1, 5]], [cell(6, 2), [1, 5, 8]], [cell(6, 3), [1, 5, 8]]]),
  );
});

test('naked triple finds nothing when three cells have four digits together', () => {
  assert.equal(technique('naked-triple').find(candidateBoard({ R1C1: '12', R1C2: '13', R1C3: '24' })), null);
});

test('naked quad, from SudokuWiki', () => {
  // https://www.sudokuwiki.org/Naked_Candidates, "Naked Quad example", loaded position. R1C1,
  // R2C1, R2C2 and R3C1 (A1, B1, B2 and C1) have only 1, 5, 6 and 8 together, so these digits
  // are removed from the other cells of block 1.
  const step = technique('naked-quad').find(fromValues('000030086000020040090078520371856294900142375400397618200703859039205467700904132'));
  assert.equal(step.technique, 'naked-quad');
  assert.deepEqual(step.eliminations, removals([[cell(1, 2), [1, 5]], [cell(1, 3), [5]], [cell(2, 3), [5, 6, 8]], [cell(3, 3), [6]]]));
  assert.equal(
    step.stages[2].text,
    'R1C1, R2C1, R2C2 and R3C1 must be 1, 5, 6 and 8 in some order, so no other cell in block 1 can be 1, 5, 6 or 8. Remove 1 from R1C2. Remove 5 from R1C2, R1C3 and R2C3. Remove 6 from R2C3 and R3C3. Remove 8 from R2C3.',
  );
});

test('naked quad finds nothing when four cells have five digits together', () => {
  assert.equal(technique('naked-quad').find(candidateBoard({ R1C1: '12', R1C2: '13', R1C3: '24', R1C4: '35' })), null);
});

test('hidden pair, from SudokuWiki', () => {
  // https://www.sudokuwiki.org/Hidden_Candidates, "Three Hidden Pairs", loaded position. 2 and 4
  // can only go in R4C3 and R5C3 (D3 and E3), and the page removes 3, 5, 6 and 7 from them.
  const step = technique('hidden-pair').find(fromValues('720408030080000047401076802810739000000851000000264080209680413340000008168943275'));
  assert.equal(step.technique, 'hidden-pair');
  assert.deepEqual(step.placements, []);
  assert.deepEqual(step.eliminations, removals([[cell(4, 3), [5, 6]], [cell(5, 3), [3, 6, 7]]]));
  assert.deepEqual(
    step.stages.map((stage) => stage.text),
    [
      'Look at column 3.',
      'In column 3, the digits 2 and 4 can only go in R4C3 and R5C3.',
      'R4C3 and R5C3 must be 2 and 4 in some order, so they cannot hold any other digit. Remove 5 and 6 from R4C3. Remove 3, 6 and 7 from R5C3.',
    ],
  );
});

test('hidden pair finds nothing when two digits share three cells', () => {
  // In row 1, 1 and 2 can go in R1C1, R1C2 and R1C3.
  const board = candidateBoard({ R1C4: '3456789', R1C5: '3456789', R1C6: '3456789', R1C7: '3456789', R1C8: '3456789', R1C9: '3456789' });
  assert.equal(technique('hidden-pair').find(board), null);
});

test('hidden triple, from SudokuWiki', () => {
  // https://www.sudokuwiki.org/Hidden_Candidates, "Two Hidden Triples", loaded position. In row 1,
  // 2, 5 and 6 can only go in R1C4, R1C7 and R1C9 (A4, A7 and A9). The page says these cells are
  // left with 2, 5 and 6, with 2 and 6, and with 2 and 5.
  const step = technique('hidden-triple').find(fromValues('000001030231090000065003100678924300103050006000136700009360570006019843300000000'));
  assert.equal(step.technique, 'hidden-triple');
  assert.deepEqual(step.eliminations, removals([[cell(1, 4), [4, 7, 8]], [cell(1, 7), [4, 9]], [cell(1, 9), [4, 7, 8, 9]]]));
  assert.equal(step.stages[1].text, 'In row 1, the digits 2, 5 and 6 can only go in R1C4, R1C7 and R1C9.');
});

test('hidden triple finds nothing when three digits share four cells', () => {
  // In row 1, 1, 2 and 3 can go in R1C1 to R1C4.
  const board = candidateBoard({ R1C5: '456789', R1C6: '456789', R1C7: '456789', R1C8: '456789', R1C9: '456789' });
  assert.equal(technique('hidden-triple').find(board), null);
});

test('hidden quad, from SudokuWiki', () => {
  // https://www.sudokuwiki.org/Hidden_Candidates, the second "Hidden Quad" example, from the start.
  // The page gives the quad {1,4,6,9} in block 5 in R4C4, R4C6, R6C4 and R6C6 (D4, D6, F4 and F6);
  // at the start of the puzzle these cells already form it.
  const step = technique('hidden-quad').find(fromValues('000500000425090001800010020500000000019000460000000002090040003200060807000001600'));
  assert.equal(step.technique, 'hidden-quad');
  assert.deepEqual(
    step.eliminations,
    removals([[cell(4, 4), [2, 3, 7, 8]], [cell(4, 6), [2, 3, 7, 8]], [cell(6, 4), [3, 7, 8]], [cell(6, 6), [3, 5, 7, 8]]]),
  );
  assert.equal(
    step.stages[2].text,
    'R4C4, R4C6, R6C4 and R6C6 must be 1, 4, 6 and 9 in some order, so they cannot hold any other digit. Remove 2, 3, 7 and 8 from R4C4 and R4C6. Remove 3, 7 and 8 from R6C4. Remove 3, 5, 7 and 8 from R6C6.',
  );
});

test('hidden quad finds nothing when four digits share five cells', () => {
  // In row 1, 1, 2, 3 and 4 can go in R1C1 to R1C5.
  const board = candidateBoard({ R1C6: '56789', R1C7: '56789', R1C8: '56789', R1C9: '56789' });
  assert.equal(technique('hidden-quad').find(board), null);
});

test('find does not change the board', () => {
  const board = fromValues('000500000425090001800010020500000000019000460000000002090040003200060807000001600');
  const values = board.values.slice();
  const cands = board.cands.slice();
  for (const t of subsets) t.find(board);
  assert.deepEqual(board.values, values);
  assert.deepEqual(board.cands, cands);
});
