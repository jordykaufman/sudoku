import { cellName } from './text.js';

// Checks a step against the puzzle's solution and the board it was found on.
// Returns a list of problems; an empty list means the step is sound.
export function checkStep(step, solution, board) {
  const problems = [];
  const placements = step.placements ?? [];
  const eliminations = step.eliminations ?? [];
  if (!placements.length && !eliminations.length) problems.push('the step places and removes nothing');
  for (const [cell, digit] of placements) {
    if (solution[cell] !== digit) problems.push(`places ${digit} in ${cellName(cell)} but the solution has ${solution[cell]}`);
    if (board.values[cell]) problems.push(`places a digit in ${cellName(cell)}, which is already filled`);
    else if (!board.has(cell, digit)) problems.push(`places ${digit} in ${cellName(cell)}, which is not a candidate there`);
  }
  for (const [cell, digit] of eliminations) {
    if (solution[cell] === digit) problems.push(`removes ${digit} from ${cellName(cell)} but that is the solution digit`);
    if (!board.has(cell, digit)) problems.push(`removes ${digit} from ${cellName(cell)}, which is not a candidate there`);
  }
  if (new Set(eliminations.map(([cell, digit]) => cell * 10 + digit)).size !== eliminations.length) {
    problems.push('lists the same elimination twice');
  }
  if (!Array.isArray(step.stages) || step.stages.length < 2) problems.push('needs at least two hint stages');
  else if (step.stages.some((stage) => typeof stage.text !== 'string' || !stage.text.trim())) {
    problems.push('has a hint stage without text');
  }
  return problems;
}

const CELL_ROLES = new Set(['key', 'target', 'fin', 'a', 'b']);
const MARK_ROLES = new Set(['key', 'elim', 'place', 'fin', 'a', 'b']);
const isInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

// Checks the hint conventions in docs/techniques.md: the first stage does not name the
// technique, the last stage names every cell the step changes, and every highlight has the
// right shape. Returns a list of problems.
export function checkHintText(step, technique) {
  const problems = [];
  const stages = step.stages ?? [];
  if (!stages.length) return problems;
  if (technique?.name && stages[0].text.includes(technique.name)) problems.push('the first stage names the technique');
  const last = stages.at(-1).text;
  const changed = new Set([...(step.placements ?? []), ...(step.eliminations ?? [])].map(([cell]) => cell));
  const unnamed = [...changed].filter((cell) => !new RegExp(`\\b${cellName(cell)}\\b`).test(last));
  if (unnamed.length) problems.push(`the last stage does not name ${unnamed.map(cellName).join(', ')}`);
  stages.forEach((stage, i) => {
    const bad = (what) => problems.push(`stage ${i + 1} has a bad ${what}`);
    if (stage.digit !== undefined && !isInt(stage.digit, 1, 9)) bad('digit');
    for (const house of stage.houses ?? []) if (!isInt(house, 0, 26)) bad('house');
    for (const [cell, role] of stage.cells ?? []) if (!isInt(cell, 0, 80) || !CELL_ROLES.has(role)) bad('cell highlight');
    for (const [cell, digit, role] of stage.marks ?? []) {
      if (!isInt(cell, 0, 80) || !isInt(digit, 1, 9) || !MARK_ROLES.has(role)) bad('mark highlight');
    }
    for (const link of stage.links ?? []) {
      const [cellA, digitA, cellB, digitB, strong] = link;
      if (link.length !== 5 || !isInt(cellA, 0, 80) || !isInt(cellB, 0, 80) || !isInt(digitA, 1, 9) || !isInt(digitB, 1, 9) || typeof strong !== 'boolean') {
        bad('link');
      }
    }
  });
  return problems;
}
