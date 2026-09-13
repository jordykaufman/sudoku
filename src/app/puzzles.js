import { formatGrid, parseGrid } from '../engine/grid.js';
import { LEVELS } from '../engine/levels.js';
import { hashString, mulberry32, randomSeed } from '../engine/random.js';
import { makePuzzleAt } from '../engine/rating.js';
import { solve } from '../engine/solver.js';
import { load, save } from './storage.js';

// Today's date in the player's time zone, as YYYY-MM-DD.
export function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Days since 1970-01-01 for a YYYY-MM-DD date.
const dayNumber = (date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);

// The puzzle bank, data/puzzles.json, made by scripts/bank.js: { levels: { [level id]: [puzzle] } }.
let bank = null;

async function loadBank() {
  if (bank) return bank;
  try {
    const response = await fetch('data/puzzles.json');
    if (response.ok) bank = await response.json();
  } catch {
    // No bank: puzzles are generated instead.
  }
  return bank;
}

// A puzzle for a level, as { puzzle, solution, level } with 81-character texts. Daily puzzles
// step through a level's list one per day, each level starting at a different place. Random
// puzzles are ones not yet played at that level; once every puzzle has been played, all of them
// become available again.
export async function getPuzzle({ level, kind, date }) {
  const id = LEVELS[level].id;
  const list = (await loadBank())?.levels?.[id];
  if (!list?.length) return generate({ level, kind, date });
  let index;
  if (kind === 'daily') {
    index = (dayNumber(date) + hashString(id)) % list.length;
  } else {
    const played = new Set(load(`played-${id}`, []));
    let open = list.map((_, i) => i).filter((i) => !played.has(i));
    if (!open.length) {
      played.clear();
      open = list.map((_, i) => i);
    }
    index = open[Math.floor(Math.random() * open.length)];
    played.add(index);
    save(`played-${id}`, [...played]);
  }
  const { solution } = solve(parseGrid(list[index]), { limit: 1 });
  return { puzzle: list[index], solution: formatGrid(solution), level };
}

// Used when there is no bank.
async function generate({ level, kind, date }) {
  // Wait a moment so that the "Getting a puzzle" message is drawn before the work starts.
  await new Promise((resolve) => setTimeout(resolve, 30));
  const rng = mulberry32(kind === 'daily' ? hashString(`${date} ${level}`) : randomSeed());
  const made = makePuzzleAt(level, rng);
  return made && { puzzle: formatGrid(made.puzzle), solution: formatGrid(made.solution), level };
}
