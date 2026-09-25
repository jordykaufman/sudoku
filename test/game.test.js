import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from '../src/app/game.js';
import { bit, formatGrid, parseGrid } from '../src/engine/grid.js';
import { solveUpTo } from '../src/engine/hint.js';
import { LEVELS } from '../src/engine/levels.js';
import { solve } from '../src/engine/solver.js';

const PUZZLE = '003020600900305001001806400008102900700000008006708200002609500800203009005010300';
const SOLUTION = formatGrid(solve(parseGrid(PUZZLE)).solution);
const SETTINGS = { mistakes: 'clash', showSolvable: false };

const newGame = (pencilMode = 'manual') => new Game({ kind: 'random', level: 7, puzzle: PUZZLE, solution: SOLUTION, pencilMode });
const right = (cell) => Number(SOLUTION[cell]);
const wrongFor = (cell) => (right(cell) === 1 ? 2 : 1);

test('entering, clearing, undo and redo', () => {
  const game = newGame();
  assert.equal(game.enter(0, right(0), SETTINGS).placed, true);
  assert.equal(game.values[0], right(0));
  game.enter(0, right(0), SETTINGS);
  assert.equal(game.values[0], 0);
  game.undo();
  assert.equal(game.values[0], right(0));
  game.undo();
  assert.equal(game.values[0], 0);
  game.redo();
  assert.equal(game.values[0], right(0));
  assert.equal(game.enter(2, 5, SETTINGS), null, 'R1C3 is a clue');
});

test('auto erase removes a placed digit from the pencil marks of its peers', () => {
  const game = newGame('erase');
  game.toggleMark(1, right(0));
  assert.equal(game.shownMarks(1), bit(right(0)));
  game.enter(0, right(0), SETTINGS);
  assert.equal(game.shownMarks(1), 0);
});

test('automatic pencil marks follow the board and remember marks turned off', () => {
  const game = newGame('auto');
  assert.equal(game.shownMarks(0), bit(4) | bit(5));
  game.toggleMark(0, 4);
  assert.equal(game.shownMarks(0), bit(5));
  assert.equal(game.toggleMark(0, 9), false, '9 is not allowed in R1C1');
  game.setPencilMode('manual');
  assert.equal(game.shownMarks(0), bit(5));
  game.setPencilMode('auto');
  assert.equal(game.shownMarks(0), bit(5));
});

test('undo until solvable goes back to the last correct position', () => {
  const game = newGame();
  game.enter(0, right(0), SETTINGS);
  game.enter(1, wrongFor(1), SETTINGS);
  game.toggleMark(3, 1);
  assert.equal(game.isSolvable(), false);
  assert.equal(game.undoUntilSolvable(), 2);
  assert.equal(game.isSolvable(), true);
  assert.equal(game.values[0], right(0));
  assert.ok(game.penalty > 0);
});

test('a hint adds time once for the same position', () => {
  const game = newGame();
  game.hint();
  const penalty = game.penalty;
  assert.ok(penalty > 0);
  game.hint();
  assert.equal(game.penalty, penalty);
  assert.equal(game.hints, 1);
});

test('a saved game restores with its undo history', () => {
  const game = newGame('erase');
  game.enter(0, right(0), SETTINGS);
  game.toggleMark(1, 7);
  game.elapsed = 12345;
  const copy = new Game(JSON.parse(JSON.stringify(game)));
  assert.deepEqual(copy.values, game.values);
  assert.equal(copy.shownMarks(1), bit(7));
  assert.equal(copy.elapsed, 12345);
  copy.undo();
  assert.equal(copy.shownMarks(1), 0);
  copy.undo();
  assert.equal(copy.values[0], 0);
});

test('applying a hint makes the move it describes, and undo takes it back', () => {
  const game = newGame('auto');
  const hint = game.hint();
  assert.equal(hint.kind, 'step');
  const before = game.snapshot();
  game.applyHint(hint);
  for (const [cell, digit] of hint.step.placements) assert.equal(game.values[cell], digit);
  for (const [cell, digit] of hint.step.eliminations) assert.equal(game.shownMarks(cell) & bit(digit), 0);
  assert.notEqual(game.snapshot(), before);
  game.undo();
  assert.equal(game.snapshot(), before);
});

test('applying a hint costs no extra time, because the hint was already paid for', () => {
  const game = newGame('auto');
  const hint = game.hint();
  const penalty = game.penalty;
  game.applyHint(hint);
  assert.equal(game.penalty, penalty);
});

test('applying a mistake hint takes the wrong digit out', () => {
  const game = newGame('auto');
  const cell = game.values.findIndex((v, i) => !v && !game.isGiven(i));
  game.enter(cell, wrongFor(cell), SETTINGS);
  const hint = game.hint();
  assert.equal(hint.kind, 'mistake');
  assert.equal(hint.cell, cell);
  game.applyHint(hint);
  assert.equal(game.values[cell], 0);
});

test('applying a mistake hint puts a rubbed out pencil mark back', () => {
  const game = newGame('auto');
  const cell = game.values.findIndex((v, i) => !v && !game.isGiven(i));
  game.toggleMark(cell, right(cell)); // in automatic mode this turns the mark off
  assert.equal(game.shownMarks(cell) & bit(right(cell)), 0);
  const hint = game.hint();
  assert.equal(hint.kind, 'mistake');
  game.applyHint(hint);
  assert.ok(game.shownMarks(cell) & bit(right(cell)));
});

test('show solution puts the answer in every empty cell as a pencil mark', () => {
  const game = newGame();
  game.showSolution();
  for (let cell = 0; cell < 81; cell++) if (!game.values[cell]) assert.equal(game.shownMarks(cell), bit(right(cell)));
  assert.equal(game.usedSolution, true);
});

test('a board that matches the solution is finished', () => {
  const game = newGame();
  for (let cell = 0; cell < 81; cell++) if (!game.values[cell]) game.enter(cell, right(cell), SETTINGS);
  assert.equal(game.checkFinished(), true);
});

// A Devious puzzle from data/puzzles.json, and the level the solving shortcut goes up to.
const DEVIOUS = '7...9..26...4..7.1......98...2..6.1.97..1..52.1.2..3...57......6.9..7...84..5...3';
const INTRICATE = LEVELS.findIndex((level) => level.id === 'intricate');
const deviousGame = (pencilMode) =>
  new Game({ kind: 'random', level: 12, puzzle: DEVIOUS, solution: formatGrid(solve(parseGrid(DEVIOUS)).solution), pencilMode });

for (const pencilMode of ['manual', 'erase', 'auto']) {
  test(`the solving shortcut places digits and leaves the candidates as pencil marks (${pencilMode})`, () => {
    const game = deviousGame(pencilMode);
    const before = game.snapshot();
    const { board } = solveUpTo(game.position(), INTRICATE);
    const result = game.autoSolve(INTRICATE);
    assert.equal(result.mistake, false);
    assert.ok(result.placed > 0);
    assert.equal(game.usedSolver, true);
    for (let cell = 0; cell < 81; cell++) {
      assert.equal(game.values[cell], board.values[cell]);
      if (!game.values[cell]) assert.equal(game.shownMarks(cell), board.cands[cell]);
    }
    // Nothing up to Intricate is left, so a hint names a harder technique.
    const hint = game.hint();
    assert.equal(hint.kind, 'step');
    assert.ok(hint.level > INTRICATE);
    // A second go finds nothing and leaves nothing to undo; one Undo takes the whole solve back.
    assert.deepEqual(game.autoSolve(INTRICATE), { mistake: false, steps: 0, placed: 0 });
    game.undo();
    assert.equal(game.snapshot(), before);
  });
}

test('the solving shortcut changes nothing on a board with a mistake', () => {
  const game = deviousGame('erase');
  const cell = game.values.indexOf(0);
  game.enter(cell, Number(formatGrid(solve(parseGrid(DEVIOUS)).solution)[cell]) === 1 ? 2 : 1, SETTINGS);
  const before = game.snapshot();
  assert.equal(game.autoSolve(INTRICATE).mistake, true);
  assert.equal(game.snapshot(), before);
  assert.equal(game.usedSolver, false);
});
