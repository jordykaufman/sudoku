// Grid geometry shared by the solver, the techniques and the UI.
//
// Cells are numbered 0-80, left to right and top to bottom.
// Houses are numbered 0-8 for rows, 9-17 for columns and 18-26 for blocks.
// A set of candidates is a 9-bit mask in which bit (d - 1) stands for digit d.

export const ROW = new Uint8Array(81);
export const COL = new Uint8Array(81);
export const BOX = new Uint8Array(81);
for (let i = 0; i < 81; i++) {
  ROW[i] = Math.floor(i / 9);
  COL[i] = i % 9;
  BOX[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3);
}

export const HOUSES = [];
for (let r = 0; r < 9; r++) HOUSES.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) HOUSES.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) {
  const top = Math.floor(b / 3) * 3;
  const left = (b % 3) * 3;
  const cells = [];
  for (let r = top; r < top + 3; r++) for (let c = left; c < left + 3; c++) cells.push(r * 9 + c);
  HOUSES.push(cells);
}

// The row, column and block house of each cell.
export const CELL_HOUSES = Array.from({ length: 81 }, (_, i) => [ROW[i], 9 + COL[i], 18 + BOX[i]]);

// The 20 other cells that share a house with each cell.
export const PEERS = Array.from({ length: 81 }, (_, i) => {
  const peers = new Set();
  for (const h of CELL_HOUSES[i]) for (const j of HOUSES[h]) if (j !== i) peers.add(j);
  return [...peers].sort((a, b) => a - b);
});

export function sees(a, b) {
  return a !== b && (ROW[a] === ROW[b] || COL[a] === COL[b] || BOX[a] === BOX[b]);
}

// Cells outside `cells` that share a house with every cell in `cells`.
export function commonPeers(cells) {
  const result = [];
  for (let i = 0; i < 81; i++) {
    if (!cells.includes(i) && cells.every((c) => sees(i, c))) result.push(i);
  }
  return result;
}

// Houses that contain every cell in `cells`.
export function sharedHouses(cells) {
  return CELL_HOUSES[cells[0]].filter((h) => cells.every((c) => CELL_HOUSES[c].includes(h)));
}

export const ALL = 0x1ff;
export const bit = (digit) => 1 << (digit - 1);

// The number of digits in each mask, and the digits themselves in increasing order.
export const POPCOUNT = new Uint8Array(512);
export const DIGITS = [];
for (let mask = 0; mask < 512; mask++) {
  const digits = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << (d - 1))) digits.push(d);
  POPCOUNT[mask] = digits.length;
  DIGITS.push(digits);
}

export const maskOf = (digits) => digits.reduce((mask, d) => mask | bit(d), 0);

// Puzzle text: 81 cells, a digit for each clue and '.' or '0' for each empty cell.
// Any other characters (spaces, line breaks, borders) are ignored.
export function parseGrid(text) {
  const chars = text.replace(/[^0-9.]/g, '');
  if (chars.length !== 81) throw new Error(`expected 81 cells, got ${chars.length}`);
  return Uint8Array.from(chars, (ch) => (ch === '.' ? 0 : Number(ch)));
}

export function formatGrid(values) {
  return Array.from(values, (v) => (v ? String(v) : '.')).join('');
}
