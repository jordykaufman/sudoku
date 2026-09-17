// Small DOM helpers.

// h('button', { class: 'row', onclick: fn }, 'Label', childElement)
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === undefined || child === null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

const KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

export const digitLabel = (digit, font) => (font === 'kanji' ? KANJI[digit] : String(digit));

// 75 -> "1:15", 3725 -> "1:02:05"
export function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = String(seconds % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}

export const LONG_PRESS_MS = 350;
const MOVE_LIMIT = 12; // pixels a finger may drift and still count as a press

// Calls handler(held) when `el` is tapped (held = false) or held for LONG_PRESS_MS (held = true).
// Moving the pointer, or the browser taking it to scroll, cancels the press.
export function onPress(el, handler) {
  let press = null; // { id, x, y, timer } while a pointer is down
  const stop = () => {
    if (press) clearTimeout(press.timer);
    press = null;
  };
  el.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    stop();
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // Not supported: pointerup still reaches us unless the finger leaves the element.
    }
    const timer = setTimeout(() => {
      press = null;
      handler(true);
    }, LONG_PRESS_MS);
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, timer };
  });
  el.addEventListener('pointermove', (event) => {
    if (press && event.pointerId === press.id && Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_LIMIT) stop();
  });
  el.addEventListener('pointerup', (event) => {
    if (!press || event.pointerId !== press.id) return;
    stop();
    handler(false);
  });
  el.addEventListener('pointercancel', stop);
  el.addEventListener('contextmenu', (event) => event.preventDefault());
}
