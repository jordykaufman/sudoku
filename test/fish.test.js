import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board } from '../src/engine/board.js';
import { cellName, houseName } from '../src/engine/text.js';
import fish from '../src/engine/techniques/fish.js';
import { ORDER } from '../src/engine/techniques/order.js';

const technique = (id) => fish.find((t) => t.id === id);

// Pencil-mark grids from the examples on HoDoKu's fish pages
// (https://hodoku.sourceforge.net/en/tech_fishb.php and tech_fishfs.php). The comment above
// each grid is the step HoDoKu gives for it.

// X-Wing: 5 r25 c58 => r4c5<>5
const XWING_ROWS = `
| 58  4   1 | 7    2    9    | 68  3   56 |
| 7   6   9 | 18   158  3    | 4   58  2  |
| 58  3   2 | 6    4    58   | 7   1   9  |
| 4   28  3 | 9    58   2568 | 1   7   56 |
| 6   28  7 | 128  158  4    | 9   58  3  |
| 1   9   5 | 3    7    68   | 68  2   4  |
| 2   1   4 | 5    6    7    | 3   9   8  |
| 3   7   6 | 28   9    28   | 5   4   1  |
| 9   5   8 | 4    3    1    | 2   6   7  |`;

// X-Wing: 1 c15 r25 => r2c4789,r5c34789<>1
const XWING_COLUMNS = `
| 9   8  14  | 14     6   2  | 7      5       3   |
| 14  6  5   | 14789  17  3  | 1289   1489    124 |
| 3   2  7   | 1489   5   48 | 189    1489    6   |
| 7   9  146 | 1268   3   68 | 5      1468    124 |
| 14  5  146 | 12678  17  9  | 12368  134678  124 |
| 8   3  2   | 167    4   5  | 16     167     9   |
| 6   7  3   | 5      9   1  | 4      2       8   |
| 2   4  9   | 36     8   7  | 136    136     5   |
| 5   1  8   | 346    2   46 | 369    369     7   |`;

// Swordfish: 2 r239 c158 => r6c8,r7c1<>2
const SWORDFISH_ROWS = `
| 1     6    29  | 5   4   3  | 289   7    28 |
| 29    7    8   | 6   29  1  | 4     3    5  |
| 4     3    5   | 8   29  7  | 6     29   1  |
| 7     2    13  | 4   5   8  | 13    6    9  |
| 6     48   34  | 9   1   2  | 38    5    7  |
| 589   589  19  | 3   7   6  | 128   28   4  |
| 2589  1    6   | 27  3   59 | 2789  4    28 |
| 3     459  249 | 27  8   59 | 279   1    6  |
| 289   89   7   | 1   6   4  | 5     289  3  |`;

// Swordfish: 4 r247 c235 => r3c235,r6c235,r8c235,r9c23<>4
const SWORDFISH_ROWS_2 = `
| 1     679      8      | 5   679    79   | 2  3   4   |
| 5     469      469    | 3   469    2    | 1  7   8   |
| 247   2347     2347   | 8   147    147  | 5  6   9   |
| 8     124      124    | 6   124    5    | 7  9   3   |
| 267   267      5      | 9   237    37   | 4  8   1   |
| 3     1479     1479   | 14  147    8    | 6  5   2   |
| 9     8        47     | 2   45     6    | 3  1   57  |
| 2467  1234567  123467 | 14  13459  1349 | 8  24  567 |
| 246   123456   12346  | 7   8      134  | 9  24  56  |`;

// Jellyfish: 7 r3467 c1259 => r1c25,r2c19,r5c129,r9c25<>7
const JELLYFISH_ROWS = `
| 2      14567   4567  | 16789  15678  179 | 78     4689  3     |
| 1679   8       467   | 1679   3      179 | 27     5     24679 |
| 5679   567     3     | 4      5678   2   | 1      689   6789  |
| 3678   367     1     | 2      67     5   | 4      389   789   |
| 35678  234567  45678 | 167    9      147 | 23578  1238  2578  |
| 57     2457    9     | 3      147    8   | 6      12    257   |
| 1378   137     2     | 5      1478   6   | 9      348   48    |
| 13568  9       568   | 18     2      134 | 358    7     4568  |
| 4      3567    5678  | 789    78     379 | 2358   2368  1     |`;

// Jellyfish: 7 r1367 c2589 => r2c2,r9c5<>7
const JELLYFISH_ROWS_2 = `
| 2    679    4  | 1   679  3   | 5   8    79  |
| 589  56789  78 | 67  2    679 | 3   4    1   |
| 1    79     3  | 4   8    5   | 6   279  279 |
| 7    3      2  | 9   5    4   | 1   6    8   |
| 48   48     5  | 67  1    67  | 9   23   23  |
| 6    1      9  | 8   3    2   | 4   57   57  |
| 49   479    1  | 5   679  8   | 2   39   369 |
| 3    59     78 | 2   4    169 | 78  159  569 |
| 589  2      6  | 3   79   179 | 78  159  4   |`;

// Finned X-Wing: 9 r24 c35 fr2c1 => r3c3<>9
const FINNED_XWING = `
| 149  5  2   | 6    7    19 | 3  49  8 |
| 149  3  189 | 148  489  5  | 6  2   7 |
| 6    7  89  | 48   3    2  | 5  49  1 |
| 2    8  39  | 47   49   6  | 1  37  5 |
| 59   6  359 | 178  89   19 | 2  37  4 |
| 7    1  4   | 5    2    3  | 8  6   9 |
| 8    2  7   | 3    1    4  | 9  5   6 |
| 15   9  15  | 2    6    7  | 4  8   3 |
| 3    4  6   | 9    5    8  | 7  1   2 |`;

// Sashimi X-Wing: 3 c36 r37 fr8c3 fr9c3 => r7c1<>3
const SASHIMI_XWING = `
| 1267  127    56   | 14567  457  156  | 3   8   9 |
| 9     378    4    | 78     378  2    | 5   6   1 |
| 136   138    3568 | 1568   9    1356 | 7   2   4 |
| 4     6      1    | 9      2    7    | 8   5   3 |
| 8     5      9    | 3      6    4    | 1   7   2 |
| 37    37     2    | 158    58   15   | 4   9   6 |
| 236   9      7    | 256    1    356  | 26  4   8 |
| 5     1234   36   | 246    34   8    | 9   13  7 |
| 1236  12348  368  | 2467   347  9    | 26  13  5 |`;

// Finned Swordfish: 7 c159 r357 fr1c9 => r3c7<>7
const FINNED_SWORDFISH = `
| 2    79  3   | 49  1    8   | 6   5  47  |
| 4    1   6   | 7   5    3   | 9   8  2   |
| 79   5   8   | 49  2    6   | 37  1  347 |
| 8    4   17  | 3   6    2   | 17  9  5   |
| 6    2   179 | 8   79   5   | 4   3  17  |
| 5    3   79  | 1   4    79  | 8   2  6   |
| 179  6   5   | 2   379  179 | 13  4  8   |
| 3    79  4   | 5   8    179 | 2   6  19  |
| 19   8   2   | 6   39   4   | 5   7  139 |`;

// Sashimi Swordfish: 2 r269 c258 fr6c4 => r45c5<>2
const SASHIMI_SWORDFISH = `
| 2    34      7    | 8   9    5 | 6     34     1   |
| 5    136     16   | 7   123  4 | 9     23     8   |
| 134  9       8    | 12  123  6 | 235   23457  257 |
| 136  123567  1256 | 4   127  9 | 1258  1258   25  |
| 14   12457   1245 | 6   127  8 | 125   9      3   |
| 8    12      9    | 12  5    3 | 7     6      4   |
| 149  1458    145  | 3   6    2 | 158   1578   579 |
| 169  1268    126  | 5   4    7 | 1238  1238   29  |
| 7    25      3    | 9   8    1 | 4     25     6   |`;

// Finned Jellyfish: 9 r2479 c1348 fr4c9 => r56c8<>9
const FINNED_JELLYFISH = `
| 35   249  35  | 1   6    249 | 8    7     29   |
| 26   1    69  | 8   7    5   | 24   249   3    |
| 8    249  7   | 3   49   249 | 6    5     1    |
| 49   5    489 | 6   2    1   | 7    3     89   |
| 26   29   1   | 7   389  389 | 5    689   4    |
| 7    3    689 | 5   489  489 | 1    2689  2689 |
| 159  7    59  | 49  138  38  | 234  2468  2568 |
| 34   8    34  | 2   5    6   | 9    1     7    |
| 159  6    2   | 49  138  7   | 34   48    58   |`;

// Sashimi Jellyfish: 8 r1469 c1289 fr9c3 => r7c12,r8c12<>8
const SASHIMI_JELLYFISH = `
| 5789   5789  3  | 4    1    6  | 2     5789   5789 |
| 2      6     89 | 79   589  3  | 1     5789   4    |
| 1      5789  4  | 279  589  28 | 789   3      6    |
| 89     4     6  | 3    7    1  | 5     89     2    |
| 359    2     1  | 8    4    59 | 679   679    379  |
| 3589   3589  7  | 6    2    59 | 4     1      389  |
| 6789   789   5  | 29   3    28 | 6789  4      1    |
| 36789  3789  2  | 1    89   4  | 6789  56789  5789 |
| 4      1     89 | 5    6    7  | 3     2      89   |`;

const grid = (text) => Board.fromCandidateGrid(text);

// The board mirrored across the diagonal from R1C1 to R9C9, so that rows become columns.
function transpose(board) {
  const mirror = (cell) => (cell % 9) * 9 + Math.floor(cell / 9);
  const out = new Board();
  for (let cell = 0; cell < 81; cell++) {
    out.values[mirror(cell)] = board.values[cell];
    out.cands[mirror(cell)] = board.cands[cell];
    out.givens[mirror(cell)] = board.givens[cell];
  }
  return out;
}

// A board drawn for one digit, one character per cell: x is a candidate in the pattern, f a
// fin, * a candidate the technique should remove, o another candidate, . a cell without the
// candidate and # the digit placed. Every empty cell also has all the other digits as
// candidates, so no other digit forms a fish. Returns the board and the names of the * cells.
function picture(digit, drawing) {
  const marks = [...drawing.replace(/[^xfo*.#]/g, '')];
  assert.equal(marks.length, 81, 'a drawing needs 81 cells');
  const others = '123456789'.replace(String(digit), '');
  const tokens = marks.map((m) => (m === '#' ? String(digit) : m === '.' ? others : '123456789'));
  const stars = marks.flatMap((m, cell) => (m === '*' ? [cellName(cell)] : []));
  return { board: Board.fromCandidateGrid(tokens.join(' ')), stars };
}

// Runs a technique and checks its step: the eliminations, the base lines (stage 2 houses),
// the cover lines (stage 3 houses), the fins, the highlights and the text. Houses and cells
// are given by name.
function expectStep(id, board, { digit, base, cover, fins = [], removed }) {
  const before = [board.values.slice(), board.cands.slice()];
  const step = technique(id).find(board);
  assert.deepEqual([board.values, board.cands], before, 'find changed the board');
  assert.ok(step, `${id} found nothing`);
  assert.equal(step.technique, id);
  assert.deepEqual(step.placements, []);
  assert.deepEqual(
    step.eliminations.map(([cell, d]) => `${cellName(cell)}<>${d}`),
    removed.map((name) => `${name}<>${digit}`),
  );

  assert.equal(step.stages.length, 3);
  const [nudge, pattern, result] = step.stages;
  assert.equal(nudge.text, `Consider the digit ${digit}.`);
  assert.deepEqual(pattern.houses.map(houseName), base);
  assert.deepEqual(result.houses.map(houseName), cover);
  const baseCells = pattern.houses.flatMap((house) => board.where(house, digit)).sort((a, b) => a - b);
  assert.deepEqual(pattern.marks.map(([cell]) => cell), baseCells);
  assert.ok(pattern.marks.every(([, d, role]) => d === digit && (role === 'key' || role === 'fin')));
  assert.deepEqual(pattern.marks.filter(([, , role]) => role === 'fin').map(([cell]) => cellName(cell)), fins);
  assert.deepEqual(
    result.marks.filter(([, , role]) => role === 'elim').map(([cell, d]) => [cell, d]),
    step.eliminations,
  );
  for (const name of [...base, ...fins]) assert.ok(pattern.text.includes(name), `stage 2 does not name ${name}`);
  for (const name of [...cover, ...removed]) assert.ok(result.text.includes(name), `stage 3 does not name ${name}`);
  return step;
}

function expectNone(id, board) {
  assert.equal(technique(id).find(board), null, `${id} found a step`);
}

test('ids, names, order and lessons', () => {
  assert.deepEqual(
    fish.map((t) => [t.id, t.name]),
    [
      ['x-wing', 'X-Wing'],
      ['swordfish', 'Swordfish'],
      ['jellyfish', 'Jellyfish'],
      ['finned-x-wing', 'Finned X-Wing'],
      ['finned-swordfish', 'Finned Swordfish'],
      ['finned-jellyfish', 'Finned Jellyfish'],
      ['sashimi-x-wing', 'Sashimi X-Wing'],
      ['sashimi-swordfish', 'Sashimi Swordfish'],
      ['sashimi-jellyfish', 'Sashimi Jellyfish'],
    ],
  );
  for (const t of fish) {
    assert.ok(ORDER.includes(t.id), `${t.id} is not in order.js`);
    assert.ok(t.lesson.length >= 3, `${t.id} lesson`);
    for (const paragraph of t.lesson) assert.ok(typeof paragraph === 'string' && paragraph.trim());
  }
});

test('X-Wing in rows (HoDoKu example)', () => {
  const step = expectStep('x-wing', grid(XWING_ROWS), {
    digit: 5,
    base: ['row 2', 'row 5'],
    cover: ['column 5', 'column 8'],
    removed: ['R4C5'],
  });
  assert.deepEqual(
    step.stages.map((stage) => stage.text),
    [
      'Consider the digit 5.',
      'In row 2 and row 5, the candidates for 5 are all in column 5 and column 8.',
      'The 5s of row 2 and row 5 can only go in column 5 and column 8, and they cannot share a column. ' +
        'So column 5 and column 8 each have their 5 in one of those rows, and 5 can be removed from R4C5.',
    ],
  );
});

test('X-Wing in columns (HoDoKu example)', () => {
  expectStep('x-wing', grid(XWING_COLUMNS), {
    digit: 1,
    base: ['column 1', 'column 5'],
    cover: ['row 2', 'row 5'],
    removed: ['R2C4', 'R2C7', 'R2C8', 'R2C9', 'R5C3', 'R5C4', 'R5C7', 'R5C8', 'R5C9'],
  });
});

test('Swordfish in rows (HoDoKu examples)', () => {
  expectStep('swordfish', grid(SWORDFISH_ROWS), {
    digit: 2,
    base: ['row 2', 'row 3', 'row 9'],
    cover: ['column 1', 'column 5', 'column 8'],
    removed: ['R6C8', 'R7C1'],
  });
  expectStep('swordfish', grid(SWORDFISH_ROWS_2), {
    digit: 4,
    base: ['row 2', 'row 4', 'row 7'],
    cover: ['column 2', 'column 3', 'column 5'],
    removed: ['R3C2', 'R3C3', 'R3C5', 'R6C2', 'R6C3', 'R6C5', 'R8C2', 'R8C3', 'R8C5', 'R9C2', 'R9C3'],
  });
});

test('Swordfish in columns (worked on the HoDoKu X-Wing grid)', () => {
  // Column 1 has 5 only in R1C1 and R3C1, column 6 only in R3C6 and R4C6, and column 9 only
  // in R1C9 and R4C9. Their three 5s are in rows 1, 3 and 4, one in each row, so R4C5 is not 5.
  expectStep('swordfish', grid(XWING_ROWS), {
    digit: 5,
    base: ['column 1', 'column 6', 'column 9'],
    cover: ['row 1', 'row 3', 'row 4'],
    removed: ['R4C5'],
  });
});

test('Jellyfish in rows (HoDoKu examples)', () => {
  expectStep('jellyfish', grid(JELLYFISH_ROWS), {
    digit: 7,
    base: ['row 3', 'row 4', 'row 6', 'row 7'],
    cover: ['column 1', 'column 2', 'column 5', 'column 9'],
    removed: ['R1C2', 'R1C5', 'R2C1', 'R2C9', 'R5C1', 'R5C2', 'R5C9', 'R9C2', 'R9C5'],
  });
  expectStep('jellyfish', grid(JELLYFISH_ROWS_2), {
    digit: 7,
    base: ['row 1', 'row 3', 'row 6', 'row 7'],
    cover: ['column 2', 'column 5', 'column 8', 'column 9'],
    removed: ['R2C2', 'R9C5'],
  });
});

test('Jellyfish in columns (drawn)', () => {
  // Columns 1, 4, 5 and 8 have their 6s in rows 2, 3, 6 and 9. The other candidates in those
  // rows are removed.
  const { board, stars } = picture(
    6,
    `
    . o o | . . o | o . o
    x . * | . x . | . . *
    . . . | x x * | . . .
    ------+-------+------
    . o o | . . o | o . o
    . o o | . . o | o . o
    x * . | . . . | . x .
    ------+-------+------
    . o o | . . o | o . o
    . o o | . . o | o . o
    . . . | x x . | * x .
    `,
  );
  expectStep('jellyfish', board, {
    digit: 6,
    base: ['column 1', 'column 4', 'column 5', 'column 8'],
    cover: ['row 2', 'row 3', 'row 6', 'row 9'],
    removed: stars,
  });
});

test('Finned X-Wing in rows (HoDoKu example)', () => {
  const step = expectStep('finned-x-wing', grid(FINNED_XWING), {
    digit: 9,
    base: ['row 2', 'row 4'],
    cover: ['column 3', 'column 5'],
    fins: ['R2C1'],
    removed: ['R3C3'],
  });
  assert.deepEqual(
    step.stages.map((stage) => stage.text),
    [
      'Consider the digit 9.',
      'In row 2 and row 4, the only candidate for 9 outside column 3 and column 5 is R2C1, which is in block 1.',
      'Either R2C1 is 9 or it is not. If R2C1 is not 9, the 9s of row 2 and row 4 are in column 3 and column 5, one in each column, ' +
        'so no other cell in those columns can be 9. ' +
        'If R2C1 is 9, no other cell in block 1 can be 9. ' +
        'R3C3 is in those columns and in block 1, so either way 9 can be removed from R3C3.',
    ],
  );
});

test('Finned X-Wing in columns (HoDoKu example, transposed)', () => {
  expectStep('finned-x-wing', transpose(grid(FINNED_XWING)), {
    digit: 9,
    base: ['column 2', 'column 4'],
    cover: ['row 3', 'row 5'],
    fins: ['R1C2'],
    removed: ['R3C3'],
  });
});

test('Finned X-Wing removes only cells that are in a cover line and in the fins block (drawn)', () => {
  // Block 3 has other candidates in R2C7, R2C9, R3C7 and R3C9, but they are not in column 2
  // or column 8.
  const { board, stars } = picture(
    4,
    `
    . x . | . . . | . x f
    o o o | o o o | o * o
    o o o | o o o | o * o
    ------+-------+------
    o o o | o o o | o o o
    . x . | . . . | . x .
    o o o | o o o | o o o
    ------+-------+------
    o o o | o o o | o o o
    o o o | o o o | o o o
    o o o | o o o | o o o
    `,
  );
  expectStep('finned-x-wing', board, {
    digit: 4,
    base: ['row 1', 'row 5'],
    cover: ['column 2', 'column 8'],
    fins: ['R1C9'],
    removed: stars,
  });
  expectNone('sashimi-x-wing', board);
});

test('Finned Swordfish in columns (HoDoKu example)', () => {
  expectStep('finned-swordfish', grid(FINNED_SWORDFISH), {
    digit: 7,
    base: ['column 1', 'column 5', 'column 9'],
    cover: ['row 3', 'row 5', 'row 7'],
    fins: ['R1C9'],
    removed: ['R3C7'],
  });
});

test('Finned Swordfish in rows (HoDoKu example, transposed)', () => {
  expectStep('finned-swordfish', transpose(grid(FINNED_SWORDFISH)), {
    digit: 7,
    base: ['row 1', 'row 5', 'row 9'],
    cover: ['column 3', 'column 5', 'column 7'],
    fins: ['R9C1'],
    removed: ['R7C3'],
  });
});

test('Finned Jellyfish in rows (HoDoKu example)', () => {
  expectStep('finned-jellyfish', grid(FINNED_JELLYFISH), {
    digit: 9,
    base: ['row 2', 'row 4', 'row 7', 'row 9'],
    cover: ['column 1', 'column 3', 'column 4', 'column 8'],
    fins: ['R4C9'],
    removed: ['R5C8', 'R6C8'],
  });
});

test('Finned Jellyfish in columns (worked on the HoDoKu Swordfish grid)', () => {
  // Columns 2, 3, 6 and 7 have 9 in R6C2, R8C2, R9C2, R1C3, R6C3, R8C3, R7C6, R8C6, R1C7, R7C7
  // and R8C7. All but R9C2 are in rows 1, 6, 7 and 8, and each column has at least two of
  // them. If R9C2 is 9, block 7 has its 9. If not, rows 1, 6, 7 and 8 have their 9s in these
  // columns. Either way R7C1, in row 7 and block 7, is not 9.
  expectStep('finned-jellyfish', grid(SWORDFISH_ROWS), {
    digit: 9,
    base: ['column 2', 'column 3', 'column 6', 'column 7'],
    cover: ['row 1', 'row 6', 'row 7', 'row 8'],
    fins: ['R9C2'],
    removed: ['R7C1'],
  });
});

test('Sashimi X-Wing in columns (HoDoKu example)', () => {
  const step = expectStep('sashimi-x-wing', grid(SASHIMI_XWING), {
    digit: 3,
    base: ['column 3', 'column 6'],
    cover: ['row 3', 'row 7'],
    fins: ['R8C3', 'R9C3'],
    removed: ['R7C1'],
  });
  assert.deepEqual(
    step.stages.map((stage) => stage.text),
    [
      'Consider the digit 3.',
      'In column 3 and column 6, the only candidates for 3 outside row 3 and row 7 are R8C3 and R9C3, which are both in block 7. ' +
        'Column 3 has only one candidate for 3 in those rows: R3C3.',
      'Either one of R8C3 and R9C3 is 3, or neither is. If neither R8C3 nor R9C3 is 3, the 3s of column 3 and column 6 are in row 3 and row 7, one in each row, ' +
        'so no other cell in those rows can be 3. ' +
        'If R8C3 or R9C3 is 3, no other cell in block 7 can be 3. ' +
        'R7C1 is in those rows and in block 7, so either way 3 can be removed from R7C1.',
    ],
  );
});

test('Sashimi X-Wing in rows (HoDoKu example, transposed)', () => {
  expectStep('sashimi-x-wing', transpose(grid(SASHIMI_XWING)), {
    digit: 3,
    base: ['row 3', 'row 6'],
    cover: ['column 3', 'column 7'],
    fins: ['R3C8', 'R3C9'],
    removed: ['R1C7'],
  });
});

test('Sashimi Swordfish in rows (HoDoKu example, whose grid has two)', () => {
  // Rows 2, 6 and 9 have 2 in R2C5, R2C8, R6C2, R6C4, R9C2 and R9C8. With columns 2, 4 and 8
  // as cover lines, R2C5 is the fin and row 2 has only R2C8 in them. R3C4 is in column 4 and
  // in block 2, so it is not 2. This pattern comes first in the search order.
  const board = grid(SASHIMI_SWORDFISH);
  const first = expectStep('sashimi-swordfish', board, {
    digit: 2,
    base: ['row 2', 'row 6', 'row 9'],
    cover: ['column 2', 'column 4', 'column 8'],
    fins: ['R2C5'],
    removed: ['R3C4'],
  });
  board.apply(first);
  // The pattern HoDoKu shows.
  expectStep('sashimi-swordfish', board, {
    digit: 2,
    base: ['row 2', 'row 6', 'row 9'],
    cover: ['column 2', 'column 5', 'column 8'],
    fins: ['R6C4'],
    removed: ['R4C5', 'R5C5'],
  });
});

test('Sashimi Swordfish in columns (worked on the HoDoKu Finned Swordfish grid)', () => {
  // Columns 1, 5 and 7 have 7 in R3C1, R7C1, R5C5, R7C5, R3C7 and R4C7. With rows 3, 5 and 7
  // as cover lines, R4C7 is the fin and column 7 has only R3C7 in them. R5C9 is in row 5 and
  // in block 6, so it is not 7.
  expectStep('sashimi-swordfish', grid(FINNED_SWORDFISH), {
    digit: 7,
    base: ['column 1', 'column 5', 'column 7'],
    cover: ['row 3', 'row 5', 'row 7'],
    fins: ['R4C7'],
    removed: ['R5C9'],
  });
});

test('Sashimi Jellyfish in rows (HoDoKu example)', () => {
  expectStep('sashimi-jellyfish', grid(SASHIMI_JELLYFISH), {
    digit: 8,
    base: ['row 1', 'row 4', 'row 6', 'row 9'],
    cover: ['column 1', 'column 2', 'column 8', 'column 9'],
    fins: ['R9C3'],
    removed: ['R7C1', 'R7C2', 'R8C1', 'R8C2'],
  });
});

test('Sashimi Jellyfish in columns (worked on the HoDoKu Sashimi Swordfish grid)', () => {
  // Columns 3, 4, 7 and 9 have 2 only in rows 3, 4, 5 and 8, apart from R6C4, and column 4
  // has only R3C4 in those rows. R4C5 and R5C5 are in rows 4 and 5 and in block 5, the fin's
  // block, so they are not 2.
  expectStep('sashimi-jellyfish', grid(SASHIMI_SWORDFISH), {
    digit: 2,
    base: ['column 3', 'column 4', 'column 7', 'column 9'],
    cover: ['row 3', 'row 4', 'row 5', 'row 8'],
    fins: ['R6C4'],
    removed: ['R4C5', 'R5C5'],
  });
});

test('a technique does not report a pattern of another kind', () => {
  // Each board has a pattern of a related kind: a Swordfish, a Jellyfish, Sashimi fish and
  // Finned fish.
  expectNone('x-wing', grid(SWORDFISH_ROWS));
  expectNone('swordfish', grid(JELLYFISH_ROWS));
  expectNone('jellyfish', grid(SASHIMI_JELLYFISH));
  expectNone('finned-x-wing', grid(SASHIMI_XWING));
  expectNone('finned-swordfish', grid(SASHIMI_SWORDFISH));
  expectNone('finned-jellyfish', grid(SASHIMI_JELLYFISH));
  expectNone('sashimi-x-wing', grid(FINNED_XWING));
  expectNone('sashimi-swordfish', grid(SWORDFISH_ROWS_2));
  expectNone('sashimi-jellyfish', grid(XWING_COLUMNS));
});

test('a pattern with nothing left to remove is not reported', () => {
  for (const [id, text] of [
    ['x-wing', XWING_ROWS],
    ['finned-x-wing', FINNED_XWING],
    ['sashimi-jellyfish', SASHIMI_JELLYFISH],
  ]) {
    const board = grid(text);
    board.apply(technique(id).find(board));
    expectNone(id, board);
  }
});

test('the fins must all be in one block (drawn)', () => {
  // With columns 2 and 8 as cover lines, the fins R1C9 and R5C4 are in block 3 and block 5.
  const { board } = picture(
    4,
    `
    . x . | . . . | . x f
    o o o | o o o | o o o
    o o o | o o o | o o o
    ------+-------+------
    o o o | o o o | o o o
    . x . | f . . | . x .
    o o o | o o o | o o o
    ------+-------+------
    o o o | o o o | o o o
    o o o | o o o | o o o
    o o o | o o o | o o o
    `,
  );
  expectNone('finned-x-wing', board);
  expectNone('sashimi-x-wing', board);
});

test('each base line needs a candidate in the cover lines (drawn)', () => {
  // With columns 2 and 8 as cover lines, R1C7 and R1C9 would be fins in block 3, but row 1
  // would have no candidate in the cover lines.
  const { board } = picture(
    4,
    `
    . . . | . . . | f . f
    o o o | o o o | o o o
    o o o | o o o | o o o
    ------+-------+------
    o o o | o o o | o o o
    . x . | . . . | . x .
    o o o | o o o | o o o
    ------+-------+------
    o o o | o o o | o o o
    o o o | o o o | o o o
    o o o | o o o | o o o
    `,
  );
  expectNone('finned-x-wing', board);
  expectNone('sashimi-x-wing', board);
});

test('nothing on an empty board', () => {
  const board = Board.fromValues(new Uint8Array(81));
  for (const t of fish) expectNone(t.id, board);
});
