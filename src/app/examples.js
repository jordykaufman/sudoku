import { Board } from '../engine/board.js';
import { parseGrid } from '../engine/grid.js';

// Example positions for each technique, data/examples.json, made by scripts/examples.js:
//   { [technique id]: [{ values, cands, givens, next }] }
// `values` has 81 characters ('.' for empty), `cands` two base-36 characters per cell, and
// `givens` 81 characters with '1' for each clue. `next` marks a position where the technique
// is the next step, so no easier technique applies there; Practice prefers those.
let cache = null;

export async function loadExamples() {
  if (cache) return cache;
  try {
    const response = await fetch('data/examples.json');
    if (response.ok) cache = await response.json();
  } catch {
    // No examples: the lesson shows its text only.
  }
  return cache ?? {};
}

export function decode({ values, cands, givens }) {
  return new Board(
    parseGrid(values),
    Uint16Array.from({ length: 81 }, (_, i) => parseInt(cands.slice(i * 2, i * 2 + 2), 36)),
    Uint8Array.from(givens, (ch) => (ch === '1' ? 1 : 0)),
  );
}
