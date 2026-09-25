import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board } from '../src/engine/board.js';
import { bit, parseGrid } from '../src/engine/grid.js';
import { findHint, solveUpTo } from '../src/engine/hint.js';
import { LEVELS, TECHNIQUE_LEVEL } from '../src/engine/levels.js';
import { nextStep } from '../src/engine/logic.js';
import { TECHNIQUES } from '../src/engine/techniques/index.js';
import { solve } from '../src/engine/solver.js';

const puzzle = parseGrid('003020600900305001001806400008102900700000008006708200002609500800203009005010300');
const { solution } = solve(puzzle);
const givens = Uint8Array.from(puzzle, (v) => (v ? 1 : 0));
const wrongDigitForFirstCell = Board.fromValues(puzzle).candidates(0).find((d) => d !== solution[0]);

test('a wrong digit is reported first', () => {
  const values = puzzle.slice();
  values[0] = wrongDigitForFirstCell;
  const hint = findHint({ values, givens, solution });
  assert.equal(hint.kind, 'mistake');
  assert.equal(hint.cell, 0);
  assert.equal(hint.stages[2].text, `R1C1 is not ${wrongDigitForFirstCell}.`);
});

test('pencil marks that leave out the right digit are reported', () => {
  const marks = new Uint16Array(81);
  marks[0] = bit(wrongDigitForFirstCell);
  const hint = findHint({ values: puzzle, givens, solution, marks });
  assert.equal(hint.kind, 'mistake');
  assert.equal(hint.stages[2].text, `R1C1 needs a pencil mark for ${solution[0]}.`);
});

test('a correct position gets the next logical step', () => {
  const hint = findHint({ values: puzzle, givens, solution });
  assert.equal(hint.kind, 'step');
  assert.ok(hint.step.placements.length + hint.step.eliminations.length > 0);
  assert.equal(typeof hint.level, 'number');
});

test('a full correct board is solved', () => {
  assert.equal(findHint({ values: solution, givens, solution }).kind, 'solved');
});

// A Devious puzzle from data/puzzles.json: the techniques up to Intricate solve part of it.
const DEVIOUS = parseGrid('7...9..26...4..7.1......98...2..6.1.97..1..52.1.2..3...57......6.9..7...84..5...3');
const deviousPosition = (marks = new Uint16Array(81)) => ({
  values: DEVIOUS.slice(),
  givens: Uint8Array.from(DEVIOUS, (v) => (v ? 1 : 0)),
  solution: solve(DEVIOUS).solution,
  marks,
});
const INTRICATE = LEVELS.findIndex((level) => level.id === 'intricate');

test('solving up to a level uses only techniques up to it, as far as they go', () => {
  const position = deviousPosition();
  const result = solveUpTo(position, INTRICATE);
  assert.equal(result.kind, 'done');
  assert.ok(result.steps.length > 0);
  for (const step of result.steps) assert.ok(TECHNIQUE_LEVEL.get(step.technique) <= INTRICATE, step.technique);
  const upToIntricate = TECHNIQUES.filter((technique) => TECHNIQUE_LEVEL.get(technique.id) <= INTRICATE);
  assert.equal(nextStep(result.board, upToIntricate), null, 'nothing up to Intricate is left');
  assert.ok(!result.board.isSolved(), 'a Devious puzzle needs more');
  for (let cell = 0; cell < 81; cell++) {
    const value = result.board.values[cell];
    if (value) assert.equal(value, position.solution[cell]);
    else assert.ok(result.board.cands[cell] & bit(position.solution[cell]));
  }
});

test('solving up to a level starts from the pencil marks', () => {
  const { board } = solveUpTo(deviousPosition(), INTRICATE);
  const cell = board.values.findIndex((value, i) => !value && board.count(i) > 1);
  const marks = new Uint16Array(81);
  marks[cell] = bit(deviousPosition().solution[cell]); // the player has worked out this cell
  const result = solveUpTo(deviousPosition(marks), INTRICATE);
  assert.equal(result.board.values[cell], deviousPosition().solution[cell]);
});

test('solving up to a level refuses a board with a mistake', () => {
  const values = puzzle.slice();
  values[0] = wrongDigitForFirstCell;
  assert.equal(solveUpTo({ values, givens, solution }, INTRICATE).kind, 'mistake');
  const marks = new Uint16Array(81);
  marks[0] = bit(wrongDigitForFirstCell);
  assert.equal(solveUpTo({ values: puzzle, givens, solution, marks }, INTRICATE).kind, 'mistake');
});
