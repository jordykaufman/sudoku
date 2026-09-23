import assert from 'node:assert/strict';
import { test } from 'node:test';
import { practiceProgress } from '../src/app/practice.js';
import { Board } from '../src/engine/board.js';
import { bit, parseGrid } from '../src/engine/grid.js';
import { nextStep } from '../src/engine/logic.js';
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

const eliminationStep = () => {
  const start = Board.fromCandidateGrid(XWING);
  return { start, step: techniqueById('x-wing').find(start.clone()) };
};

const placementStep = () => {
  const start = Board.fromString('003020600900305001001806400008102900700000008006708200002609500800203009005010300');
  return { start, step: nextStep(start.clone()) };
};

test('an untouched position is not done and has nothing wrong', () => {
  const { start, step } = eliminationStep();
  assert.deepEqual(practiceProgress(start, start.clone(), step), { done: false, right: 0, wrong: [] });
});

test('making the step\'s eliminations finishes the position', () => {
  const { start, step } = eliminationStep();
  const board = start.clone();
  assert.equal(step.eliminations.length, 1);
  for (const [cell, digit] of step.eliminations) board.cands[cell] &= ~bit(digit);
  const result = practiceProgress(start, board, step);
  assert.deepEqual(result, { done: true, right: step.eliminations.length, wrong: [] });
});

test('removing a mark that is not part of the step is wrong', () => {
  const { start, step } = eliminationStep();
  const board = start.clone();
  board.cands[0] &= ~bit(5); // R1C1 has nothing to do with this X-Wing
  const result = practiceProgress(start, board, step);
  assert.equal(result.done, false);
  assert.deepEqual(result.wrong, [0]);
});

test('a mark put back is neither right nor wrong', () => {
  const { start, step } = eliminationStep();
  const board = start.clone();
  board.cands[0] &= ~bit(5);
  board.cands[0] |= bit(5);
  assert.deepEqual(practiceProgress(start, board, step), { done: false, right: 0, wrong: [] });
});

test('a mark that was never there is wrong', () => {
  const { start, step } = eliminationStep();
  const board = start.clone();
  board.cands[0] |= bit(3);
  assert.deepEqual(practiceProgress(start, board, step).wrong, [0]);
});

test('placing the digit the step asks for finishes the position', () => {
  const { start, step } = placementStep();
  assert.equal(step.placements.length, 1);
  const [cell, digit] = step.placements[0];
  const board = start.clone();
  board.values[cell] = digit;
  board.cands[cell] = 0;
  assert.deepEqual(practiceProgress(start, board, step), { done: true, right: 1, wrong: [] });
});

test('placing a digit the step does not ask for is wrong', () => {
  const { start, step } = placementStep();
  const [cell, digit] = step.placements[0];
  const board = start.clone();
  board.values[cell] = digit === 1 ? 2 : 1;
  board.cands[cell] = 0;
  const result = practiceProgress(start, board, step);
  assert.equal(result.done, false);
  assert.deepEqual(result.wrong, [cell]);
});

// The rules a stored position has to keep, which scripts/examples.js applies when it builds
// them: the technique applies, no technique earlier in the solving order makes any of the same
// changes (or the exercise would be the hard way to do a simpler move), and no single easier
// than the technique is going begging (or the eye would go there instead).
test('every stored position is a sound exercise', async () => {
  const { readFileSync } = await import('node:fs');
  const { ORDER } = await import('../src/engine/techniques/order.js');
  const examples = JSON.parse(readFileSync(new URL('../data/examples.json', import.meta.url), 'utf8'));
  const rank = new Map(ORDER.map((id, index) => [id, index]));
  const singles = ['full-house', 'naked-single', 'hidden-single-block', 'hidden-single'];
  const edits = (step) => [...step.eliminations, ...step.placements].map(([cell, digit]) => cell * 10 + digit);
  const decode = ({ values, cands, givens }) =>
    new Board(
      parseGrid(values),
      Uint16Array.from({ length: 81 }, (_, i) => parseInt(cands.slice(i * 2, i * 2 + 2), 36)),
      Uint8Array.from(givens, (ch) => (ch === '1' ? 1 : 0)),
    );

  for (const [id, positions] of Object.entries(examples)) {
    assert.ok(positions.length >= 3, `${id} has only ${positions.length} positions`);
    positions.forEach((position, index) => {
      const where = `${id} position ${index + 1}`;
      const step = techniqueById(id).find(decode(position));
      assert.ok(step, `${where}: the technique does not apply`);
      const changes = new Set(edits(step));
      for (const earlier of ORDER.slice(0, rank.get(id))) {
        const other = techniqueById(earlier)?.find(decode(position));
        assert.ok(
          !other || !edits(other).some((edit) => changes.has(edit)),
          `${where}: ${earlier} makes the same change`,
        );
      }
      for (const single of singles) {
        if (single === id || rank.get(single) > rank.get(id)) continue;
        assert.ok(!techniqueById(single).find(decode(position)), `${where}: a ${single} is going begging`);
      }
    });
  }
});

test('every technique has at least one practice position, and its step still applies', async () => {
  const { readFileSync } = await import('node:fs');
  const examples = JSON.parse(readFileSync(new URL('../data/examples.json', import.meta.url), 'utf8'));
  const decode = ({ values, cands, givens }) =>
    new Board(
      parseGrid(values),
      Uint16Array.from({ length: 81 }, (_, i) => parseInt(cands.slice(i * 2, i * 2 + 2), 36)),
      Uint8Array.from(givens, (ch) => (ch === '1' ? 1 : 0)),
    );
  for (const [id, positions] of Object.entries(examples)) {
    assert.ok(positions.length >= 3, `${id} has ${positions.length} positions`);
    for (const position of positions) {
      assert.ok(techniqueById(id).find(decode(position)), `${id} does not apply in one of its positions`);
    }
  }
});
