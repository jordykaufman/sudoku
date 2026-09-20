import { ALL, BOX, COL, HOUSES, PEERS, ROW, bit } from '../engine/grid.js';
import { HINT_PENALTY_SECONDS, checkWork, findHint } from '../engine/hint.js';

// Seconds added to the clock for help other than hints. These numbers are this app's own.
export const PENALTY = {
  solution: 600, // Show Solution
  notSolvable: 30, // asking whether the board is solvable when it isn't
  undoUntilSolvable: 60,
  wrongDigit: 10, // each wrong digit shown in red when Mark mistakes is set to wrong digits
  unsolvableMove: 10, // each move that makes the board unsolvable while Show solvable is on
  check: 30, // Check the board, when it finds a mistake
  mistakeHint: 10, // a hint that points out a mistake
  stuckHint: 60, // a hint that gives a digit because no technique applies
};

const toDigits = (text) => Array.from(text, (ch) => (ch === '.' || ch === '0' ? 0 : Number(ch)));
const digitsText = (values) => values.map((v) => v || '.').join('');
// Pencil marks as text: two base-36 characters per cell.
const marksText = (marks) => marks.map((m) => m.toString(36).padStart(2, '0')).join('');
const parseMarks = (text) => Array.from({ length: 81 }, (_, i) => parseInt(text.slice(i * 2, i * 2 + 2), 36));

function allowedMask(values, cell) {
  let mask = ALL;
  for (const p of PEERS[cell]) if (values[p]) mask &= ~bit(values[p]);
  return mask;
}

// Converts pencil marks between the modes. In 'manual' and 'erase' mode `marks` holds the
// marks the player sees. In 'auto' mode the shown marks are the allowed digits minus
// `removed`, the marks the player turned off.
function convertMarks(values, marks, removed, from, to) {
  if (from === to || (from !== 'auto' && to !== 'auto')) return;
  for (let cell = 0; cell < 81; cell++) {
    if (to === 'auto') {
      removed[cell] = marks[cell] ? allowedMask(values, cell) & ~marks[cell] : 0;
    } else {
      marks[cell] = values[cell] ? 0 : allowedMask(values, cell) & ~removed[cell];
    }
  }
}

export class Game {
  // `data` is either a new puzzle ({ kind, level, date, puzzle, solution }) or saved JSON.
  constructor(data) {
    this.kind = data.kind;
    this.level = data.level;
    this.date = data.date ?? null;
    this.puzzle = data.puzzle;
    this.solution = toDigits(data.solution);
    this.givens = toDigits(data.puzzle).map((v) => (v ? 1 : 0));
    this.values = toDigits(data.values ?? data.puzzle);
    this.marks = data.marks ? parseMarks(data.marks) : new Array(81).fill(0);
    this.removed = data.removed ? parseMarks(data.removed) : new Array(81).fill(0);
    this.pencilMode = data.pencilMode ?? 'erase';
    this.elapsed = data.elapsed ?? 0; // milliseconds of play
    this.penalty = data.penalty ?? 0; // seconds
    this.hints = data.hints ?? 0;
    this.usedSolution = data.usedSolution ?? false;
    this.finished = data.finished ?? false;
    this.undoStack = data.undo ?? [];
    this.redoStack = data.redo ?? [];
    this.charged = new Set(data.charged ?? []);
    this.lastHint = data.lastHint ?? null;
    this.lastCheck = data.lastCheck ?? null;
  }

  toJSON() {
    return {
      kind: this.kind,
      level: this.level,
      date: this.date,
      puzzle: this.puzzle,
      solution: digitsText(this.solution),
      values: digitsText(this.values),
      marks: marksText(this.marks),
      removed: marksText(this.removed),
      pencilMode: this.pencilMode,
      elapsed: Math.round(this.elapsed),
      penalty: this.penalty,
      hints: this.hints,
      usedSolution: this.usedSolution,
      finished: this.finished,
      undo: this.undoStack.slice(-400),
      redo: this.redoStack.slice(-400),
      charged: [...this.charged],
      lastHint: this.lastHint,
      lastCheck: this.lastCheck,
    };
  }

  get seconds() {
    return Math.floor(this.elapsed / 1000) + this.penalty;
  }

  isGiven(cell) {
    return this.givens[cell] === 1;
  }

  // The digits the placed digits allow in a cell.
  allowed(cell) {
    return allowedMask(this.values, cell);
  }

  // The pencil marks shown in a cell.
  shownMarks(cell) {
    if (this.values[cell]) return 0;
    if (this.pencilMode === 'auto') return this.allowed(cell) & ~this.removed[cell];
    return this.marks[cell];
  }

  digitCount(digit) {
    return this.values.filter((v) => v === digit).length;
  }

  snapshot() {
    return `${digitsText(this.values)}|${marksText(this.marks)}|${marksText(this.removed)}`;
  }

  restore(snapshot) {
    const [values, marks, removed] = snapshot.split('|');
    this.values = toDigits(values);
    this.marks = parseMarks(marks);
    this.removed = parseMarks(removed);
  }

  record() {
    this.undoStack.push(this.snapshot());
    this.redoStack = [];
  }

  setPencilMode(mode) {
    if (mode === this.pencilMode) return;
    convertMarks(this.values, this.marks, this.removed, this.pencilMode, mode);
    const convert = (snapshot) => {
      const [values, marks, removed] = snapshot.split('|');
      const v = toDigits(values);
      const m = parseMarks(marks);
      const r = parseMarks(removed);
      convertMarks(v, m, r, this.pencilMode, mode);
      return `${values}|${marksText(m)}|${marksText(r)}`;
    };
    this.undoStack = this.undoStack.map(convert);
    this.redoStack = this.redoStack.map(convert);
    this.pencilMode = mode;
  }

  // Places `digit` in `cell`, or clears the cell if it already holds that digit. Returns null
  // if nothing changed, otherwise { placed, houses, digit } where `houses` are the houses this
  // move filled and `digit` is set when all nine copies of it are now placed.
  enter(cell, digit, settings) {
    if (this.finished || this.isGiven(cell)) return null;
    const wasSolvable = this.isSolvable();
    this.record();
    if (this.values[cell] === digit) {
      this.values[cell] = 0;
      return { placed: false, houses: [], digit: 0 };
    }
    this.values[cell] = digit;
    if (this.pencilMode === 'erase') for (const p of PEERS[cell]) this.marks[p] &= ~bit(digit);
    if (digit !== this.solution[cell]) {
      if (settings.mistakes === 'wrong' && !this.charged.has(cell)) {
        this.charged.add(cell);
        this.penalty += PENALTY.wrongDigit;
      }
      if (settings.showSolvable && wasSolvable) this.penalty += PENALTY.unsolvableMove;
    }
    const houses = [ROW[cell], 9 + COL[cell], 18 + BOX[cell]].filter((h) => HOUSES[h].every((c) => this.values[c]));
    return { placed: true, houses, digit: this.digitCount(digit) === 9 ? digit : 0 };
  }

  // Clears the player's digit from a cell, or the cell's pencil marks when it has no digit.
  erase(cell) {
    if (this.finished || this.isGiven(cell)) return false;
    if (this.values[cell]) {
      this.record();
      this.values[cell] = 0;
      return true;
    }
    if (!this.shownMarks(cell)) return false;
    this.record();
    if (this.pencilMode === 'auto') this.removed[cell] = this.allowed(cell);
    else this.marks[cell] = 0;
    return true;
  }

  toggleMark(cell, digit) {
    if (this.finished || this.values[cell]) return false;
    const b = bit(digit);
    if (this.pencilMode === 'auto' && !(this.allowed(cell) & b)) return false;
    this.record();
    if (this.pencilMode === 'auto') this.removed[cell] ^= b;
    else this.marks[cell] ^= b;
    return true;
  }

  // Fills every empty cell with the pencil marks the placed digits allow.
  fillMarks() {
    this.record();
    for (let cell = 0; cell < 81; cell++) {
      if (this.values[cell]) continue;
      if (this.pencilMode === 'auto') this.removed[cell] = 0;
      else this.marks[cell] = this.allowed(cell);
    }
  }

  undo() {
    if (!this.undoStack.length) return false;
    this.redoStack.push(this.snapshot());
    this.restore(this.undoStack.pop());
    return true;
  }

  redo() {
    if (!this.redoStack.length) return false;
    this.undoStack.push(this.snapshot());
    this.restore(this.redoStack.pop());
    return true;
  }

  // Whether every placed digit agrees with the solution.
  isSolvable() {
    return this.values.every((v, cell) => !v || v === this.solution[cell]);
  }

  askSolvable() {
    const solvable = this.isSolvable();
    if (!solvable) this.penalty += PENALTY.notSolvable;
    return solvable;
  }

  // Undoes moves until the board is solvable again. Returns the number of moves undone.
  undoUntilSolvable() {
    let count = 0;
    while (!this.isSolvable() && this.undo()) count++;
    if (count) this.penalty += PENALTY.undoUntilSolvable;
    return count;
  }

  // The player's digits that are not in the solution.
  wrongCells() {
    const cells = new Set();
    for (let cell = 0; cell < 81; cell++) {
      if (this.values[cell] && !this.isGiven(cell) && this.values[cell] !== this.solution[cell]) cells.add(cell);
    }
    return cells;
  }

  // The player's digits that share a house with the same digit.
  clashCells() {
    const cells = new Set();
    for (let cell = 0; cell < 81; cell++) {
      const v = this.values[cell];
      if (v && !this.isGiven(cell) && PEERS[cell].some((p) => this.values[p] === v)) cells.add(cell);
    }
    return cells;
  }

  // Finds a hint for the current position. Time is added once per position, so asking again
  // without changing the board costs nothing.
  hint() {
    const result = findHint({
      values: Uint8Array.from(this.values),
      givens: Uint8Array.from(this.givens),
      solution: Uint8Array.from(this.solution),
      marks: Uint16Array.from({ length: 81 }, (_, cell) => this.shownMarks(cell)),
    });
    const position = this.snapshot();
    if (result.kind !== 'solved' && this.lastHint !== position) {
      this.lastHint = position;
      this.hints++;
      if (result.kind === 'step') this.penalty += HINT_PENALTY_SECONDS[result.level] ?? 0;
      else if (result.kind === 'mistake') this.penalty += PENALTY.mistakeHint;
      else this.penalty += PENALTY.stuckHint;
    }
    return result;
  }

  // Checks the placed digits and the pencil marks against the solution. Time is added once
  // per position, and only when something is wrong.
  checkWork() {
    const result = checkWork({
      values: Uint8Array.from(this.values),
      givens: Uint8Array.from(this.givens),
      solution: Uint8Array.from(this.solution),
      marks: Uint16Array.from({ length: 81 }, (_, cell) => this.shownMarks(cell)),
    });
    const position = this.snapshot();
    if (result.problems && this.lastCheck !== position) {
      this.lastCheck = position;
      this.penalty += PENALTY.check;
    }
    return result;
  }

  // Shows the solution of every empty cell as its only pencil mark.
  showSolution() {
    this.record();
    for (let cell = 0; cell < 81; cell++) {
      if (this.values[cell]) continue;
      const b = bit(this.solution[cell]);
      if (this.pencilMode === 'auto') this.removed[cell] = this.allowed(cell) & ~b;
      else this.marks[cell] = b;
    }
    if (!this.usedSolution) this.penalty += PENALTY.solution;
    this.usedSolution = true;
  }

  // Marks the game finished when every cell matches the solution.
  checkFinished() {
    if (!this.finished && this.values.every((v, cell) => v === this.solution[cell])) this.finished = true;
    return this.finished;
  }
}
