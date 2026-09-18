import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LONG_PRESS_MS, onPress } from '../src/app/dom.js';

// A stand-in for a DOM element: records listeners and fires pointer events at them.
class FakeElement {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, fn) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }

  setPointerCapture() {}

  fire(type, props = {}) {
    const event = { isPrimary: true, pointerId: 1, pointerType: 'touch', button: 0, clientX: 0, clientY: 0, preventDefault() {}, ...props };
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }
}

const pressed = () => {
  const el = new FakeElement();
  const calls = [];
  onPress(el, (held) => calls.push(held));
  return { el, calls };
};

test('a quick tap calls the handler once, with held false', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { el, calls } = pressed();
  el.fire('pointerdown');
  el.fire('pointerup');
  t.mock.timers.tick(LONG_PRESS_MS);
  assert.deepEqual(calls, [false]);
});

test('a hold calls the handler once, with held true, and the release does nothing more', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { el, calls } = pressed();
  el.fire('pointerdown');
  t.mock.timers.tick(LONG_PRESS_MS);
  el.fire('pointerup');
  assert.deepEqual(calls, [true]);
});

test('moving the finger, or the browser taking the pointer, cancels the press', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { el, calls } = pressed();
  el.fire('pointerdown');
  el.fire('pointermove', { clientX: 40 });
  t.mock.timers.tick(LONG_PRESS_MS);
  el.fire('pointerup');
  el.fire('pointerdown');
  el.fire('pointercancel');
  t.mock.timers.tick(LONG_PRESS_MS);
  el.fire('pointerup');
  assert.deepEqual(calls, []);
});

test('a second finger and other mouse buttons are ignored', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { el, calls } = pressed();
  el.fire('pointerdown', { isPrimary: false, pointerId: 2 });
  el.fire('pointerup', { isPrimary: false, pointerId: 2 });
  el.fire('pointerdown', { pointerType: 'mouse', button: 2 });
  el.fire('pointerup', { pointerType: 'mouse', button: 2 });
  t.mock.timers.tick(LONG_PRESS_MS);
  assert.deepEqual(calls, []);
});
