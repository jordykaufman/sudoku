// Naked Pair, Naked Triple, Naked Quad, Hidden Pair, Hidden Triple and Hidden Quad.
// Definitions: http://sudopedia.enjoysudoku.com/Naked_Subset.html,
// http://sudopedia.enjoysudoku.com/Hidden_Subset.html,
// https://hodoku.sourceforge.net/en/tech_naked.php and
// https://hodoku.sourceforge.net/en/tech_hidden.php.
import { DIGITS, HOUSES, POPCOUNT, bit, maskOf, sharedHouses } from '../grid.js';
import { cellList, houseName, joinList, orList, removalText } from '../text.js';
import { combinations, sortEliminations } from './common.js';

// Naked subsets: `size` empty cells in a house whose candidates together are exactly `size`
// digits. The digits are removed from the other cells of the house, and from the other cells
// of a second house that holds all the cells (a block and a row or column).
function findNaked(board, id, size) {
  for (let house = 0; house < 27; house++) {
    const open = HOUSES[house].filter((cell) => board.count(cell) >= 2 && board.count(cell) <= size);
    for (const cells of combinations(open, size)) {
      const digits = cells.reduce((mask, cell) => mask | board.cands[cell], 0);
      if (POPCOUNT[digits] !== size) continue;
      const done = new Set(cells);
      const eliminations = [];
      const changed = [];
      for (const h of [house, ...sharedHouses(cells).filter((h) => h !== house)]) {
        const before = eliminations.length;
        for (const cell of HOUSES[h]) {
          if (done.has(cell)) continue;
          done.add(cell);
          for (const digit of DIGITS[board.cands[cell] & digits]) eliminations.push([cell, digit]);
        }
        if (eliminations.length > before) changed.push(h);
      }
      // Skip cells whose removals are all in the second house. The same cells come up again
      // when `house` is that second house, and then the first stage names the house where
      // candidates are removed.
      if (changed[0] !== house) continue;
      sortEliminations(eliminations);

      const digitList = DIGITS[digits];
      const name = houseName(house);
      const also =
        changed.length > 1 ? ` ${size === 2 ? 'Both cells are' : 'All three cells are'} also in ${houseName(changed[1])}.` : '';
      const keyCells = cells.map((cell) => [cell, 'key']);
      const keyMarks = cells.flatMap((cell) => board.candidates(cell).map((digit) => [cell, digit, 'key']));
      return {
        technique: id,
        placements: [],
        eliminations,
        stages: [
          { text: `Look at ${name}.` },
          {
            text: `In ${name}, ${cellList(cells)} have no candidates other than ${joinList(digitList)}.${also}`,
            houses: changed,
            cells: keyCells,
            marks: keyMarks,
          },
          {
            text:
              `${cellList(cells)} must be ${joinList(digitList)} in some order, so no other cell in ` +
              `${orList(changed.map(houseName))} can be ${orList(digitList)}. ${removalText(eliminations)}`,
            houses: changed,
            cells: [...keyCells, ...[...new Set(eliminations.map(([cell]) => cell))].map((cell) => [cell, 'target'])],
            marks: [...keyMarks, ...eliminations.map(([cell, digit]) => [cell, digit, 'elim'])],
          },
        ],
      };
    }
  }
  return null;
}

// Hidden subsets: `size` digits, none placed in a house, whose candidates in the house are
// all in the same `size` cells. Every other candidate is removed from those cells.
function findHidden(board, id, size) {
  for (let house = 0; house < 27; house++) {
    const houseCells = HOUSES[house];
    let placed = 0;
    // spots[d]: bit i is set when houseCells[i] has the candidate d.
    const spots = new Uint16Array(10);
    houseCells.forEach((cell, i) => {
      if (board.values[cell]) placed |= bit(board.values[cell]);
      for (const digit of board.candidates(cell)) spots[digit] |= 1 << i;
    });
    const open = [];
    for (let digit = 1; digit <= 9; digit++) {
      if (!(placed & bit(digit)) && POPCOUNT[spots[digit]] >= 2 && POPCOUNT[spots[digit]] <= size) open.push(digit);
    }
    for (const digits of combinations(open, size)) {
      const where = digits.reduce((mask, digit) => mask | spots[digit], 0);
      if (POPCOUNT[where] !== size) continue;
      const cells = houseCells.filter((_, i) => where & (1 << i));
      const mask = maskOf(digits);
      const eliminations = cells.flatMap((cell) => DIGITS[board.cands[cell] & ~mask].map((digit) => [cell, digit]));
      if (!eliminations.length) continue;

      const name = houseName(house);
      const keyMarks = cells.flatMap((cell) => DIGITS[board.cands[cell] & mask].map((digit) => [cell, digit, 'key']));
      return {
        technique: id,
        placements: [],
        eliminations,
        stages: [
          { text: `Look at ${name}.` },
          {
            text: `In ${name}, the digits ${joinList(digits)} can only go in ${cellList(cells)}.`,
            houses: [house],
            cells: cells.map((cell) => [cell, 'key']),
            marks: keyMarks,
          },
          {
            text: `${cellList(cells)} must be ${joinList(digits)} in some order, so they cannot hold any other digit. ${removalText(eliminations, { byCell: true })}`,
            houses: [house],
            cells: cells.map((cell) => [cell, board.cands[cell] & ~mask ? 'target' : 'key']),
            marks: [...keyMarks, ...eliminations.map(([cell, digit]) => [cell, digit, 'elim'])],
          },
        ],
      };
    }
  }
  return null;
}

const nakedPair = {
  id: 'naked-pair',
  name: 'Naked Pair',
  lesson: [
    'Look for two cells in the same row, column or block that have the same two candidates and no others.',
    'Each of the two cells must hold one of the two digits, and they cannot both hold the same digit, so the two digits go in these two cells, one in each. No other cell of that row, column or block can hold either digit, so you can remove both digits from the other cells.',
    'If the two cells are in the same row or column and also in the same block, remove the two digits from the other cells of the block as well.',
  ],
  find: (board) => findNaked(board, 'naked-pair', 2),
};

const nakedTriple = {
  id: 'naked-triple',
  name: 'Naked Triple',
  lesson: [
    'Look for three cells in the same row, column or block whose candidates, taken together, are only three digits. A cell does not need all three digits. For example, cells with the candidates 1 and 2, 2 and 3, and 1 and 3 together have only the digits 1, 2 and 3.',
    'Each of the three cells must hold one of the three digits, and no two of them can hold the same digit, so the three digits go in these three cells, one in each. You can remove the three digits from the other cells of that row, column or block.',
    'If the three cells are in the same row or column and also in the same block, remove the three digits from the other cells of the block as well.',
  ],
  find: (board) => findNaked(board, 'naked-triple', 3),
};

const nakedQuad = {
  id: 'naked-quad',
  name: 'Naked Quad',
  lesson: [
    'Look for four cells in the same row, column or block whose candidates, taken together, are only four digits. A cell does not need all four digits.',
    'Each of the four cells must hold one of the four digits, and no two of them can hold the same digit, so the four digits go in these four cells, one in each. You can remove the four digits from the other cells of that row, column or block.',
  ],
  find: (board) => findNaked(board, 'naked-quad', 4),
};

const hiddenPair = {
  id: 'hidden-pair',
  name: 'Hidden Pair',
  lesson: [
    'Pick a row, column or block and two digits it does not have yet. Find the cells in it that can hold each digit. If both digits can only go in the same two cells, those two cells must hold the two digits, one in each, because the row, column or block needs both.',
    'Neither cell can hold any other digit, so you can remove every other candidate from the two cells.',
  ],
  find: (board) => findHidden(board, 'hidden-pair', 2),
};

const hiddenTriple = {
  id: 'hidden-triple',
  name: 'Hidden Triple',
  lesson: [
    'Pick a row, column or block and three digits it does not have yet. If only three cells in it can hold any of these digits, those three cells must hold the three digits, one in each, because the row, column or block needs all three. A digit does not need to be a candidate in all three cells.',
    'None of the three cells can hold any other digit, so you can remove every other candidate from them.',
  ],
  find: (board) => findHidden(board, 'hidden-triple', 3),
};

const hiddenQuad = {
  id: 'hidden-quad',
  name: 'Hidden Quad',
  lesson: [
    'Pick a row, column or block and four digits it does not have yet. If only four cells in it can hold any of these digits, those four cells must hold the four digits, one in each, because the row, column or block needs all four. A digit does not need to be a candidate in all four cells.',
    'None of the four cells can hold any other digit, so you can remove every other candidate from them.',
  ],
  find: (board) => findHidden(board, 'hidden-quad', 4),
};

export default [nakedPair, nakedTriple, nakedQuad, hiddenPair, hiddenTriple, hiddenQuad];
