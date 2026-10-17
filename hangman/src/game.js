// Two-player Hangman rules, with no DOM. One player chooses a word or phrase and the other
// guesses it a letter at a time, or all at once. Every wrong guess draws one more step of the
// figure (src/figure.js), and the guesser loses when the figure is complete.

export const MIN_PARTS = 4;
export const MAX_PARTS = 16;
export const MAX_LENGTH = 40;

export const isLetter = (char) => char.length === 1 && char >= 'A' && char <= 'Z';

const lettersOf = (text) => [...text].filter(isLetter).join('');

// Capitals without accents, curly quotes made straight, single spaces:
// "  Crème  brûlée " -> "CREME BRULEE".
export function cleanWord(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// Why a cleaned word can't be used, or null if it can.
export function wordProblem(word) {
  if (lettersOf(word).length < 2) return 'Type a word of at least two letters.';
  if (word.length > MAX_LENGTH) return `Use at most ${MAX_LENGTH} characters.`;
  if (!/^[A-Z' -]+$/.test(word)) return 'Use letters only, with spaces, hyphens or apostrophes between words.';
  return null;
}

// A round. `letters` are the letters guessed so far, in order, and `words` the wrong guesses
// of the whole word.
export function newRound({ word, clue = '', parts }) {
  return { word, clue, parts, letters: [], words: [], solvedByWord: false, gaveUp: false };
}

export const wrongLetters = (round) => round.letters.filter((letter) => !round.word.includes(letter));

export const misses = (round) => wrongLetters(round).length + round.words.length;

// Whether the character at a position of the word is showing. Spaces, hyphens and apostrophes
// show from the start.
export const shown = (round, char) => !isLetter(char) || round.solvedByWord || round.letters.includes(char);

export function status(round) {
  if ([...round.word].every((char) => shown(round, char))) return 'won';
  if (round.gaveUp || misses(round) >= round.parts) return 'lost';
  return 'playing';
}

export const count = (round, letter) => [...round.word].filter((char) => char === letter).length;

// Guesses one letter. Returns 'hit' or 'miss', or null when the letter can't be guessed now.
export function guessLetter(round, letter) {
  if (status(round) !== 'playing' || !isLetter(letter) || round.letters.includes(letter)) return null;
  round.letters.push(letter);
  return round.word.includes(letter) ? 'hit' : 'miss';
}

// Guesses the whole word. Only the letters are compared, so "ICECREAM" is right for "ICE CREAM".
// Returns 'hit' or 'miss', or null when there is nothing to guess or the same wrong word was
// already guessed, which costs nothing.
export function guessWord(round, text) {
  const word = cleanWord(text);
  if (status(round) !== 'playing' || !lettersOf(word) || round.words.includes(word)) return null;
  if (lettersOf(word) === lettersOf(round.word)) {
    round.solvedByWord = true;
    return 'hit';
  }
  round.words.push(word);
  return 'miss';
}

export function giveUp(round) {
  if (status(round) === 'playing') round.gaveUp = true;
}

// A match: the two players' scores, which of them chooses the next word, and the round being
// played (null while the word is being chosen). Players take turns at choosing.
export const newMatch = () => ({ scores: [0, 0], setter: 0, round: null });

export const guesser = (match) => 1 - match.setter;

// Gives a finished round's point to its winner, once. Returns the winner.
export function scoreRound(match) {
  const { round } = match;
  if (round.winner === undefined) {
    round.winner = status(round) === 'won' ? guesser(match) : match.setter;
    match.scores[round.winner] += 1;
  }
  return round.winner;
}

export function nextRound(match) {
  match.setter = guesser(match);
  match.round = null;
}

// A match read back from storage, or null if it isn't one this version can play.
export function restoreMatch(saved) {
  const isCount = (n) => Number.isInteger(n) && n >= 0;
  const isText = (list) => Array.isArray(list) && list.every((item) => typeof item === 'string');
  if (!saved || !Array.isArray(saved.scores) || saved.scores.length !== 2 || !saved.scores.every(isCount)) return null;
  if (saved.setter !== 0 && saved.setter !== 1) return null;
  const { round } = saved;
  if (round === null) return saved;
  if (!round || typeof round.word !== 'string' || wordProblem(round.word) || typeof round.clue !== 'string') return null;
  if (!Number.isInteger(round.parts) || round.parts < MIN_PARTS || round.parts > MAX_PARTS) return null;
  if (!isText(round.letters) || !isText(round.words)) return null;
  return saved;
}
