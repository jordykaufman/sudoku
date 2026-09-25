import { Board } from './board.js';
import { BOX, DIGITS, PEERS, POPCOUNT, bit } from './grid.js';
import { TECHNIQUE_LEVEL } from './levels.js';
import { logicalSolve, nextStep } from './logic.js';
import { TECHNIQUES } from './techniques/index.js';
import { cellList, cellName, houseName, plural, removalText } from './text.js';

// Seconds added to the game clock for a hint, by the index of the level of the technique
// the hint describes. The Enjoy Sudoku manuals say harder techniques add more time; these
// numbers are this app's own.
export const HINT_PENALTY_SECONDS = [5, 5, 5, 5, 5, 5, 10, 10, 15, 20, 30, 45, 60, 90, 90, 120];

// What a hint says about the player's position.
//
//   values    placed digits, both clues and the player's entries (0 = empty)
//   givens    1 for each clue
//   solution  the puzzle's solution
//   marks     the pencil marks the player can see, as a candidate mask per cell. A cell
//             without marks (0) counts as having every candidate the placed digits allow.
//
// Returns one of:
//   { kind: 'solved' }
//   { kind: 'mistake', cell, stages }  a placed digit is wrong, or a cell's pencil marks
//                                      leave out the right digit
//   { kind: 'step', step, level }      the next logical step and the index of its level
//   { kind: 'stuck', cell, stages }    no technique applies; the last stage gives a digit
export function findHint(position) {
  const mistake = findMistake(position);
  if (mistake) return mistake;
  if (position.values.every((v) => v !== 0)) return { kind: 'solved' };

  const board = boardFor(position);
  const step = nextStep(board);
  if (step) return { kind: 'step', step, level: TECHNIQUE_LEVEL.get(step.technique) };

  // No technique applies. Point at the empty cell with the fewest candidates and give its digit.
  const { values, solution } = position;
  let cell = -1;
  for (let i = 0; i < 81; i++) {
    if (!values[i] && (cell < 0 || POPCOUNT[board.cands[i]] < POPCOUNT[board.cands[cell]])) cell = i;
  }
  return {
    kind: 'stuck',
    cell,
    stages: [
      { text: 'None of the techniques in this app applies here.' },
      { text: `Look at ${cellName(cell)}.`, cells: [[cell, 'key']] },
      { text: `${cellName(cell)} is ${solution[cell]}.`, cells: [[cell, 'target']], marks: [[cell, solution[cell], 'place']] },
    ],
  };
}

// Solves the player's position as far as the techniques of level `level` and easier ones go,
// for the shortcut on the game screen. `position` is what findHint takes. Returns
// { kind: 'mistake' } when a placed digit is wrong or a cell's pencil marks leave out its
// answer, because solving from there could place wrong digits, and otherwise
// { kind: 'done', steps, board } with the steps made and the board after them.
export function solveUpTo(position, level) {
  if (findMistake(position)) return { kind: 'mistake' };
  const techniques = TECHNIQUES.filter((technique) => TECHNIQUE_LEVEL.get(technique.id) <= level);
  const { steps, board } = logicalSolve(boardFor(position), { techniques });
  return { kind: 'done', steps, board };
}

// The player's position as a board: the placed digits, and in each empty cell the candidates
// the placed digits allow, narrowed to the cell's pencil marks when it has any.
function boardFor({ values, givens, marks = new Uint16Array(81) }) {
  const board = Board.fromValues(values, givens);
  for (let cell = 0; cell < 81; cell++) if (!values[cell] && marks[cell]) board.cands[cell] &= marks[cell];
  return board;
}

// The first mistake on the board as a hint: a wrong digit, or else an empty cell whose pencil
// marks leave out its answer. Null when there is none.
function findMistake({ values, solution, marks = new Uint16Array(81) }) {
  for (let cell = 0; cell < 81; cell++) {
    if (!values[cell] || values[cell] === solution[cell]) continue;
    const block = 18 + BOX[cell];
    return {
      kind: 'mistake',
      cell,
      stages: [
        { text: 'There is a mistake on the board.' },
        { text: `There is a wrong digit in ${houseName(block)}.`, houses: [block] },
        { text: `${cellName(cell)} is not ${values[cell]}.`, houses: [block], cells: [[cell, 'target']] },
      ],
    };
  }
  for (let cell = 0; cell < 81; cell++) {
    if (values[cell] || !marks[cell] || marks[cell] & bit(solution[cell])) continue;
    return {
      kind: 'mistake',
      cell,
      stages: [
        { text: 'A pencil mark is missing.' },
        { text: `Check the pencil marks in ${cellName(cell)}.`, cells: [[cell, 'key']] },
        {
          text: `${cellName(cell)} needs a pencil mark for ${solution[cell]}.`,
          cells: [[cell, 'target']],
          marks: [[cell, solution[cell], 'place']],
        },
      ],
    };
  }
  return null;
}

// Checks everything the player has done against the solution, for the Check the board item on
// the hint menu. `position` is what findHint takes. Three kinds of mistake are reported: a
// placed digit that is not the solution, a cell whose pencil marks leave out its answer, and a
// pencil mark for a digit that is already placed in the cell's row, column or block. A cell
// without pencil marks claims nothing, so it is never a mistake.
//
// Returns { problems, text, cells, marks }, where `problems` counts the mistakes and `cells`
// and `marks` highlight them the way a hint's stages do.
export function checkWork({ values, givens, solution, marks = new Uint16Array(81) }) {
  const wrong = [];
  const missing = [];
  const stale = [];
  let marked = 0;
  for (let cell = 0; cell < 81; cell++) {
    if (values[cell]) {
      if (!givens[cell] && values[cell] !== solution[cell]) wrong.push(cell);
      continue;
    }
    if (!marks[cell]) continue;
    marked++;
    // A wrong digit takes its own digit out of the marks of the cells it sees, and can make
    // other marks look impossible. Those are consequences of the wrong digit, not separate
    // mistakes, so a mark problem is reported only when no wrong digit explains it.
    const heldByMistake = (digit) => PEERS[cell].some((peer) => values[peer] === digit && values[peer] !== solution[peer]);
    const heldRightly = (digit) => PEERS[cell].some((peer) => values[peer] === digit && values[peer] === solution[peer]);
    const answer = solution[cell];
    if (!(marks[cell] & bit(answer)) && !heldByMistake(answer)) missing.push(cell);
    for (const digit of DIGITS[marks[cell]]) {
      if (heldRightly(digit)) stale.push([cell, digit]);
    }
  }

  const sentences = [];
  if (wrong.length) sentences.push(`${cellList(wrong)} ${plural(wrong.length, 'holds a wrong digit', 'hold wrong digits')}.`);
  else sentences.push('Every digit on the board is right.');
  if (missing.length) {
    sentences.push(
      `${cellList(missing)} ${plural(missing.length, 'has no pencil mark for its answer', 'have no pencil mark for their answer')}.`,
    );
  }
  if (stale.length) {
    sentences.push(
      `${plural(stale.length, 'One pencil mark is', 'Some pencil marks are')} for ${plural(stale.length, 'a digit', 'digits')} ` +
        `already placed in the same row, column or block. ${removalText(stale)}`,
    );
  }
  if (!missing.length && !stale.length && marked) sentences.push('The pencil marks are right too.');

  return {
    problems: wrong.length + missing.length + stale.length,
    wrong,
    missing,
    stale,
    text: sentences.join(' '),
    // `mistake` is this check's own cell role, drawn in the colour of a wrong digit.
    cells: wrong.map((cell) => [cell, 'mistake']).concat(missing.map((cell) => [cell, 'key'])),
    marks: missing.map((cell) => [cell, solution[cell], 'place']).concat(stale.map(([cell, digit]) => [cell, digit, 'elim'])),
  };
}
