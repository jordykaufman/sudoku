import { ALL, DIGITS, HOUSES, PEERS, POPCOUNT, bit, parseGrid } from './grid.js';

// A position for logical solving: the placed digits and the candidates left in each
// empty cell. `givens` marks the puzzle's original clues, which the Avoidable Rectangle
// technique needs to tell apart from cells solved during play.
export class Board {
  constructor(values = new Uint8Array(81), cands = new Uint16Array(81), givens = new Uint8Array(81)) {
    this.values = values;
    this.cands = cands;
    this.givens = givens;
  }

  // A board with every candidate the placed digits allow. Without `givens`, every
  // placed digit counts as a clue.
  static fromValues(values, givens = null) {
    const board = new Board(
      Uint8Array.from(values),
      new Uint16Array(81),
      Uint8Array.from(givens ?? values, (v) => (v ? 1 : 0)),
    );
    for (let i = 0; i < 81; i++) {
      if (board.values[i]) continue;
      let mask = ALL;
      for (const p of PEERS[i]) if (board.values[p]) mask &= ~bit(board.values[p]);
      board.cands[i] = mask;
    }
    return board;
  }

  static fromString(text) {
    return Board.fromValues(parseGrid(text));
  }

  // Pencil-mark grid text: 81 cells separated by spaces. A cell written as one digit is
  // a placed digit; a cell written as several digits lists its candidates. A cell in
  // brackets lists candidates even when there is only one, as in (5). Border characters
  // (| - + . : ' * = #) are ignored, so grids copied from HoDoKu can be pasted in.
  // `givens` is optional puzzle text marking the clues; without it every placed digit
  // counts as a clue.
  static fromCandidateGrid(text, givens = null) {
    const tokens = text.replace(/[|\-+.:'*=#]/g, ' ').trim().split(/\s+/);
    if (tokens.length !== 81) throw new Error(`expected 81 cells, got ${tokens.length}`);
    const board = new Board();
    tokens.forEach((token, i) => {
      const match = /^(\(?)([1-9]+)(\)?)$/.exec(token);
      if (!match || match[1].length !== match[3].length) throw new Error(`cell ${i} is not a list of digits: ${token}`);
      if (token.length === 1) board.values[i] = Number(token);
      else for (const ch of match[2]) board.cands[i] |= bit(Number(ch));
    });
    board.givens = Uint8Array.from(givens ? parseGrid(givens) : board.values, (v) => (v ? 1 : 0));
    return board;
  }

  // For debugging output, in the format fromCandidateGrid reads. An empty cell with one
  // candidate is shown in brackets, and an empty cell with no candidates as '-'.
  toCandidateGrid() {
    const cells = Array.from(this.values, (v, i) => {
      if (v) return String(v);
      const digits = DIGITS[this.cands[i]].join('');
      return digits.length === 1 ? `(${digits})` : digits || '-';
    });
    const width = Math.max(...cells.map((c) => c.length));
    const rows = [];
    for (let r = 0; r < 9; r++) rows.push(cells.slice(r * 9, r * 9 + 9).map((c) => c.padEnd(width)).join(' '));
    return rows.join('\n');
  }

  clone() {
    return new Board(this.values.slice(), this.cands.slice(), this.givens.slice());
  }

  has(cell, digit) {
    return (this.cands[cell] & bit(digit)) !== 0;
  }

  count(cell) {
    return POPCOUNT[this.cands[cell]];
  }

  // The candidates of a cell in increasing order. The array is shared: don't modify it.
  candidates(cell) {
    return DIGITS[this.cands[cell]];
  }

  // Cells of `house` that still have `digit` as a candidate.
  where(house, digit) {
    const b = bit(digit);
    return HOUSES[house].filter((cell) => this.cands[cell] & b);
  }

  // Whether `digit` is already placed in `house`.
  placed(house, digit) {
    return HOUSES[house].some((cell) => this.values[cell] === digit);
  }

  place(cell, digit) {
    this.values[cell] = digit;
    this.cands[cell] = 0;
    const clear = ~bit(digit);
    for (const p of PEERS[cell]) this.cands[p] &= clear;
  }

  eliminate(cell, digit) {
    const b = bit(digit);
    if (!(this.cands[cell] & b)) return false;
    this.cands[cell] &= ~b;
    return true;
  }

  // Applies a step. Returns how many of its placements and eliminations changed the board.
  apply(step) {
    let changed = 0;
    for (const [cell, digit] of step.eliminations) if (this.eliminate(cell, digit)) changed++;
    for (const [cell, digit] of step.placements) {
      if (this.values[cell]) continue;
      this.place(cell, digit);
      changed++;
    }
    return changed;
  }

  isSolved() {
    for (let i = 0; i < 81; i++) if (!this.values[i]) return false;
    return true;
  }
}
