import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board } from '../src/engine/board.js';
import { carve, randomSolution } from '../src/engine/generator.js';
import { BOX, HOUSES, PEERS, formatGrid, parseGrid, sees } from '../src/engine/grid.js';
import { LEVELS, TECHNIQUE_LEVEL } from '../src/engine/levels.js';
import { logicalSolve } from '../src/engine/logic.js';
import { hashString, mulberry32 } from '../src/engine/random.js';
import { solve } from '../src/engine/solver.js';
import { ORDER } from '../src/engine/techniques/order.js';
import { checkStep } from '../src/engine/validate.js';

const EASY = '003020600900305001001806400008102900700000008006708200002609500800203009005010300';

function isCompleteGrid(grid) {
  return HOUSES.every(
    (house) => new Set(house.map((cell) => grid[cell])).size === 9 && house.every((cell) => grid[cell] >= 1 && grid[cell] <= 9),
  );
}

test('every house has 9 cells and every cell has 20 peers', () => {
  assert.equal(HOUSES.length, 27);
  for (const house of HOUSES) assert.equal(new Set(house).size, 9);
  for (let cell = 0; cell < 81; cell++) {
    assert.equal(PEERS[cell].length, 20);
    for (const peer of PEERS[cell]) assert.ok(sees(cell, peer) && sees(peer, cell));
  }
  assert.equal(BOX[0], 0);
  assert.equal(BOX[40], 4);
  assert.equal(BOX[80], 8);
});

test('puzzle text round-trips', () => {
  assert.equal(formatGrid(parseGrid(EASY)), EASY.replaceAll('0', '.'));
});

test('the solver finds the one solution of a valid puzzle', () => {
  const puzzle = parseGrid(EASY);
  const { count, solution } = solve(puzzle);
  assert.equal(count, 1);
  assert.ok(isCompleteGrid(solution));
  for (let cell = 0; cell < 81; cell++) if (puzzle[cell]) assert.equal(solution[cell], puzzle[cell]);
});

test('the solver stops at the limit and rejects clashing clues', () => {
  assert.equal(solve(new Uint8Array(81)).count, 2);
  const clash = parseGrid(EASY);
  clash[0] = 3; // row 1 already has a 3 in R1C3
  assert.equal(solve(clash).count, 0);
});

test('board candidates follow the placed digits', () => {
  const board = Board.fromValues(parseGrid(EASY));
  assert.deepEqual(board.candidates(0), [4, 5]);
  assert.deepEqual(board.candidates(1), [4, 5, 7, 8]);
  board.place(0, 4);
  assert.deepEqual(board.candidates(1), [5, 7, 8]);
  assert.equal(board.values[0], 4);
  assert.equal(board.cands[0], 0);
});

test('pencil-mark grids parse', () => {
  const cells = Array.from({ length: 81 }, (_, i) => (i === 0 ? '5' : '12')).join(' ');
  const board = Board.fromCandidateGrid(`| ${cells} |`);
  assert.equal(board.values[0], 5);
  assert.equal(board.givens[0], 1);
  assert.equal(board.givens[1], 0);
  assert.deepEqual(board.candidates(1), [1, 2]);
});

test('the same seed gives the same numbers', () => {
  const a = mulberry32(hashString('2026-09-14 fiendish'));
  const b = mulberry32(hashString('2026-09-14 fiendish'));
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  const x = mulberry32(1)();
  assert.ok(x >= 0 && x < 1);
});

test('carved puzzles are symmetric and have one solution', () => {
  const rng = mulberry32(7);
  for (let n = 0; n < 5; n++) {
    const solution = randomSolution(rng);
    assert.ok(isCompleteGrid(solution));
    const puzzle = carve(solution, rng);
    assert.equal(solve(puzzle).count, 1);
    for (let cell = 0; cell < 81; cell++) {
      assert.equal(puzzle[cell] === 0, puzzle[80 - cell] === 0);
      if (puzzle[cell]) assert.equal(puzzle[cell], solution[cell]);
    }
  }
});

test('carve stops at maxEmpty', () => {
  const rng = mulberry32(3);
  const puzzle = carve(randomSolution(rng), rng, { maxEmpty: 20 });
  assert.ok(puzzle.filter((v) => v === 0).length <= 20);
});

test('the technique order never goes back to an easier level', () => {
  let last = -1;
  for (const id of ORDER) {
    const level = TECHNIQUE_LEVEL.get(id);
    assert.notEqual(level, undefined, `${id} has no level`);
    assert.ok(level >= last, `${id} comes after a harder technique`);
    last = level;
  }
  for (const id of TECHNIQUE_LEVEL.keys()) assert.ok(ORDER.includes(id), `${id} is missing from order.js`);
  assert.equal(LEVELS.length, 16);
});

test('checkStep catches wrong placements and eliminations', () => {
  const puzzle = parseGrid(EASY);
  const board = Board.fromValues(puzzle);
  const { solution } = solve(puzzle);
  const stages = [{ text: 'one' }, { text: 'two' }];
  const wrong = board.candidates(0).find((d) => d !== solution[0]);
  const step = (placements, eliminations) => ({ technique: 't', placements, eliminations, stages });
  assert.deepEqual(checkStep(step([[0, solution[0]]], []), solution, board), []);
  assert.equal(checkStep(step([[0, wrong]], []), solution, board).length, 1);
  assert.equal(checkStep(step([], [[0, solution[0]]]), solution, board).length, 1);
  assert.equal(checkStep(step([], [[0, wrong]]), solution, board).length, 0);
  assert.equal(checkStep(step([], []), solution, board).length, 1);
});

test('logical solving finishes an easy puzzle with singles', () => {
  const { solved, steps } = logicalSolve(Board.fromValues(parseGrid(EASY)));
  assert.equal(solved, true);
  for (const step of steps) assert.ok(TECHNIQUE_LEVEL.get(step.technique) <= TECHNIQUE_LEVEL.get('naked-single'), step.technique);
});
