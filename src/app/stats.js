import { LEVELS } from '../engine/levels.js';
import { load, save } from './storage.js';

// Statistics per level, keyed by level id:
//   started, finished, timed (finished without Show Solution), bestSeconds, totalSeconds, hints
// and `daily`, the level ids finished for each date's daily games.

const empty = () => ({ levels: {}, daily: {} });

export function loadStats() {
  return { ...empty(), ...load('stats', {}) };
}

function entry(stats, level) {
  const id = LEVELS[level].id;
  stats.levels[id] ??= { started: 0, finished: 0, timed: 0, bestSeconds: null, totalSeconds: 0, hints: 0 };
  return stats.levels[id];
}

export function recordStart(stats, game) {
  entry(stats, game.level).started++;
  save('stats', stats);
}

export function recordFinish(stats, game) {
  const e = entry(stats, game.level);
  e.finished++;
  e.hints += game.hints;
  if (!game.usedSolution) {
    e.timed++;
    e.totalSeconds += game.seconds;
    e.bestSeconds = e.bestSeconds === null ? game.seconds : Math.min(e.bestSeconds, game.seconds);
  }
  if (game.kind === 'daily' && game.date) {
    const done = new Set(stats.daily[game.date] ?? []);
    done.add(LEVELS[game.level].id);
    stats.daily[game.date] = [...done];
  }
  save('stats', stats);
}

export function dailyDone(stats, date, level) {
  return (stats.daily[date] ?? []).includes(LEVELS[level].id);
}

export function resetStats() {
  const stats = empty();
  save('stats', stats);
  return stats;
}
