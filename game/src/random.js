// SOLMARA — a small seeded random generator.
// One seed builds the same city, the same traffic and the same pedestrians every
// time, so a screenshot scene and a test can be replayed exactly.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A generator with the helpers the city and the world use.
export function createRng(seed) {
  const next = mulberry32(seed);
  let spare = null;
  return {
    next,
    // Float in [min, max).
    range(min, max) {
      return min + next() * (max - min);
    },
    // Whole number in [min, max] inclusive.
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    // One element of an array.
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // True with probability p.
    chance(p) {
      return next() < p;
    },
    // A shuffled copy of a list (Fisher-Yates).
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
    // A standard normal, Box-Muller, for natural-looking scatter.
    normal() {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      const mag = Math.sqrt(-2 * Math.log(u));
      spare = mag * Math.sin(2 * Math.PI * v);
      return mag * Math.cos(2 * Math.PI * v);
    },
  };
}
