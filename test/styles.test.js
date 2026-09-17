import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8');
const position = (selector) => {
  const index = css.indexOf(`${selector} {`);
  assert.notEqual(index, -1, `${selector} is in app.css`);
  return index;
};

// The cell rules all have the same specificity, so the later rule wins. A cell that holds the
// highlighted digit, or a pencil mark for it, must keep its colour inside a shaded house.
test('digit highlights are drawn over house shading', () => {
  assert.ok(position('.cell.house') < position('.cell.hl-digit'));
  assert.ok(position('.cell.house') < position('.cell.hl-mark'));
});
