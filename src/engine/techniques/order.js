// The order the solver tries techniques in, simplest first. A hint always describes the
// first technique in this order that makes progress, and grading counts the hardest level
// used, so a technique must never come before one from an easier level.
export const ORDER = [
  // Learn, Simple, Easy
  'full-house',
  'hidden-single-block',
  'hidden-single',
  // Moderate
  'locked-candidate-direct-pointing',
  'naked-single',
  // Intricate
  'locked-candidate',
  'naked-pair',
  // Difficult
  'hidden-pair',
  'naked-triple',
  'x-wing',
  'remote-pair',
  'unique-rectangle',
  'bug-plus-1',
  // Annoying
  'hidden-triple',
  'swordfish',
  'finned-x-wing',
  'sashimi-x-wing',
  'w-wing',
  'finned-swordfish',
  'sashimi-swordfish',
  // Devious
  'xy-wing',
  'xyz-wing',
  'jellyfish',
  'almost-locked-candidates',
  'hidden-unique-rectangle',
  'avoidable-rectangle',
  'wxyz-wing',
  // Fiendish. Fishy Cycle comes before X-Chain: with X-Chain first, fuzz runs never used Fishy
  // Cycle, because the rest of a loop is an X-Chain between the two cells of a weak link.
  'naked-quad',
  'hidden-quad',
  'simple-colors',
  'fishy-cycle',
  'x-chain',
  'xy-chain',
  'finned-jellyfish',
  'sashimi-jellyfish',
  // Nightmare
  'sue-de-coq',
  'als-xz',
  '3d-medusa',
];
