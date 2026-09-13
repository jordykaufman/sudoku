// Builds the puzzle bank, data/puzzles.json, and the examples for the Learn screen,
// data/examples.json.
//
//   node scripts/bank.js [--per-level 365] [--seed 1] [--minutes 30] [--examples 3]
//
// The levels that need only Full House are carved with that condition. For the other levels,
// puzzles are carved and rated until every level has --per-level puzzles or the time runs out.
//
// An example for a technique is a position where the technique is the next step. Some
// techniques are rarely the next step (a naked quad in a house usually shows up first as an
// easier hidden subset), so a technique with too few such positions also gets positions from
// hard puzzles where it applies but an easier technique applies too.

import { mkdirSync, writeFileSync } from 'node:fs';
import { carve, randomSolution } from '../src/engine/generator.js';
import { formatGrid } from '../src/engine/grid.js';
import { LEVELS, TECHNIQUE_LEVEL } from '../src/engine/levels.js';
import { mulberry32 } from '../src/engine/random.js';
import { EMPTY_CELLS, carveFor, rate } from '../src/engine/rating.js';
import { TECHNIQUES } from '../src/engine/techniques/index.js';
import { ORDER } from '../src/engine/techniques/order.js';

const options = { 'per-level': 365, seed: 1, minutes: 30, examples: 3 };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '');
  if (!(key in options)) throw new Error(`unknown option ${args[i]}`);
  options[key] = Number(args[i + 1]);
}
const perLevel = options['per-level'];
const DIFFICULT = LEVELS.findIndex((level) => level.id === 'difficult');

const rng = mulberry32(options.seed);
const bank = LEVELS.map(() => new Set());
const started = Date.now();
const seconds = () => Math.round((Date.now() - started) / 1000);

const encode = (board) => ({
  values: formatGrid(board.values),
  cands: Array.from(board.cands, (mask) => mask.toString(36).padStart(2, '0')).join(''),
  givens: Array.from(board.givens).join(''),
});

const nextStepExamples = Object.fromEntries(ORDER.map((id) => [id, []]));
const otherExamples = Object.fromEntries(ORDER.map((id) => [id, []]));
const exampleCount = (id) => nextStepExamples[id].length + otherExamples[id].length;

function keepExamples(step, board) {
  if (nextStepExamples[step.technique].length < options.examples) nextStepExamples[step.technique].push(encode(board));
  if (TECHNIQUE_LEVEL.get(step.technique) < DIFFICULT) return;
  for (const technique of TECHNIQUES) {
    if (technique.id === step.technique || exampleCount(technique.id) >= options.examples) continue;
    if (technique.find(board)) otherExamples[technique.id].push(encode(board));
  }
}

// The levels that need only Full House.
LEVELS.forEach((level, index) => {
  if (!EMPTY_CELLS[level.id]) return;
  while (bank[index].size < perLevel) {
    const puzzle = carveFor(index, randomSolution(rng), rng);
    if (rate(puzzle, keepExamples) === index) bank[index].add(formatGrid(puzzle));
  }
});

// Every other level.
const counts = () => LEVELS.map((level, index) => `${level.name} ${bank[index].size}`).join(', ');
let carved = 0;
let unsolved = 0;
let lastReport = Date.now();
while (bank.some((set) => set.size < perLevel) && Date.now() - started < options.minutes * 60000) {
  const puzzle = carve(randomSolution(rng), rng);
  carved++;
  const level = rate(puzzle, keepExamples);
  if (level < 0) unsolved++;
  else if (bank[level].size < perLevel) bank[level].add(formatGrid(puzzle));
  if (Date.now() - lastReport > 30000) {
    lastReport = Date.now();
    console.log(`${seconds()}s, ${carved} carved: ${counts()}`);
  }
}

mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
const levels = Object.fromEntries(LEVELS.map((level, index) => [level.id, [...bank[index]]]));
const examples = Object.fromEntries(ORDER.map((id) => [id, [...nextStepExamples[id], ...otherExamples[id]].slice(0, options.examples)]));
writeFileSync(new URL('../data/puzzles.json', import.meta.url), `${JSON.stringify({ levels }, null, 1)}\n`);
writeFileSync(new URL('../data/examples.json', import.meta.url), `${JSON.stringify(examples)}\n`);

console.log(`\nDone in ${seconds()}s. Carved ${carved} puzzles for the levels above Super Simple; the techniques could not solve ${unsolved}.`);
LEVELS.forEach((level, index) => console.log(`  ${level.name.padEnd(14)}${String(bank[index].size).padStart(5)}`));
const borrowed = ORDER.filter((id) => nextStepExamples[id].length < options.examples && otherExamples[id].length);
const short = ORDER.filter((id) => exampleCount(id) < options.examples);
if (borrowed.length) console.log(`Examples where the technique is not the next step: ${borrowed.join(', ')}`);
console.log(short.length ? `Fewer than ${options.examples} examples: ${short.map((id) => `${id} (${exampleCount(id)})`).join(', ')}` : 'Every technique has examples.');
