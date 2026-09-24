import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board } from '../src/engine/board.js';
import { cellName } from '../src/engine/text.js';
import wings from '../src/engine/techniques/wings.js';

const technique = (id) => wings.find((t) => t.id === id);

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

// HoDoKu, Chains and Loops, Remote Pair example on the left (image rp01.png): the chain
// r2c7-r2c2-r3c1-r6c1 on 4 and 5 removes 5 from r6c7.
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

// SudokuWiki, W-Wing Strategy, W-Wing example 1: A6 and F5 have 3 and 6, the strong link on 6
// is A3-F3, and 3 is removed from D6 and E6.
const SUDOKUWIKI_W_WING = `
19    8     46    346   2     36    15    59    7
29    46    3     5     1     7     8     269   2469
12    5     7     46    9     8     1246  3     1246
35    46    8     9     7     2356  23456 1     23456
7     1     9     236   4     2356  2356  256   8
35    2     46    8     36    1     9     7     3456
8     9     1     236   5     236   7     4     36
4     7     2     1     36    9     356   8     356
6     3     5     7     8     4     12    29    129`;

// SudokuWiki, Y-Wing Strategy, example 1: hinge A1 (1, 7), pincers A7 (2, 7) and E1 (1, 2);
// 2 is removed from E7.
const SUDOKUWIKI_Y_WING = `
17   3    4    5    9    12   27   8    6
8    179  2    17   6    3    4    5    179
6    179  5    4    27   8    237  13   1279
127  17   3    9    8    12   5    6    4
12   5    8    6    237  4    237  9    127
9    4    6    17   237  5    8    13   127
5    2    7    3    1    6    9    4    8
3    8    1    2    4    9    6    7    5
4    6    9    8    5    7    1    2    3`;

// SudokuWiki, XYZ-Wing, example 1: hinge F9 (1, 2, 4), pincers D9 (1, 2) and F1 (1, 4); 1 is
// removed from F7.
const SUDOKUWIKI_XYZ_WING_1 = `
38    9     2     46    48    1     7     5     346
5     134   1467  2     47    679   346   19    8
146   148   1467  4569  3     56789 2     19    46
38    7     5     13    128   4     9     6     12
2     38    14    139   6     89    148   7     5
14    6     9     7     125   258   148   3     124
146   145   8     1456  9     567   1356  2     1367
7     1245  146   1456  1245  3     156   8     9
9     125   3     8     1257  2567  156   4     167`;

// SudokuWiki, XYZ-Wing, example 2: hinge E8 with the common digit 6; 6 is removed from E9.
const SUDOKUWIKI_XYZ_WING_2 = `
6     79    13479 57    23457 234   125   145   8
5     13    134   9     2346  8     1246  146   7
8     2     47    567   4567  1     4569  3     69
3     4     567   2     15    9     67    8     16
2     79    5679  15    8     46    3     467   169
1     8     69    3     46    7     469   2     5
7     5     138   4     136   36    168   9     2
9     136   1238  1678  12367 5     1678  167   4
4     16    128   1678  9     26    15678 1567  3`;

// SudokuWiki, WXYZ-Wing, examples 1 to 4.
const SUDOKUWIKI_WXYZ_WING = [
  {
    // Hinge D3 (1, 2, 5, 9); 9 is removed from D2.
    grid: `
1689  169   189   1589  2     4     7     3     158
5     4     189   3     7     89    2     6     18
2     3     7     1568  15    568   159   189   4
7     12569 1259  59    3     259   8     4     156
69    2569  3     4     8     1     59    279   567
19    8     4     579   6     2579  159   12    3
3     12    128   1678  14    678   46    5     9
148   7     158   568   9     3     46    18    2
1489  159   6     2     145   58    3     178   178`,
    expected: [['R4C2', 9]],
  },
  {
    // D6, E5, G6 and J6 contain 2, 5, 6 and 9; 5 is removed from F6, G5 and J5.
    grid: `
8    4    2    56   56   3    7    1    9
67   679  3    1    789  4    568  258  26
5    679  1    27   2789 289  68   3    4
69   3    8    26   1    269  4    7    5
49   2    45   3    59   7    1    6    8
1    56   7    456  458  568  2    9    3
3    58   6    247  2457 25   9    458  1
47   578  45   9    3    1    568  258  26
2    1    9    8    456  56   3    45   7`,
    expected: [['R6C6', 5], ['R7C5', 5], ['R9C5', 5]],
  },
  {
    // C1, B2, C8 and C3 contain 3, 4, 5 and 9; 3 is removed from B7, B8 and B9.
    grid: `
2457  135   1257  3467  2367  247   8     3456  9
2479  39    8     34679 23679 5     13    346   136
459   6     59    1     389   489   7     345   2
589   589   2569  679   15679 3     1259  279   4
259   7     23569 69    4     19    12359 8     135
1     4     359   2     5789  789   6     379   357
3     589   4     789   279   6     259   1     578
789   2     179   5     1379  179   4     3679  3678
6     1589  1579  34789 12379 12479 2359  279   3578`,
    expected: [['R2C7', 3], ['R2C8', 3], ['R2C9', 3]],
  },
  {
    // Hinge B4, with B3, B6 and D4; 5 is removed from A4.
    grid: `
9    246  3    458  267  1    478  245  2578
8    246  46   345  2367 56   3479 1245 1279
7    5    1    348  23   9    348  6    28
1    8    7    35   36   56   2    9    4
35   34   45   7    9    2    1    8    6
2    69   69   1    4    8    5    7    3
6    7    58   9    1    3    48   245  258
35   39   2    6    8    4    79   15   1579
4    1    89   2    5    7    6    3    89`,
    expected: [['R1C4', 5]],
  },
];

// SudokuWiki, Sue-De-Coq, example 1. No wing applies here.
const SUDOKUWIKI_SUE_DE_COQ = `
47    1     34    9     5     8     346   467   2
289   28    6     3     4     7     5     1     89
5     378   3489  6     2     1     348   4789  78
1289  258   7     148   6     25    1489  3     189
6     238   12389 1478  78    23    148   4789  5
18    4     35    178   9     35    2     678   1678
1278  25678 1258  78    3     9     168   268   4
248   9     248   5     1     6     7     28    3
3     678   18    2     78    4     1689  5     1689`;

test('remote pair: HoDoKu example removes 5 from R6C7', () => {
  const step = expectEliminations('remote-pair', Board.fromCandidateGrid(HODOKU_REMOTE_PAIR), [['R6C7', 5]]);
  assert.equal(step.stages[0].text, 'Look at the cells whose only candidates are 4 and 5.');
  assert.equal(
    step.stages[2].text,
    'R2C7 and R6C1 are 3 steps apart, an odd number, so one of them is 4 and the other is 5. R6C7 sees both of them, so it cannot be 4 or 5. Remove 5 from R6C7.',
  );
});

test('remote pair: removes both digits from cells that see both ends of the chain', () => {
  // R1C1-R1C5 share row 1, R1C5-R3C4 share block 2, R3C4-R7C4 share column 4.
  const board = boardWith({ R1C1: '27', R1C5: '27', R3C4: '27', R7C4: '27' });
  expectEliminations('remote-pair', board, [['R1C4', 2], ['R1C4', 7], ['R7C1', 2], ['R7C1', 7]]);
});

test('remote pair: nothing for a chain of three cells, or after the elimination', () => {
  assert.equal(run('remote-pair', boardWith({ R1C1: '27', R1C5: '27', R3C4: '27' })), null);
  const board = Board.fromCandidateGrid(HODOKU_REMOTE_PAIR);
  board.apply(technique('remote-pair').find(board));
  assert.equal(run('remote-pair', board), null);
  assert.equal(run('remote-pair', Board.fromCandidateGrid(SUDOKUWIKI_W_WING)), null);
});

test('w-wing: SudokuWiki example removes 3 from R4C6 and R5C6', () => {
  const step = expectEliminations('w-wing', Board.fromCandidateGrid(SUDOKUWIKI_W_WING), [['R4C6', 3], ['R5C6', 3]]);
  assert.equal(
    step.stages[1].text,
    'Only R1C3 and R6C3 can be 6 in column 3, so one of them is 6. R1C6 sees R1C3 and R6C5 sees R6C3. If R1C3 is 6, R1C6 is 3. If R6C3 is 6, R6C5 is 3.',
  );
});

test('w-wing: needs a strong link', () => {
  // R1C1 and R5C9 have 1 and 5 and don't see each other. In column 5 only R1C5 and R5C5 have 5.
  const cells = { R1C1: '15', R5C9: '15' };
  for (const r of [2, 3, 4, 6, 7, 8, 9]) cells[`R${r}C5`] = '12346789';
  expectEliminations('w-wing', boardWith(cells), [['R1C9', 1], ['R5C1', 1]]);
  // With a third 5 in column 5 there is no strong link.
  assert.equal(run('w-wing', boardWith({ ...cells, R9C5: '123456789' })), null);
  assert.equal(run('w-wing', Board.fromCandidateGrid(SUDOKUWIKI_XYZ_WING_1)), null);
});

test('xy-wing: SudokuWiki example removes 2 from R5C7', () => {
  const step = expectEliminations('xy-wing', Board.fromCandidateGrid(SUDOKUWIKI_Y_WING), [['R5C7', 2]]);
  assert.equal(step.stages[0].text, 'Look at R1C1, which has only the candidates 1 and 7.');
});

test('xy-wing: removes z from every cell that sees both pincers', () => {
  // Pivot R1C1 (3, 7), pincers R1C5 (3, 5) and R3C2 (5, 7).
  const cells = { R1C1: '37', R1C5: '35', R3C2: '57' };
  expectEliminations('xy-wing', boardWith(cells), [['R1C2', 5], ['R1C3', 5], ['R3C4', 5], ['R3C5', 5], ['R3C6', 5]]);
  // If the second pincer has 8 instead of 7, there is no XY-Wing.
  assert.equal(run('xy-wing', boardWith({ ...cells, R3C2: '58' })), null);
  assert.equal(run('xy-wing', Board.fromCandidateGrid(HODOKU_REMOTE_PAIR)), null);
});

test('xyz-wing: SudokuWiki examples', () => {
  expectEliminations('xyz-wing', Board.fromCandidateGrid(SUDOKUWIKI_XYZ_WING_1), [['R6C7', 1]]);
  expectEliminations('xyz-wing', Board.fromCandidateGrid(SUDOKUWIKI_XYZ_WING_2), [['R5C9', 6]]);
});

test('xyz-wing: removes z only from cells that see all three cells', () => {
  // Pivot R1C1 (2, 4, 8), pincers R1C5 (2, 8) and R2C2 (4, 8).
  const cells = { R1C1: '248', R1C5: '28', R2C2: '48' };
  expectEliminations('xyz-wing', boardWith(cells), [['R1C2', 8], ['R1C3', 8]]);
  // R2C5 doesn't see the pivot.
  assert.equal(run('xyz-wing', boardWith({ R1C1: '248', R1C5: '28', R2C5: '48' })), null);
  assert.equal(run('xyz-wing', Board.fromCandidateGrid(SUDOKUWIKI_Y_WING)), null);
});

test('wxyz-wing: SudokuWiki examples', () => {
  for (const { grid, expected } of SUDOKUWIKI_WXYZ_WING) {
    expectEliminations('wxyz-wing', Board.fromCandidateGrid(grid), expected);
  }
});

test('wxyz-wing: needs exactly one digit that is not restricted', () => {
  // R4C3, R4C4, R4C6 and R6C1 contain 1, 2, 5 and 9. 1, 2 and 5 are restricted; the 9 in R6C1
  // doesn't see the 9s in R4C4 and R4C6.
  const cells = { R4C3: '1259', R4C4: '59', R4C6: '259', R6C1: '19' };
  const step = expectEliminations('wxyz-wing', boardWith(cells), [['R4C1', 9], ['R4C2', 9]]);
  assert.match(
    step.stages[1].text,
    /In these cells, every 1 is in block 4, every 2 is in row 4 and every 5 is in row 4, so each of 1, 2 and 5 can go in at most one of them\. The 9s are not all in one row, column or block: R4C4 and R6C1 both have 9/,
  );
  // With the 5 and 9 cell in R5C4 instead of R4C4, its 5 doesn't see the 5 in R4C3 either.
  const { R4C4, ...rest } = cells;
  assert.equal(run('wxyz-wing', boardWith({ ...rest, R5C4: R4C4 })), null);
});

test('wxyz-wing: nothing on boards without one', () => {
  assert.equal(run('wxyz-wing', Board.fromCandidateGrid(SUDOKUWIKI_SUE_DE_COQ)), null);
  assert.equal(run('wxyz-wing', Board.fromCandidateGrid(HODOKU_REMOTE_PAIR)), null);
});

test('wing lessons are plain paragraphs', () => {
  for (const t of wings) {
    assert.ok(Array.isArray(t.lesson) && t.lesson.length >= 2, t.id);
    for (const paragraph of t.lesson) assert.ok(typeof paragraph === 'string' && paragraph.endsWith('.'), t.id);
  }
});
