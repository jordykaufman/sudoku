import { Board } from './board.js';
import { DIGITS, bit } from './grid.js';

// Rearranging and relabelling a board. Renaming the digits, reordering the three bands of
// rows, the three stacks of columns, the rows within a band and the columns within a stack,
// and swapping rows with columns all leave a Sudoku a Sudoku: every technique applies to the
// new board exactly as it did to the old one, on the cells the rearrangement moved them to.
// Practice uses this so that a position never comes up looking the same twice.

const shuffle = (items, rng) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Where each of the nine lines ends up: the bands move, and the lines within each band move.
function linePermutation(rng) {
  const out = new Array(9);
  shuffle([0, 1, 2], rng).forEach((band, toBand) => {
    shuffle([0, 1, 2], rng).forEach((line, toLine) => {
      out[band * 3 + line] = toBand * 3 + toLine;
    });
  });
  return out;
}

// A random rearrangement, as { rows, columns, transpose, digits } where `digits[d]` is the new
// name of digit d. Given on its own so that a test can use a fixed one.
export function randomArrangement(rng = Math.random) {
  const names = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  const digits = new Uint8Array(10);
  names.forEach((name, index) => {
    digits[index + 1] = name;
  });
  return { rows: linePermutation(rng), columns: linePermutation(rng), transpose: rng() < 0.5, digits };
}

// A new board, rearranged and relabelled. The board given is left alone.
export function rearrange(board, arrangement = randomArrangement()) {
  const { rows, columns, transpose, digits } = arrangement;
  const out = new Board();
  const rename = (mask) => DIGITS[mask].reduce((out, digit) => out | bit(digits[digit]), 0);
  for (let cell = 0; cell < 81; cell++) {
    const row = rows[Math.floor(cell / 9)];
    const column = columns[cell % 9];
    const to = transpose ? column * 9 + row : row * 9 + column;
    out.values[to] = board.values[cell] ? digits[board.values[cell]] : 0;
    out.cands[to] = rename(board.cands[cell]);
    out.givens[to] = board.givens[cell];
  }
  return out;
}
