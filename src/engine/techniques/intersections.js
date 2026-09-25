// Locked Candidate (direct pointing), Locked Candidate and Almost Locked Candidates.
// Definitions: http://sudopedia.enjoysudoku.com/Locked_Candidates.html and
// http://sudopedia.enjoysudoku.com/Almost_Locked_Candidates.html. The Sudopedia mirror has no
// page for direct pointing. Here it means a pointing move whose eliminations leave the digit
// with exactly one possible cell in a house where it had two or more.
import { BOX, CELL_HOUSES, COL, DIGITS, HOUSES, POPCOUNT, ROW, bit } from '../grid.js';
import { aDigit, capitalize, cellList, cellName, houseName, joinList, orList, removalText } from '../text.js';
import { combinations } from './common.js';

const byNumber = (a, b) => a - b;

const candidatesOf = (board, cells) => cells.reduce((mask, cell) => mask | board.cands[cell], 0);

// The row or column that contains all of `cells`, or -1.
function lineOf(cells) {
  if (cells.every((cell) => ROW[cell] === ROW[cells[0]])) return ROW[cells[0]];
  if (cells.every((cell) => COL[cell] === COL[cells[0]])) return 9 + COL[cells[0]];
  return -1;
}

// The block that contains all of `cells`, or -1.
function blockOf(cells) {
  return cells.every((cell) => BOX[cell] === BOX[cells[0]]) ? 18 + BOX[cells[0]] : -1;
}

// Locked candidate moves that remove something, for each digit in turn. Pointing: every
// candidate for the digit in a block is in one row or column. Claiming: every candidate for
// the digit in a row or column is in one block. `from` is the house whose candidates are
// all in the other house, `to`; `cells` are those candidates, and the digit is removed from
// the rest of `to`.
function* lockedMoves(board, pointing) {
  const first = pointing ? 18 : 0;
  const last = pointing ? 26 : 17;
  for (let digit = 1; digit <= 9; digit++) {
    for (let from = first; from <= last; from++) {
      if (board.placed(from, digit)) continue;
      const cells = board.where(from, digit);
      if (cells.length < 2) continue;
      const to = pointing ? lineOf(cells) : blockOf(cells);
      if (to < 0) continue;
      const eliminations = board
        .where(to, digit)
        .filter((cell) => !cells.includes(cell))
        .map((cell) => [cell, digit]);
      if (eliminations.length) yield { digit, from, to, cells, eliminations };
    }
  }
}

// The second stage and the explanation used in the last stage of a locked candidate hint.
function describeLocked({ digit, from, to, cells, eliminations }) {
  const fromName = houseName(from);
  const toName = houseName(to);
  const keyMarks = cells.map((cell) => [cell, digit, 'key']);
  return {
    keyMarks,
    pattern: { text: `Every cell in ${fromName} that can be ${digit} is in ${toName}.`, digit, houses: [from, to], marks: keyMarks },
    reason:
      `${capitalize(fromName)} needs ${aDigit(digit)}, and it can only go in ${orList(cells.map(cellName))}. ` +
      `${cells.length === 2 ? 'Both cells are' : 'All three cells are'} in ${toName}, so no other cell in ${toName} can be ${digit}. ` +
      `Remove ${digit} from ${cellList(eliminations.map(([cell]) => cell))}.`,
  };
}

// A house where removing the move's candidates leaves the digit with exactly one possible
// cell, when it had two or more before. Blocks are checked before rows and columns.
function singleAfter(board, { digit, eliminations }) {
  const removed = eliminations.map(([cell]) => cell);
  const houses = [...new Set(removed.flatMap((cell) => CELL_HOUSES[cell]))].sort(byNumber);
  for (const house of [...houses.filter((h) => h >= 18), ...houses.filter((h) => h < 18)]) {
    if (board.placed(house, digit)) continue;
    const before = board.where(house, digit);
    if (before.length < 2) continue;
    const after = before.filter((cell) => !removed.includes(cell));
    if (after.length === 1) return { house, cell: after[0] };
  }
  return null;
}

const lockedCandidateDirectPointing = {
  id: 'locked-candidate-direct-pointing',
  name: 'Locked Candidate (direct pointing)',
  lesson: [
    'This is a Locked Candidate followed by a Hidden Single. It counts as a technique of its own, at an easier level than Locked Candidate, because it ends with a digit placed, so you can do it without pencil marks.',
    'Pick a digit and a block that does not have that digit yet, and find the cells in the block that can still hold it. If these cells are all in one row, the digit goes in that row, inside the block. So no cell of the row outside the block can hold the digit, and you can remove it from those cells. The same works with a column.',
    'Then look at the rows, columns and blocks of the cells you removed the digit from. If one of them had two or more cells that could hold the digit and now has only one, the digit goes in that cell.',
  ],
  find(board) {
    for (const move of lockedMoves(board, true)) {
      const single = singleAfter(board, move);
      if (!single) continue;
      const { digit, from, to, eliminations } = move;
      const { keyMarks, pattern, reason } = describeLocked(move);
      return {
        technique: 'locked-candidate-direct-pointing',
        placements: [[single.cell, digit]],
        eliminations,
        stages: [
          { text: `Consider the digit ${digit}.` },
          pattern,
          {
            text: `${reason} After that, ${cellName(single.cell)} is the only cell in ${houseName(single.house)} that can be ${digit}, so it must be ${digit}.`,
            digit,
            houses: [from, to, single.house],
            cells: [...eliminations.map(([cell]) => [cell, 'target']), [single.cell, 'target']],
            marks: [...keyMarks, ...eliminations.map(([cell]) => [cell, digit, 'elim']), [single.cell, digit, 'place']],
          },
        ],
      };
    }
    return null;
  },
};

const lockedCandidate = {
  id: 'locked-candidate',
  name: 'Locked Candidate',
  lesson: [
    'Pick a digit and a block that does not have that digit yet, and find the cells in the block that can still hold it. Suppose these cells are all in one row. The block needs the digit, so one of these cells must hold it.',
    'A row holds each digit only once, so no cell of that row outside the block can hold the digit, and you can remove it from those cells. This case is called pointing. It works the same way when the cells are all in one column.',
    'In the other case, called claiming, you start from a row. Pick a digit that the row does not have yet. If the cells of the row that can hold the digit are all in one block, one of those cells must hold it. A block also holds each digit only once, so no other cell of the block can hold the digit, and you can remove it from them. This also works with a column.',
  ],
  find(board) {
    for (const variant of ['pointing', 'claiming']) {
      const move = lockedMoves(board, variant === 'pointing').next().value;
      if (!move) continue;
      const { digit, from, to, eliminations } = move;
      const { keyMarks, pattern, reason } = describeLocked(move);
      return {
        technique: 'locked-candidate',
        variant,
        placements: [],
        eliminations,
        stages: [
          { text: `Consider the digit ${digit}.` },
          pattern,
          {
            text: reason,
            digit,
            houses: [from, to],
            cells: eliminations.map(([cell]) => [cell, 'target']),
            marks: [...keyMarks, ...eliminations.map(([cell]) => [cell, digit, 'elim'])],
          },
        ],
      };
    }
    return null;
  },
};

// Almost Locked Candidates in one block and one row or column that crosses it, with `size`
// digits (2 or 3). `lineSet` and `blockSet` are size - 1 cells of the line and of the block,
// outside the shared cells, whose candidates together are exactly the digits. If no other
// cell of the line outside the shared cells has one of the digits, the digits are removed
// from the cells of the block outside the shared cells and `blockSet`. The same holds with
// the line and the block swapped.
function findAlmostLocked(board, size, block, line) {
  const inLine = new Set(HOUSES[line]);
  const shared = HOUSES[block].filter((cell) => inLine.has(cell));
  const lineRest = HOUSES[line].filter((cell) => 18 + BOX[cell] !== block);
  const blockRest = HOUSES[block].filter((cell) => !inLine.has(cell));
  let placed = 0;
  for (const cell of [...HOUSES[block], ...lineRest]) if (board.values[cell]) placed |= bit(board.values[cell]);
  const sharedCandidates = candidatesOf(board, shared);
  const blockSets = combinations(blockRest.filter((cell) => board.cands[cell]), size - 1);
  for (const lineSet of combinations(lineRest.filter((cell) => board.cands[cell]), size - 1)) {
    const digits = candidatesOf(board, lineSet);
    // The shared cells must have a candidate for one of the digits, so that the hint can name
    // them. When the board's candidates include the solution, they always do.
    if (POPCOUNT[digits] !== size || digits & placed || !(digits & sharedCandidates)) continue;
    const lineOthers = lineRest.filter((cell) => !lineSet.includes(cell));
    for (const blockSet of blockSets) {
      if (candidatesOf(board, blockSet) !== digits) continue;
      const blockOthers = blockRest.filter((cell) => !blockSet.includes(cell));
      const orientations = [
        [line, block, lineSet, blockSet, lineOthers, blockOthers],
        [block, line, blockSet, lineSet, blockOthers, lineOthers],
      ];
      for (const [from, to, fromSet, toSet, fromOthers, toOthers] of orientations) {
        if (candidatesOf(board, fromOthers) & digits) continue;
        const eliminations = toOthers.flatMap((cell) => DIGITS[board.cands[cell] & digits].map((digit) => [cell, digit]));
        if (eliminations.length) return almostLockedStep(board, { from, to, digits, shared, fromSet, toSet, eliminations });
      }
    }
  }
  return null;
}

function almostLockedStep(board, { from, to, digits, shared, fromSet, toSet, eliminations }) {
  const digitList = DIGITS[digits];
  const sharedCells = shared.filter((cell) => board.cands[cell] & digits);
  const fromName = houseName(from);
  const toName = houseName(to);
  const houses = [from, to];
  const anyDigit = orList(digitList);
  const keyCells = [...sharedCells, ...fromSet, ...toSet].sort(byNumber);
  const keyMarks = keyCells.flatMap((cell) => DIGITS[board.cands[cell] & digits].map((digit) => [cell, digit, 'key']));
  const pair = digitList.length === 2;

  const pattern =
    `In ${fromName}, the digits ${joinList(digitList)} can only go in ${cellList([...sharedCells, ...fromSet].sort(byNumber))}. ` +
    (pair
      ? `${cellName(fromSet[0])} has no candidates other than ${joinList(digitList)}, and neither does ${cellName(toSet[0])} in ${toName}.`
      : `${cellList(fromSet)} have no candidates other than ${joinList(digitList)}, and neither do ${cellList(toSet)} in ${toName}.`);
  const sharedChoice = orList(sharedCells.map(cellName));
  const result =
    (pair
      ? `${cellName(fromSet[0])} must be ${anyDigit}, so ${fromName} has exactly one of ${joinList(digitList)} in ${sharedChoice}. ` +
        `${cellName(toSet[0])} must be the other one, since it can only be ${anyDigit} and is in ${toName} with ${cellList(sharedCells)}. `
      : `${cellList(fromSet)} must be two of ${joinList(digitList)}, so ${fromName} has exactly one of these digits in ${sharedChoice}. ` +
        `${cellList(toSet)} must be the other two, since they can only be ${anyDigit} and are in ${toName} with ${cellList(sharedCells)}. `) +
    `So no other cell in ${toName} can be ${anyDigit}. ${removalText(eliminations)}`;

  const keyCellRoles = keyCells.map((cell) => [cell, 'key']);
  return {
    technique: 'almost-locked-candidates',
    placements: [],
    eliminations,
    stages: [
      { text: `Look at ${fromName} and ${toName}.` },
      { text: pattern, houses, cells: keyCellRoles, marks: keyMarks },
      {
        text: result,
        houses,
        cells: [...keyCellRoles, ...[...new Set(eliminations.map(([cell]) => cell))].map((cell) => [cell, 'target'])],
        marks: [...keyMarks, ...eliminations.map(([cell, digit]) => [cell, digit, 'elim'])],
      },
    ],
  };
}

const almostLockedCandidates = {
  id: 'almost-locked-candidates',
  name: 'Almost Locked Candidates',
  lesson: [
    'You need a block and a row that cross, so they share three cells, and two digits that neither the block nor the row has yet.',
    'Look for this. In the row, outside the shared cells, there is one cell whose only candidates are the two digits, and no other cell of the row outside the shared cells can hold either digit. In the block, outside the shared cells, there is also a cell whose only candidates are the same two digits.',
    "The row needs both digits, and they can only go in the shared cells or in the row's two-candidate cell. That cell holds one of them, so exactly one of the two digits is in the shared cells. The block needs both digits too. Its two-candidate cell holds one of them, and it cannot hold the same digit as the one in the shared cells, because they are all in the block. So the block's two digits are in the shared cells and its two-candidate cell, and no other cell of the block can hold either digit. You can remove both digits from those cells.",
    "The same works with three digits. In the row, look for two cells outside the shared cells whose candidates together are exactly the three digits, with no other cell of the row outside the shared cells able to hold any of them. In the block, look for two cells outside the shared cells whose candidates together are the same three digits. The row's two cells hold two of the digits, so exactly one is in the shared cells, and the block's two cells must hold the other two.",
    "The row and the block can also swap roles. If, in the block, the digits can only go in the shared cells and the block's cells you found, remove the digits from the cells of the row outside the shared cells and the row's cells you found. Everything here also works with a column in place of the row.",
  ],
  find(board) {
    for (const size of [2, 3]) {
      for (let block = 18; block < 27; block++) {
        const top = ROW[HOUSES[block][0]];
        const left = COL[HOUSES[block][0]];
        for (const line of [top, top + 1, top + 2, 9 + left, 10 + left, 11 + left]) {
          const step = findAlmostLocked(board, size, block, line);
          if (step) return step;
        }
      }
    }
    return null;
  },
};

export default [lockedCandidateDirectPointing, lockedCandidate, almostLockedCandidates];
