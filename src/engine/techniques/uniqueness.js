// Unique Rectangle, BUG+1, Hidden Unique Rectangle and Avoidable Rectangle.
//
// These techniques rely on the puzzle having exactly one solution. Each looks for cells
// whose digits could be swapped to give another valid grid, and rules out the digits that
// would complete such a pattern, because that would give the puzzle a second solution.

import { CELL_HOUSES, DIGITS, HOUSES, POPCOUNT, bit, commonPeers, sharedHouses } from '../grid.js';
import { cellList, cellName, houseName, joinList, orList, removalText } from '../text.js';

// Every rectangle: 4 cells in exactly 2 rows, 2 columns and 2 blocks, as [top left, top
// right, bottom left, bottom right]. Two rows in the same band of blocks need two columns
// in different stacks, and two rows in different bands need two columns in the same stack.
const RECTANGLES = [];
for (let r1 = 0; r1 < 9; r1++) {
  for (let r2 = r1 + 1; r2 < 9; r2++) {
    for (let c1 = 0; c1 < 9; c1++) {
      for (let c2 = c1 + 1; c2 < 9; c2++) {
        const sameBand = Math.floor(r1 / 3) === Math.floor(r2 / 3);
        const sameStack = Math.floor(c1 / 3) === Math.floor(c2 / 3);
        if (sameBand !== sameStack) RECTANGLES.push([r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2]);
      }
    }
  }
}

// The four ways to name the corners of a rectangle, as indices [A, B, C, D]: A and B share a
// row or column, C is in line with A and D is in line with B. A and D are opposite corners,
// and so are B and C.
const SIDES = [
  [0, 1, 2, 3],
  [2, 3, 0, 1],
  [0, 2, 1, 3],
  [1, 3, 0, 2],
];

const byCell = (x, y) => x - y;

const COUNT_WORDS = ['', 'one', 'two', 'three'];
const REST_WORDS = ['', 'other', 'third', 'fourth'];

const swapText = (a, b) =>
  `swapping the ${Math.min(a, b)}s and ${Math.max(a, b)}s in these four cells would give the puzzle a second solution`;

// The same for a unique rectangle, whose four cells are all empty.
const holdText = (a, b) =>
  `these four cells would hold only ${Math.min(a, b)}s and ${Math.max(a, b)}s, and swapping those digits would give the puzzle a second solution`;

// A hint stage. Pattern cells get the role 'key' and changed cells 'target'; `keyMarks` are
// [cell, digit] pairs shown as 'key', and removed or placed candidates are shown as such.
function stage(text, { keyCells = [], keyMarks = [], houses = [], eliminations = [], placements = [] } = {}) {
  const cells = new Map(keyCells.map((cell) => [cell, 'key']));
  const marks = new Map(keyMarks.map(([cell, digit]) => [cell * 10 + digit, [cell, digit, 'key']]));
  for (const [cell, digit] of eliminations) {
    cells.set(cell, 'target');
    marks.set(cell * 10 + digit, [cell, digit, 'elim']);
  }
  for (const [cell, digit] of placements) {
    cells.set(cell, 'target');
    marks.set(cell * 10 + digit, [cell, digit, 'place']);
  }
  const result = { text };
  if (houses.length) result.houses = houses;
  if (cells.size) result.cells = [...cells];
  if (marks.size) result.marks = [...marks.values()];
  return result;
}

// [cell, digit] for each candidate of `cells` in `mask`.
const candidateMarks = (board, cells, mask) =>
  cells.flatMap((cell) => DIGITS[board.cands[cell] & mask].map((digit) => [cell, digit]));

// Calls visit(chosen) for each way to choose `size` of `items`, in order, and returns the
// first result that is not null. `chosen` is reused between calls.
function eachSubset(items, size, visit, start = 0, chosen = []) {
  if (chosen.length === size) return visit(chosen);
  for (let i = start; i <= items.length - size + chosen.length; i++) {
    chosen.push(items[i]);
    const found = eachSubset(items, size, visit, i + 1, chosen);
    chosen.pop();
    if (found) return found;
  }
  return null;
}

// Whether some of `cells` have, between them, no more candidates than there are cells.
function containsLockedSet(board, cells) {
  for (let chosen = 1; chosen < 1 << cells.length; chosen++) {
    let mask = 0;
    let count = 0;
    cells.forEach((cell, i) => {
      if (!(chosen & (1 << i))) return;
      mask |= board.cands[cell];
      count++;
    });
    if (POPCOUNT[mask] <= count) return true;
  }
  return false;
}

// Type 3 of Unique and Avoidable Rectangles. At least one of the two cells `pair` holds a
// digit from `extra`, so in a house that contains both, they count as one cell with the
// candidates `extra`. Looks for k - 1 other empty cells of that house whose candidates and
// `extra` are k digits in all (k from 2 to 4): those k digits must all go in these cells, so
// they can be removed from the rest of the house. Skips subsets that make a naked subset
// without the rectangle: some of the other cells on their own, or those cells with one of
// the two cells. Returns the first subset that removes something.
function findSubsetWithPair(board, pair, extra) {
  for (const house of sharedHouses(pair)) {
    const others = HOUSES[house].filter((cell) => !board.values[cell] && !pair.includes(cell));
    for (let size = 1; size <= 3; size++) {
      const found = eachSubset(others, size, (subset) => {
        let mask = extra;
        for (const cell of subset) mask |= board.cands[cell];
        if (POPCOUNT[mask] !== size + 1 || containsLockedSet(board, subset)) return null;
        if (pair.some((cell) => (board.cands[cell] & ~mask) === 0)) return null;
        const eliminations = [];
        for (const cell of others) {
          if (subset.includes(cell)) continue;
          for (const digit of DIGITS[board.cands[cell] & mask]) eliminations.push([cell, digit]);
        }
        return eliminations.length ? { house, subset: subset.slice(), mask, eliminations } : null;
      });
      if (found) return found;
    }
  }
  return null;
}

// The text of the last stage of a type 3 step, after the sentence about the rectangle.
function subsetConclusion(pair, extra, { house, subset, mask }) {
  const [p, q] = pair.map(cellName);
  const n = subset.length;
  return (
    `So ${p} or ${q} is ${orList(DIGITS[extra])}. ${cellList(subset)} ${n === 1 ? 'holds' : 'hold'} ${COUNT_WORDS[n]} ` +
    `of the digits ${joinList(DIGITS[mask])}, and ${p} or ${q} holds the ${REST_WORDS[n]}, so no other cell in ` +
    `${houseName(house)} can be ${orList(DIGITS[mask])}.`
  );
}

// The text of the stage that shows the subset of a type 3 step.
function subsetText(pair, extra, { house, subset, mask }) {
  const [p, q] = pair.map(cellName);
  return (
    `The other candidates of ${p} and ${q} are ${joinList(DIGITS[extra])}. In ${houseName(house)}, ` +
    `${cellList(subset)} ${subset.length === 1 ? 'has' : 'have'} no candidates other than ${joinList(DIGITS[mask])}.`
  );
}

// ---------------------------------------------------------------------------------------
// Unique Rectangle

// The candidate mask of a and b if `rect` could become a unique rectangle: all four cells
// are empty, at least one of them has only two candidates, and all four have both of those
// candidates. Otherwise 0.
function rectanglePair(board, rect) {
  let pair = 0;
  let common = 0x1ff;
  for (const cell of rect) {
    if (board.values[cell]) return 0;
    common &= board.cands[cell];
    if (POPCOUNT[board.cands[cell]] === 2) pair = board.cands[cell];
  }
  return pair && (common & pair) === pair ? pair : 0;
}

const uniqueRectangleStep = (variant, eliminations, stages) => ({
  technique: 'unique-rectangle',
  variant,
  placements: [],
  eliminations,
  stages,
});

// The first two stages of a unique rectangle hint. `bivalue` lists the cells that have only
// the candidates a and b.
function rectangleStages(board, rect, pair, bivalue) {
  const [a, b] = DIGITS[pair];
  return [
    { text: `Consider the digits ${a} and ${b}.` },
    stage(
      `${cellList(rect)} are in two rows, two columns and two blocks, and each has the candidates ${a} and ${b}. ` +
        `${cellList(bivalue)} ${bivalue.length === 1 ? 'has' : 'have'} no other candidates.`,
      { keyCells: rect, keyMarks: candidateMarks(board, rect, pair) },
    ),
  ];
}

function uniqueRectangleType1(board, rect, pair) {
  const others = rect.filter((cell) => board.cands[cell] !== pair);
  if (others.length !== 1) return null;
  const [a, b] = DIGITS[pair];
  const target = others[0];
  const eliminations = [
    [target, a],
    [target, b],
  ];
  return uniqueRectangleStep('type 1', eliminations, [
    ...rectangleStages(
      board,
      rect,
      pair,
      rect.filter((cell) => cell !== target),
    ),
    stage(
      `If ${cellName(target)} were ${a} or ${b}, ${holdText(a, b)}. ${removalText(eliminations, { byCell: true })}`,
      { keyCells: rect, keyMarks: candidateMarks(board, rect, pair), eliminations },
    ),
  ]);
}

// Types 2 to 4: A and B have only a and b, and C and D, in line with them, have more.
function uniqueRectangleType2(board, rect, pair, [A, B, C, D]) {
  const extra = board.cands[C] & ~pair;
  if (POPCOUNT[extra] !== 1 || (board.cands[D] & ~pair) !== extra) return null;
  const c = DIGITS[extra][0];
  const eliminations = commonPeers([C, D])
    .filter((cell) => board.has(cell, c))
    .map((cell) => [cell, c]);
  if (!eliminations.length) return null;
  const houses = sharedHouses([C, D]);
  const [p, q] = [C, D].sort(byCell).map(cellName);
  return uniqueRectangleStep('type 2', eliminations, [
    ...rectangleStages(board, rect, pair, [A, B]),
    stage(
      `If neither ${p} nor ${q} were ${c}, ${holdText(...DIGITS[pair])}. So ${p} or ${q} is ${c}, and no other cell in ` +
        `${orList(houses.map(houseName))} can be ${c}. ${removalText(eliminations, { byCell: true })}`,
      { houses, keyCells: rect, keyMarks: candidateMarks(board, rect, pair | extra), eliminations },
    ),
  ]);
}

function uniqueRectangleType3(board, rect, pair, [A, B, C, D]) {
  const extra = (board.cands[C] | board.cands[D]) & ~pair;
  const roof = [C, D].sort(byCell);
  const found = findSubsetWithPair(board, roof, extra);
  if (!found) return null;
  const [a, b] = DIGITS[pair];
  const [p, q] = roof.map(cellName);
  const keyCells = [...rect, ...found.subset];
  const keyMarks = [...candidateMarks(board, rect, pair), ...candidateMarks(board, roof, extra), ...candidateMarks(board, found.subset, found.mask)];
  return uniqueRectangleStep('type 3', found.eliminations, [
    ...rectangleStages(board, rect, pair, [A, B]),
    stage(subsetText(roof, extra, found), { houses: [found.house], keyCells, keyMarks }),
    stage(
      `If ${p} and ${q} were both ${a} or ${b}, ${holdText(a, b)}. ${subsetConclusion(roof, extra, found)} ` +
        removalText(found.eliminations, { byCell: true }),
      { houses: [found.house], keyCells, keyMarks, eliminations: found.eliminations },
    ),
  ]);
}

function uniqueRectangleType4(board, rect, pair, [A, B, C, D]) {
  const [a, b] = DIGITS[pair];
  const roof = [C, D].sort(byCell);
  for (const house of sharedHouses(roof)) {
    for (const [u, v] of [
      [a, b],
      [b, a],
    ]) {
      if (!onlyIn(board, house, u, C, D)) continue;
      const eliminations = roof.map((cell) => [cell, v]);
      const [p, q] = roof.map(cellName);
      return uniqueRectangleStep('type 4', eliminations, [
        ...rectangleStages(board, rect, pair, [A, B]),
        stage(
          `In ${houseName(house)}, ${u} can only go in ${p} and ${q}, so one of them is ${u}. If the other one were ${v}, ` +
            `${holdText(a, b)}. ${removalText(eliminations, { byCell: true })}`,
          { houses: [house], keyCells: rect, keyMarks: candidateMarks(board, rect, pair), eliminations },
        ),
      ]);
    }
  }
  return null;
}

const uniqueRectangle = {
  id: 'unique-rectangle',
  name: 'Unique Rectangle',
  lesson: [
    'This technique only works because the puzzle has exactly one solution. Every puzzle in this app does.',
    'Look for four empty cells at the corners of a rectangle that covers exactly two rows, two columns and two blocks, where all four cells have the same two candidates, for example 3 and 7. Suppose all four cells held only 3s and 7s. Then the two rows, the two columns and the two blocks would each have one 3 and one 7 in these cells, so swapping the 3s and 7s would still give a valid grid. None of the four cells is a clue, so that grid would agree with the clues too, and the puzzle would have a second solution. So at least one of the four cells must hold a digit other than 3 or 7.',
    'Type 1: three of the cells have only the candidates 3 and 7. Then the fourth cell cannot be 3 or 7, so remove 3 and 7 from it.',
    'Type 2: two cells in the same row or column have only 3 and 7, and the other two cells have 3, 7 and one more candidate, the same one in both, for example 9. One of those two cells must be 9, so remove 9 from every other cell in a row, column or block that contains both of them.',
    'Type 3: two cells in the same row or column have only 3 and 7, and the other two cells have more candidates. One of the other two cells must hold one of its extra candidates. In a row, column or block that contains both of them, count the two cells as one cell whose candidates are their extra candidates. If this cell and some other cells there have, between them, only as many different candidates as there are cells, those digits must all go in these cells. Remove them from the rest of that row, column or block.',
    'Type 4: two cells in the same row or column have only 3 and 7. The other two cells are in a row, column or block where 3 can only go in those two cells, so one of them is 3. If the other one were 7, the four cells would hold only 3s and 7s. Remove 7 from both of them.',
  ],
  find(board) {
    for (const rect of RECTANGLES) {
      const pair = rectanglePair(board, rect);
      const step = pair && uniqueRectangleType1(board, rect, pair);
      if (step) return step;
    }
    for (const type of [uniqueRectangleType2, uniqueRectangleType3, uniqueRectangleType4]) {
      for (const rect of RECTANGLES) {
        const pair = rectanglePair(board, rect);
        if (!pair) continue;
        for (const side of SIDES) {
          const corners = side.map((i) => rect[i]);
          const [A, B, C, D] = corners;
          if (board.cands[A] !== pair || board.cands[B] !== pair) continue;
          if (board.cands[C] === pair || board.cands[D] === pair) continue;
          const step = type(board, rect, pair, corners);
          if (step) return step;
        }
      }
    }
    return null;
  },
};

// ---------------------------------------------------------------------------------------
// BUG+1

const bugPlusOne = {
  id: 'bug-plus-1',
  name: 'BUG+1',
  lesson: [
    'This technique only works because the puzzle has exactly one solution. Every puzzle in this app does.',
    'Suppose every empty cell had exactly two candidates, and in every row, column and block, each digit that is still a candidate there was a candidate in exactly two cells. Take any solution and change every empty cell to its other candidate. Each row, column and block would still have every digit once, so the puzzle would have a second solution. So this position never happens in a puzzle with one solution.',
    'Look for a position with one extra candidate: every empty cell has two candidates except one cell with three, and each candidate is in exactly two cells of every row, column and block, except for one digit of the cell with three candidates. That digit is a candidate in three cells in each of the row, the column and the block of that cell.',
    'That digit must go in the cell with three candidates. If the cell were one of its other two candidates, you could remove the digit from it, and the board would be in the position described above.',
  ],
  find(board) {
    let three = -1;
    for (let cell = 0; cell < 81; cell++) {
      if (board.values[cell]) continue;
      const count = POPCOUNT[board.cands[cell]];
      if (count === 2) continue;
      if (count !== 3 || three >= 0) return null;
      three = cell;
    }
    if (three < 0) return null;
    // Every digit must be a candidate in 0 or 2 cells of every house, except one digit of
    // `three`, which must be a candidate in 3 cells of each house of `three`.
    const threeHouses = CELL_HOUSES[three];
    let digit = 0;
    for (let house = 0; house < 27; house++) {
      const counts = new Uint8Array(10);
      for (const cell of HOUSES[house]) for (const d of DIGITS[board.cands[cell]]) counts[d]++;
      for (let d = 1; d <= 9; d++) {
        if (counts[d] === 0 || counts[d] === 2) continue;
        if (counts[d] !== 3 || !threeHouses.includes(house) || (digit && digit !== d)) return null;
        digit = d;
      }
    }
    if (!digit || !board.has(three, digit)) return null;
    for (const house of threeHouses) if (board.where(house, digit).length !== 3) return null;

    const name = cellName(three);
    const others = board.candidates(three).filter((d) => d !== digit);
    const placements = [[three, digit]];
    const keyMarks = threeHouses.flatMap((house) => board.where(house, digit).map((cell) => [cell, digit]));
    return {
      technique: 'bug-plus-1',
      placements,
      eliminations: [],
      stages: [
        { text: 'Count the candidates of each empty cell.' },
        stage(
          `Every empty cell except ${name} has exactly two candidates, and ${name} has three: ${joinList(board.candidates(three))}. ` +
            'In every row, column and block, each digit that is still a candidate there is a candidate in exactly two cells. ' +
            `The only exception is ${digit}, which is a candidate in three cells in each of ${joinList(threeHouses.map(houseName))}.`,
          { houses: threeHouses, keyCells: [three], keyMarks },
        ),
        stage(
          `If ${name} were ${orList(others)}, removing ${digit} from it would leave two candidates in every empty cell and two cells ` +
            'for each candidate in every row, column and block, and then changing every empty cell to its other candidate would ' +
            `give the puzzle a second solution. ${name} must be ${digit}.`,
          { houses: threeHouses, keyCells: [three], keyMarks, placements },
        ),
      ],
    };
  },
};

// ---------------------------------------------------------------------------------------
// Hidden Unique Rectangle

// Whether `digit` is a candidate in `house` only in the cells p and q.
function onlyIn(board, house, digit, p, q) {
  const cells = board.where(house, digit);
  return cells.length === 2 && cells.includes(p) && cells.includes(q);
}

const hiddenUniqueRectangle = {
  id: 'hidden-unique-rectangle',
  name: 'Hidden Unique Rectangle',
  lesson: [
    'This technique only works because the puzzle has exactly one solution. Every puzzle in this app does.',
    'Look for four empty cells at the corners of a rectangle that covers exactly two rows, two columns and two blocks, where all four cells have the same two candidates, for example 3 and 7, and at least one of the cells has no other candidates. The four cells cannot end up holding only 3s and 7s, because swapping those 3s and 7s would give the puzzle a second solution.',
    'Start from a corner that has only 3 and 7, and look at the opposite corner. Check whether, in the row of the opposite corner, 3 can only go in the two corners of the rectangle in that row, and whether the same is true in its column.',
    'If both are true, the opposite corner cannot be 7. If it were 7, the corners next to it in its row and its column would both have to be 3. The corner you started from would then be 7, and the four cells would hold only 3s and 7s. So remove 7 from the opposite corner.',
    'Check with the two digits the other way round as well: 7 in the row and the column, and 3 removed.',
  ],
  find(board) {
    for (const rect of RECTANGLES) {
      const pair = rectanglePair(board, rect);
      if (!pair) continue;
      const [a, b] = DIGITS[pair];
      for (let i = 0; i < 4; i++) {
        const A = rect[i];
        if (board.cands[A] !== pair) continue;
        // D is the corner opposite A, C the corner in the row of D and B the corner in its column.
        const D = rect[3 - i];
        const C = rect[(3 - i) ^ 1];
        const B = rect[(3 - i) ^ 2];
        const [row, column] = CELL_HOUSES[D];
        for (const [u, v] of [
          [a, b],
          [b, a],
        ]) {
          if (!onlyIn(board, row, u, C, D) || !onlyIn(board, column, u, B, D)) continue;
          const eliminations = [[D, v]];
          const keyMarks = candidateMarks(board, rect, pair);
          const bivalue = rect.filter((cell) => board.cands[cell] === pair);
          return {
            technique: 'hidden-unique-rectangle',
            placements: [],
            eliminations,
            stages: [
              ...rectangleStages(board, rect, pair, bivalue),
              stage(
                `In ${houseName(row)}, ${u} can only go in ${cellList([C, D].sort(byCell))}. ` +
                  `In ${houseName(column)}, ${u} can only go in ${cellList([B, D].sort(byCell))}.`,
                { houses: [row, column], keyCells: rect, keyMarks },
              ),
              stage(
                `If ${cellName(D)} were ${v}, ${cellList([B, C].sort(byCell))} would both be ${u} and ${cellName(A)} would be ${v}, ` +
                  `and ${swapText(a, b)}. ${removalText(eliminations, { byCell: true })}`,
                { houses: [row, column], keyCells: rect, keyMarks, eliminations },
              ),
            ],
          };
        }
      }
    }
    return null;
  },
};

// ---------------------------------------------------------------------------------------
// Avoidable Rectangle

// Whether a cell was solved during play rather than given as a clue.
const solvedNotClue = (board, cell) => board.values[cell] !== 0 && board.givens[cell] === 0;

const avoidableStep = (variant, eliminations, stages) => ({
  technique: 'avoidable-rectangle',
  variant,
  placements: [],
  eliminations,
  stages,
});

const rectangleText = (rect) => `${cellList(rect)} are in two rows, two columns and two blocks.`;

// Type 1: three corners are solved and none was a clue. The corner X has the digit a and the
// two corners next to it have b, so the fourth corner W cannot be a.
function avoidableType1(board, rect) {
  for (let i = 0; i < 4; i++) {
    const W = rect[i];
    const X = rect[3 - i];
    const [Y, Z] = [rect[i ^ 1], rect[i ^ 2]].sort(byCell);
    if (board.values[W] || ![X, Y, Z].every((cell) => solvedNotClue(board, cell))) continue;
    const a = board.values[X];
    const b = board.values[Y];
    if (board.values[Z] !== b || !board.has(W, a) || board.count(W) < 2) continue;
    const eliminations = [[W, a]];
    const keyMarks = [[W, a]];
    return avoidableStep('type 1', eliminations, [
      { text: `Consider the digits ${Math.min(a, b)} and ${Math.max(a, b)}.` },
      stage(
        `${rectangleText(rect)} ${cellName(X)} is ${a}, ${cellList([Y, Z])} are both ${b}, and none of these three cells was a clue.`,
        { keyCells: rect, keyMarks },
      ),
      stage(
        `If ${cellName(W)} were ${a}, ${swapText(a, b)}, because none of them is a clue. ${removalText(eliminations, { byCell: true })}`,
        { keyCells: rect, keyMarks, eliminations },
      ),
    ]);
  }
  return null;
}

// Types 2 and 3: A and B share a row or column, are solved as a and b, and neither was a
// clue. C, in line with A, has the candidate b, and D, in line with B, has a.
function avoidableType2(board, rect, [A, B, C, D], a, b) {
  const extra = board.cands[C] & ~bit(b);
  if (POPCOUNT[extra] !== 1 || board.cands[D] !== (bit(a) | extra)) return null;
  const c = DIGITS[extra][0];
  const eliminations = commonPeers([C, D])
    .filter((cell) => board.has(cell, c))
    .map((cell) => [cell, c]);
  if (!eliminations.length) return null;
  const houses = sharedHouses([C, D]);
  const [p, q] = [C, D].map(cellName);
  const keyMarks = [...candidateMarks(board, [C], bit(b) | extra), ...candidateMarks(board, [D], bit(a) | extra)];
  return avoidableStep('type 2', eliminations, [
    { text: `Consider the digits ${Math.min(a, b)} and ${Math.max(a, b)}.` },
    stage(
      `${rectangleText(rect)} ${cellName(A)} is ${a} and ${cellName(B)} is ${b}, and neither was a clue. ` +
        `${p} has only the candidates ${joinList([b, c].sort(byCell))}, and ${q} has only ${joinList([a, c].sort(byCell))}.`,
      { keyCells: rect, keyMarks },
    ),
    stage(
      `If neither ${p} nor ${q} were ${c}, ${p} would be ${b} and ${q} would be ${a}, and ${swapText(a, b)}, because none ` +
        `of them is a clue. So ${p} or ${q} is ${c}, and no other cell in ${orList(houses.map(houseName))} can be ${c}. ` +
        removalText(eliminations, { byCell: true }),
      { houses, keyCells: rect, keyMarks, eliminations },
    ),
  ]);
}

function avoidableType3(board, rect, [A, B, C, D], a, b) {
  const both = bit(a) | bit(b);
  const extraC = board.cands[C] & ~both;
  const extraD = board.cands[D] & ~both;
  if (!extraC || !extraD) return null;
  const extra = extraC | extraD;
  const roof = [C, D].sort(byCell);
  const found = findSubsetWithPair(board, roof, extra);
  if (!found) return null;
  const keyCells = [...rect, ...found.subset];
  const cornerMarks = [
    [C, b],
    [D, a],
  ];
  const keyMarks = [
    ...cornerMarks,
    ...candidateMarks(board, roof, extra),
    ...candidateMarks(board, found.subset, found.mask),
  ];
  const [p, q] = [C, D].map(cellName);
  return avoidableStep('type 3', found.eliminations, [
    { text: `Consider the digits ${Math.min(a, b)} and ${Math.max(a, b)}.` },
    stage(
      `${rectangleText(rect)} ${cellName(A)} is ${a} and ${cellName(B)} is ${b}, and neither was a clue. ` +
        `${p} has the candidate ${b} and ${q} has the candidate ${a}, and both have other candidates.`,
      { keyCells: rect, keyMarks: cornerMarks },
    ),
    stage(subsetText(roof, extra, found), { houses: [found.house], keyCells, keyMarks }),
    stage(
      `If ${p} were ${b} and ${q} were ${a}, ${swapText(a, b)}, because none of them is a clue. ` +
        `${subsetConclusion(roof, extra, found)} ${removalText(found.eliminations, { byCell: true })}`,
      { houses: [found.house], keyCells, keyMarks, eliminations: found.eliminations },
    ),
  ]);
}

const avoidableRectangle = {
  id: 'avoidable-rectangle',
  name: 'Avoidable Rectangle',
  lesson: [
    'This technique only works because the puzzle has exactly one solution. Every puzzle in this app does.',
    'It uses cells that have already been solved, so it depends on which digits were clues. Look for four cells at the corners of a rectangle that covers exactly two rows, two columns and two blocks, where some of the corners are solved but none of them was a clue. Suppose the four cells ended up with 3 in two opposite corners and 7 in the other two. Swapping the 3s and 7s would still give a valid grid, and since none of the four cells is a clue, that grid would agree with the clues too, so the puzzle would have a second solution. So the four cells can never end up like that.',
    'Type 1: three corners are solved. One of them is 3, and the two corners in its row and its column are both 7. The fourth corner cannot be 3, so remove 3 from it.',
    'Type 2: two corners in the same row or column are solved as 3 and 7. Of the other two corners, the one in the same row or column as the 3 has only the candidates 7 and 9, and the one in the same row or column as the 7 has only 3 and 9. If neither of them were 9, they would be 7 and 3. So one of them is 9: remove 9 from every other cell in a row, column or block that contains both of them.',
    'Type 3: two corners in the same row or column are solved as 3 and 7. Of the other two corners, the one in the same row or column as the 3 has 7 and other candidates, and the one in the same row or column as the 7 has 3 and other candidates. They cannot be 7 and 3, so at least one of them holds one of its other candidates. In a row, column or block that contains both of them, count the two cells as one cell whose candidates are those other candidates. If this cell and some other cells there have, between them, only as many different candidates as there are cells, those digits must all go in these cells. Remove them from the rest of that row, column or block.',
  ],
  find(board) {
    for (const rect of RECTANGLES) {
      const step = avoidableType1(board, rect);
      if (step) return step;
    }
    for (const type of [avoidableType2, avoidableType3]) {
      for (const rect of RECTANGLES) {
        for (const side of SIDES) {
          const corners = side.map((i) => rect[i]);
          const [A, B, C, D] = corners;
          if (!solvedNotClue(board, A) || !solvedNotClue(board, B) || board.values[C] || board.values[D]) continue;
          const a = board.values[A];
          const b = board.values[B];
          if (!board.has(C, b) || !board.has(D, a)) continue;
          const step = type(board, rect, corners, a, b);
          if (step) return step;
        }
      }
    }
    return null;
  },
};

export default [uniqueRectangle, bugPlusOne, hiddenUniqueRectangle, avoidableRectangle];
