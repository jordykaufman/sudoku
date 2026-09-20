import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from '../src/app/game.js';
import { Board } from '../src/engine/board.js';
import { ALL, bit, formatGrid, parseGrid } from '../src/engine/grid.js';
import { checkWork } from '../src/engine/hint.js';
import { solve } from '../src/engine/solver.js';
import { cellName } from '../src/engine/text.js';

const PUZZLE = '003020600900305001001806400008102900700000008006708200002609500800203009005010300';
const SOLUTION = formatGrid(solve(parseGrid(PUZZLE)).solution);
const answer = (cell) => Number(SOLUTION[cell]);

// A position to check: the puzzle's clues, plus whatever the caller places or marks.
function position({ values = {}, marks = {} } = {}) {
  const clues = parseGrid(PUZZLE);
  const cells = Uint8Array.from(clues);
  for (const [cell, digit] of Object.entries(values)) cells[cell] = digit;
  return {
    values: cells,
    givens: Uint8Array.from(clues, (v) => (v ? 1 : 0)),
    solution: Uint8Array.from(SOLUTION, Number),
    marks: Uint16Array.from({ length: 81 }, (_, cell) => marks[cell] ?? 0),
  };
}

const firstEmpty = parseGrid(PUZZLE).findIndex((v) => !v);
// The digits the clues still allow in a cell, so that a test mark is not stale by accident.
const allowed = (cell) => Board.fromString(PUZZLE).cands[cell];

test('a board with nothing wrong reports nothing wrong', () => {
  const result = checkWork(position({ values: { [firstEmpty]: answer(firstEmpty) } }));
  assert.equal(result.problems, 0);
  assert.equal(result.text, 'Every digit on the board is right.');
  assert.deepEqual(result.cells, []);
  assert.deepEqual(result.marks, []);
});

test('correct pencil marks are called right', () => {
  const result = checkWork(position({ marks: { [firstEmpty]: allowed(firstEmpty) } }));
  assert.equal(result.problems, 0);
  assert.equal(result.text, 'Every digit on the board is right. The pencil marks are right too.');
});

test('a wrong digit is named and highlighted', () => {
  const wrong = answer(firstEmpty) === 1 ? 2 : 1;
  const result = checkWork(position({ values: { [firstEmpty]: wrong } }));
  assert.equal(result.problems, 1);
  assert.equal(result.text, `${cellName(firstEmpty)} holds a wrong digit.`);
  assert.deepEqual(result.cells, [[firstEmpty, 'mistake']]);
  assert.deepEqual(result.wrong, [firstEmpty]);
});

test('two wrong digits share a sentence', () => {
  const [a, b] = [...parseGrid(PUZZLE).keys()].filter((cell) => !parseGrid(PUZZLE)[cell]).slice(0, 2);
  const values = { [a]: answer(a) === 1 ? 2 : 1, [b]: answer(b) === 1 ? 2 : 1 };
  const result = checkWork(position({ values }));
  assert.equal(result.problems, 2);
  assert.equal(result.text, `${cellName(a)} and ${cellName(b)} hold wrong digits.`);
});

test('a cell whose pencil marks leave out its answer is named', () => {
  const marks = { [firstEmpty]: ALL & ~bit(answer(firstEmpty)) };
  const result = checkWork(position({ marks }));
  assert.equal(result.problems > 0, true);
  assert.ok(result.text.includes(`${cellName(firstEmpty)} has no pencil mark for its answer.`), result.text);
  assert.ok(result.cells.some(([cell, role]) => cell === firstEmpty && role === 'key'));
  assert.ok(result.marks.some(([cell, digit, role]) => cell === firstEmpty && digit === answer(firstEmpty) && role === 'place'));
});

test('a pencil mark for a digit already placed nearby is named', () => {
  // R1C3 is a clue 3, so a 3 pencilled into R1C1 cannot be right.
  const result = checkWork(position({ marks: { 0: bit(answer(0)) | bit(3) } }));
  assert.equal(result.problems, 1);
  assert.ok(result.text.includes('One pencil mark is for a digit already placed in the same row, column or block.'), result.text);
  assert.ok(result.text.includes('Remove 3 from R1C1.'), result.text);
  assert.deepEqual(result.marks, [[0, 3, 'elim']]);
});

test('marks a wrong digit explains are not reported as separate mistakes', () => {
  // R1C1 and R1C2 both answer to digits in row 1. Putting R1C2's answer into R1C1 takes that
  // digit out of R1C2's marks, which the wrong digit explains.
  const second = parseGrid(PUZZLE).findIndex((v, cell) => !v && cell > firstEmpty);
  const values = { [firstEmpty]: answer(second) };
  const marks = { [second]: allowed(second) & ~bit(answer(second)) };
  const result = checkWork(position({ values, marks }));
  assert.equal(result.problems, 1, result.text);
  assert.equal(result.text, `${cellName(firstEmpty)} holds a wrong digit. The pencil marks are right too.`);
});

test('a cell without pencil marks is never a mistake', () => {
  const result = checkWork(position());
  assert.equal(result.problems, 0);
  assert.equal(result.text, 'Every digit on the board is right.');
});

test('the game adds time once per position, and only when something is wrong', () => {
  const game = new Game({ kind: 'random', level: 7, puzzle: PUZZLE, solution: SOLUTION, pencilMode: 'manual' });
  assert.equal(game.checkWork().problems, 0);
  assert.equal(game.penalty, 0, 'a clean board costs nothing');

  game.enter(firstEmpty, answer(firstEmpty) === 1 ? 2 : 1, { mistakes: 'off', showSolvable: false });
  assert.equal(game.checkWork().problems, 1);
  const penalty = game.penalty;
  assert.ok(penalty > 0);
  assert.equal(game.checkWork().problems, 1);
  assert.equal(game.penalty, penalty, 'checking the same position again costs nothing');

  game.undo();
  assert.equal(game.checkWork().problems, 0);
  assert.equal(game.penalty, penalty, 'a clean board still costs nothing');
});
