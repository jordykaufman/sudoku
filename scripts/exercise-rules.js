// What makes a position a sound exercise for a technique. scripts/examples.js keeps only
// positions that pass, and test/practice.test.js checks the stored file against the same rules.
//
// A technique's find() returns the first pattern it comes across, and the order it searches in
// depends on how the digits are named and the rows and columns arranged. So a check that asks a
// simpler technique only for its first pattern misses the others: the Naked Triple that does an
// Almost Locked Candidates exercise's job is invisible when a different Naked Triple is found
// first. The checks below go through every pattern a technique has on the board, by making each
// one on a scratch copy and asking again.

import { TECHNIQUES } from '../src/engine/techniques/index.js';
import { ORDER } from '../src/engine/techniques/order.js';

const byId = new Map(TECHNIQUES.map((technique) => [technique.id, technique]));
export const RANK = new Map(ORDER.map((id, index) => [id, index]));
const SINGLES = ['full-house', 'naked-single', 'hidden-single-block', 'hidden-single'];
const MAX_PATTERNS = 60; // per technique per position, far more than a board holds

const changes = (step) => [...step.eliminations, ...step.placements].map(([cell, digit]) => cell * 10 + digit);

// Every step `id` can take on `board`, one after another: each is made on a scratch copy before
// the next is looked for, so a technique used on its own for as long as it finds anything. That
// also catches a change the technique only reaches after an earlier step of its own, which a
// player using that simpler technique would reach the same way.
export function stepsOf(board, id) {
  const technique = byId.get(id);
  const steps = [];
  if (!technique) return steps;
  let scratch = null;
  let step = technique.find(board);
  while (step && steps.length < MAX_PATTERNS) {
    steps.push(step);
    scratch ??= board.clone();
    if (scratch.apply(step) === 0) break;
    step = technique.find(scratch);
  }
  return steps;
}

// Remembers each technique's steps on one board, for checking several exercises on it.
export function stepCache(board) {
  const cache = new Map();
  return (id) => {
    if (!cache.has(id)) cache.set(id, stepsOf(board, id));
    return cache.get(id);
  };
}

// A single easier than technique `id` that is there for the taking, or null. The single a
// single-technique exercise is about does not count, nor one that comes later in the order.
export function easierSingle(board, id) {
  const rank = RANK.get(id);
  return SINGLES.find((single) => single !== id && RANK.get(single) < rank && byId.get(single).find(board)) ?? null;
}

// A technique earlier in the solving order that makes one of the changes `step` makes, or null.
export function simplerTechnique(board, id, step, steps = stepCache(board)) {
  const wanted = new Set(changes(step));
  for (const earlier of ORDER.slice(0, RANK.get(id))) {
    if (steps(earlier).some((other) => changes(other).some((change) => wanted.has(change)))) return earlier;
  }
  return null;
}
