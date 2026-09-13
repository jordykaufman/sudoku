import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board } from '../src/engine/board.js';
import { cellName } from '../src/engine/text.js';
import advanced from '../src/engine/techniques/advanced.js';

const technique = (id) => advanced.find((t) => t.id === id);

// 'R4C6' -> 32.
const cellIndex = (name) => {
  const [, r, c] = name.match(/^R(\d)C(\d)$/);
  return (r - 1) * 9 + (c - 1);
};

// A pencil-mark grid in which the named cells have the given candidates and every other cell
// has all nine.
function boardWith(cells) {
  const tokens = Array(81).fill('123456789');
  for (const [name, candidates] of Object.entries(cells)) tokens[cellIndex(name)] = candidates;
  return Board.fromCandidateGrid(tokens.join(' '));
}

const sorted = (eliminations) => [...eliminations].sort((a, b) => a[0] * 10 + a[1] - (b[0] * 10 + b[1]));

// Runs find, checks that the board is unchanged and that the step follows the hint rules, and
// returns the step.
function run(id, board) {
  const t = technique(id);
  const before = board.cands.slice();
  const step = t.find(board);
  assert.deepEqual(board.cands, before, 'find changed the board');
  if (!step) return null;
  assert.equal(step.technique, id);
  assert.deepEqual(step.placements, []);
  assert.ok(step.stages.length >= 3);
  assert.ok(!step.stages[0].text.includes(t.name), 'the first stage names the technique');
  const last = step.stages.at(-1).text;
  for (const [cell, digit] of step.eliminations) {
    assert.ok(board.has(cell, digit), `${digit} is not a candidate in ${cellName(cell)}`);
    assert.ok(last.includes(cellName(cell)), `the last stage does not name ${cellName(cell)}`);
  }
  return step;
}

function expectEliminations(id, board, expected) {
  const step = run(id, board);
  assert.ok(step, `${id} found nothing`);
  assert.deepEqual(sorted(step.eliminations), sorted(expected.map(([name, digit]) => [cellIndex(name), digit])));
  return step;
}

// SudokuWiki, Sue-De-Coq, example 1: D2 and E2 contain 2, 3, 5 and 8, B2 has 2 and 8, F3 has 3
// and 5. The page removes 8 from C2 and J2, 2 from G2 and 3 from E3. G2 also has an 8, which
// the same logic removes: 8 must go in B2, D2 or E2, and G2 sees all three.
const SUDOKUWIKI_SUE_DE_COQ_1 = `
47    1     34    9     5     8     346   467   2
289   28    6     3     4     7     5     1     89
5     378   3489  6     2     1     348   4789  78
1289  258   7     148   6     25    1489  3     189
6     238   12389 1478  78    23    148   4789  5
18    4     35    178   9     35    2     678   1678
1278  25678 1258  78    3     9     168   268   4
248   9     248   5     1     6     7     28    3
3     678   18    2     78    4     1689  5     1689`;

// SudokuWiki, Sue-De-Coq, example 2: E7 and E8 contain 1, 3, 6, 7 and 8, D9 and F9 have 1, 3
// and 7, E2 has 6 and 8. The page removes the 6s and 8s from the rest of row E and the 1s, 3s
// and 7s from the rest of box 6.
const SUDOKUWIKI_SUE_DE_COQ_2 = `
1     5     78    4     3     2     78    6     9
9     27    4     1     8     6     23    237   5
26    268   3     59    7     59    128   128   4
567   69    2     3568  16    1578  3689  4     137
4567  68    158   35    9     13457 136   1378  2
467   3     189   68    2     478   5     1789  17
25    279   59    3689  16    1389  4     137   137
3     4     6     7     5     19    129   129   8
8     1     79    2     4     39    379   5     6`;

// SudokuWiki, WXYZ-Wing page, comment by Strmckr (11 April 2018): A = r1c8 {78}, B = r79c8,r8c7
// {3678}, restricted commons 7 and 8. The doubly linked rule gives r3c8<>8, r7c7<>3,
// r9c79<>6. The singly linked rule with x = 7 and z = 8 gives r3c8<>8.
const STRMCKR_ALS = `
5     478   1     2     6     3     789   78    49
34    6     27    1     8     9     27    5     34
9     238   28    7     5     4     2368  2368  1
2     9     3     6     4     8     5     1     7
48    478   478   59    19    15    236   236   36
1     5     6     3     2     7     4     9     8
7     38    5     4     19    6     19    38    2
36    1     9     8     7     2     36    4     5
468   248   248   59    3     15    16789 678   69`;

// HoDoKu, Chains and Loops, Remote Pair example on the left (image rp01.png).
const HODOKU_REMOTE_PAIR = `
7 9 8 4 5 2 3 1 6
6 45 3 7 8 1 45 9 2
45 1 2 69 3 69 8 7 45
3 7 19 2 6 5 19 4 8
8 2 59 1 4 3 7 6 59
45 6 145 8 9 7 15 2 3
9 8 56 56 1 4 2 3 7
1 34 7 369 2 8 469 5 49
2 345 456 3569 7 69 469 8 1`;

test('sue de coq: SudokuWiki example 1', () => {
  const step = expectEliminations('sue-de-coq', Board.fromCandidateGrid(SUDOKUWIKI_SUE_DE_COQ_1), [
    ['R3C2', 8],
    ['R5C3', 3],
    ['R7C2', 2],
    ['R7C2', 8],
    ['R9C2', 8],
  ]);
  assert.equal(step.stages[0].text, 'Look at R4C2 and R5C2, where column 2 meets block 4.');
  assert.equal(
    step.stages[1].text,
    'R4C2 and R5C2 have the candidates 2, 3, 5 and 8 between them, 2 more than the number of cells. In column 2, R2C2 has only 2 and 8. In block 4, R6C3 has only 3 and 5.',
  );
});

test('sue de coq: SudokuWiki example 2, with two block cells', () => {
  expectEliminations('sue-de-coq', Board.fromCandidateGrid(SUDOKUWIKI_SUE_DE_COQ_2), [
    ['R4C7', 3],
    ['R5C1', 6],
    ['R5C3', 8],
    ['R6C8', 1],
    ['R6C8', 7],
  ]);
});

test('sue de coq: basic form removes row digits from the row and block digits from the block', () => {
  // R1C1 and R1C2 contain 3, 4, 5 and 9; R1C7 has 4 and 5; R2C3 has 3 and 9.
  const cells = { R1C1: '3459', R1C2: '3459', R1C7: '45' };
  const expected = [];
  for (const name of ['R1C3', 'R1C4', 'R1C5', 'R1C6', 'R1C8', 'R1C9']) expected.push([name, 4], [name, 5]);
  for (const name of ['R1C3', 'R2C1', 'R2C2', 'R3C1', 'R3C2', 'R3C3']) expected.push([name, 3], [name, 9]);
  expectEliminations('sue-de-coq', boardWith({ ...cells, R2C3: '39' }), expected);
  // If the row cell and the block cell share the candidate 4, there is no Sue de Coq.
  assert.equal(run('sue-de-coq', boardWith({ ...cells, R2C3: '49' })), null);
  assert.equal(run('sue-de-coq', Board.fromCandidateGrid(HODOKU_REMOTE_PAIR)), null);
});

test('als-xz: removes 8 from R3C8 in the Strmckr example', () => {
  const step = expectEliminations('als-xz', Board.fromCandidateGrid(STRMCKR_ALS), [['R3C8', 8]]);
  assert.equal(
    step.stages[1].text,
    'Look at two groups of cells. In the first, R1C8 has only the candidates 7 and 8. In the second, R7C8, R8C7 and R9C8 in block 9 have only the candidates 3, 6, 7 and 8 between them. Each group is in one house and has one more candidate than cells, so at most one of its candidates is left out.',
  );
});

test('als-xz: a bivalue cell and a four-cell set', () => {
  // R7C1 has 4 and 9. R4C2, R5C2, R6C2 and R8C2 contain 3, 4, 5, 6 and 9. The 9s of the two
  // sets are in R7C1 and R8C2, which share block 7, so one of the sets holds 4: R4C2 or R7C1.
  // Every other cell has all candidates, so 4 goes from each cell that sees R4C2 and R7C1.
  const cells = { R7C1: '49', R4C2: '34', R5C2: '56', R6C2: '35', R8C2: '69' };
  expectEliminations('als-xz', boardWith(cells), [['R4C1', 4], ['R5C1', 4], ['R6C1', 4], ['R7C2', 4], ['R9C2', 4]]);
  // With the 6 and 9 cell in R2C2 instead of R8C2, the 9s don't see each other.
  const { R8C2, ...rest } = cells;
  assert.equal(run('als-xz', boardWith({ ...rest, R2C2: R8C2 })), null);
  assert.equal(run('als-xz', Board.fromValues(new Uint8Array(81))), null);
});

test('advanced lessons are plain paragraphs', () => {
  for (const t of advanced) {
    assert.ok(Array.isArray(t.lesson) && t.lesson.length >= 2, t.id);
    for (const paragraph of t.lesson) assert.ok(typeof paragraph === 'string' && paragraph.endsWith('.'), t.id);
  }
});
