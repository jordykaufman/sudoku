// Builds data/examples.json, the positions the Learn and Practice screens use.
//
//   node scripts/examples.js [--count 30] [--minutes 20] [--seed 1]
//
// Boards are generated only to be mined and are then thrown away, so the puzzle bank has
// nothing to do with this and the number of positions is limited only by build time. An
// example is a position on a solve path where the technique applies. An easier move may apply
// there too: Practice names the technique you are looking for, so that does not matter, and
// insisting on it made the rarer techniques almost impossible to find. Positions where the
// technique is the next step anyway are marked, and both screens show those first.
//
// At most one position per board per technique, so that the examples of a technique come from
// as many different boards as possible. Where a board offers both, the position where the
// technique is the next step is the one kept, and Learn shows those first.

import { writeFileSync } from 'node:fs';
import { Board } from '../src/engine/board.js';
import { carve, randomSolution } from '../src/engine/generator.js';
import { formatGrid } from '../src/engine/grid.js';
import { logicalSolve } from '../src/engine/logic.js';
import { mulberry32 } from '../src/engine/random.js';
import { TECHNIQUES } from '../src/engine/techniques/index.js';
import { ORDER } from '../src/engine/techniques/order.js';

const options = { count: 30, minutes: 20, seed: 1 };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '');
  if (!(key in options)) throw new Error(`unknown option ${args[i]}`);
  options[key] = Number(args[i + 1]);
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
  const picks = new Map(); // technique id -> { next, any }: the best position this board offers
  const wanted = short();
  logicalSolve(Board.fromValues(puzzle), {
    onStep: (step, board) => {
      positions++;
      for (const id of wanted) {
        if (found[id].length >= options.count) continue;
        if (!picks.has(id)) picks.set(id, {});
        const pick = picks.get(id);
        if (pick.next) continue;
        if (id === step.technique) pick.next = encode(board, true);
        else if (!pick.any && byId.get(id).find(board)) pick.any = encode(board, false);
      }
    },
  });
  for (const [id, pick] of picks) {
    const example = pick.next ?? pick.any;
    if (!example || found[id].length >= options.count) continue;
    const key = example.values + example.cands;
    if (seen.has(key)) continue;
    seen.add(key);
    found[id].push(example);
  }
  boards++;
  if (boards % 200 === 0) {
    const left = short();
    console.log(`${Math.round((Date.now() - started) / 1000)}s, ${boards} boards: ${left.length} techniques short${left.length && left.length < 6 ? ` (${left.join(', ')})` : ''}`);
  }
}

const examples = Object.fromEntries(ORDER.map((id) => [id, found[id]]));
writeFileSync(new URL('../data/examples.json', import.meta.url), `${JSON.stringify(examples)}\n`);

console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s: ${boards} boards mined, ${positions} positions examined.`);
for (const id of ORDER) {
  const list = found[id];
  const next = list.filter((example) => example.next).length;
  console.log(`  ${id.padEnd(34)}${String(list.length).padStart(3)}${next ? `  (${next} where nothing easier applies)` : ''}`);
}
