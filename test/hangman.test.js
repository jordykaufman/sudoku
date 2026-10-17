import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PARTS, figureSvg, stepsFor } from '../hangman/src/figure.js';
import {
  MAX_PARTS, MIN_PARTS,
  cleanWord, giveUp, guessLetter, guessWord, guesser, misses, newMatch, newRound, nextRound, restoreMatch, scoreRound, status, wordProblem,
} from '../hangman/src/game.js';

const ROOT = new URL('../hangman/', import.meta.url).pathname;

test('words are cleaned and checked', () => {
  assert.equal(cleanWord('  Crème  brûlée '), 'CREME BRULEE');
  assert.equal(cleanWord('rock ’n’ roll'), "ROCK 'N' ROLL");
  assert.equal(wordProblem('CAT'), null);
  assert.equal(wordProblem("JACK-IN-THE-BOX"), null);
  assert.match(wordProblem('A'), /two letters/);
  assert.match(wordProblem('R2D2'), /letters only/);
  assert.match(wordProblem('A'.repeat(41)), /at most/);
});

test('letters are found or missed, once each', () => {
  const round = newRound({ word: 'HELLO THERE', parts: 6 });
  assert.equal(guessLetter(round, 'L'), 'hit');
  assert.equal(guessLetter(round, 'L'), null, 'already guessed');
  assert.equal(guessLetter(round, 'Z'), 'miss');
  assert.equal(guessLetter(round, '?'), null);
  assert.equal(misses(round), 1);
  for (const letter of 'HEOTR') guessLetter(round, letter);
  assert.equal(status(round), 'won');
  assert.equal(guessLetter(round, 'Q'), null, 'the round is over');
});

test('the guesser loses on the last body part', () => {
  const round = newRound({ word: 'CAT', parts: 4 });
  for (const letter of 'XYZ') guessLetter(round, letter);
  assert.equal(status(round), 'playing');
  guessLetter(round, 'Q');
  assert.equal(status(round), 'lost');
});

test('guessing the whole word compares the letters, and a repeated wrong word is free', () => {
  const round = newRound({ word: 'ICE CREAM', parts: 5 });
  assert.equal(guessWord(round, 'ice cubes'), 'miss');
  assert.equal(guessWord(round, 'Ice  Cubes'), null);
  assert.equal(misses(round), 1);
  assert.equal(guessWord(round, 'icecream'), 'hit');
  assert.equal(status(round), 'won');
});

test('giving up loses the round', () => {
  const round = newRound({ word: 'CAT', parts: 8 });
  giveUp(round);
  assert.equal(status(round), 'lost');
});

test('the winner scores once and the players swap roles', () => {
  const match = newMatch();
  assert.equal(guesser(match), 1);
  match.round = newRound({ word: 'DOG', parts: 4 });
  for (const letter of 'DOG') guessLetter(match.round, letter);
  assert.equal(scoreRound(match), 1);
  assert.equal(scoreRound(match), 1);
  assert.deepEqual(match.scores, [0, 1]);
  nextRound(match);
  assert.equal(match.setter, 1);
  assert.equal(match.round, null);
  match.round = newRound({ word: 'DOG', parts: 4 });
  giveUp(match.round);
  assert.equal(scoreRound(match), 1, 'the setter wins');
  assert.deepEqual(match.scores, [0, 2]);
});

test('a saved match is used only if it is whole', () => {
  const match = newMatch();
  match.round = newRound({ word: 'DOG', parts: 9 });
  assert.equal(restoreMatch(JSON.parse(JSON.stringify(match))).round.word, 'DOG');
  assert.equal(restoreMatch(null), null);
  assert.equal(restoreMatch({ scores: [0], setter: 0, round: null }), null);
  assert.equal(restoreMatch({ ...match, round: { ...match.round, parts: 30 } }), null);
  assert.equal(restoreMatch({ ...match, round: { ...match.round, letters: 'ABC' } }), null);
});

test('every number of body parts from 4 to 16 makes a whole, symmetrical figure', () => {
  for (let count = MIN_PARTS; count <= MAX_PARTS; count++) {
    const steps = stepsFor(count);
    assert.equal(steps.length, count);
    const parts = steps.flat();
    assert.equal(new Set(parts).size, parts.length, `${count}: no part twice`);
    for (const part of ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']) assert.ok(parts.includes(part), `${count}: ${part}`);
    for (const part of parts.filter((p) => p.startsWith('left'))) assert.ok(parts.includes(part.replace('left', 'right')), `${count}: ${part} has a pair`);
    assert.deepEqual(parts, PARTS.filter((part) => parts.includes(part)), `${count}: drawn in order`);
    assert.equal(figureSvg(steps, count).match(/<g>/g).length, count);
  }
  assert.deepEqual(stepsFor(MAX_PARTS).flat(), PARTS);
});

function filesUnder(dir) {
  const files = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...filesUnder(path));
    else files.push(path);
  }
  return files;
}

test('the Hangman service worker caches every file the game loads', () => {
  assert.ok(existsSync(join(ROOT, 'sw.js')));
  const source = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const listed = [...source.matchAll(/^\s+'([^']+)',$/gm)].map((match) => match[1]);
  const expected = ['./', ...filesUnder('').filter((file) => file !== 'sw.js' && !file.endsWith('.svg'))];
  assert.deepEqual([...listed].sort(), [...expected].sort());
  assert.match(source, /cache\.addAll\(FILES\.map\(\(file\) => new Request\(file, \{ cache: 'reload' \}\)\)\)/);
});
