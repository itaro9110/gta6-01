// random.js — small seeded random numbers for SOLMARA.
// One file, one job: deterministic randomness, so the city, the traffic
// and the staged screenshots look the same every time a seed is given.
// mulberry32 is a tiny, well-known seeded generator: given the same seed
// it always returns the same sequence, which is what makes the city
// layout and the screenshot staging reproducible.

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

// A convenience wrapper: one RNG object with the helpers the game uses.
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // A float in [min, max).
    range(min, max) {
      return min + next() * (max - min);
    },
    // An integer in [min, max] inclusive.
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    // One element of an array, picked uniformly.
    pick(array) {
      return array[Math.floor(next() * array.length)];
    },
    // True with probability p.
    chance(p) {
      return next() < p;
    },
  };
}
