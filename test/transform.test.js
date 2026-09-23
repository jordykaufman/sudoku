import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board } from '../src/engine/board.js';
import { POPCOUNT } from '../src/engine/grid.js';
import { mulberry32 } from '../src/engine/random.js';
import { randomArrangement, rearrange } from '../src/engine/transform.js';
import { techniqueById } from '../src/engine/techniques/index.js';

// The X-Wing from test/fish.test.js: 5 in rows 2 and 5, columns 5 and 8, removes 5 from R4C5.
const XWING = `
| 58  4   1 | 7    2    9    | 68  3   56 |
| 7   6   9 | 18   158  3    | 4   58  2  |
| 58  3   2 | 6    4    58   | 7   1   9  |
| 4   28  3 | 9    58   2568 | 1   7   56 |
| 6   28  7 | 128  158  4    | 9   58  3  |
| 1   9   5 | 3    7    68   | 68  2   4  |
| 2   1   4 | 5    6    7    | 3   9   8  |
| 3   7   6 | 28   9    28   | 5   4   1  |
| 9   5   8 | 4    3    1    | 2   6   7  |`;

const counts = (board) => Array.from(board.cands, (mask) => POPCOUNT[mask]).sort((a, b) => a - b).join('');
const digitCounts = (board) => Array.from({ length: 10 }, (_, d) => [...board.values].filter((v) => v === d).length).slice(1).sort().join(',');

test('a rearranged board is still the same puzzle in a different arrangement', () => {
  const board = Board.fromCandidateGrid(XWING);
  const out = rearrange(board, randomArrangement(mulberry32(7)));
  assert.equal(counts(out), counts(board), 'the same spread of candidate counts');
  assert.equal(digitCounts(out), digitCounts(board), 'the same number of each digit, under its new name');
  assert.equal([...out.givens].filter(Boolean).length, [...board.givens].filter(Boolean).length);
  for (let house = 0; house < 27; house++) {
    const placed = out.values.filter((v, cell) => v && [Math.floor(cell / 9), 9 + (cell % 9), 18 + (Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3))].includes(house));
    assert.equal(new Set(placed).size, placed.length, `house ${house} has no repeated digit`);
  }
});

test('the technique still applies, with the same shape of step', () => {
  const board = Board.fromCandidateGrid(XWING);
  const before = techniqueById('x-wing').find(board.clone());
  for (const seed of [1, 2, 3, 4, 5]) {
    const out = rearrange(board, randomArrangement(mulberry32(seed)));
    const after = techniqueById('x-wing').find(out);
    assert.ok(after, `seed ${seed} lost the X-Wing`);
    assert.equal(after.eliminations.length, before.eliminations.length);
    assert.equal(after.placements.length, before.placements.length);
  }
});

test('rearranging gives a different board almost every time', () => {
  const board = Board.fromCandidateGrid(XWING);
  const seen = new Set();
  for (let seed = 1; seed <= 20; seed++) seen.add(rearrange(board, randomArrangement(mulberry32(seed))).toCandidateGrid());
  assert.ok(seen.size >= 19, `only ${seen.size} of 20 arrangements were different`);
});

test('the identity arrangement changes nothing', () => {
  const board = Board.fromCandidateGrid(XWING);
  const same = rearrange(board, {
    rows: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    columns: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    transpose: false,
    digits: Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
  });
  assert.equal(same.toCandidateGrid(), board.toCandidateGrid());
});
