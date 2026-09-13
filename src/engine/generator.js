import { shuffled } from './random.js';
import { solve } from './solver.js';

// A random complete grid.
export function randomSolution(rng) {
  return solve(new Uint8Array(81), { limit: 1, rng }).solution;
}

// Empties cells of a complete grid in pairs that mirror each other through the centre
// (cell i and cell 80 - i), in random order. A pair stays empty only if the puzzle still
// has exactly one solution and `keep(puzzle)` returns true. No pair is emptied that would
// take the puzzle past `maxEmpty` empty cells.
export function carve(solution, rng, { keep = null, maxEmpty = 81 } = {}) {
  const puzzle = solution.slice();
  let empty = 0;
  for (const i of shuffled([...Array(41).keys()], rng)) {
    const j = 80 - i;
    const size = i === j ? 1 : 2;
    if (empty + size > maxEmpty) continue;
    puzzle[i] = 0;
    puzzle[j] = 0;
    if (solve(puzzle, { limit: 2 }).count === 1 && (!keep || keep(puzzle))) {
      empty += size;
    } else {
      puzzle[i] = solution[i];
      puzzle[j] = solution[j];
    }
  }
  return puzzle;
}
