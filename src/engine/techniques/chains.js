import { CELL_HOUSES, PEERS, bit, sees } from '../grid.js';
import { cellList, cellName, houseName, joinList, removalText } from '../text.js';
import { sortEliminations } from './common.js';

// Simple Colors, X-Chain, XY-Chain, Fishy Cycle and 3D Medusa Coloring.
//
// Terms. A strong link on a digit joins the only two cells of a house that have the digit as
// a candidate, so one of the two cells holds the digit. A weak link on a digit joins two
// cells that see each other and both have the digit, so at most one of them holds it. A
// strong link can also be used as a weak link. A bivalue cell is an empty cell with exactly
// two candidates.

// ---------------------------------------------------------------------------------------
// Shared helpers

// For each cell, the cells joined to it by a strong link on `digit`, in increasing order.
function strongPartners(board, digit) {
  const partners = Array.from({ length: 81 }, () => []);
  for (let house = 0; house < 27; house++) {
    const cells = board.where(house, digit);
    if (cells.length !== 2) continue;
    const [a, b] = cells;
    if (!partners[a].includes(b)) partners[a].push(b);
    if (!partners[b].includes(a)) partners[b].push(a);
  }
  for (const list of partners) list.sort((x, y) => x - y);
  return partners;
}

// For each cell with `digit`, the other cells with `digit` that it sees, in increasing order.
function weakPartners(board, digit) {
  const b = bit(digit);
  return Array.from({ length: 81 }, (_, cell) => (board.cands[cell] & b ? PEERS[cell].filter((p) => board.cands[p] & b) : []));
}

// The first house shared by cells `a` and `b` in which they are the only cells with `digit`.
const strongHouse = (board, a, b, digit) =>
  CELL_HOUSES[a].find((house) => CELL_HOUSES[b].includes(house) && board.where(house, digit).length === 2);

const sharedHouse = (a, b) => CELL_HOUSES[a].find((house) => CELL_HOUSES[b].includes(house));

const strongSentence = (board, a, b, digit) =>
  `${cellName(a)} and ${cellName(b)} are the only cells in ${houseName(strongHouse(board, a, b, digit))} that can be ${digit}.`;

const weakSentence = (a, b) => `${cellName(a)} and ${cellName(b)} are both in ${houseName(sharedHouse(a, b))}.`;

const COLOR_NAMES = ['the first color', 'the second color'];
const COLOR_ROLES = ['a', 'b'];

// ---------------------------------------------------------------------------------------
// Chains of alternating strong and weak links
//
// A node is a number: a cell for single-digit chains, or cell * 9 + digit - 1 for XY-Chains.
// `strong(node)` and `weak(node)` list the nodes joined to a node by each kind of link, and
// `cellOf(node)` gives its cell. A search state is 2 * node + t, where t is 0 when the next
// link must be strong and 1 when it must be weak.

// The fewest links from any node in `sources` (with a strong link next) to each state, or -1
// when a state cannot be reached. Reversing a chain that starts and ends with a strong link
// gives another such chain, so with the possible chain ends as sources, dist[2 * node + 1 - t]
// is the fewest links still needed from state (node, t) to reach an end.
function linkDistances(sources, strong, weak) {
  const dist = new Int16Array(2 * 729).fill(-1);
  const queue = [];
  for (const node of sources) {
    dist[2 * node] = 0;
    queue.push(2 * node);
  }
  for (let i = 0; i < queue.length; i++) {
    const state = queue[i];
    const node = state >> 1;
    const t = state & 1;
    for (const next of t ? weak(node) : strong(node)) {
      const nextState = 2 * next + 1 - t;
      if (dist[nextState] < 0) {
        dist[nextState] = dist[state] + 1;
        queue.push(nextState);
      }
    }
  }
  return dist;
}

// The first chain of exactly `length` links that starts at `start` with a strong link, uses
// alternating links, ends with a strong link and passes `accept(path)`. A chain enters a cell
// at most once and only enters nodes that pass `usable`. `dist` comes from linkDistances with
// the possible ends as sources. Returns the nodes of the chain in order, or null.
function searchChain({ start, length, strong, weak, cellOf, usable = () => true, accept, dist }) {
  const path = [start];
  const used = new Uint8Array(81);
  used[cellOf(start)] = 1;
  const visit = (node, t) => {
    const depth = path.length - 1;
    if (depth === length) return t === 1 && accept(path) ? path.slice() : null;
    const left = dist[2 * node + 1 - t];
    if (left < 0 || depth + left > length) return null;
    const cell = cellOf(node);
    for (const next of t ? weak(node) : strong(node)) {
      const nextCell = cellOf(next);
      const enters = nextCell !== cell;
      if (enters && (used[nextCell] || !usable(next))) continue;
      if (enters) used[nextCell] = 1;
      path.push(next);
      const found = visit(next, 1 - t);
      path.pop();
      if (enters) used[nextCell] = 0;
      if (found) return found;
    }
    return null;
  };
  return visit(start, 0);
}

// ---------------------------------------------------------------------------------------
// Simple Colors

// Groups of cells joined by strong links on one digit. `color[cell]` is 0 or 1 for the cells
// of every group, alternating along each link. A group whose links cannot be colored this way
// is left out; a board whose candidates include the solution never has one.
function colorGroups(partners) {
  const color = new Int8Array(81).fill(-1);
  const groups = [];
  for (let first = 0; first < 81; first++) {
    if (color[first] >= 0 || !partners[first].length) continue;
    const cells = [first];
    color[first] = 0;
    let consistent = true;
    for (let i = 0; i < cells.length; i++) {
      for (const next of partners[cells[i]]) {
        if (color[next] < 0) {
          color[next] = 1 - color[cells[i]];
          cells.push(next);
        } else if (color[next] === color[cells[i]]) {
          consistent = false;
        }
      }
    }
    if (consistent) groups.push({ cells: cells.sort((a, b) => a - b), color });
  }
  return groups;
}

// The first two stages of a Simple Colors hint.
function colorStages(board, digit, group, partners) {
  const links = [];
  for (const cell of group.cells) {
    for (const partner of partners[cell]) if (partner > cell) links.push([cell, digit, partner, digit, true]);
  }
  const marks = group.cells.map((cell) => [cell, digit, COLOR_ROLES[group.color[cell]]]);
  const first = group.cells.filter((cell) => group.color[cell] === 0);
  const second = group.cells.filter((cell) => group.color[cell] === 1);
  const have = (cells) => (cells.length === 1 ? 'has' : 'have');
  return [
    { text: `Consider the digit ${digit}.`, digit },
    {
      text:
        `The two cells of each linked pair are the only cells in a row, column or block that can be ${digit}, so one of them is ${digit} and the other is not. ` +
        `${cellList(first)} ${have(first)} the first color and ${cellList(second)} ${have(second)} the second color, so each pair has one cell of each color. ` +
        `Either every cell of the first color is ${digit}, or every cell of the second color is.`,
      digit,
      marks,
      links,
    },
  ];
}

function colorWrap(board, digit, group, partners) {
  const byColor = [0, 1].map((color) => group.cells.filter((cell) => group.color[cell] === color));
  const clashes = byColor.map((cells) => {
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) if (sees(cells[i], cells[j])) return [cells[i], cells[j]];
    }
    return null;
  });
  // Neither color clashes, or both do, which a board with the solution's candidates never has.
  if (!clashes[0] === !clashes[1]) return null;
  const wrong = clashes[0] ? 0 : 1;
  const [x, y] = clashes[wrong];
  const house = sharedHouse(x, y);
  const eliminations = byColor[wrong].map((cell) => [cell, digit]);
  const stages = colorStages(board, digit, group, partners);
  stages.push({
    text:
      `${cellName(x)} and ${cellName(y)} both have ${COLOR_NAMES[wrong]} and are both in ${houseName(house)}, so they cannot both be ${digit}. ` +
      `So the cells of ${COLOR_NAMES[wrong]} are not ${digit}: remove ${digit} from ${cellList(byColor[wrong])}.`,
    digit,
    houses: [house],
    cells: byColor[wrong].map((cell) => [cell, 'target']),
    marks: group.cells.map((cell) => [cell, digit, group.color[cell] === wrong ? 'elim' : COLOR_ROLES[group.color[cell]]]),
  });
  return { technique: 'simple-colors', variant: 'color wrap', placements: [], eliminations, stages };
}

function colorTrap(board, digit, group, partners) {
  const inGroup = new Uint8Array(81);
  for (const cell of group.cells) inGroup[cell] = 1;
  const targets = [];
  const witnesses = [];
  for (let cell = 0; cell < 81; cell++) {
    if (inGroup[cell] || !board.has(cell, digit)) continue;
    const seen = [-1, -1];
    for (const peer of PEERS[cell]) if (inGroup[peer] && seen[group.color[peer]] < 0) seen[group.color[peer]] = peer;
    if (seen[0] < 0 || seen[1] < 0) continue;
    targets.push(cell);
    witnesses.push(seen);
  }
  if (!targets.length) return null;
  const stages = colorStages(board, digit, group, partners);
  const reason =
    targets.length === 1
      ? `${cellName(targets[0])} sees ${cellName(witnesses[0][0])}, which has the first color, and ${cellName(witnesses[0][1])}, which has the second color. Whichever color is ${digit}, ${cellName(targets[0])} sees a ${digit}, so remove ${digit} from ${cellName(targets[0])}.`
      : `${cellList(targets)} each see a cell of the first color and a cell of the second color. Whichever color is ${digit}, each of them sees a ${digit}, so remove ${digit} from ${cellList(targets)}.`;
  stages.push({
    text: reason,
    digit,
    cells: targets.map((cell) => [cell, 'target']),
    marks: [
      ...group.cells.map((cell) => [cell, digit, COLOR_ROLES[group.color[cell]]]),
      ...targets.map((cell) => [cell, digit, 'elim']),
    ],
  });
  return {
    technique: 'simple-colors',
    variant: 'color trap',
    placements: [],
    eliminations: targets.map((cell) => [cell, digit]),
    stages,
  };
}

const simpleColors = {
  id: 'simple-colors',
  name: 'Simple Colors',
  lesson: [
    'Pick a digit and find the rows, columns and blocks where only two cells can hold it. In each of these houses, one of the two cells holds the digit and the other does not.',
    'Pairs that share a cell join into a group. Give the cells of the group two colors so that the two cells of every pair have different colors. Then either every cell of the first color holds the digit, or every cell of the second color does.',
    'Color wrap: if two cells of the same color are in the same row, column or block, they cannot both hold the digit, so that color is the wrong one. Remove the digit from every cell of that color.',
    'Color trap: if a cell outside the group has the digit as a candidate and sees a cell of each color, then whichever color is right, the cell shares a house with a cell that holds the digit. Remove the digit from that cell.',
  ],
  find(board) {
    for (let digit = 1; digit <= 9; digit++) {
      const partners = strongPartners(board, digit);
      for (const group of colorGroups(partners)) {
        const step = colorWrap(board, digit, group, partners) ?? colorTrap(board, digit, group, partners);
        if (step) return step;
      }
    }
    return null;
  },
};

// ---------------------------------------------------------------------------------------
// X-Chain

// The longest X-Chain searched for, in links.
const X_CHAIN_MAX_LINKS = 17;

// Cells other than `a` and `b` that have `digit` and see both of them.
function commonTargets(board, digit, a, b) {
  const mask = bit(digit);
  return PEERS[a].filter((cell) => cell !== b && board.cands[cell] & mask && sees(cell, b));
}

const removeSentence = (digit, targets) =>
  `Remove ${digit} from ${cellList(targets)}, which ${targets.length === 1 ? 'sees' : 'see'} both of them.`;

// Highlights for a chain's cells and candidates, with the targets marked for removal.
const chainCells = (cells, targets) => [...cells.map((cell) => [cell, 'key']), ...targets.map((cell) => [cell, 'target'])];

function xChainStep(board, digit, chain, targets) {
  const links = [];
  const sentences = [];
  for (let i = 0; i + 1 < chain.length; i++) {
    const strong = i % 2 === 0;
    links.push([chain[i], digit, chain[i + 1], digit, strong]);
    sentences.push(strong ? strongSentence(board, chain[i], chain[i + 1], digit) : weakSentence(chain[i], chain[i + 1]));
  }
  const first = cellName(chain[0]);
  const last = cellName(chain.at(-1));
  const forced = chain.slice(1).map((cell, i) => `${cellName(cell)} is ${i % 2 ? 'not ' : ''}${digit}`);
  const marks = chain.map((cell) => [cell, digit, 'key']);
  return {
    technique: 'x-chain',
    placements: [],
    eliminations: targets.map((cell) => [cell, digit]),
    stages: [
      { text: `Consider the digit ${digit}.`, digit },
      { text: `Look at ${cellList(chain)}, in that order. ${sentences.join(' ')}`, digit, cells: chainCells(chain, []), marks, links },
      {
        text: `If ${first} is not ${digit}, then ${joinList(forced)}, so at least one of ${first} and ${last} is ${digit}. ${removeSentence(digit, targets)}`,
        digit,
        cells: chainCells(chain, targets),
        marks: [...marks, ...targets.map((cell) => [cell, digit, 'elim'])],
        links,
      },
    ],
  };
}

const xChain = {
  id: 'x-chain',
  name: 'X-Chain',
  lesson: [
    'Pick a digit. A strong link joins the only two cells in a row, column or block that can hold the digit: if one of them does not hold it, the other does. A weak link joins two cells that see each other and can both hold the digit: if one of them holds it, the other does not.',
    'An X-Chain is a line of cells joined by links that alternate strong, weak, strong and so on. It starts and ends with a strong link.',
    'If the first cell does not hold the digit, the second cell does, so the third does not, so the fourth does, and so on to the last cell, which must hold the digit. So at least one of the two end cells holds the digit.',
    'A cell outside the chain that sees both end cells cannot hold the digit. Remove the digit from it.',
  ],
  find(board) {
    const digits = [];
    for (let digit = 1; digit <= 9; digit++) {
      const strong = strongPartners(board, digit);
      const weak = weakPartners(board, digit);
      const starts = [];
      for (let start = 0; start < 81; start++) {
        if (!strong[start].length) continue;
        const ends = [];
        for (let end = 0; end < 81; end++) {
          if (end !== start && strong[end].length && commonTargets(board, digit, start, end).length) ends.push(end);
        }
        if (!ends.length) continue;
        const dist = linkDistances(ends, (cell) => strong[cell], (cell) => weak[cell]);
        if (dist[2 * start + 1] >= 0) starts.push({ start, dist });
      }
      digits.push({ digit, strong, weak, starts });
    }
    // Shortest chains first, so the hint is easy to follow.
    for (let length = 3; length <= X_CHAIN_MAX_LINKS; length += 2) {
      for (const { digit, strong, weak, starts } of digits) {
        for (const { start, dist } of starts) {
          if (dist[2 * start + 1] > length) continue;
          let targets = [];
          const chain = searchChain({
            start,
            length,
            dist,
            strong: (cell) => strong[cell],
            weak: (cell) => weak[cell],
            cellOf: (cell) => cell,
            accept: (path) => {
              targets = commonTargets(board, digit, path[0], path.at(-1)).filter((cell) => !path.includes(cell));
              return targets.length > 0;
            },
          });
          if (chain) return xChainStep(board, digit, chain, targets);
        }
      }
    }
    return null;
  },
};

// ---------------------------------------------------------------------------------------
// XY-Chain

// The most cells in an XY-Chain searched for.
const XY_CHAIN_MAX_CELLS = 12;

// XY-Chain nodes are candidates: cell * 9 + digit - 1.
const nodeCell = (node) => Math.floor(node / 9);
const nodeDigit = (node) => (node % 9) + 1;

function xyChainStep(chain, targets) {
  const cells = chain.filter((_, i) => i % 2 === 0).map(nodeCell);
  // The digit each cell shares with the cell before it, then the digit it shares with the next.
  const pairs = cells.map((_, i) => [nodeDigit(chain[2 * i]), nodeDigit(chain[2 * i + 1])]);
  const z = pairs[0][0];
  const links = [];
  cells.forEach((cell, i) => {
    links.push([cell, pairs[i][0], cell, pairs[i][1], true]);
    if (i + 1 < cells.length) links.push([cell, pairs[i][1], cells[i + 1], pairs[i][1], false]);
  });
  const parts = cells.map((cell, i) => `${pairs[i][0]} and ${pairs[i][1]} in ${cellName(cell)}`);
  const forced = cells.map((cell, i) => `${cellName(cell)} is ${pairs[i][1]}`);
  const marks = cells.flatMap((cell, i) => [
    [cell, pairs[i][0], 'key'],
    [cell, pairs[i][1], 'key'],
  ]);
  const first = cellName(cells[0]);
  const last = cellName(cells.at(-1));
  return {
    technique: 'xy-chain',
    placements: [],
    eliminations: targets.map((cell) => [cell, z]),
    stages: [
      { text: `Look at ${first}.`, cells: [[cells[0], 'key']] },
      {
        text:
          `Look at ${cellList(cells)}, in that order. Each of these cells has exactly two candidates, and each cell before the last sees the next one and shares a candidate with it. ` +
          `The candidates are ${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}.`,
        cells: chainCells(cells, []),
        marks,
        links,
      },
      {
        text: `If ${first} is not ${z}, then ${joinList(forced)}, so at least one of ${first} and ${last} is ${z}. ${removeSentence(z, targets)}`,
        cells: chainCells(cells, targets),
        marks: [...marks, ...targets.map((cell) => [cell, z, 'elim'])],
        links,
      },
    ],
  };
}

const xyChain = {
  id: 'xy-chain',
  name: 'XY-Chain',
  lesson: [
    'Look for cells that have exactly two candidates. If such a cell is not one of its two digits, it is the other.',
    'An XY-Chain is a line of at least four of these cells in which each cell sees the next one and shares a candidate with it. The first cell has candidates z and a, the second has a and b, the third has b and c, and so on, until the last cell, whose other candidate is z.',
    'If the first cell is not z, it is a. The second cell sees it, so the second cell is not a and must be b. Then the third cell is c, and so on, until the last cell must be z. So at least one of the two end cells is z.',
    'A cell outside the chain that sees both end cells cannot be z. Remove z from it.',
  ],
  find(board) {
    const strong = Array.from({ length: 729 }, () => []);
    const weak = Array.from({ length: 729 }, () => []);
    const bivalue = [];
    for (let cell = 0; cell < 81; cell++) if (board.count(cell) === 2) bivalue.push(cell);
    for (const cell of bivalue) {
      const [x, y] = board.candidates(cell);
      strong[cell * 9 + x - 1].push(cell * 9 + y - 1);
      strong[cell * 9 + y - 1].push(cell * 9 + x - 1);
      for (const digit of [x, y]) {
        for (const peer of PEERS[cell]) {
          if (board.count(peer) === 2 && board.has(peer, digit)) weak[cell * 9 + digit - 1].push(peer * 9 + digit - 1);
        }
      }
    }
    const starts = [];
    for (const cell of bivalue) {
      for (const z of board.candidates(cell)) {
        const ends = [];
        for (const other of bivalue) {
          if (other !== cell && board.has(other, z) && commonTargets(board, z, cell, other).length) ends.push(other * 9 + z - 1);
        }
        if (!ends.length) continue;
        const start = cell * 9 + z - 1;
        const dist = linkDistances(ends, (node) => strong[node], (node) => weak[node]);
        if (dist[2 * start + 1] >= 0) starts.push({ start, dist });
      }
    }
    // Shortest chains first. Three cells would be an XY-Wing, which is a separate technique.
    for (let size = 4; size <= XY_CHAIN_MAX_CELLS; size++) {
      const length = 2 * size - 1;
      for (const { start, dist } of starts) {
        if (dist[2 * start + 1] > length) continue;
        const z = nodeDigit(start);
        let targets = [];
        const chain = searchChain({
          start,
          length,
          dist,
          strong: (node) => strong[node],
          weak: (node) => weak[node],
          cellOf: nodeCell,
          accept: (path) => {
            if (nodeDigit(path.at(-1)) !== z) return false;
            const cells = path.map(nodeCell);
            targets = commonTargets(board, z, cells[0], cells.at(-1)).filter((cell) => !cells.includes(cell));
            return targets.length > 0;
          },
        });
        if (chain) return xyChainStep(chain, targets);
      }
    }
    return null;
  },
};

// ---------------------------------------------------------------------------------------
// Fishy Cycle

// The most cells in a Fishy Cycle searched for.
const FISHY_CYCLE_MAX_CELLS = 12;

// The loop is loop[0] = loop[1] - loop[2] = ... = loop[n - 1] - loop[0], with strong links (=)
// and weak links (-). Returns the houses shared by the two cells of each weak link, each with
// the cells outside the loop in that house that have `digit`.
function cycleHouses(board, digit, loop) {
  const result = [];
  for (let i = 1; i < loop.length; i += 2) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    for (const house of CELL_HOUSES[a]) {
      if (!CELL_HOUSES[b].includes(house) || result.some((entry) => entry.house === house)) continue;
      result.push({ house, cells: board.where(house, digit).filter((cell) => !loop.includes(cell)) });
    }
  }
  return result;
}

function fishyCycleStep(board, digit, loop, houses) {
  const links = [];
  const sentences = [];
  loop.forEach((a, i) => {
    const b = loop[(i + 1) % loop.length];
    const strong = i % 2 === 0;
    links.push([a, digit, b, digit, strong]);
    sentences.push(strong ? strongSentence(board, a, b, digit) : weakSentence(a, b));
  });
  const used = houses.filter((entry) => entry.cells.length);
  const targets = [...new Set(used.flatMap((entry) => entry.cells))].sort((x, y) => x - y);
  const names = used.map((entry) => houseName(entry.house));
  const even = loop.filter((_, i) => i % 2 === 0);
  const odd = loop.filter((_, i) => i % 2 === 1);
  const marks = loop.map((cell, i) => [cell, digit, COLOR_ROLES[i % 2]]);
  const cells = loop.map((cell, i) => [cell, COLOR_ROLES[i % 2]]);
  const where =
    names.length === 1 ? `${names[0]} has its ${digit}` : `${joinList(names)} each have their ${digit}`;
  return {
    technique: 'fishy-cycle',
    placements: [],
    eliminations: targets.map((cell) => [cell, digit]),
    stages: [
      { text: `Consider the digit ${digit}.`, digit },
      {
        text: `Look at ${cellList(loop)}, in that order, and then back to ${cellName(loop[0])}. ${sentences.join(' ')}`,
        digit,
        cells,
        marks,
        links,
      },
      {
        text:
          `Going around the loop, either ${cellList(even)} are ${digit}, or ${cellList(odd)} are ${digit}. ` +
          `Either way ${where} in a cell of the loop, so remove ${digit} from ${cellList(targets)}.`,
        digit,
        houses: used.map((entry) => entry.house),
        cells: [...cells, ...targets.map((cell) => [cell, 'target'])],
        marks: [...marks, ...targets.map((cell) => [cell, digit, 'elim'])],
        links,
      },
    ],
  };
}

const fishyCycle = {
  id: 'fishy-cycle',
  name: 'Fishy Cycle',
  lesson: [
    'Pick a digit. Look for a closed loop of cells joined by links that alternate between strong and weak. A strong link joins the only two cells in a row, column or block that can hold the digit. A weak link joins two cells that see each other and can both hold the digit.',
    'The cells around the loop must alternate between holding the digit and not holding it. If the first cell holds the digit, the cell it shares a weak link with does not, so that cell\'s strong-link partner does, and so on around the loop. If the first cell does not hold the digit, its strong-link partner does, and so on the other way.',
    'So each weak link in the loop has the digit in exactly one of its two cells. The row, column or block of that link has its digit in one of those two cells, so remove the digit from the other cells of that house.',
    'An X-Wing is the smallest loop of this kind: four cells, in two rows and two columns. Loops with more cells, or with links in blocks, work the same way.',
  ],
  find(board) {
    const digits = [];
    for (let digit = 1; digit <= 9; digit++) {
      const strong = strongPartners(board, digit);
      const weak = weakPartners(board, digit);
      const starts = [];
      for (let start = 0; start < 81; start++) {
        if (!strong[start].length) continue;
        // The start is the loop's lowest cell, and the loop closes with a weak link back to it.
        const ends = weak[start].filter((cell) => cell > start && strong[cell].length);
        if (!ends.length) continue;
        const dist = linkDistances(ends, (cell) => strong[cell], (cell) => weak[cell]);
        if (dist[2 * start + 1] >= 0) starts.push({ start, dist });
      }
      digits.push({ digit, strong, weak, starts });
    }
    // Shortest loops first. A loop of n cells is a chain of n - 1 links plus the closing weak link.
    for (let size = 4; size <= FISHY_CYCLE_MAX_CELLS; size += 2) {
      for (const { digit, strong, weak, starts } of digits) {
        for (const { start, dist } of starts) {
          if (dist[2 * start + 1] > size - 1) continue;
          let houses = [];
          const loop = searchChain({
            start,
            length: size - 1,
            dist,
            strong: (cell) => strong[cell],
            weak: (cell) => weak[cell],
            cellOf: (cell) => cell,
            usable: (cell) => cell > start,
            accept: (path) => {
              if (!sees(path.at(-1), start)) return false;
              houses = cycleHouses(board, digit, path);
              return houses.some((entry) => entry.cells.length);
            },
          });
          if (loop) return fishyCycleStep(board, digit, loop, houses);
        }
      }
    }
    return null;
  },
};

// ---------------------------------------------------------------------------------------
// 3D Medusa Coloring

// Candidates are nodes, as in XY-Chains. Two candidates are linked when they are the only two
// candidates of a cell, or when they are the same digit in the only two cells of a house that
// have that digit. Exactly one candidate of each linked pair is correct.
function medusaLinks(board) {
  const links = Array.from({ length: 729 }, () => []);
  const add = (x, y) => {
    if (links[x].includes(y)) return;
    links[x].push(y);
    links[y].push(x);
  };
  for (let digit = 1; digit <= 9; digit++) {
    for (let house = 0; house < 27; house++) {
      const cells = board.where(house, digit);
      if (cells.length === 2) add(cells[0] * 9 + digit - 1, cells[1] * 9 + digit - 1);
    }
  }
  for (let cell = 0; cell < 81; cell++) {
    if (board.count(cell) !== 2) continue;
    const [x, y] = board.candidates(cell);
    add(cell * 9 + x - 1, cell * 9 + y - 1);
  }
  return links;
}

// Groups of linked candidates. color[node] is 0 or 1 for the nodes of every group, and differs
// between linked nodes. A group whose links cannot be colored this way is left out.
function medusaGroups(board) {
  const links = medusaLinks(board);
  const color = new Int8Array(729).fill(-1);
  const groups = [];
  for (let first = 0; first < 729; first++) {
    if (color[first] >= 0 || !links[first].length) continue;
    const nodes = [first];
    color[first] = 0;
    let consistent = true;
    for (let i = 0; i < nodes.length; i++) {
      for (const next of links[nodes[i]]) {
        if (color[next] < 0) {
          color[next] = 1 - color[nodes[i]];
          nodes.push(next);
        } else if (color[next] === color[nodes[i]]) {
          consistent = false;
        }
      }
    }
    if (consistent) groups.push({ first, nodes: nodes.sort((a, b) => a - b), color, links });
  }
  return groups;
}

const MEDUSA_RULES = [
  'same color twice in a cell',
  'same color twice in a house',
  'both colors in a cell',
  'candidate sees both colors',
  'sees one color, cell has the other',
];

const candidateName = (node) => `${nodeDigit(node)} in ${cellName(nodeCell(node))}`;

function medusaStep(board, group, rule, eliminations, info) {
  const { nodes, color, links } = group;
  sortEliminations(eliminations);
  const removed = new Set(eliminations.map(([cell, digit]) => cell * 9 + digit - 1));
  const marks = nodes.map((node) => [nodeCell(node), nodeDigit(node), COLOR_ROLES[color[node]]]);
  const linkList = [];
  for (const node of nodes) {
    for (const next of links[node]) if (next > node) linkList.push([nodeCell(node), nodeDigit(node), nodeCell(next), nodeDigit(next), true]);
  }
  const start = nodeCell(group.first);
  const targets = [...new Set(eliminations.map(([cell]) => cell))];
  const last = {
    cells: targets.map((cell) => [cell, 'target']),
    marks: [
      ...marks.filter(([cell, digit]) => !removed.has(cell * 9 + digit - 1)),
      ...eliminations.map(([cell, digit]) => [cell, digit, 'elim']),
    ],
    links: linkList,
  };
  let reason;
  if (rule === 0 || rule === 1) {
    const [a, b] = info.witness;
    const wrong = COLOR_NAMES[info.wrong];
    if (rule === 0) {
      reason = `${cellName(nodeCell(a))} has two candidates of ${wrong}, ${nodeDigit(a)} and ${nodeDigit(b)}. A cell holds only one digit, so ${wrong} is not correct.`;
    } else {
      const house = sharedHouse(nodeCell(a), nodeCell(b));
      last.houses = [house];
      reason = `${cellName(nodeCell(a))} and ${cellName(nodeCell(b))} both have ${nodeDigit(a)} in ${wrong} and are both in ${houseName(house)}, so they cannot both be ${nodeDigit(a)}. So ${wrong} is not correct.`;
    }
  } else if (rule === 2) {
    reason =
      targets.length === 1
        ? `${cellName(targets[0])} has a candidate of each color. One of the two colors is correct, so the candidates without a color in ${cellName(targets[0])} are not.`
        : `${cellList(targets)} each have a candidate of each color. One of the two colors is correct, so the candidates without a color in those cells are not.`;
  } else if (eliminations.length > 1) {
    const names = joinList(eliminations.map(([cell, digit]) => `${digit} in ${cellName(cell)}`));
    reason =
      rule === 3
        ? `${names} each see their digit in a candidate of the first color and in a candidate of the second color. Whichever color is correct, each of them sees a correct candidate of its own digit, so none of them is correct.`
        : `${names} each see their digit in one color, and each of their cells has a candidate of the other color. Whichever color is correct, none of them is correct.`;
  } else {
    const [cell, digit] = eliminations[0];
    const node = cell * 9 + digit - 1;
    if (rule === 3) {
      const [a, b] = [info.seenFrom[0][node], info.seenFrom[1][node]];
      reason = `${digit} in ${cellName(cell)} sees ${candidateName(a)}, which has the first color, and ${candidateName(b)}, which has the second color. One of those two is correct, so ${cellName(cell)} is not ${digit}.`;
    } else {
      // The color of the candidate it sees. No candidate sees its digit in both colors (that rule
      // is tried first), so seen[node] is 1 or 2.
      const seen = info.seen[node] === 1 ? 0 : 1;
      const own = nodes.find((n) => nodeCell(n) === cell && color[n] === 1 - seen);
      const other = info.seenFrom[seen][node];
      reason =
        `${cellName(cell)} has ${nodeDigit(own)} in ${COLOR_NAMES[1 - seen]}, and its ${digit} sees ${candidateName(other)}, which has ${COLOR_NAMES[seen]}. ` +
        `If ${COLOR_NAMES[1 - seen]} is correct, ${cellName(cell)} is ${nodeDigit(own)}, and if ${COLOR_NAMES[seen]} is correct, ${cellName(nodeCell(other))} is ${digit}, so ${cellName(cell)} is not ${digit}.`;
    }
  }
  return {
    technique: '3d-medusa',
    variant: MEDUSA_RULES[rule],
    placements: [],
    eliminations,
    stages: [
      { text: `Look at ${cellName(start)}.`, cells: [[start, 'key']] },
      {
        text:
          `Start with ${candidateName(group.first)} and color the candidates linked to it, and the candidates linked to those, and so on. ` +
          'Two candidates are linked when they are the only two candidates in a cell, or when they are the same digit in the only two cells of a row, column or block that can hold it. Linked candidates get different colors. ' +
          'Either every candidate of the first color is correct, or every candidate of the second color is.',
        cells: [[start, 'key']],
        marks,
        links: linkList,
      },
      { text: `${reason} ${removalText(eliminations)}`, ...last },
    ],
  };
}

// The first elimination a colored group gives, trying the rules in order.
function medusaGroupStep(board, group) {
  const { nodes, color } = group;
  const inGroup = new Uint8Array(729);
  for (const node of nodes) inGroup[node] = 1;

  // A color with two candidates in one cell, or one digit twice in a house, is not correct.
  const clash = [null, null];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length && nodeCell(nodes[j]) === nodeCell(nodes[i]); j++) {
      if (color[nodes[i]] === color[nodes[j]]) clash[color[nodes[i]]] ??= { rule: 0, witness: [nodes[i], nodes[j]] };
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const [a, b] = [nodes[i], nodes[j]];
      if (color[a] === color[b] && nodeDigit(a) === nodeDigit(b) && sees(nodeCell(a), nodeCell(b))) {
        clash[color[a]] ??= { rule: 1, witness: [a, b] };
      }
    }
  }
  // Both colors clashing means the candidates leave out the solution; skip the group.
  if (clash[0] && clash[1]) return null;
  for (const wrong of [0, 1]) {
    if (!clash[wrong]) continue;
    const eliminations = nodes.filter((node) => color[node] === wrong).map((node) => [nodeCell(node), nodeDigit(node)]);
    return medusaStep(board, group, clash[wrong].rule, eliminations, { wrong, witness: clash[wrong].witness });
  }

  // For candidates without a color: which colors their cell has, and in which colors (and first
  // through which candidate) they see their own digit.
  const cellColors = new Uint8Array(81);
  const seen = new Uint8Array(729);
  const seenFrom = [new Int16Array(729).fill(-1), new Int16Array(729).fill(-1)];
  for (const node of nodes) {
    const cell = nodeCell(node);
    const digit = nodeDigit(node);
    const c = color[node];
    cellColors[cell] |= 1 << c;
    for (const peer of PEERS[cell]) {
      const other = peer * 9 + digit - 1;
      if (inGroup[other] || !board.has(peer, digit)) continue;
      seen[other] |= 1 << c;
      if (seenFrom[c][other] < 0) seenFrom[c][other] = node;
    }
  }
  const info = { cellColors, seen, seenFrom };

  const bothInCell = [];
  for (let cell = 0; cell < 81; cell++) {
    if (cellColors[cell] !== 3) continue;
    for (const digit of board.candidates(cell)) if (!inGroup[cell * 9 + digit - 1]) bothInCell.push([cell, digit]);
  }
  if (bothInCell.length) return medusaStep(board, group, 2, bothInCell, info);

  const seesBoth = [];
  const seesAndCell = [];
  for (let node = 0; node < 729; node++) {
    if (!seen[node]) continue;
    const cell = nodeCell(node);
    if (seen[node] === 3) seesBoth.push([cell, nodeDigit(node)]);
    else if (cellColors[cell] & (seen[node] ^ 3)) seesAndCell.push([cell, nodeDigit(node)]);
  }
  if (seesBoth.length) return medusaStep(board, group, 3, seesBoth, info);
  if (seesAndCell.length) return medusaStep(board, group, 4, seesAndCell, info);
  return null;
}

const medusa = {
  id: '3d-medusa',
  name: '3D Medusa Coloring',
  lesson: [
    'This is coloring on candidates instead of cells, with every digit at once. A candidate is correct when its cell holds that digit in the solution.',
    'Two candidates are linked when they are the only two candidates in a cell, or when they are the same digit in the only two cells of a row, column or block that can hold it. Exactly one of two linked candidates is correct. Give a linked pair two different colors, then keep giving each candidate linked to a colored one the other color. Either every candidate of the first color is correct, or every candidate of the second color is.',
    'If one color has two candidates in the same cell, or the same digit twice in a row, column or block, that color cannot be correct. Remove every candidate of that color.',
    'A candidate without a color can be removed when it shares a house with its digit in both colors, when its cell has candidates of both colors, or when it shares a house with its digit in one color and its cell has a candidate of the other color. In each case the candidate is wrong whichever color is correct.',
  ],
  find(board) {
    for (const group of medusaGroups(board)) {
      const step = medusaGroupStep(board, group);
      if (step) return step;
    }
    return null;
  },
};

export default [simpleColors, xChain, xyChain, fishyCycle, medusa];
