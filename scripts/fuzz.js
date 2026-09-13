// Solves random puzzles with the logical techniques. At every position it runs each technique,
// checks the step it returns against the puzzle's solution and checks that the technique left
// the board unchanged, then applies the first step in solving order.
//
//   node scripts/fuzz.js [--count 100] [--seed 1] [--groups fish,subsets] [--text 1] [--placed 1]
//
// --groups limits the run to singles.js plus the named technique files, so one file can be
// tested while other files are unfinished. --text 1 also checks the hint conventions
// (checkHintText in src/engine/validate.js). --placed 1 also checks the positions a player
// reaches by filling in correct digits in random order, with every candidate the placed digits
// allow. Those positions exercise Avoidable Rectangle and BUG+1 far more than solving does.

import { Board } from '../src/engine/board.js';
import { carve, randomSolution } from '../src/engine/generator.js';
import { formatGrid } from '../src/engine/grid.js';
import { mulberry32, shuffled } from '../src/engine/random.js';
import { ORDER } from '../src/engine/techniques/order.js';
import { checkHintText, checkStep } from '../src/engine/validate.js';

const ALL_GROUPS = ['singles', 'intersections', 'subsets', 'fish', 'uniqueness', 'wings', 'chains', 'advanced'];
const MAX_FAILURES = 5;

const options = { count: 100, seed: 1, groups: null, text: 0, placed: 0 };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '');
  if (!(key in options)) throw new Error(`unknown option ${args[i]}`);
  options[key] = key === 'groups' ? args[i + 1] : Number(args[i + 1]);
}

const groups = options.groups ? ['singles', ...options.groups.split(',')] : ALL_GROUPS;
const byId = new Map();
for (const group of groups) {
  const module = await import(`../src/engine/techniques/${group}.js`);
  for (const technique of module.default) byId.set(technique.id, technique);
}
const techniques = ORDER.filter((id) => byId.has(id)).map((id) => byId.get(id));
const unordered = [...byId.keys()].filter((id) => !ORDER.includes(id));
if (unordered.length) console.log(`Not in order.js, so not run: ${unordered.join(', ')}`);

const sameBoard = (a, b) =>
  a.values.every((v, i) => v === b.values[i]) && a.cands.every((m, i) => m === b.cands[i]) && a.givens.every((g, i) => g === b.givens[i]);

const checked = new Map();
const applied = new Map();
let failures = 0;

function report(id, problems, puzzle, board, step) {
  failures++;
  console.log(`\nFAIL ${id}: ${problems.join('; ')}`);
  console.log(`puzzle ${formatGrid(puzzle)}`);
  console.log(board.toCandidateGrid());
  if (step) console.log(`placements ${JSON.stringify(step.placements)} eliminations ${JSON.stringify(step.eliminations)}`);
}

// Runs every technique on a position and checks what each returns. Returns the first sound step.
function checkPosition(board, solution, puzzle) {
  let first = null;
  for (const technique of techniques) {
    const before = board.clone();
    const step = technique.find(board);
    if (!sameBoard(before, board)) {
      report(technique.id, ['find() changed the board'], puzzle, before, null);
      board.values.set(before.values);
      board.cands.set(before.cands);
      board.givens.set(before.givens);
    }
    if (!step) continue;
    checked.set(technique.id, (checked.get(technique.id) ?? 0) + 1);
    const problems = checkStep(step, solution, board);
    if (step.technique !== technique.id) problems.push(`step.technique is ${step.technique}`);
    if (options.text) problems.push(...checkHintText(step, technique));
    if (problems.length) {
      report(technique.id, problems, puzzle, board, step);
      continue;
    }
    first ??= step;
  }
  return first;
}

const rng = mulberry32(options.seed);
let unsolved = 0;
let played = 0;
const started = Date.now();

while (played < options.count && failures < MAX_FAILURES) {
  played++;
  const solution = randomSolution(rng);
  const puzzle = carve(solution, rng);
  const board = Board.fromValues(puzzle);
  while (!board.isSolved()) {
    const step = checkPosition(board, solution, puzzle);
    if (!step) {
      unsolved++;
      break;
    }
    board.apply(step);
    applied.set(step.technique, (applied.get(step.technique) ?? 0) + 1);
  }
  if (options.placed) {
    const values = puzzle.slice();
    const empty = Array.from(puzzle.keys()).filter((cell) => !puzzle[cell]);
    for (const cell of shuffled(empty, rng).slice(0, -1)) {
      values[cell] = solution[cell];
      checkPosition(Board.fromValues(values, puzzle), solution, puzzle);
    }
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n${played} puzzles in ${seconds}s. Not finished by these techniques: ${unsolved}. Failures: ${failures}.`);
console.log(`${'technique'.padEnd(34)}${'checked'.padStart(9)}${'applied'.padStart(9)}`);
for (const technique of techniques) {
  const id = technique.id;
  console.log(`${id.padEnd(34)}${String(checked.get(id) ?? 0).padStart(9)}${String(applied.get(id) ?? 0).padStart(9)}`);
}
process.exit(failures ? 1 : 0);
