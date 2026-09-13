import { BOX, COL, DIGITS, POPCOUNT, ROW, bit } from './grid.js';
import { shuffled } from './random.js';

// Backtracking solver. It counts the solutions of a grid (0 = empty cell), stopping once
// the count reaches `limit`, and returns the first solution it found. With `rng` it tries
// digits in random order, which is how random complete grids are made.
export function solve(values, { limit = 2, rng = null } = {}) {
  const grid = Uint8Array.from(values);
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);
  for (let i = 0; i < 81; i++) {
    const d = grid[i];
    if (!d) continue;
    const b = bit(d);
    if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & b) return { count: 0, solution: null };
    rows[ROW[i]] |= b;
    cols[COL[i]] |= b;
    boxes[BOX[i]] |= b;
  }
  const empties = [];
  for (let i = 0; i < 81; i++) if (!grid[i]) empties.push(i);

  let count = 0;
  let solution = null;

  const search = (depth) => {
    if (depth === empties.length) {
      count++;
      if (!solution) solution = grid.slice();
      return count >= limit;
    }
    // Fill the cell with the fewest options first.
    let pick = depth;
    let pickMask = 0;
    let pickCount = 10;
    for (let k = depth; k < empties.length; k++) {
      const cell = empties[k];
      const mask = 0x1ff & ~(rows[ROW[cell]] | cols[COL[cell]] | boxes[BOX[cell]]);
      if (POPCOUNT[mask] < pickCount) {
        pick = k;
        pickMask = mask;
        pickCount = POPCOUNT[mask];
        if (pickCount <= 1) break;
      }
    }
    if (pickCount === 0) return false;
    [empties[depth], empties[pick]] = [empties[pick], empties[depth]];
    const cell = empties[depth];
    const digits = rng ? shuffled(DIGITS[pickMask], rng) : DIGITS[pickMask];
    for (const d of digits) {
      const b = bit(d);
      grid[cell] = d;
      rows[ROW[cell]] |= b;
      cols[COL[cell]] |= b;
      boxes[BOX[cell]] |= b;
      const stop = search(depth + 1);
      rows[ROW[cell]] &= ~b;
      cols[COL[cell]] &= ~b;
      boxes[BOX[cell]] &= ~b;
      grid[cell] = 0;
      if (stop) return true;
    }
    return false;
  };

  search(0);
  return { count, solution };
}
