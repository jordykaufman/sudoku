// Difficulty levels and the techniques each one adds, from the Enjoy Sudoku Android manual
// (http://www.enjoysudoku.com/android/manual.html). A level may also need the techniques of
// every easier level. The manual lists no new technique for Never Played, Learn More,
// Easiest, Easy as Pie, Super Simple and Diabolical.
export const LEVELS = [
  { id: 'never-played', name: 'Never Played', techniques: [] },
  { id: 'learn', name: 'Learn', techniques: ['full-house'] },
  { id: 'learn-more', name: 'Learn More', techniques: [] },
  { id: 'easiest', name: 'Easiest', techniques: [] },
  { id: 'easy-as-pie', name: 'Easy as Pie', techniques: [] },
  { id: 'super-simple', name: 'Super Simple', techniques: [] },
  { id: 'simple', name: 'Simple', techniques: ['hidden-single-block'] },
  { id: 'easy', name: 'Easy', techniques: ['hidden-single'] },
  { id: 'moderate', name: 'Moderate', techniques: ['locked-candidate-direct-pointing', 'naked-single'] },
  { id: 'intricate', name: 'Intricate', techniques: ['locked-candidate', 'naked-pair'] },
  {
    id: 'difficult',
    name: 'Difficult',
    techniques: ['unique-rectangle', 'bug-plus-1', 'naked-triple', 'hidden-pair', 'remote-pair', 'x-wing'],
  },
  {
    id: 'annoying',
    name: 'Annoying',
    techniques: ['finned-x-wing', 'sashimi-x-wing', 'swordfish', 'hidden-triple', 'finned-swordfish', 'sashimi-swordfish', 'w-wing'],
  },
  {
    id: 'devious',
    name: 'Devious',
    techniques: ['jellyfish', 'almost-locked-candidates', 'hidden-unique-rectangle', 'xyz-wing', 'xy-wing', 'avoidable-rectangle', 'wxyz-wing'],
  },
  {
    id: 'fiendish',
    name: 'Fiendish',
    techniques: ['naked-quad', 'simple-colors', 'hidden-quad', 'finned-jellyfish', 'sashimi-jellyfish', 'fishy-cycle', 'x-chain', 'xy-chain'],
  },
  { id: 'diabolical', name: 'Diabolical', techniques: [] },
  { id: 'nightmare', name: 'Nightmare', techniques: ['sue-de-coq', '3d-medusa', 'als-xz'] },
];

// The index in LEVELS of the level that adds each technique.
export const TECHNIQUE_LEVEL = new Map();
LEVELS.forEach((level, index) => {
  for (const id of level.techniques) TECHNIQUE_LEVEL.set(id, index);
});
