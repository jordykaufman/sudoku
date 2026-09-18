import { BOX, COL, DIGITS, HOUSES, POPCOUNT, ROW, bit } from '../grid.js';
import { capitalize, cellList, cellName, houseName, joinList } from '../text.js';

// X-Wing, Swordfish and Jellyfish, and their Finned and Sashimi forms.
//
// A fish of size N for a digit uses N base lines and N cover lines. The base lines are rows
// and the cover lines are columns, or the base lines are columns and the cover lines are
// rows. Within this file a line is numbered 0-8, and a position is a cell's place along a
// line (its column in a row, its row in a column). A set of positions is a 9-bit mask.
//
// Definitions: Sudopedia (http://sudopedia.enjoysudoku.com/X-Wing.html, Finned_X-Wing.html,
// Sashimi_X-Wing.html) and HoDoKu (https://hodoku.sourceforge.net/en/tech_fishb.php and
// tech_fishfs.php).

const WORDS = { 2: 'two', 3: 'three', 4: 'four' };

// The bit positions (0-8) set in each 9-bit mask, in increasing order.
const POSITIONS = DIGITS.map((digits) => digits.map((d) => d - 1));

// The positions of the three blocks along a line: 0-2, 3-5 and 6-8.
const THIRDS = [0b000000111, 0b000111000, 0b111000000];

// Every set of k lines out of 9, in increasing order, as a list and as a mask.
function lineSets(k) {
  const sets = [];
  const add = (start, lines) => {
    if (lines.length === k) {
      sets.push({ lines, mask: lines.reduce((mask, line) => mask | (1 << line), 0) });
      return;
    }
    for (let line = start; line < 9; line++) add(line + 1, [...lines, line]);
  };
  add(0, []);
  return sets;
}
const LINE_SETS = { 2: lineSets(2), 3: lineSets(3), 4: lineSets(4) };

const ORIENTATIONS = [
  {
    base: 'row',
    cover: 'column',
    cell: (line, pos) => line * 9 + pos,
    baseHouse: (line) => line,
    coverHouse: (pos) => 9 + pos,
    lineOf: (cell) => ROW[cell],
    posOf: (cell) => COL[cell],
  },
  {
    base: 'column',
    cover: 'row',
    cell: (line, pos) => pos * 9 + line,
    baseHouse: (line) => 9 + line,
    coverHouse: (pos) => pos,
    lineOf: (cell) => COL[cell],
    posOf: (cell) => ROW[cell],
  },
];

// Calls `visit` for every digit, orientation and set of `size` base lines in which the
// digit is not placed and every line has a candidate for it, and returns the first step
// `visit` returns. `masks[line]` holds the positions of the digit's candidates in each line,
// and `union` the positions of the candidates in the base lines. `only` limits the search
// to one digit.
function search(board, size, visit, only = 0) {
  for (let digit = only || 1; digit <= (only || 9); digit++) {
    const b = bit(digit);
    for (const o of ORIENTATIONS) {
      const masks = new Uint16Array(9);
      let usable = 0;
      for (let line = 0; line < 9; line++) {
        let placed = false;
        for (let pos = 0; pos < 9; pos++) {
          const cell = o.cell(line, pos);
          if (board.values[cell] === digit) placed = true;
          if (board.cands[cell] & b) masks[line] |= 1 << pos;
        }
        if (masks[line] && !placed) usable |= 1 << line;
      }
      if (POPCOUNT[usable] < size) continue;
      for (const base of LINE_SETS[size]) {
        if (base.mask & ~usable) continue;
        let union = 0;
        for (const line of base.lines) union |= masks[line];
        const step = visit({ digit, o, masks, base, union });
        if (step) return step;
      }
    }
  }
  return null;
}

// Basic fish: every candidate in the base lines is in the cover lines.
function findBasicFish(board, size, id, only = 0) {
  return search(board, size, ({ digit, o, masks, base, union }) => {
    if (POPCOUNT[union] !== size) return null;
    const eliminations = [];
    for (let line = 0; line < 9; line++) {
      if (base.mask & (1 << line)) continue;
      for (const pos of POSITIONS[masks[line] & union]) eliminations.push([o.cell(line, pos), digit]);
    }
    if (!eliminations.length) return null;
    return fishStep({ id, digit, o, masks, base, cover: union, fins: [], block: -1, thin: [], eliminations });
  }, only);
}

// The first X-Wing, or else Swordfish, for `digit` that removes a candidate. The board
// highlights its cells when the digit is selected.
export function findBasicFishFor(board, digit) {
  return findBasicFish(board, 2, 'x-wing', digit) ?? findBasicFish(board, 3, 'swordfish', digit);
}

// Finned and sashimi fish. The cover lines are chosen from the lines that hold candidates
// of the base lines, so every cover line has at least one candidate that is not a fin. The
// fins are the candidates outside the cover lines and must all be in one block. Every base
// line needs a candidate in the cover lines. A pattern is sashimi when at least one base
// line has only one candidate in the cover lines; `sashimi` selects which kind to report.
function findFinnedFish(board, size, id, sashimi) {
  return search(board, size, ({ digit, o, masks, base, union }) => {
    const extra = POPCOUNT[union] - size;
    // The fins' positions are in one block, so there are 1 to 3 of them.
    if (extra < 1 || extra > 3) return null;
    for (const cover of LINE_SETS[size]) {
      if (cover.mask & ~union) continue;
      const outside = union & ~cover.mask;
      if (!THIRDS.some((third) => (outside & ~third) === 0)) continue;
      const fins = [];
      const thin = [];
      let block = -1;
      let valid = true;
      for (const line of base.lines) {
        const inside = masks[line] & cover.mask;
        if (!inside) {
          valid = false;
          break;
        }
        if (POPCOUNT[inside] === 1) thin.push(line);
        for (const pos of POSITIONS[masks[line] & ~cover.mask]) {
          const cell = o.cell(line, pos);
          if (block < 0) block = BOX[cell];
          if (BOX[cell] !== block) valid = false;
          fins.push(cell);
        }
        if (!valid) break;
      }
      if (!valid || (thin.length > 0) !== sashimi) continue;
      const eliminations = [];
      for (const cell of HOUSES[18 + block]) {
        if (base.mask & (1 << o.lineOf(cell))) continue;
        if (!(cover.mask & (1 << o.posOf(cell)))) continue;
        if (board.cands[cell] & bit(digit)) eliminations.push([cell, digit]);
      }
      if (eliminations.length) {
        return fishStep({ id, digit, o, masks, base, cover: cover.mask, fins, block, thin, eliminations });
      }
    }
    return null;
  });
}

function fishStep({ id, digit, o, masks, base, cover, fins, block, thin, eliminations }) {
  eliminations.sort((a, b) => a[0] - b[0]);
  fins.sort((a, b) => a - b);
  const targets = eliminations.map(([cell]) => cell);
  const baseHouses = base.lines.map(o.baseHouse);
  const coverHouses = POSITIONS[cover].map(o.coverHouse);
  const baseText = joinList(baseHouses.map(houseName));
  const coverText = joinList(coverHouses.map(houseName));
  const n = WORDS[base.lines.length];

  const marks = [];
  for (const line of base.lines) {
    for (const pos of POSITIONS[masks[line]]) {
      const cell = o.cell(line, pos);
      marks.push([cell, digit, fins.includes(cell) ? 'fin' : 'key']);
    }
  }
  marks.sort((a, b) => a[0] - b[0]);

  let pattern;
  let result;
  if (!fins.length) {
    const apart = base.lines.length === 2 ? 'they cannot share' : 'no two of them can share';
    pattern = `In ${baseText}, the candidates for ${digit} are all in the same ${n} ${o.cover}s.`;
    result =
      `The ${digit}s of ${baseText} can only go in ${coverText}, and ${apart} a ${o.cover}. ` +
      `So ${coverText} each have their ${digit} in one of those ${o.base}s, and ${digit} can be removed from ${cellList(targets)}.`;
  } else {
    const blockName = houseName(18 + block);
    const finNames = cellList(fins);
    const inBlock = fins.length === 1 ? 'which is in' : fins.length === 2 ? 'which are both in' : 'which are all in';
    pattern = `In ${baseText}, the candidates for ${digit} are all in the same ${n} ${o.cover}s, except ${finNames}, ${inBlock} ${blockName}.`;
    if (thin.length) {
      const thinText = capitalize(joinList(thin.map((line) => houseName(o.baseHouse(line)))));
      pattern += ` ${thinText} ${thin.length === 1 ? 'has' : 'each have'} only one candidate for ${digit} in those ${o.cover}s.`;
    }
    let noFin;
    let aFin;
    if (fins.length === 1) {
      noFin = `${finNames} is not`;
      aFin = `${finNames} is`;
    } else if (fins.length === 2) {
      noFin = `neither ${cellName(fins[0])} nor ${cellName(fins[1])} is`;
      aFin = `${cellName(fins[0])} or ${cellName(fins[1])} is`;
    } else {
      noFin = `none of ${finNames} is`;
      aFin = `one of ${finNames} is`;
    }
    result =
      `If ${noFin} ${digit}, the ${digit}s of ${baseText} can only go in ${coverText}, one in each ${o.cover}, ` +
      `so no other cell in those ${o.cover}s can be ${digit}. ` +
      `If ${aFin} ${digit}, no other cell in ${blockName} can be ${digit}, so either way ${digit} can be removed from ${cellList(targets)}.`;
  }

  return {
    technique: id,
    placements: [],
    eliminations,
    stages: [
      { text: `Consider the digit ${digit}.` },
      { text: pattern, digit, houses: baseHouses, marks },
      {
        text: result,
        digit,
        houses: coverHouses,
        cells: targets.map((cell) => [cell, 'target']),
        marks: [...marks, ...targets.map((cell) => [cell, digit, 'elim'])],
      },
    ],
  };
}

// Lessons. `size` is the number of base lines; `name` is X-Wing, Swordfish or Jellyfish.

function basicLesson(size) {
  const n = WORDS[size];
  return [
    `Pick a digit and look for ${n} rows in which every candidate for that digit is in the same ${n} columns.` +
      (size > 2 ? ` A row does not need a candidate in all ${n} columns.` : ''),
    `Each of the ${n} rows must contain the digit once, in one of the ${n} columns, and ${size === 2 ? 'the two rows cannot' : 'no two of the rows can'} have it in the same column. ` +
      `So each of the ${n} columns has its copy of the digit in one of the ${n} rows.`,
    `Remove the digit from the cells of the ${n} columns that are not in the ${n} rows.`,
    `The pattern can also be found with rows and columns swapped: ${n} columns in which every candidate for the digit is in the same ${n} rows. ` +
      `Then remove the digit from the cells of those rows that are not in the ${n} columns.`,
  ];
}

function finsLesson(size) {
  const n = WORDS[size];
  return [
    `In both cases, the digit cannot be in a cell that is in one of the ${n} columns and in the fins' block but not in one of the ${n} rows. ` +
      'Remove the digit from those cells.',
  ];
}

function swappedFinsLesson(size) {
  const n = WORDS[size];
  return `The pattern can also be found with rows and columns swapped: ${n} columns whose candidates for the digit are in the same ${n} rows, except for fins in one block. ` +
    `Then remove the digit from the cells that are in one of the ${n} rows and in the fins' block but not in one of the ${n} columns.`;
}

function finnedLesson(size, name) {
  const n = WORDS[size];
  const article = size === 2 ? 'an' : 'a';
  const need = size === 2 ? 'a candidate in both columns' : `at least two candidates in the ${n} columns`;
  return [
    `Pick a digit and look for ${n} rows whose candidates for that digit are all in the same ${n} columns, except for one or more extra candidates called fins. ` +
      `All the fins must be in one block, and each row must have ${need}.`,
    `Either one of the fins is the digit, or none of them is. If none of them is, the candidates in the ${n} rows form ${article} ${name}, ` +
      `and the digit cannot be in the cells of the ${n} columns outside the ${n} rows. If a fin is the digit, the digit cannot be in any other cell of the fins' block.`,
    ...finsLesson(size),
    `If one of the rows has only one candidate in the ${n} columns, the pattern is a Sashimi ${name} instead.`,
    swappedFinsLesson(size),
  ];
}

function sashimiLesson(size, name) {
  const n = WORDS[size];
  return [
    `Pick a digit and look for ${n} rows whose candidates for that digit are all in the same ${n} columns, except for one or more extra candidates called fins, which must all be in one block. ` +
      `In a Sashimi ${name}, at least one of the rows has only one candidate in the ${n} columns, so without the fins that row would have only one cell left for the digit.`,
    `The reasoning is the same as for a Finned ${name}. If none of the fins is the digit, each of the ${n} rows has the digit in one of the ${n} columns, ${size === 2 ? 'not both' : 'no two of them'} in the same column, ` +
      `so each of the ${n} columns has its copy of the digit in one of the ${n} rows, and the digit cannot be in the other cells of those columns. ` +
      `If a fin is the digit, the digit cannot be in any other cell of the fins' block.`,
    ...finsLesson(size),
    swappedFinsLesson(size),
  ];
}

const SIZES = [
  { size: 2, key: 'x-wing', name: 'X-Wing' },
  { size: 3, key: 'swordfish', name: 'Swordfish' },
  { size: 4, key: 'jellyfish', name: 'Jellyfish' },
];

const basic = SIZES.map(({ size, key, name }) => ({
  id: key,
  name,
  lesson: basicLesson(size),
  find: (board) => findBasicFish(board, size, key),
}));

const finned = SIZES.map(({ size, key, name }) => ({
  id: `finned-${key}`,
  name: `Finned ${name}`,
  lesson: finnedLesson(size, name),
  find: (board) => findFinnedFish(board, size, `finned-${key}`, false),
}));

const sashimi = SIZES.map(({ size, key, name }) => ({
  id: `sashimi-${key}`,
  name: `Sashimi ${name}`,
  lesson: sashimiLesson(size, name),
  find: (board) => findFinnedFish(board, size, `sashimi-${key}`, true),
}));

export default [...basic, ...finned, ...sashimi];
