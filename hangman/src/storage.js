// localStorage with JSON values. Storage can be unavailable (private browsing, blocked site
// data), so every read falls back to a default and every write is allowed to fail. The prefix
// keeps these keys apart from the Sudoku app's, which shares the origin.

const PREFIX = 'hangman:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Nothing else to do: the game keeps working without saving.
  }
}
