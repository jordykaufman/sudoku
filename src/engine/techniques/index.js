import advanced from './advanced.js';
import chains from './chains.js';
import fish from './fish.js';
import intersections from './intersections.js';
import { ORDER } from './order.js';
import singles from './singles.js';
import subsets from './subsets.js';
import uniqueness from './uniqueness.js';
import wings from './wings.js';

const BY_ID = new Map();
for (const technique of [...singles, ...intersections, ...subsets, ...fish, ...uniqueness, ...wings, ...chains, ...advanced]) {
  BY_ID.set(technique.id, technique);
}

// Techniques in solving order. Techniques that aren't written yet are left out.
export const TECHNIQUES = ORDER.filter((id) => BY_ID.has(id)).map((id) => BY_ID.get(id));

export const techniqueById = (id) => BY_ID.get(id);
