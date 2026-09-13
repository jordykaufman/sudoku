import { COL, ROW } from './grid.js';

// Names used in hint text: cells as R1C2, houses as "row 1", "column 1" and "block 1".

export const cellName = (cell) => `R${ROW[cell] + 1}C${COL[cell] + 1}`;

export function houseName(house) {
  if (house < 9) return `row ${house + 1}`;
  if (house < 18) return `column ${house - 8}`;
  return `block ${house - 17}`;
}

export const houseKind = (house) => (house < 9 ? 'row' : house < 18 ? 'column' : 'block');

// "A", "A and B", "A, B and C".
export function joinList(items) {
  const list = [...items].map(String);
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

export const cellList = (cells) => joinList(cells.map(cellName));

export const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export const aDigit = (digit) => (digit === 8 ? `an ${digit}` : `a ${digit}`);

// "A", "A or B", "A, B or C".
export function orList(items) {
  const list = [...items].map(String);
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`;
}

export const plural = (count, one, many) => (count === 1 ? one : many);

// Sentences that name every removal. By default, digits removed from the same cells share a
// sentence: "Remove 4 from R3C2. Remove 7 from R3C2 and R3C9." With `byCell`, cells that lose
// the same digits share one: "Remove 1 and 9 from R3C1. Remove 2 from R3C5."
export function removalText(eliminations, { byCell = false } = {}) {
  const lists = new Map();
  for (const [cell, digit] of eliminations) {
    const [key, value] = byCell ? [cell, digit] : [digit, cell];
    if (!lists.has(key)) lists.set(key, []);
    lists.get(key).push(value);
  }
  const groups = new Map();
  for (const key of [...lists.keys()].sort((a, b) => a - b)) {
    const values = lists.get(key).sort((a, b) => a - b);
    const id = values.join(' ');
    if (!groups.has(id)) groups.set(id, { keys: [], values });
    groups.get(id).keys.push(key);
  }
  return [...groups.values()]
    .map(({ keys, values }) => {
      const [digits, cells] = byCell ? [values, keys] : [keys, values];
      return `Remove ${joinList(digits)} from ${cellList(cells)}.`;
    })
    .join(' ');
}
