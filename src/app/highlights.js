import { Board } from '../engine/board.js';
import { BOX, DIGITS, HOUSES, POPCOUNT, bit } from '../engine/grid.js';
import { findBasicFishFor } from '../engine/techniques/fish.js';

// Extra highlights for the selected digit, both optional (settings Show singles and Show
// fish). `game` provides values, givens, shownMarks(cell) and allowed(cell).

// Both read only the pencil marks on the board, never what the marks ought to be: a cell
// without marks takes no part, and a mark for a digit already placed in the cell's row,
// column or block is left out, because the board itself rules it out.
const marked = (game, cell) => (game.values[cell] ? 0 : game.shownMarks(cell) & game.allowed(cell));

// Cells where the pencil marks say `digit` must go: the only mark for it in a row, a column
// or a block, or a cell whose only mark it is.
export function singleCells(game, digit) {
  const cells = new Set();
  const b = bit(digit);
  for (const house of HOUSES) {
    const holders = house.filter((cell) => marked(game, cell) & b);
    if (holders.length === 1) cells.add(holders[0]);
  }
  for (let cell = 0; cell < 81; cell++) if (marked(game, cell) === b) cells.add(cell);
  return cells;
}

// The digit whose pencil mark in `cell` is the only one for it in the cell's block, or 0 when
// there is none. Two such digits in one cell would mean the marks contradict each other, so
// that gives 0 too.
export function blockSingle(game, cell) {
  const block = HOUSES[18 + BOX[cell]];
  const alone = DIGITS[marked(game, cell)].filter((digit) => block.every((other) => other === cell || !(marked(game, other) & bit(digit))));
  return alone.length === 1 ? alone[0] : 0;
}

// With no digit highlighted: the cells a hold fills, whatever digit they need. A cell with one
// pencil mark left, or with the only pencil mark for a digit in its block.
export function forcedCells(game) {
  const cells = new Set();
  for (let cell = 0; cell < 81; cell++) if (POPCOUNT[marked(game, cell)] === 1 || blockSingle(game, cell)) cells.add(cell);
  return cells;
}

// The cells of the first X-Wing, Swordfish or Jellyfish for `digit` in the pencil marks that
// removes a pencil mark.
export function fishCells(game, digit) {
  const board = Board.fromValues(game.values, game.givens);
  for (let cell = 0; cell < 81; cell++) board.cands[cell] = marked(game, cell);
  const step = findBasicFishFor(board, digit);
  return new Set(step ? step.stages[1].marks.map(([cell]) => cell) : []);
}
