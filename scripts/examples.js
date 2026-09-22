// Builds data/examples.json, the worked examples the Learn and Practice screens use.
//
//   node scripts/examples.js [--count 12] [--minutes 10] [--seed 1]
//
// Positions come from the puzzles already in data/puzzles.json, so the puzzle bank does not
// change. An example is a position where the technique is the next step the solver takes,
// which means no easier technique applies there. Some techniques are rarely the next step (a
// naked quad usually shows up as a hidden subset first), so a technique still short of --count
// also takes positions where it applies although an easier technique applies too. Those are
// left unmarked, and Practice uses only the marked ones.

import { readFileSync, writeFileSync } from 'node:fs';
import { formatGrid, parseGrid } from '../src/engine/grid.js';
import { LEVELS, TECHNIQUE_LEVEL } from '../src/engine/levels.js';
import { mulberry32 } from '../src/engine/random.js';
import { rate } from '../src/engine/rating.js';
import { TECHNIQUES } from '../src/engine/techniques/index.js';
import { ORDER } from '../src/engine/techniques/order.js';

const options = { count: 12, minutes: 10, seed: 1 };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '');
  if (!(key in options)) throw new Error(`unknown option ${args[i]}`);
  options[key] = Number(args[i + 1]);
}

const DIFFICULT = LEVELS.findIndex((level) => level.id === 'difficult');
const encode = (board, next) => ({
  values: formatGrid(board.values),
  cands: Array.from(board.cands, (mask) => mask.toString(36).padStart(2, '0')).join(''),
  givens: Array.from(board.givens).join(''),
  ...(next ? { next: 1 } : {}),
});

const found = Object.fromEntries(ORDER.map((id) => [id, { next: [], other: [] }]));
const total = (id) => found[id].next.length + found[id].other.length;
// Positions where the technique is the next step are the ones Practice can use, so the hunt
// goes on while any technique is short of them, even when borrowed positions have filled it up.
const short = () => ORDER.filter((id) => found[id].next.length < options.count);

function keep(step, board) {
  const store = found[step.technique];
  if (store && store.next.length < options.count) store.next.push(encode(board, true));
  // A position with a hard step is also a good hunting ground for the rarer techniques.
  if (TECHNIQUE_LEVEL.get(step.technique) < DIFFICULT) return;
  for (const technique of TECHNIQUES) {
    if (technique.id === step.technique || total(technique.id) >= options.count) continue;
    if (technique.find(board)) found[technique.id].other.push(encode(board, false));
  }
}

const bank = JSON.parse(readFileSync(new URL('../data/puzzles.json', import.meta.url), 'utf8'));
const puzzles = Object.values(bank.levels).flat();
// A spread of levels, in a fixed order, so the same run gives the same examples.
const rng = mulberry32(options.seed);
for (let i = puzzles.length - 1; i > 0; i--) {
  const j = Math.floor(rng() * (i + 1));
  [puzzles[i], puzzles[j]] = [puzzles[j], puzzles[i]];
}

const started = Date.now();
let used = 0;
for (const puzzle of puzzles) {
  if (!short().length || Date.now() - started > options.minutes * 60000) break;
  rate(parseGrid(puzzle), keep);
  used++;
  if (used % 500 === 0) console.log(`${Math.round((Date.now() - started) / 1000)}s, ${used} puzzles: ${short().length} techniques short of next-step examples`);
}

const examples = Object.fromEntries(ORDER.map((id) => [id, [...found[id].next, ...found[id].other].slice(0, options.count)]));
writeFileSync(new URL('../data/examples.json', import.meta.url), `${JSON.stringify(examples)}\n`);

console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s from ${used} puzzles.`);
for (const id of ORDER) {
  const { next, other } = found[id];
  const borrowed = Math.max(0, Math.min(total(id), options.count) - next.length);
  const note = borrowed ? `  (${borrowed} where an easier technique also applies)` : '';
  console.log(`  ${id.padEnd(34)}${String(Math.min(total(id), options.count)).padStart(3)}${note}`);
}
