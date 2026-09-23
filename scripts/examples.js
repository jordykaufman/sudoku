// Builds data/examples.json, the positions the Learn and Practice screens use.
//
//   node scripts/examples.js [--count 30] [--minutes 20] [--seed 1] [--workers 1] [--out file]
//
// --workers N mines on N processor cores at once, each with its own seed, and merges what they
// find; the sound positions of the rarer techniques are scarce enough for that to matter.
//
// Boards are generated only to be mined and are then thrown away, so the puzzle bank has
// nothing to do with this and the number of positions is limited only by build time. An
// example is a position on a solve path where the technique applies. An easier move may apply
// somewhere else on the board: Practice names the technique you are looking for, so that does
// not matter, and insisting on it made the rarer techniques almost impossible to find.
//
// Two kinds of position make a poor exercise and are left out, even when that leaves a
// technique short of --count. The rules are in scripts/exercise-rules.js, which the tests check
// the stored file against: no single easier than the technique may be there for the taking,
// which is a distraction from looking for something harder, and no technique earlier in the
// solving order may make one of the same changes, which would have the player work out the hard
// way what a simpler move does. That check goes through every pattern the simpler technique
// has, not just the first one it finds.
//
// At most one position per board per technique, so that the examples of a technique come from
// as many different boards as possible. A position where the technique is the next step passes
// both rules by definition, since nothing easier applies anywhere on the board; where a board
// offers one, that is the one kept, and Learn shows those first.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Board } from '../src/engine/board.js';
import { carve, randomSolution } from '../src/engine/generator.js';
import { formatGrid } from '../src/engine/grid.js';
import { logicalSolve } from '../src/engine/logic.js';
import { mulberry32 } from '../src/engine/random.js';
import { TECHNIQUES } from '../src/engine/techniques/index.js';
import { ORDER } from '../src/engine/techniques/order.js';
import { easierSingle, simplerTechnique, stepCache } from './exercise-rules.js';

const options = { count: 30, minutes: 20, seed: 1, workers: 1, out: null };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '');
  if (!(key in options)) throw new Error(`unknown option ${args[i]}`);
  options[key] = key === 'out' ? args[i + 1] : Number(args[i + 1]);
}
const out = options.out ?? new URL('../data/examples.json', import.meta.url);
const keyOf = (example) => example.values + example.cands;

if (options.workers > 1) {
  // Run the workers side by side, then keep up to --count positions per technique from what they
  // found between them, next-step positions first.
  const dir = mkdtempSync(join(tmpdir(), 'examples-'));
  const script = fileURLToPath(import.meta.url);
  const parts = Array.from({ length: options.workers }, (_, i) => join(dir, `part-${i + 1}.json`));
  const children = parts.map((part, i) =>
    spawnAsync(process.execPath, [script, '--count', options.count, '--minutes', options.minutes, '--seed', options.seed * 1000 + i + 1, '--out', part]),
  );
  await Promise.all(children);
  const merged = {};
  for (const part of parts) {
    for (const [id, list] of Object.entries(JSON.parse(readFileSync(part, 'utf8')))) (merged[id] ??= []).push(...list);
  }
  rmSync(dir, { recursive: true, force: true });
  const examples = Object.fromEntries(
    ORDER.map((id) => {
      const unique = [...new Map((merged[id] ?? []).map((example) => [keyOf(example), example])).values()];
      unique.sort((a, b) => (b.next ? 1 : 0) - (a.next ? 1 : 0));
      return [id, unique.slice(0, options.count)];
    }),
  );
  writeFileSync(out, `${JSON.stringify(examples)}\n`);
  report(examples, `${options.workers} workers`);
  process.exit(0);
}

function spawnAsync(command, args) {
  return import('node:child_process').then(
    ({ spawn }) =>
      new Promise((resolve, reject) => {
        const child = spawn(command, args.map(String), { stdio: ['ignore', 'inherit', 'inherit'] });
        child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`worker exited with ${code}`))));
      }),
  );
}

function report(examples, how) {
  console.log(`\nDone (${how}).`);
  for (const id of ORDER) {
    const list = examples[id] ?? [];
    const next = list.filter((example) => example.next).length;
    const notes = [next ? `${next} where nothing easier applies` : '', list.length < options.count ? `short of ${options.count}` : ''].filter(Boolean);
    console.log(`  ${id.padEnd(34)}${String(list.length).padStart(3)}${notes.length ? `  (${notes.join(', ')})` : ''}`);
  }
}

const byId = new Map(TECHNIQUES.map((technique) => [technique.id, technique]));
const found = Object.fromEntries(ORDER.map((id) => [id, []]));
const seen = new Set(); // positions already kept, so no two examples are the same board state
const short = () => ORDER.filter((id) => found[id].length < options.count && byId.has(id));

const encode = (board, next) => ({
  values: formatGrid(board.values),
  cands: Array.from(board.cands, (mask) => mask.toString(36).padStart(2, '0')).join(''),
  givens: Array.from(board.givens).join(''),
  ...(next ? { next: 1 } : {}),
});

const rng = mulberry32(options.seed);
const started = Date.now();
let boards = 0;
let positions = 0;

while (short().length && Date.now() - started < options.minutes * 60000) {
  const puzzle = carve(randomSolution(rng), rng);
  const picks = new Map(); // technique id -> { next, clean }: the best sound position this board offers
  const wanted = short();
  logicalSolve(Board.fromValues(puzzle), {
    onStep: (step, board) => {
      positions++;
      const steps = stepCache(board); // each simpler technique's steps here, worked out only if asked for
      for (const id of wanted) {
        if (found[id].length >= options.count) continue;
        if (!picks.has(id)) picks.set(id, {});
        const pick = picks.get(id);
        if (pick.next) continue;
        if (id === step.technique) {
          pick.next = encode(board, true);
          continue;
        }
        if (pick.clean) continue;
        const target = byId.get(id).find(board);
        if (!target || easierSingle(board, id) || simplerTechnique(board, id, target, steps)) continue;
        pick.clean = encode(board, false);
      }
    },
  });
  for (const [id, pick] of picks) {
    const example = pick.next ?? pick.clean;
    if (!example || found[id].length >= options.count) continue; // nothing sound for it on this board
    const key = keyOf(example);
    if (seen.has(key)) continue;
    seen.add(key);
    found[id].push(example);
  }
  boards++;
  if (boards % 200 === 0) {
    const left = short();
    console.log(`${Math.round((Date.now() - started) / 1000)}s, ${boards} boards: ${left.length} techniques short${left.length && left.length < 8 ? ` (${left.map((id) => `${id} ${found[id].length}`).join(', ')})` : ''}`);
  }
}

// No technique is topped up with positions that failed the rules: a flawed exercise is worse
// than one fewer, and the tests check every stored position against the same rules.
const examples = Object.fromEntries(ORDER.map((id) => [id, found[id]]));
writeFileSync(out, `${JSON.stringify(examples)}\n`);
report(examples, `${Math.round((Date.now() - started) / 1000)}s, seed ${options.seed}: ${boards} boards mined, ${positions} positions examined`);
