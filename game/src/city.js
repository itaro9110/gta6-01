// city.js — builds the city of Solmara and answers collision questions.
// One file, one job: the static map. It lays out the road grid, the
// buildings in every block, the parks, Sun Plaza, the marina docks, the
// beach and the sea, the palms and the street props. world.js asks it
// "is this spot a road / a building / water?" and render.js asks it what
// to draw. Nothing here moves; all movement lives in world.js.

import { AVENUES, STREETS, ROAD_W, WORLD_W, WORLD_H, SAND_X, SEA_X, PLAZA, MARINA, PARK_SPOTS, PALETTE } from './config.js';
import { makeRng } from './random.js';

// A building: a rectangle with a roof colour, a wall colour and a
// deterministic set of windows so it reads as a building, not a box.
export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const palms = [];

  // Every block is the rectangle between two neighbouring avenues and
  // two neighbouring streets. Buildings fill the block, inset from the
  // road edges so sidewalks stay walkable.
  const xs = [0, ...AVENUES, WORLD_W];
  const ys = [0, ...STREETS, WORLD_H];
  for (let ix = 0; ix < xs.length - 1; ix++) {
    for (let iy = 0; iy < ys.length - 1; iy++) {
      const x0 = xs[ix];
      const x1 = xs[ix + 1];
      const y0 = ys[iy];
      const y1 = ys[iy + 1];
      const w = x1 - x0;
      const h = y1 - y0;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // The plaza block stays open (fountain, paving, people).
      if (Math.hypot(cx - PLAZA.x, cy - PLAZA.y) < PLAZA.r + 120) continue;
      // The marina block stays open (docks and water).
      if (cx > MARINA.x - MARINA.w / 2 - 60 && cx < MARINA.x + MARINA.w / 2 + 60 &&
          cy > MARINA.y - MARINA.h / 2 - 60 && cy < MARINA.y + MARINA.h / 2 + 60) continue;
      // Park blocks stay green.
      if (PARK_SPOTS.some((p) => Math.abs(cx - p.x) < p.w / 2 + 80 && Math.abs(cy - p.y) < p.h / 2 + 80)) continue;
      // Beach blocks east of the sand line stay open.
      if (x0 >= SAND_X - 40) continue;
      // Each block gets 1 to 4 buildings along its long side.
      const count = rng.int(1, 3);
      for (let b = 0; b < count; b++) {
        const bw = Math.min(w - 130, rng.range(90, 190));
        const bh = Math.min(h - 130, rng.range(80, 170));
        if (bw < 60 || bh < 50) continue;
        const bx = x0 + 70 + rng.range(0, Math.max(1, w - 140 - bw));
        const by = y0 + 70 + rng.range(0, Math.max(1, h - 140 - bh));
        // Keep buildings inside their block.
        if (bx + bw > x1 - 60 || by + bh > y1 - 60) continue;
        const roof = rng.pick(PALETTE.buildingRoof);
        const wall = rng.pick(PALETTE.buildingWall);
        const windows = [];
        const cols = Math.max(1, Math.floor(bw / 34));
        const rows = Math.max(1, Math.floor(bh / 34));
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if (rng.chance(0.75)) windows.push({ dx: 14 + c * 34, dy: 14 + r * 34 });
          }
        }
        buildings.push({ x: bx, y: by, w: bw, h: bh, roof, wall, windows });
      }
      // A tree or two on the block's spare corners.
      if (rng.chance(0.6)) {
        trees.push({ x: x0 + rng.range(60, w - 60), y: y0 + rng.range(60, h - 60), r: rng.range(14, 22) });
      }
    }
  }

  // Palms line the beach road and the marina walk.
  for (let y = 150; y < WORLD_H; y += 170) {
    palms.push({ x: SAND_X + 55, y: y + 30, r: 16 });
    if (y % 340 === 0) palms.push({ x: SAND_X + 110, y: y + 120, r: 14 });
  }
  for (let x = MARINA.x - MARINA.w / 2; x < MARINA.x + MARINA.w / 2; x += 130) {
    palms.push({ x, y: MARINA.y - MARINA.h / 2 - 45, r: 15 });
  }
  // A few palms around the plaza.
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    palms.push({ x: PLAZA.x + Math.cos(ang) * (PLAZA.r - 25), y: PLAZA.y + Math.sin(ang) * (PLAZA.r - 25), r: 15 });
  }

  return { buildings, trees, palms, seed };
}

// Is a point on a road (avenue or street, road width included)?
export function onRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_W / 2) return true;
  return false;
}

// Is a point in the sea (east edge, past the sand)?
export function inSea(x, y) {
  return x >= SEA_X && y >= 0 && y <= WORLD_H;
}

// Is a point on sand (walkable beach, but cars bog down)?
export function onSand(x, y) {
  return x >= SAND_X && x < SEA_X;
}

// The nearest avenue or street centre to a point (for traffic lanes).
export function nearestRoad(x, y) {
  let bestA = AVENUES[0];
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; bestA = ax; }
  }
  let bestS = STREETS[0];
  let bestSD = Infinity;
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestSD) { bestSD = d; bestS = sy; }
  }
  return bestD <= bestSD ? { axis: 'v', at: bestA } : { axis: 'h', at: bestS };
}

// Circle-vs-building collision: pushes a circle (x, y, r) out of every
// building it overlaps. Returns true when a push happened.
export function collideBuildings(city, pos, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(pos.y, b.y + b.h));
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * r;
      pos.y = cy + (dy / d) * r;
    } else {
      // Dead centre: push out along the shortest side.
      const left = pos.x - b.x;
      const right = b.x + b.w - pos.x;
      const top = pos.y - b.y;
      const bottom = b.y + b.h - pos.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = b.x - r;
      else if (m === right) pos.x = b.x + b.w + r;
      else if (m === top) pos.y = b.y - r;
      else pos.y = b.y + b.h + r;
    }
  }
  return hit;
}

// Keep a point inside the world, and out of the sea (nobody drives or
// walks into the water; the beach is the edge of the map).
export function clampToLand(pos, r) {
  pos.x = Math.max(r, Math.min(WORLD_W - r, pos.x));
  pos.y = Math.max(r, Math.min(WORLD_H - r, pos.y));
  if (pos.x > SEA_X - r) pos.x = SEA_X - r;
}
