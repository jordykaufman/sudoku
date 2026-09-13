import { Board } from './board.js';
import { carve, randomSolution } from './generator.js';
import { LEVELS, TECHNIQUE_LEVEL } from './levels.js';
import { logicalSolve } from './logic.js';
import { techniqueById } from './techniques/index.js';

const levelIndex = (id) => LEVELS.findIndex((level) => level.id === id);
const LEARN = levelIndex('learn');
const FIENDISH = levelIndex('fiendish');
const DIABOLICAL = levelIndex('diabolical');

// The Enjoy Sudoku manual lists no new technique for six levels. The rules for them are this
// app's own.
//
// Never Played to Super Simple need only Full House, so they differ by the number of empty
// cells. Puzzles that Full House alone can solve have few empty cells: in 350 generated
// puzzles, carving with that condition stopped at 21 empty cells every time.
export const EMPTY_CELLS = {
  'never-played': [4, 6],
  learn: [7, 10],
  'learn-more': [11, 13],
  easiest: [14, 16],
  'easy-as-pie': [17, 19],
  'super-simple': [20, 21],
};

// Diabolical needs the same techniques as Fiendish, more often: at least this many steps that
// use a Fiendish technique. In a survey of 1000 generated puzzles (scripts/survey.js), 18 needed
// Fiendish techniques: 13 used them in one step and 5 in two or more.
export const DIABOLICAL_STEPS = 2;

const fullHouse = techniqueById('full-house');

export function solvableByFullHouse(puzzle) {
  const board = Board.fromValues(puzzle);
  while (!board.isSolved()) {
    const step = fullHouse.find(board);
    if (!step) return false;
    board.apply(step);
  }
  return true;
}

// The level of a solved puzzle from the steps that solved it, as an index in LEVELS, or -1
// when it fits no level.
export function levelOf(puzzle, steps) {
  let hardest = 0;
  let fiendishSteps = 0;
  for (const step of steps) {
    const level = TECHNIQUE_LEVEL.get(step.technique);
    hardest = Math.max(hardest, level);
    if (level === FIENDISH) fiendishSteps++;
  }
  if (hardest <= LEARN) {
    const empty = puzzle.filter((v) => v === 0).length;
    return LEVELS.findIndex(({ id }) => EMPTY_CELLS[id] && empty >= EMPTY_CELLS[id][0] && empty <= EMPTY_CELLS[id][1]);
  }
  if (hardest === FIENDISH && fiendishSteps >= DIABOLICAL_STEPS) return DIABOLICAL;
  return hardest;
}

// The level of a puzzle, or -1 when the techniques can't solve it or it fits no level.
// `onStep(step, board)` is passed on to logicalSolve.
export function rate(puzzle, onStep = null) {
  const { steps, solved } = logicalSolve(Board.fromValues(puzzle), { onStep });
  return solved ? levelOf(puzzle, steps) : -1;
}

// Carves a puzzle from `solution` for `level`. Levels that need only Full House keep that
// condition and stop at their largest number of empty cells. Other levels use plain carving,
// which reaches each of them often enough: in the survey above the rarest, Diabolical, came
// from 5 of 1000 puzzles.
export function carveFor(level, solution, rng) {
  const range = EMPTY_CELLS[LEVELS[level].id];
  return range ? carve(solution, rng, { keep: solvableByFullHouse, maxEmpty: range[1] }) : carve(solution, rng);
}

// Makes a puzzle at `level`, trying up to `attempts` complete grids. Returns
// { puzzle, solution } as digit arrays, or null.
export function makePuzzleAt(level, rng, attempts = 200) {
  for (let i = 0; i < attempts; i++) {
    const solution = randomSolution(rng);
    const puzzle = carveFor(level, solution, rng);
    if (rate(puzzle) === level) return { puzzle, solution };
  }
  return null;
}
