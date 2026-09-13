// Solves random minimal puzzles and reports how often each level and technique comes up.
// Used to set the level rules in src/engine/rating.js.
//
//   node scripts/survey.js [--count 1000] [--seed 1]

import { Board } from '../src/engine/board.js';
import { carve, randomSolution } from '../src/engine/generator.js';
import { LEVELS, TECHNIQUE_LEVEL } from '../src/engine/levels.js';
import { logicalSolve } from '../src/engine/logic.js';
import { mulberry32 } from '../src/engine/random.js';
import { levelOf } from '../src/engine/rating.js';
import { ORDER } from '../src/engine/techniques/order.js';

const options = { count: 1000, seed: 1 };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) options[args[i].replace(/^--/, '')] = Number(args[i + 1]);

const FIENDISH = LEVELS.findIndex((level) => level.id === 'fiendish');
const rng = mulberry32(options.seed);
const levelCounts = new Array(LEVELS.length).fill(0);
const puzzlesUsing = {};
const fiendishSteps = new Map(); // steps with a Fiendish technique -> puzzles, for puzzles whose hardest technique is Fiendish
let unsolved = 0;
let noLevel = 0;
let solveMs = 0;
let slowest = 0;

for (let n = 0; n < options.count; n++) {
  const puzzle = carve(randomSolution(rng), rng);
  const started = performance.now();
  const { steps, solved } = logicalSolve(Board.fromValues(puzzle));
  const ms = performance.now() - started;
  solveMs += ms;
  slowest = Math.max(slowest, ms);
  if (!solved) {
    unsolved++;
    continue;
  }
  const level = levelOf(puzzle, steps);
  if (level < 0) noLevel++;
  else levelCounts[level]++;
  const levels = steps.map((step) => TECHNIQUE_LEVEL.get(step.technique));
  for (const id of new Set(steps.map((step) => step.technique))) puzzlesUsing[id] = (puzzlesUsing[id] ?? 0) + 1;
  if (Math.max(...levels) === FIENDISH) {
    const count = levels.filter((l) => l === FIENDISH).length;
    fiendishSteps.set(count, (fiendishSteps.get(count) ?? 0) + 1);
  }
}

const percent = (count) => `${((100 * count) / options.count).toFixed(1)}%`;
console.log(`${options.count} puzzles. Solving took ${(solveMs / options.count).toFixed(1)} ms on average, ${slowest.toFixed(0)} ms at most.`);
console.log(`Not solved by the techniques: ${unsolved} (${percent(unsolved)}). Solved but fitting no level: ${noLevel}.\n`);
console.log('Level');
LEVELS.forEach((level, index) => {
  if (levelCounts[index]) console.log(`  ${level.name.padEnd(14)}${String(levelCounts[index]).padStart(6)}  ${percent(levelCounts[index])}`);
});
console.log('\nPuzzles using each technique');
for (const id of ORDER) console.log(`  ${id.padEnd(34)}${String(puzzlesUsing[id] ?? 0).padStart(6)}`);
console.log('\nPuzzles whose hardest technique is Fiendish, by the number of steps that use a Fiendish technique');
for (const [count, puzzles] of [...fiendishSteps].sort((a, b) => a[0] - b[0])) console.log(`  ${String(count).padStart(3)}: ${puzzles}`);
