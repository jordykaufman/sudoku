import { Board } from '../engine/board.js';
import { HOUSES, bit } from '../engine/grid.js';
import { findBasicFishFor } from '../engine/techniques/fish.js';

// Extra highlights for the selected digit, both optional (settings Show singles and Show
// fish). `game` provides values, givens, shownMarks(cell) and allowed(cell).

// The candidates the player can see in a cell: its pencil marks, or every digit the placed
// digits allow when it shows none. Hints read the board the same way.
const seen = (game, cell) => (game.values[cell] ? 0 : game.shownMarks(cell) || game.allowed(cell));

// Cells where `digit` is the only place left in a row, a column or a block.
export function singleCells(game, digit) {
  const cells = new Set();
  const b = bit(digit);
  for (let house = 0; house < 27; house++) {
    let only = -1;
    let count = 0;
    let placed = false;
    for (const cell of HOUSES[house]) {
      if (game.values[cell] === digit) placed = true;
      else if (seen(game, cell) & b) {
        only = cell;
        count++;
      }
    }
    if (!placed && count === 1) cells.add(only);
  }
  return cells;
}

// The cells of the first X-Wing, Swordfish or Jellyfish for `digit` that removes a pencil mark.
export function fishCells(game, digit) {
  const board = Board.fromValues(game.values, game.givens);
  for (let cell = 0; cell < 81; cell++) if (!game.values[cell]) board.cands[cell] &= seen(game, cell);
  const step = findBasicFishFor(board, digit);
  return new Set(step ? step.stages[1].marks.map(([cell]) => cell) : []);
}
