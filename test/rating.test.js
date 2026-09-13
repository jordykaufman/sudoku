import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVELS } from '../src/engine/levels.js';
import { mulberry32 } from '../src/engine/random.js';
import { EMPTY_CELLS, makePuzzleAt, rate, solvableByFullHouse } from '../src/engine/rating.js';
import { solve } from '../src/engine/solver.js';

const levelIndex = (id) => LEVELS.findIndex((level) => level.id === id);

test('puzzles that need only Full House are rated by their empty cells', () => {
  const rng = mulberry32(4);
  for (const [id, [min, max]] of Object.entries(EMPTY_CELLS)) {
    const level = levelIndex(id);
    const made = makePuzzleAt(level, rng);
    assert.ok(made, id);
    const empty = made.puzzle.filter((v) => v === 0).length;
    assert.ok(empty >= min && empty <= max, `${id} has ${empty} empty cells`);
    assert.ok(solvableByFullHouse(made.puzzle));
    assert.equal(solve(made.puzzle).count, 1);
    assert.equal(rate(made.puzzle), level);
  }
});

test('puzzles are made at the easy and middle levels', () => {
  const rng = mulberry32(9);
  for (const id of ['simple', 'easy', 'moderate', 'intricate']) {
    const level = levelIndex(id);
    const made = makePuzzleAt(level, rng, 500);
    assert.ok(made, id);
    assert.equal(solve(made.puzzle).count, 1);
    assert.equal(rate(made.puzzle), level);
  }
});
