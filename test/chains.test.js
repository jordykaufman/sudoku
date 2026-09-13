import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board } from '../src/engine/board.js';
import { parseGrid } from '../src/engine/grid.js';
import { solve } from '../src/engine/solver.js';
import chains from '../src/engine/techniques/chains.js';
import { cellName } from '../src/engine/text.js';
import { checkStep } from '../src/engine/validate.js';

const technique = (id) => chains.find((t) => t.id === id);

// Runs a technique on a board and checks what every step must satisfy: the board is not
// changed, the step is sound against the puzzle's solution, the first stage does not name the
// technique and the last stage names every cell that changes.
function run(id, board, puzzle) {
  const before = board.clone();
  const step = technique(id).find(board);
  assert.deepEqual(board.values, before.values);
  assert.deepEqual(board.cands, before.cands);
  if (step) {
    assert.equal(step.technique, id);
    assert.deepEqual(checkStep(step, solve(parseGrid(puzzle)).solution, board), []);
    assert.ok(!step.stages[0].text.includes(technique(id).name));
    for (const [cell] of step.eliminations) assert.ok(step.stages.at(-1).text.includes(cellName(cell)), cellName(cell));
  }
  return step;
}

// Eliminations written as "digit@cell", for example "8@R4C3".
const removed = (step) => step.eliminations.map(([cell, digit]) => `${digit}@${cellName(cell)}`);

// Pencil-mark grids from SudokuWiki examples, each with the puzzle it came from (for the
// solution). The grids were decoded from the pages' "Load Example" links.

// https://www.sudokuwiki.org/Singles_Chains, Rule 2 example.
const SINGLES_RULE_2 = {
  puzzle: '000000030002090500080706004900054006030000070600380009300601020007020600060000000',
  grid: `
    17   9    6    5    4    2    178  3    178
    147  14   2    8    9    3    5    6    17
    5    8    3    7    1    6    2    9    4
    9    7    18   2    5    4    3    18   6
    48   3    5    1    6    9    48   7    2
    6    2    14   3    8    7    14   5    9
    3    45   489  6    7    1    89   2    58
    18   15   7    9    2    58   6    4    3
    2    6    89   4    3    58   1789 18   1578`,
};

// https://www.sudokuwiki.org/Singles_Chains, first Rule 4 example.
const SINGLES_RULE_4 = {
  puzzle: '007000200000054009061000008300740905000000000508016002700000590800370000005000300',
  grid: `
    4   5   7   168 689 19  2   16  3
    2   8   3   16  5   4   16  7   9
    9   6   1   2   3   7   4   5   8
    3   12  26  7   4   8   9   16  5
    16  7   9   5   2   3   8   4   16
    5   4   8   9   1   6   7   3   2
    7   3   246 168 68  12  5   9   46
    8   9   46  3   7   5   16  2   146
    16  12  5   4   69  29  3   8   7`,
};

// https://www.sudokuwiki.org/Singles_Chains, second Rule 4 example.
const SINGLES_RULE_4B = {
  puzzle: '000000050050409000008060400860010500001040700009050083006090300000108090040000000',
  grid: `
    67  1   4   3   278 27  9   5   68
    367 5   237 4   78  9   28  13  168
    23  9   8   5   6   1   4   23  7
    8   6   37  9   1   37  5   4   2
    5   23  1   8   4   23  7   6   9
    4   27  9   27  5   6   1   8   3
    1   8   6   27  9   4   3   27  5
    237 37  5   1   23  8   6   9   4
    9   4   23  6   37  5   28  17  18`,
};

// https://www.sudokuwiki.org/X_Cycles, Figure 4.
const X_CYCLES_FIGURE_4 = {
  puzzle: '003000100500670000700009006034705600000000000008406930900300002000052009001000500',
  grid: `
    48    6     3     5     2     48    1     9     7
    5     148   9     6     7     1348  2     48    34
    7     148   2     18    348   9     348   5     6
    1     3     4     7     9     5     6     2     8
    6     9     5     2     38    38    47    47    1
    2     7     8     4     1     6     9     3     5
    9     5     67    3     468   1478  478   14678 2
    34    48    67    18    5     2     3478  1467  9
    348   2     1     9     468   478   5     4678  34`,
};

// https://www.sudokuwiki.org/XY_Chains, example 1.
const XY_CHAINS_1 = {
  puzzle: '080103070000000000001408020570001039000609000920800051030905200000000000010702060',
  grid: `
    26  8   245 1   29  3   59  7   456
    37  9   24  5   27  6   18  14  348
    37  56  1   4   79  8   359 2   356
    5   7   8   2   4   1   6   3   9
    1   4   3   6   5   9   7   8   2
    9   2   6   8   3   7   4   5   1
    68  3   7   9   16  5   2   14  48
    268 56  25  3   16  4   18  9   7
    4   1   9   7   8   2   35  6   35`,
};

// https://www.sudokuwiki.org/3D_Medusa, Rule 1 example.
const MEDUSA_RULE_1 = {
  puzzle: '093804500005600000206070000020060040000208000070040090000010703000002600002507180',
  grid: `
    17  9   3   8   2   4   5   6   17
    147 8   5   6   39  13  49  137 2
    2   14  6   139 7   5   49  13  8
    3   2   1   7   6   9   8   4   5
    69  46  49  2   5   8   3   17  17
    5   7   8   13  4   13  2   9   6
    8   5   49  49  1   6   7   2   3
    14  134 7   349 8   2   6   5   49
    69  346 2   5   39  7   1   8   49`,
};

// https://www.sudokuwiki.org/3D_Medusa, Rule 3 example.
const MEDUSA_RULE_3 = {
  puzzle: '290000030000020070000109402800760200600000007009045008903407000060030000050000084',
  grid: `
    2    9    1467 56   57   46   8    3    15
    145  18   1468 3568 2    3468 9    7    156
    357  378  678  1    578  9    4    56   2
    8    4    5    7    6    1    2    9    3
    6    123  12   2389 89   238  5    4    7
    37   237  9    23   4    5    16   16   8
    9    128  3    4    158  7    16   25   56
    14   6    1248 258  3    28   7    125  9
    17   5    127  269  19   26   3    8    4`,
};

const boardOf = (example) => Board.fromCandidateGrid(example.grid);

test('simple colors: color wrap', () => {
  // SudokuWiki: the 8s in J6 and J8 (R9C6 and R9C8) have the same color, so that color is removed.
  const step = run('simple-colors', boardOf(SINGLES_RULE_2), SINGLES_RULE_2.puzzle);
  assert.equal(step.variant, 'color wrap');
  assert.deepEqual(removed(step), ['8@R4C3', '8@R5C7', '8@R8C1', '8@R9C6', '8@R9C8']);
  assert.equal(step.stages[0].text, 'Consider the digit 8.');
  assert.match(step.stages.at(-1).text, /^R9C6 and R9C8 both have the first color and are both in row 9/);
});

test('simple colors: color trap', () => {
  // The strong links on 6 form one group: R1C8, R2C4, R4C3, R5C9, R8C7 and R9C1 in one color,
  // R2C7, R4C8, R5C1 and R9C5 in the other. R1C5 sees R1C8 and R9C5. R7C4 sees R2C4 and R9C5.
  // No other cell with a 6 sees both colors, and no two cells of one color see each other.
  const step = run('simple-colors', boardOf(SINGLES_RULE_4), SINGLES_RULE_4.puzzle);
  assert.equal(step.variant, 'color trap');
  assert.deepEqual(removed(step), ['6@R1C5', '6@R7C4']);
});

test('simple colors finds nothing', () => {
  assert.equal(run('simple-colors', boardOf(XY_CHAINS_1), XY_CHAINS_1.puzzle), null);
});

test('x-chain', () => {
  // R1C6 = R1C1 (row 1) - R9C1 (column 1) = R8C2 (block 7) - R8C4 (row 8) = R3C4 (column 4).
  // One of R1C6 and R3C4 is 8, and R2C6 and R3C5 see both.
  const step = run('x-chain', boardOf(X_CYCLES_FIGURE_4), X_CYCLES_FIGURE_4.puzzle);
  assert.deepEqual(removed(step), ['8@R2C6', '8@R3C5']);
  assert.equal(step.stages[0].text, 'Consider the digit 8.');
  assert.match(step.stages[1].text, /^Look at R1C6, R1C1, R9C1, R8C2, R8C4 and R3C4, in that order\. /);
  assert.equal(step.stages[1].links.length, 5);
  assert.equal(
    step.stages[2].text,
    'If R1C6 is not 8, then R1C1 is 8, R9C1 is not 8, R8C2 is 8, R8C4 is not 8 and R3C4 is 8, so at least one of R1C6 and R3C4 is 8. Remove 8 from R2C6 and R3C5, which see both of them.',
  );
});

test('x-chain with three links', () => {
  // R1C6 = R4C6 (column 6) - R4C3 (row 4) = R2C3 (column 3). R1C1 sees R1C6 and R2C3; R2C5 sees
  // R1C6 and R2C3.
  const step = run('x-chain', boardOf(SINGLES_RULE_4B), SINGLES_RULE_4B.puzzle);
  assert.deepEqual(removed(step), ['7@R1C1', '7@R2C5']);
  assert.equal(step.stages[1].links.length, 3);
});

test('x-chain finds nothing', () => {
  assert.equal(run('x-chain', boardOf(MEDUSA_RULE_1), MEDUSA_RULE_1.puzzle), null);
});

test('xy-chain', () => {
  // SudokuWiki: A7, A5, A1 and C2 remove the 5s in A3, C7 and C9.
  const step = run('xy-chain', boardOf(XY_CHAINS_1), XY_CHAINS_1.puzzle);
  assert.deepEqual(removed(step), ['5@R1C3', '5@R3C7', '5@R3C9']);
  assert.equal(step.stages[0].text, 'Look at R1C7.');
  assert.equal(
    step.stages[2].text,
    'If R1C7 is not 5, then R1C7 is 9, R1C5 is 2, R1C1 is 6 and R3C2 is 5, so at least one of R1C7 and R3C2 is 5. Remove 5 from R1C3, R3C7 and R3C9, which see both of them.',
  );
});

test('xy-chain finds nothing', () => {
  assert.equal(run('xy-chain', boardOf(X_CYCLES_FIGURE_4), X_CYCLES_FIGURE_4.puzzle), null);
});

test('fishy cycle', () => {
  // SudokuWiki: the loop A1, A6, C4, H4, H2, J1 removes the 8s in B6, C5 and H7.
  const step = run('fishy-cycle', boardOf(X_CYCLES_FIGURE_4), X_CYCLES_FIGURE_4.puzzle);
  assert.deepEqual(removed(step), ['8@R2C6', '8@R3C5', '8@R8C7']);
  assert.equal(step.stages[0].text, 'Consider the digit 8.');
  assert.equal(step.stages[1].links.length, 6);
  assert.equal(
    step.stages[2].text,
    'Going around the loop, either R1C1, R3C4 and R8C2 are 8, or R1C6, R8C4 and R9C1 are 8. Either way block 2 and row 8 each have their 8 in a cell of the loop, so remove 8 from R2C6, R3C5 and R8C7.',
  );
});

test('fishy cycle finds nothing', () => {
  assert.equal(run('fishy-cycle', boardOf(SINGLES_RULE_2), SINGLES_RULE_2.puzzle), null);
});

test('3d medusa: same color twice in a cell', () => {
  // SudokuWiki: two candidates of one color in H2 (R8C2). Checked by hand: the group starting at
  // 4 in R2C1 gives 1 and 3 in R8C2 the same color, and these are all the candidates of that color.
  const step = run('3d-medusa', boardOf(MEDUSA_RULE_1), MEDUSA_RULE_1.puzzle);
  assert.equal(step.variant, 'same color twice in a cell');
  assert.deepEqual(removed(step), ['9@R2C5', '4@R2C7', '4@R3C2', '9@R3C7', '4@R8C1', '1@R8C2', '3@R8C2', '3@R9C5']);
  assert.equal(step.stages[0].text, 'Look at R2C1.');
  assert.match(step.stages[2].text, /^R8C2 has two candidates of the second color, 1 and 3\./);
});

test('3d medusa: both colors in a cell', () => {
  // SudokuWiki: the 8 in C2 (R3C2) is removed.
  const step = run('3d-medusa', boardOf(MEDUSA_RULE_3), MEDUSA_RULE_3.puzzle);
  assert.equal(step.variant, 'both colors in a cell');
  assert.deepEqual(removed(step), ['8@R3C2']);
});

test('3d medusa: candidate sees both colors', () => {
  // The position of SudokuWiki's first Rule 4 example, with the candidates the placed digits
  // allow. The first group starts at 7 in R1C2. R1C2 and R3C2 are the only cells in column 2
  // with a 7, so their 7s have different colors, and the 7 in R2C1 sees both through block 1.
  const puzzle = '100056003043090000800043002030560210950421037021030000317980005000310970000670301';
  const step = run('3d-medusa', Board.fromValues(parseGrid(puzzle)), puzzle);
  assert.equal(step.variant, 'candidate sees both colors');
  assert.deepEqual(removed(step), ['7@R2C1']);
  assert.equal(
    step.stages[2].text,
    '7 in R2C1 sees 7 in R1C2, which has the first color, and 7 in R3C2, which has the second color. One of those two is correct, so R2C1 is not 7. Remove 7 from R2C1.',
  );
});

test('3d medusa: same color twice in a house', () => {
  // A position from this app's generator where no single applies. Starting from 2 in R1C4:
  // R1C4 has 2 and 7; row 1 has 2s and 7s only in R1C4 and R1C8; column 8 has 2s and 7s only
  // in R1C8 and R8C8; block 3 has 7s only in R1C8 and R2C7; column 7 only in R2C7 and R7C7;
  // row 7 only in R7C4 and R7C7; block 8 only in R7C4 and R8C6; column 6 only in R2C6 and
  // R8C6. The second color is 7 in R1C4, 2 in R1C8, and 7 in R2C6, R2C7, R7C4 and R8C8.
  // Its 7s in R1C4 and R2C6 are both in block 2, so every candidate of that color goes.
  const puzzle = '3....8..5..6.......7..1..6.75..2.3.6..96.18..6.2.9..47.4..3..1.......6..1..9....3';
  const board = Board.fromCandidateGrid(`
    3   1   4   27  6   8   9   27  5
    8   29  6   247 5   279 247 3   1
    29  7   5   234 1   239 24  6   8
    7   5   1   8   2   4   3   9   6
    4   3   9   6   7   1   8   5   2
    6   8   2   35  9   35  1   4   7
    25  4   8   257 3   6   257 1   9
    259 29  3   1   8   257 6   27  4
    1   6   7   9   4   25  25  8   3`);
  const step = run('3d-medusa', board, puzzle);
  assert.equal(step.variant, 'same color twice in a house');
  assert.deepEqual(removed(step), ['7@R1C4', '2@R1C8', '7@R2C6', '7@R2C7', '7@R7C4', '7@R8C8']);
  assert.deepEqual(step.stages[2].houses, [19]);
});

test('3d medusa: sees one color, cell has the other', () => {
  // A position from this app's generator where no single applies. Starting from 3 in R1C1, the
  // first color is 3 in R1C1, R4C8 and R6C2, 6 in R3C1 and 1 in R3C2; the second color is 3 in
  // R1C2 and R4C1 and 1 in R3C1 and R6C2. R1C2 has 3 in the second color, and its 6 sees the 6
  // of the first color in R3C1, so R1C2 is not 6 whichever color is correct.
  const puzzle = '..52..4.1..41.3.8.......372..6.2...7.4.....2.9...5.8..851.......2.3.51..4.3..92..';
  const board = Board.fromCandidateGrid(`
    367   3679  5     2     6789  678   4     69    1
    2     679   4     1     679   3     569   8     569
    16    169   8     5     469   46    3     7     2
    135   8     6     49    2     14    59    13459 7
    15    4     7     689   3     168   569   2     569
    9     13    2     467   5     1467  8     1346  346
    8     5     1     46    46    2     7     3469  3469
    67    2     9     3     4678  5     1     46    468
    4     67    3     678   1     9     2     56    568`);
  const step = run('3d-medusa', board, puzzle);
  assert.equal(step.variant, 'sees one color, cell has the other');
  assert.deepEqual(removed(step), ['6@R1C2']);
  assert.equal(
    step.stages[2].text,
    'R1C2 has 3 in the second color, and its 6 sees 6 in R3C1, which has the first color. If the second color is correct, R1C2 is 3, and if the first color is correct, R3C1 is 6, so R1C2 is not 6. Remove 6 from R1C2.',
  );
});

test('3d medusa finds nothing', () => {
  assert.equal(run('3d-medusa', boardOf(X_CYCLES_FIGURE_4), X_CYCLES_FIGURE_4.puzzle), null);
});

test('chain techniques find nothing on an empty board or a solved board', () => {
  const empty = Board.fromValues(new Uint8Array(81));
  const solved = Board.fromValues(solve(parseGrid(XY_CHAINS_1.puzzle)).solution);
  for (const t of chains) {
    assert.equal(t.find(empty), null, t.id);
    assert.equal(t.find(solved), null, t.id);
  }
});
