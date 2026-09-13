import { CELL_HOUSES, DIGITS, HOUSES, PEERS, POPCOUNT, sees, sharedHouses } from '../grid.js';
import { cellList, cellName, houseName, joinList, plural, removalText } from '../text.js';
import { elimMarks, keyMarks, resultCells } from './common.js';

// Sue de Coq, ALS-XZ.

// Every non-empty subset of `cells` with the union of its candidates, smallest subsets first.
function subsetsOf(board, cells) {
  const n = cells.length;
  const masks = new Uint16Array(1 << n);
  const subsets = [];
  for (let s = 1; s < 1 << n; s++) {
    const low = s & -s;
    masks[s] = masks[s ^ low] | board.cands[cells[31 - Math.clz32(low)]];
    subsets.push({ cells: cells.filter((_, i) => s & (1 << i)), mask: masks[s] });
  }
  return subsets.sort((a, b) => a.cells.length - b.cells.length);
}

// Sue de Coq. Core: 2 or 3 empty cells where a row or column meets a block, with candidates V
// numbering at least 2 more than the cells. Line cells: other empty cells of the row or column.
// Block cells: other empty cells of the block. The line cells and the block cells share no
// candidate, and the core, line and block cells together have as many candidates as cells.
// Every candidate of the line cells lies in the line and every candidate of the block cells
// lies in the block, so no digit can go twice, and each digit goes in exactly one of the cells.
const sueDeCoq = {
  id: 'sue-de-coq',
  name: 'Sue de Coq',
  lesson: [
    'Look where a row or column crosses a block. Pick two or three empty cells there whose candidates number at least two more than the cells, for example two cells with the candidates 3, 4, 5 and 9 between them.',
    'Then look for other cells in the row or column that have some of those digits, and other cells in the block that have some of the rest. The simplest case is one cell in the row with only 4 and 5, and one cell in the block with only 3 and 9. The row cells and the block cells must not share a candidate.',
    'If all these cells together have as many candidates as there are cells, each digit goes in exactly one of them. The row digits can go only once, because all their cells are in the row, and the block digits only once, because all their cells are in the block.',
    'So each row digit can be removed from the rest of the row, and each block digit from the rest of the block. A digit that only the crossing cells have can be removed from the rest of both.',
  ],
  find(board) {
    for (let box = 18; box < 27; box++) {
      const lines = [...new Set(HOUSES[box].flatMap((cell) => CELL_HOUSES[cell].slice(0, 2)))].sort((a, b) => a - b);
      for (const line of lines) {
        const crossing = HOUSES[box].filter((cell) => CELL_HOUSES[cell].includes(line) && !board.values[cell]);
        if (crossing.length < 2) continue;
        const cores = subsetsOf(board, crossing).filter((s) => s.cells.length >= 2);
        for (const core of cores) {
          const extra = POPCOUNT[core.mask] - core.cells.length;
          if (extra < 2) continue;
          const side = (house) =>
            subsetsOf(
              board,
              HOUSES[house].filter((cell) => !core.cells.includes(cell) && board.cands[cell] & core.mask),
            )
              .map((s) => ({ ...s, excess: s.cells.length - POPCOUNT[s.mask & ~core.mask] }))
              .filter((s) => s.excess >= 1 && s.excess < extra && POPCOUNT[s.mask] > s.cells.length);
          const lineSets = side(line);
          if (!lineSets.length) continue;
          const boxSets = side(box);
          for (const lineSet of lineSets) {
            for (const boxSet of boxSets) {
              if (lineSet.mask & boxSet.mask || lineSet.excess + boxSet.excess !== extra) continue;
              if (lineSet.cells.some((cell) => boxSet.cells.includes(cell))) continue;
              const step = sueDeCoqStep(board, box, line, core, lineSet, boxSet);
              if (step) return step;
            }
          }
        }
      }
    }
    return null;
  },
};

function sueDeCoqStep(board, box, line, core, lineSet, boxSet) {
  const cells = [...core.cells, ...lineSet.cells, ...boxSet.cells];
  const all = core.mask | lineSet.mask | boxSet.mask;
  if (POPCOUNT[all] !== cells.length) return null;
  const eliminations = [];
  for (let cell = 0; cell < 81; cell++) {
    if (!(board.cands[cell] & all) || cells.includes(cell)) continue;
    for (const digit of DIGITS[board.cands[cell] & all]) {
      if (cells.every((other) => !board.has(other, digit) || sees(cell, other))) eliminations.push([cell, digit]);
    }
  }
  if (!eliminations.length) return null;
  const n = cells.length;
  const onlyCore = DIGITS[core.mask & ~lineSet.mask & ~boxSet.mask];
  const have = (group) => plural(group.length, 'has', 'have');
  const between = (group) => (group.length > 1 ? ' between them' : '');
  const lineName = houseName(line);
  const boxName = houseName(box);
  const houses = [line, box];
  const marks = keyMarks(board, cells, DIGITS[all]);
  return {
    technique: 'sue-de-coq',
    placements: [],
    eliminations,
    stages: [
      {
        text: `Look at ${cellList(core.cells)}, where ${lineName} meets ${boxName}.`,
        houses,
        cells: core.cells.map((cell) => [cell, 'key']),
      },
      {
        text: `${cellList(core.cells)} have the candidates ${joinList(DIGITS[core.mask])} between them, ${POPCOUNT[core.mask] - core.cells.length} more than the number of cells. In ${lineName}, ${cellList(lineSet.cells)} ${have(lineSet.cells)} only ${joinList(DIGITS[lineSet.mask])}${between(lineSet.cells)}. In ${boxName}, ${cellList(boxSet.cells)} ${have(boxSet.cells)} only ${joinList(DIGITS[boxSet.mask])}${between(boxSet.cells)}.`,
        houses,
        cells: cells.map((cell) => [cell, 'key']),
        marks,
      },
      {
        text: `Together these ${n} cells have only ${n} candidates. The ${joinList(DIGITS[lineSet.mask])} candidates among them are all in ${lineName}${onlyCore.length ? ',' : ' and'} the ${joinList(DIGITS[boxSet.mask])} candidates are all in ${boxName}${onlyCore.length ? `, and the ${joinList(onlyCore)} candidates are all in both houses` : ''}, so no digit can go in two of these cells, and each of the ${n} digits goes in exactly one of them.`,
        houses,
        cells: cells.map((cell) => [cell, 'key']),
        marks,
      },
      {
        text: `So a cell outside these ${n} cells cannot hold one of the digits if it sees every one of the ${n} cells that has that digit as a candidate. ${removalText(eliminations)}`,
        houses,
        cells: resultCells(cells, eliminations),
        marks: [...marks, ...elimMarks(eliminations)],
      },
    ],
  };
}

// Sets of cells as three 27-bit words.
const PEER_BITS = PEERS.map((peers) => {
  const bits = new Int32Array(3);
  for (const peer of peers) bits[(peer / 27) | 0] |= 1 << peer % 27;
  return bits;
});

const bitsToCells = (w0, w1, w2) => {
  const cells = [];
  for (let cell = 0; cell < 81; cell++) if ([w0, w1, w2][(cell / 27) | 0] & (1 << cell % 27)) cells.push(cell);
  return cells;
};

// Almost locked sets: N empty cells in one house with N + 1 candidates between them. Each has
// `bits` (its cells), `houses` (a bit for each house that holds all its cells), and for each
// digit d, at offset 3 * (d - 1): `holders` (its cells with d) and `seen` (cells that see all
// of those holders).
function almostLockedSets(board) {
  const keys = new Set();
  const sets = [];
  for (let house = 0; house < 27; house++) {
    const empty = HOUSES[house].filter((cell) => !board.values[cell]);
    for (const subset of subsetsOf(board, empty)) {
      if (POPCOUNT[subset.mask] !== subset.cells.length + 1) continue;
      const key = subset.cells.join(',');
      if (keys.has(key)) continue;
      keys.add(key);
      const bits = new Int32Array(3);
      for (const cell of subset.cells) bits[(cell / 27) | 0] |= 1 << cell % 27;
      let houses = 0;
      for (const h of sharedHouses(subset.cells)) houses |= 1 << h;
      const holders = new Int32Array(27);
      const seen = new Int32Array(27);
      for (const digit of DIGITS[subset.mask]) {
        const o = 3 * (digit - 1);
        seen[o] = seen[o + 1] = seen[o + 2] = -1;
        for (const cell of subset.cells) {
          if (!board.has(cell, digit)) continue;
          holders[o + ((cell / 27) | 0)] |= 1 << cell % 27;
          for (let w = 0; w < 3; w++) seen[o + w] &= PEER_BITS[cell][w];
        }
      }
      sets.push({ cells: subset.cells, mask: subset.mask, house, bits, houses, holders, seen });
    }
  }
  return sets.sort((a, b) => a.cells.length - b.cells.length);
}

// ALS-XZ: two almost locked sets A and B with no common cell, a digit x whose candidates in A
// all see its candidates in B, and another common digit z. A and B cannot both hold x, and
// the set without x holds all its other digits, including z. So one of them holds z.
const alsXz = {
  id: 'als-xz',
  name: 'ALS-XZ',
  lesson: [
    'An almost locked set is a group of cells in one row, column or block that has one more candidate than it has cells, for example three cells with only the candidates 1, 4, 6 and 8 between them. A single cell with two candidates is one too. The cells hold different digits, so at most one of the candidates is left out.',
    'Look for two such groups with no cell in common that both have two digits as candidates, for example 9 and 4, where every 9 in one group sees every 9 in the other. The two groups cannot both hold 9, so one of them leaves out 9 and must hold all of its other candidates, including 4.',
    'So one of the two groups holds a 4. A cell outside both groups that sees every 4 in both groups cannot be 4, so 4 can be removed from it.',
  ],
  find(board) {
    const sets = almostLockedSets(board);
    const withDigit = new Int32Array(27);
    for (let cell = 0; cell < 81; cell++) {
      for (const digit of DIGITS[board.cands[cell]]) withDigit[3 * (digit - 1) + ((cell / 27) | 0)] |= 1 << cell % 27;
    }
    for (let i = 0; i < sets.length; i++) {
      const a = sets[i];
      for (let j = i + 1; j < sets.length; j++) {
        const b = sets[j];
        const common = a.mask & b.mask;
        if (POPCOUNT[common] < 2 || a.houses & b.houses) continue;
        if ((a.bits[0] & b.bits[0]) | (a.bits[1] & b.bits[1]) | (a.bits[2] & b.bits[2])) continue;
        for (const x of DIGITS[common]) {
          const o = 3 * (x - 1);
          if ((b.holders[o] & ~a.seen[o]) | (b.holders[o + 1] & ~a.seen[o + 1]) | (b.holders[o + 2] & ~a.seen[o + 2])) continue;
          for (const z of DIGITS[common]) {
            if (z === x) continue;
            const p = 3 * (z - 1);
            const t = [0, 1, 2].map((w) => a.seen[p + w] & b.seen[p + w] & withDigit[p + w] & ~a.bits[w] & ~b.bits[w]);
            if (!(t[0] | t[1] | t[2])) continue;
            return alsXzStep(board, a, b, x, z, bitsToCells(...t));
          }
        }
      }
    }
    return null;
  },
};

function describeSet(board, set) {
  const digits = joinList(DIGITS[set.mask]);
  if (set.cells.length === 1) return `${cellName(set.cells[0])} has only the candidates ${digits}`;
  return `${cellList(set.cells)} in ${houseName(set.house)} have only the candidates ${digits} between them`;
}

function alsXzStep(board, a, b, x, z, targets) {
  const eliminations = targets.map((cell) => [cell, z]);
  const cells = [...a.cells, ...b.cells];
  const xA = a.cells.filter((cell) => board.has(cell, x));
  const xB = b.cells.filter((cell) => board.has(cell, x));
  const links = xA.flatMap((p) => xB.map((q) => [p, x, q, x, false]));
  const marks = keyMarks(board, cells, [x, z]);
  return {
    technique: 'als-xz',
    placements: [],
    eliminations,
    stages: [
      { text: `Consider the digits ${x} and ${z}.` },
      {
        text: `Look at two groups of cells. In the first, ${describeSet(board, a)}. In the second, ${describeSet(board, b)}. Each group is in one house and has one more candidate than cells, so at most one of its candidates is left out.`,
        cells: cells.map((cell) => [cell, 'key']),
        marks: keyMarks(board, cells, DIGITS[a.mask | b.mask]),
      },
      {
        text: `Every ${x} in the first group sees every ${x} in the second, so the groups cannot both hold ${x}. The group that leaves out ${x} has to hold all its other candidates, including ${z}.`,
        cells: cells.map((cell) => [cell, 'key']),
        marks,
        links,
      },
      {
        text: `So one of the groups holds ${z}, and a cell that sees every ${z} in both groups cannot be ${z}. ${removalText(eliminations)}`,
        cells: resultCells(cells, eliminations),
        marks: [...marks, ...elimMarks(eliminations)],
        links,
      },
    ],
  };
}

export default [sueDeCoq, alsXz];
