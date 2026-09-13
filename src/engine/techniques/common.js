import { commonPeers } from '../grid.js';

// Helpers shared by the technique files.

// Every way to choose k of the items, keeping their order.
export function combinations(items, k) {
  const result = [];
  const chosen = [];
  const extend = (start) => {
    if (chosen.length === k) {
      result.push(chosen.slice());
      return;
    }
    for (let i = start; i <= items.length - (k - chosen.length); i++) {
      chosen.push(items[i]);
      extend(i + 1);
      chosen.pop();
    }
  };
  extend(0);
  return result;
}

export const sortEliminations = (eliminations) => eliminations.sort((x, y) => x[0] - y[0] || x[1] - y[1]);

// Cells outside `cells` that see every cell in `cells` and have `digit` as a candidate.
export function targetsFor(board, cells, digit) {
  return commonPeers(cells).filter((cell) => board.has(cell, digit));
}

// Highlights for a result stage: the pattern cells as 'key' and the changed cells as 'target'.
export function resultCells(keyCells, eliminations) {
  const targets = [...new Set(eliminations.map(([cell]) => cell))];
  return [...keyCells.filter((cell) => !targets.includes(cell)).map((cell) => [cell, 'key']), ...targets.map((cell) => [cell, 'target'])];
}

export const elimMarks = (eliminations) => eliminations.map(([cell, digit]) => [cell, digit, 'elim']);

// A 'key' mark for each candidate in `digits` that the cells have.
export function keyMarks(board, cells, digits) {
  const marks = [];
  for (const cell of cells) for (const digit of digits) if (board.has(cell, digit)) marks.push([cell, digit, 'key']);
  return marks;
}
