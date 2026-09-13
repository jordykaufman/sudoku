import { ALL, CELL_HOUSES, DIGITS, HOUSES, POPCOUNT, bit } from '../grid.js';
import { aDigit, capitalize, cellName, houseName } from '../text.js';

// Full House: the only empty cell of a house.
const fullHouse = {
  id: 'full-house',
  name: 'Full House',
  lesson: [
    'When a row, column or block has only one empty cell, that cell must hold the one digit the house is missing.',
  ],
  find(board) {
    for (let house = 0; house < 27; house++) {
      let empty = -1;
      let emptyCount = 0;
      let placed = 0;
      for (const cell of HOUSES[house]) {
        if (board.values[cell]) {
          placed |= bit(board.values[cell]);
        } else {
          empty = cell;
          emptyCount++;
        }
      }
      if (emptyCount !== 1) continue;
      const missing = ALL & ~placed;
      if (POPCOUNT[missing] !== 1 || !(board.cands[empty] & missing)) continue;
      const digit = DIGITS[missing][0];
      const name = houseName(house);
      return {
        technique: 'full-house',
        placements: [[empty, digit]],
        eliminations: [],
        stages: [
          { text: `Look at ${name}.` },
          { text: `${capitalize(name)} has only one empty cell.`, houses: [house] },
          {
            text: `${cellName(empty)} must be ${digit}, the only digit missing from ${name}.`,
            houses: [house],
            cells: [[empty, 'target']],
            marks: [[empty, digit, 'place']],
          },
        ],
      };
    }
    return null;
  },
};

// Hidden Single: a digit that has only one possible cell in a house.
function findHiddenSingle(board, id, firstHouse, lastHouse) {
  for (let digit = 1; digit <= 9; digit++) {
    for (let house = firstHouse; house <= lastHouse; house++) {
      if (board.placed(house, digit)) continue;
      const cells = board.where(house, digit);
      if (cells.length !== 1) continue;
      const cell = cells[0];
      const name = houseName(house);
      return {
        technique: id,
        placements: [[cell, digit]],
        eliminations: [],
        stages: [
          { text: `Consider the digit ${digit}.` },
          { text: `Where in ${name} can you put ${aDigit(digit)}?`, digit, houses: [house] },
          {
            text: `Only ${cellName(cell)} can be ${digit}.`,
            digit,
            houses: [house],
            cells: [[cell, 'target']],
            marks: [[cell, digit, 'place']],
          },
        ],
      };
    }
  }
  return null;
}

const hiddenSingleBlock = {
  id: 'hidden-single-block',
  name: 'Hidden Single (in blocks)',
  lesson: [
    'Pick a digit and a block that does not have that digit yet. A cell in the block cannot hold the digit if the cell is already filled, or if its row or column already has the digit.',
    'If only one cell in the block is left, the digit goes there.',
  ],
  find: (board) => findHiddenSingle(board, 'hidden-single-block', 18, 26),
};

const hiddenSingle = {
  id: 'hidden-single',
  name: 'Hidden Single',
  lesson: [
    'The same check works for rows and columns. Pick a digit and a row or column that does not have that digit yet. Rule out the cells that are filled, and the cells whose block or crossing line already has the digit.',
    'If only one cell is left, the digit goes there.',
  ],
  find: (board) => findHiddenSingle(board, 'hidden-single', 0, 17),
};

// Naked Single: an empty cell with only one candidate left.
const nakedSingle = {
  id: 'naked-single',
  name: 'Naked Single',
  lesson: [
    'Pick an empty cell. Cross off every digit that already appears in its row, column or block, and any candidate you have already ruled out for it.',
    'If only one digit is left, it goes in the cell.',
  ],
  find(board) {
    for (let cell = 0; cell < 81; cell++) {
      if (board.values[cell] || POPCOUNT[board.cands[cell]] !== 1) continue;
      const digit = DIGITS[board.cands[cell]][0];
      const name = cellName(cell);
      return {
        technique: 'naked-single',
        placements: [[cell, digit]],
        eliminations: [],
        stages: [
          { text: `Look at ${name}.`, cells: [[cell, 'key']] },
          { text: `Which digits can still go in ${name}?`, houses: CELL_HOUSES[cell], cells: [[cell, 'key']] },
          {
            text: `${name} can only be ${digit}.`,
            houses: CELL_HOUSES[cell],
            cells: [[cell, 'target']],
            marks: [[cell, digit, 'place']],
          },
        ],
      };
    }
    return null;
  },
};

export default [fullHouse, hiddenSingleBlock, hiddenSingle, nakedSingle];
