import { TECHNIQUES } from './techniques/index.js';

// The first step found by the techniques, tried in solving order.
export function nextStep(board, techniques = TECHNIQUES) {
  for (const technique of techniques) {
    const step = technique.find(board);
    if (step) return step;
  }
  return null;
}

// Applies steps until the board is solved or no technique makes progress. `onStep(step,
// board)` is called with the board as it was before the step; clone it to keep it.
export function logicalSolve(board, { techniques = TECHNIQUES, onStep = null, maxSteps = 1000 } = {}) {
  const work = board.clone();
  const steps = [];
  while (!work.isSolved() && steps.length < maxSteps) {
    const step = nextStep(work, techniques);
    if (!step) break;
    if (onStep) onStep(step, work);
    if (work.apply(step) === 0) throw new Error(`${step.technique} returned a step that changes nothing`);
    steps.push(step);
  }
  return { steps, solved: work.isSolved(), board: work };
}
