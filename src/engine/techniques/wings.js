import { DIGITS, PEERS, POPCOUNT, bit, commonPeers, sees, sharedHouses } from '../grid.js';
import { cellList, cellName, houseName, joinList, plural, removalText } from '../text.js';
import { elimMarks, keyMarks, resultCells, targetsFor } from './common.js';

// Remote Pair, W-Wing, XY-Wing, XYZ-Wing, WXYZ-Wing.

// [cell, digit] for each of `digits` that each target has as a candidate, sorted by cell.
function eliminationsFor(board, targets, digits) {
  const eliminations = [];
  for (const cell of [...targets].sort((a, b) => a - b)) {
    for (const digit of digits) if (board.has(cell, digit)) eliminations.push([cell, digit]);
  }
  return eliminations;
}

// Remote Pair: a chain of at least 4 cells that all have only the candidates a and b, where
// each cell sees the next. Cells an odd number of steps apart hold different digits, so a
// cell that sees both ends of a chain with an odd number of steps can't be a or b.
function findRemotePair(board, a, b) {
  const mask = bit(a) | bit(b);
  const cells = [];
  for (let cell = 0; cell < 81; cell++) if (board.cands[cell] === mask) cells.push(cell);
  if (cells.length < 4) return null;
  for (const start of cells) {
    const dist = new Map([[start, 0]]);
    const parent = new Map();
    const queue = [start];
    let twoColorable = true;
    for (let q = 0; q < queue.length; q++) {
      const current = queue[q];
      for (const next of cells) {
        if (!sees(current, next)) continue;
        if (!dist.has(next)) {
          dist.set(next, dist.get(current) + 1);
          parent.set(next, current);
          queue.push(next);
        } else if (dist.get(next) === dist.get(current)) {
          twoColorable = false;
        }
      }
    }
    // An odd loop of such cells can't happen in a position that has a solution.
    if (!twoColorable) continue;
    for (const end of queue) {
      const steps = dist.get(end);
      if (end < start || steps < 3 || steps % 2 === 0) continue;
      const targets = commonPeers([start, end]).filter((cell) => board.cands[cell] & mask);
      if (!targets.length) continue;
      const chain = [end];
      while (chain[0] !== start) chain.unshift(parent.get(chain[0]));
      return { chain, targets };
    }
  }
  return null;
}

const remotePair = {
  id: 'remote-pair',
  name: 'Remote Pair',
  lesson: [
    'Look for cells that all have only the same two candidates, for example 2 and 7, and that form a chain in which each cell sees the next one. The chain needs at least four cells.',
    'Two cells that see each other cannot hold the same digit. So if one cell of the chain is 2, the next is 7, the one after that is 2, and so on. Two cells that are an odd number of steps apart along the chain always hold different digits: one is 2 and the other is 7.',
    'A cell outside the chain that sees two cells an odd number of steps apart cannot be 2 or 7, so both candidates can be removed from it.',
  ],
  find(board) {
    for (let a = 1; a <= 8; a++) {
      for (let b = a + 1; b <= 9; b++) {
        const found = findRemotePair(board, a, b);
        if (!found) continue;
        const { chain, targets } = found;
        const start = chain[0];
        const end = chain[chain.length - 1];
        const eliminations = eliminationsFor(board, targets, [a, b]);
        const links = chain.slice(1).map((cell, i) => [chain[i], a, cell, a, false]);
        return {
          technique: 'remote-pair',
          placements: [],
          eliminations,
          stages: [
            { text: `Look at the cells whose only candidates are ${a} and ${b}.` },
            {
              text: `${cellList(chain)} each have only the candidates ${a} and ${b}, and each of them sees the next one in this list. Two cells that see each other cannot hold the same digit, so the digits alternate along the chain.`,
              cells: chain.map((cell) => [cell, 'key']),
              marks: keyMarks(board, chain, [a, b]),
              links,
            },
            {
              text: `${cellName(start)} and ${cellName(end)} are ${chain.length - 1} steps apart, an odd number, so one of them is ${a} and the other is ${b}. ${cellList(targets)} ${plural(targets.length, 'sees', 'see')} both of them, so ${plural(targets.length, 'it cannot', 'none of these cells can')} be ${a} or ${b}. ${removalText(eliminations)}`,
              cells: resultCells(chain, eliminations),
              marks: [...keyMarks(board, chain, [a, b]), ...elimMarks(eliminations)],
              links,
            },
          ],
        };
      }
    }
    return null;
  },
};

// W-Wing: cells A and D with only the candidates w and x that don't see each other, and a
// strong link on x between B and C, where A sees B and C sees D. One of A and D is w.
const wWing = {
  id: 'w-wing',
  name: 'W-Wing',
  lesson: [
    'Look for two cells that have only the same two candidates, for example 1 and 5, and that do not see each other. Call them A and D.',
    'Then look for a row, column or block where only two cells can hold one of those digits, for example 5, so that one of those two cells is 5. Call them B and C, and check that A sees B and that D sees C.',
    'If B is 5, A cannot be 5, so A is 1. If C is 5, D cannot be 5, so D is 1. One of B and C is 5, so one of A and D is 1.',
    'A cell that sees both A and D cannot be 1, so 1 can be removed from it.',
  ],
  find(board) {
    const bivalue = [];
    for (let cell = 0; cell < 81; cell++) if (POPCOUNT[board.cands[cell]] === 2) bivalue.push(cell);
    for (let i = 0; i < bivalue.length; i++) {
      for (let j = i + 1; j < bivalue.length; j++) {
        const a = bivalue[i];
        const d = bivalue[j];
        if (board.cands[a] !== board.cands[d] || sees(a, d)) continue;
        const [lo, hi] = board.candidates(a);
        for (const [x, w] of [[lo, hi], [hi, lo]]) {
          const targets = targetsFor(board, [a, d], w);
          if (!targets.length) continue;
          for (let house = 0; house < 27; house++) {
            const link = board.where(house, x);
            if (link.length !== 2 || link.includes(a) || link.includes(d)) continue;
            let [b, c] = link;
            if (!(sees(a, b) && sees(c, d))) {
              if (!(sees(a, c) && sees(b, d))) continue;
              [b, c] = [c, b];
            }
            const eliminations = eliminationsFor(board, targets, [w]);
            const keyCells = [a, b, c, d];
            const marks = [...keyMarks(board, [a, d], [lo, hi]), [b, x, 'key'], [c, x, 'key']];
            const links = [
              [a, x, b, x, false],
              [b, x, c, x, true],
              [c, x, d, x, false],
            ];
            const [A, B, C, D] = keyCells.map(cellName);
            return {
              technique: 'w-wing',
              placements: [],
              eliminations,
              stages: [
                { text: `Look at ${A} and ${D}. Both have only the candidates ${lo} and ${hi}.`, cells: [[a, 'key'], [d, 'key']] },
                {
                  text: `Only ${cellList([b, c].sort((p, q) => p - q))} can be ${x} in ${houseName(house)}, so one of them is ${x}. ${A} sees ${B} and ${D} sees ${C}. If ${B} is ${x}, ${A} is ${w}. If ${C} is ${x}, ${D} is ${w}.`,
                  houses: [house],
                  cells: keyCells.map((cell) => [cell, 'key']),
                  marks,
                  links,
                },
                {
                  text: `So one of ${A} and ${D} is ${w}, and a cell that sees both of them cannot be ${w}. ${removalText(eliminations)}`,
                  houses: [house],
                  cells: resultCells(keyCells, eliminations),
                  marks: [...marks, ...elimMarks(eliminations)],
                  links,
                },
              ],
            };
          }
        }
      }
    }
    return null;
  },
};

// XY-Wing: a pivot with only x and y that sees a pincer with only x and z and a pincer with
// only y and z. One of the pincers is z.
const xyWing = {
  id: 'xy-wing',
  name: 'XY-Wing',
  lesson: [
    'Look for a cell with only two candidates, for example 3 and 7. Then look for two cells it sees that also have two candidates each: one with 3 and a third digit, for example 5, and one with 7 and 5.',
    'If the first cell is 3, the cell with 3 and 5 cannot be 3, so it is 5. If the first cell is 7, the cell with 7 and 5 is 5. Either way, one of those two cells is 5.',
    'A cell that sees both of them cannot be 5, so 5 can be removed from it.',
  ],
  find(board) {
    for (let pivot = 0; pivot < 81; pivot++) {
      if (POPCOUNT[board.cands[pivot]] !== 2) continue;
      const [x, y] = board.candidates(pivot);
      for (const first of PEERS[pivot]) {
        const mask = board.cands[first];
        if (POPCOUNT[mask] !== 2 || !(mask & bit(x)) || mask & bit(y)) continue;
        const z = DIGITS[mask & ~bit(x)][0];
        for (const second of PEERS[pivot]) {
          if (board.cands[second] !== (bit(y) | bit(z))) continue;
          const targets = targetsFor(board, [first, second], z);
          if (!targets.length) continue;
          const eliminations = eliminationsFor(board, targets, [z]);
          const keyCells = [pivot, first, second];
          const marks = [...keyMarks(board, [pivot], [x, y]), ...keyMarks(board, [first], [x, z]), ...keyMarks(board, [second], [y, z])];
          const links = [
            [pivot, x, first, x, false],
            [pivot, y, second, y, false],
          ];
          const [P, Q, R] = keyCells.map(cellName);
          return {
            technique: 'xy-wing',
            placements: [],
            eliminations,
            stages: [
              { text: `Look at ${P}, which has only the candidates ${x} and ${y}.`, cells: [[pivot, 'key']] },
              {
                text: `${P} sees ${Q}, which has only ${joinList(board.candidates(first))}, and ${R}, which has only ${joinList(board.candidates(second))}. If ${P} is ${x}, ${Q} is ${z}. If ${P} is ${y}, ${R} is ${z}.`,
                cells: keyCells.map((cell) => [cell, 'key']),
                marks,
                links,
              },
              {
                text: `So one of ${Q} and ${R} is ${z}, and a cell that sees both of them cannot be ${z}. ${removalText(eliminations)}`,
                cells: resultCells(keyCells, eliminations),
                marks: [...marks, ...elimMarks(eliminations)],
                links,
              },
            ],
          };
        }
      }
    }
    return null;
  },
};

// XYZ-Wing: a pivot with only x, y and z that sees a pincer with only x and z and a pincer
// with only y and z. One of the three cells is z.
const xyzWing = {
  id: 'xyz-wing',
  name: 'XYZ-Wing',
  lesson: [
    'Look for a cell with exactly three candidates, for example 2, 4 and 8. Then look for two cells it sees with two candidates each: one with only 2 and 8, and one with only 4 and 8.',
    'If the first cell is 2, the cell with 2 and 8 is 8. If the first cell is 4, the cell with 4 and 8 is 8. If the first cell is 8, it holds the 8 itself. So one of the three cells is 8.',
    'A cell that sees all three cells cannot be 8, so 8 can be removed from it.',
  ],
  find(board) {
    for (let pivot = 0; pivot < 81; pivot++) {
      const all = board.cands[pivot];
      if (POPCOUNT[all] !== 3) continue;
      const pincers = PEERS[pivot].filter((cell) => POPCOUNT[board.cands[cell]] === 2 && !(board.cands[cell] & ~all));
      for (let i = 0; i < pincers.length; i++) {
        for (let j = i + 1; j < pincers.length; j++) {
          const first = pincers[i];
          const second = pincers[j];
          if (board.cands[first] === board.cands[second]) continue;
          const z = DIGITS[board.cands[first] & board.cands[second]][0];
          const targets = targetsFor(board, [pivot, first, second], z);
          if (!targets.length) continue;
          const x = DIGITS[board.cands[first] & ~bit(z)][0];
          const y = DIGITS[board.cands[second] & ~bit(z)][0];
          const eliminations = eliminationsFor(board, targets, [z]);
          const keyCells = [pivot, first, second];
          const marks = keyMarks(board, keyCells, DIGITS[all]);
          const links = [
            [pivot, x, first, x, false],
            [pivot, y, second, y, false],
          ];
          const [P, Q, R] = keyCells.map(cellName);
          return {
            technique: 'xyz-wing',
            placements: [],
            eliminations,
            stages: [
              { text: `Look at ${P}, which has only the candidates ${joinList(DIGITS[all])}.`, cells: [[pivot, 'key']] },
              {
                text: `${P} sees ${Q}, which has only ${joinList(board.candidates(first))}, and ${R}, which has only ${joinList(board.candidates(second))}. If ${P} is ${x}, ${Q} is ${z}. If ${P} is ${y}, ${R} is ${z}. Otherwise ${P} is ${z}.`,
                cells: keyCells.map((cell) => [cell, 'key']),
                marks,
                links,
              },
              {
                text: `So one of the three cells is ${z}, and a cell that sees all three cannot be ${z}. ${removalText(eliminations)}`,
                cells: resultCells(keyCells, eliminations),
                marks: [...marks, ...elimMarks(eliminations)],
                links,
              },
            ],
          };
        }
      }
    }
    return null;
  },
};

const FOUR_DIGIT_MASKS = [];
for (let mask = 0; mask < 512; mask++) if (POPCOUNT[mask] === 4) FOUR_DIGIT_MASKS.push(mask);

// WXYZ-Wing: 4 cells, not all in one house, with 4 candidates between them, where exactly one
// digit z is not restricted (a digit is restricted when the cells that have it are all in one
// house, which is the same as each of them seeing all the others). One of the cells is z.
const wxyzWing = {
  id: 'wxyz-wing',
  name: 'WXYZ-Wing',
  lesson: [
    'Look for four cells, not all in one row, column or block, whose candidates together are only four digits, for example 1, 2, 5 and 9.',
    'For each of the four digits, look at the cells among the four that have it as a candidate. If those cells are all in one row, column or block, the digit can go in at most one of the four cells. Check that this is true for three of the digits, for example 1, 2 and 5, and not for the fourth, 9.',
    'Suppose a cell that sees every 9 in the four cells were 9. Then none of the four cells could be 9, and the four cells would have only 1, 2 and 5 left. One of those digits would have to go in two of the four cells, and that is impossible, because the cells that have it are all in one row, column or block.',
    'So 9 can be removed from every cell that sees all the 9s in the four cells.',
  ],
  find(board) {
    const small = [];
    for (let cell = 0; cell < 81; cell++) {
      const count = POPCOUNT[board.cands[cell]];
      if (count >= 2 && count <= 4) small.push(cell);
    }
    for (const all of FOUR_DIGIT_MASKS) {
      const fit = small.filter((cell) => !(board.cands[cell] & ~all));
      const n = fit.length;
      if (n < 4) continue;
      for (let i = 0; i < n - 3; i++) {
        for (let j = i + 1; j < n - 2; j++) {
          for (let k = j + 1; k < n - 1; k++) {
            const three = board.cands[fit[i]] | board.cands[fit[j]] | board.cands[fit[k]];
            for (let l = k + 1; l < n; l++) {
              if ((three | board.cands[fit[l]]) !== all) continue;
              const step = wxyzStep(board, [fit[i], fit[j], fit[k], fit[l]], all);
              if (step) return step;
            }
          }
        }
      }
    }
    return null;
  },
};

function wxyzStep(board, cells, all) {
  if (sharedHouses(cells).length) return null;
  // Skip groups in which two cells have only two candidates or three cells have only three.
  // Such a group contains a naked pair or triple, an XY-Wing or an XYZ-Wing, and those
  // techniques, which come earlier in the solving order, remove the same candidates.
  const masks = cells.map((cell) => board.cands[cell]);
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (POPCOUNT[masks[i] | masks[j]] <= 2) return null;
      for (let k = j + 1; k < 4; k++) if (POPCOUNT[masks[i] | masks[j] | masks[k]] <= 3) return null;
    }
  }
  let z = 0;
  let open = 0;
  const restricted = [];
  const where = [];
  for (const digit of DIGITS[all]) {
    const withDigit = cells.filter((cell) => board.has(cell, digit));
    const houses = sharedHouses(withDigit);
    if (houses.length) {
      restricted.push(digit);
      where.push(`every ${digit} is in ${houseName(houses[0])}`);
    } else {
      open++;
      z = digit;
    }
  }
  if (open !== 1) return null;
  const zCells = cells.filter((cell) => board.has(cell, z));
  const targets = commonPeers(zCells).filter((cell) => !cells.includes(cell) && board.has(cell, z));
  if (!targets.length) return null;
  const p = zCells.find((a) => zCells.some((b) => b !== a && !sees(a, b)));
  const q = zCells.find((b) => b !== p && !sees(p, b));
  const eliminations = eliminationsFor(board, targets, [z]);
  const marks = keyMarks(board, cells, DIGITS[all]);
  const names = cellList(cells);
  return {
    technique: 'wxyz-wing',
    placements: [],
    eliminations,
    stages: [
      { text: `Look at ${names}.`, cells: cells.map((cell) => [cell, 'key']) },
      {
        text: `Between them, ${names} have only the candidates ${joinList(DIGITS[all])}: four digits for four cells. In these cells, ${joinList(where)}, so each of ${joinList(restricted)} can go in at most one of them. The ${z}s are not all in one row, column or block: ${cellName(p)} and ${cellName(q)} both have ${z} as a candidate but do not see each other.`,
        cells: cells.map((cell) => [cell, 'key']),
        marks,
      },
      {
        text: `If a cell that sees every ${z} in the four cells were ${z}, the four cells would have only ${joinList(restricted)} left, and one of those digits would have to go in two cells that see each other. So a cell that sees every ${z} in the four cells cannot be ${z}. ${removalText(eliminations)}`,
        cells: resultCells(cells, eliminations),
        marks: [...marks, ...elimMarks(eliminations)],
      },
    ],
  };
}

export default [remotePair, wWing, xyWing, xyzWing, wxyzWing];
