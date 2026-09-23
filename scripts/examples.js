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
// as many different boards as possible. A position with a single going begging is a poor place
// to practise something harder, so positions where a Full House, a Naked Single or a Hidden
// Single is there for the taking are set aside and used only to fill a technique that would
// otherwise fall short. Of what is left, the position where the technique is the next step is
// the one kept, and Learn shows those first.

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
const SINGLES = ['full-house', 'naked-single', 'hidden-single-block', 'hidden-single'].map((id) => byId.get(id)).filter(Boolean);
const found = Object.fromEntries(ORDER.map((id) => [id, []]));
const reserve = Object.fromEntries(ORDER.map((id) => [id, []])); // positions with a single going begging
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
  const picks = new Map(); // technique id -> { next, clean, spare }: the best this board offers
  const wanted = short();
  logicalSolve(Board.fromValues(puzzle), {
    onStep: (step, board) => {
      positions++;
      let single = null; // worked out once per position, and only if a technique wants it
      for (const id of wanted) {
        if (found[id].length >= options.count) continue;
        if (!picks.has(id)) picks.set(id, {});
        const pick = picks.get(id);
        if (pick.next) continue;
        // The next step is never a position with a single going begging: an easier technique
        // would have been taken first.
        if (id === step.technique) {
          pick.next = encode(board, true);
          continue;
        }
        if (pick.clean) continue;
        if (!byId.get(id).find(board)) continue;
        if (single === null) single = SINGLES.some((technique) => technique.find(board));
        if (!single) pick.clean = encode(board, false);
        else if (!pick.spare) pick.spare = encode(board, false);
      }
    },
  });
  for (const [id, pick] of picks) {
    const good = pick.next ?? pick.clean;
    const chosen = good ?? pick.spare;
    if (!chosen) continue; // this board had nothing for that technique
    const key = chosen.values + chosen.cands;
    if (seen.has(key)) continue;
    const list = good ? found[id] : reserve[id];
    if (list.length >= options.count) continue;
    list.push(chosen);
    seen.add(key);
  }
  boards++;
  if (boards % 200 === 0) {
    const left = short();
    console.log(`${Math.round((Date.now() - started) / 1000)}s, ${boards} boards: ${left.length} techniques short${left.length && left.length < 6 ? ` (${left.join(', ')})` : ''}`);
  }
}

// A technique that could not fill up on clean positions takes what it can from the reserve.
const borrowed = {};
for (const id of ORDER) {
  const take = reserve[id].splice(0, Math.max(0, options.count - found[id].length));
  if (take.length) borrowed[id] = take.length;
  found[id].push(...take);
}

const examples = Object.fromEntries(ORDER.map((id) => [id, found[id]]));
writeFileSync(new URL('../data/examples.json', import.meta.url), `${JSON.stringify(examples)}\n`);

console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s: ${boards} boards mined, ${positions} positions examined.`);
for (const id of ORDER) {
  const list = found[id];
  const next = list.filter((example) => example.next).length;
  const notes = [next ? `${next} where nothing easier applies` : '', borrowed[id] ? `${borrowed[id]} with a single going begging` : ''].filter(Boolean);
  console.log(`  ${id.padEnd(34)}${String(list.length).padStart(3)}${notes.length ? `  (${notes.join(', ')})` : ''}`);
}
