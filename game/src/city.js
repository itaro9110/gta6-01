// SOLMARA — the map: roads, districts, places, buildings, spawn points.
// Everything here is data. The world reads it; the renderer draws it; the
// tests ask it where the roads are. One seed builds one city.

import { CFG } from './config.js';

// Flat-roof colours for the city's buildings.
const ROOFS = ['#d98a4b', '#c96f5a', '#7fae7a', '#6a8caf', '#b09a5e', '#9a7fb0', '#5e8a7a', '#c9b458'];
const UMBRELLAS = ['#e23b3b', '#f2c200', '#3b7fe2', '#37b06a', '#e26a9b', '#3bb8c4'];

// The plaza is the block between avenue 1200 and avenue 1650, street 950 and street 1300.
export const PLAZA = { x: 1256, y: 1006, w: 338, h: 238, cx: 1425, cy: 1125 };
// The sea starts here; the sand runs just west of it.
export const WATER_X = 3360;
export const BEACH_X0 = 3180;

// Build the whole city from a seeded generator.
export function buildCity(rng) {
  const { avenues, streets, roadWidth } = CFG;
  const half = roadWidth / 2;

  const districts = [
    { name: 'Old Town', x: 0, y: 0, w: 1200, h: 1300, color: '#e8d9a8' },
    { name: 'Downtown', x: 1200, y: 0, w: 1350, h: 1300, color: '#cfd8e2' },
    { name: 'Marina Bay', x: 2550, y: 0, w: 1050, h: 950, color: '#a8d8e0' },
    { name: 'Harbor Works', x: 0, y: 1300, w: 2550, h: 1300, color: '#d8c9a8' },
    { name: 'Solmara Beach', x: 2550, y: 950, w: 1050, h: 1650, color: '#f2e2a8' },
  ];

  const places = {
    marasBar: { x: 1200, y: 950, name: "Mara's Bar", sub: 'The Rusty Anchor' },
    vault: { x: 1650, y: 1300, name: 'Meridian Vault', sub: 'Downtown Bank' },
    libertyPlaza: { x: PLAZA.cx, y: PLAZA.cy, name: 'Liberty Plaza', sub: 'Fountain Square' },
    marina: { x: 3000, y: 250, name: 'Marina', sub: 'Solmara Yacht Club' },
    oldMarket: { x: 750, y: 600, name: 'Old Market', sub: 'Fresh & Cheap' },
    palmsHotel: { x: 2100, y: 600, name: 'Palms Hotel', sub: 'Rooms by the Hour' },
    harborWorks: { x: 2100, y: 2000, name: 'Harbor Works', sub: 'Docks & Cranes' },
    chopShop: { x: 2550, y: 2000, name: "Rico's Chop Shop", sub: 'No Questions Asked' },
    policeHQ: { x: 750, y: 1300, name: 'Police HQ', sub: 'Solmara PD' },
    beach: { x: 3300, y: 1650, name: 'Solmara Beach', sub: 'Sun, Sand, Trouble' },
  };

  // Landmark buildings, placed by hand next to their intersections.
  const buildings = [
    { x: 1020, y: 810, w: 110, h: 64, color: '#8a5a3b', label: "Mara's Bar" },
    { x: 1720, y: 1370, w: 150, h: 84, color: '#5a6a7a', label: 'Meridian Vault' },
    { x: 2620, y: 1860, w: 140, h: 80, color: '#7a3b3b', label: "Rico's Chop Shop" },
    { x: 1900, y: 420, w: 130, h: 100, color: '#c9a85e', label: 'Palms Hotel' },
    { x: 420, y: 1050, w: 150, h: 90, color: '#3b4a6a', label: 'Police HQ' },
    { x: 380, y: 330, w: 90, h: 60, color: '#b06a3b', label: 'Market Stall' },
    { x: 500, y: 420, w: 80, h: 60, color: '#7a9a4b', label: 'Market Stall' },
    { x: 600, y: 330, w: 70, h: 55, color: '#c94b6a', label: 'Market Stall' },
  ];

  // Blocks that already hold a landmark: no generic building goes in them.
  const claimed = new Set(['750,600', '1650,1300', '2550,1650', '1650,250', '300,950', '300,250']);

  // Generic buildings, one or two per open block.
  for (let ai = 0; ai < avenues.length - 1; ai += 1) {
    for (let si = 0; si < streets.length - 1; si += 1) {
      const x0 = avenues[ai];
      const y0 = streets[si];
      if (claimed.has(`${x0},${y0}`)) continue;
      if (x0 === 1200 && y0 === 950) continue; // the plaza stays open
      if (x0 >= 3000) continue; // the beach strip stays open
      const innerX = x0 + half + 10;
      const innerY = y0 + half + 10;
      const innerW = avenues[ai + 1] - x0 - roadWidth - 20;
      const innerH = streets[si + 1] - y0 - roadWidth - 20;
      const count = rng.chance(0.55) ? 2 : 1;
      if (count === 1) {
        const w = Math.min(innerW, rng.range(120, 210));
        const h = Math.min(innerH, rng.range(90, 150));
        buildings.push({
          x: innerX + (innerW - w) / 2,
          y: innerY + (innerH - h) / 2,
          w, h,
          color: rng.pick(ROOFS),
          label: '',
        });
      } else {
        const w1 = Math.min(innerW * 0.48, rng.range(100, 170));
        const h1 = Math.min(innerH, rng.range(80, 140));
        const w2 = Math.min(innerW * 0.48, rng.range(100, 170));
        const h2 = Math.min(innerH, rng.range(80, 140));
        buildings.push({ x: innerX, y: innerY, w: w1, h: h1, color: rng.pick(ROOFS), label: '' });
        buildings.push({ x: innerX + innerW - w2, y: innerY + innerH - h2, w: w2, h: h2, color: rng.pick(ROOFS), label: '' });
      }
    }
  }

  // Beach umbrellas in a loose line down the sand.
  const umbrellas = [];
  for (let i = 0; i < 9; i += 1) {
    umbrellas.push({
      x: 3230 + rng.range(-30, 60),
      y: 320 + i * 230 + rng.range(-40, 40),
      color: UMBRELLAS[i % UMBRELLAS.length],
    });
  }

  return {
    width: CFG.worldWidth,
    height: CFG.worldHeight,
    avenues,
    streets,
    roadWidth,
    districts,
    places,
    buildings,
    plaza: PLAZA,
    waterX: WATER_X,
    beachX0: BEACH_X0,
    umbrellas,
    spawn: { x: 1200, y: 1030 },
    cometSpot: { x: 3000, y: 330 },
  };
}

// Is this point on a road (avenue or street)?
export function isOnRoad(city, x, y) {
  const half = city.roadWidth / 2;
  for (const ax of city.avenues) if (Math.abs(x - ax) <= half) return true;
  for (const sy of city.streets) if (Math.abs(y - sy) <= half) return true;
  return false;
}

// Is this point in the sea?
export function isWater(city, x, y) {
  return x >= city.waterX && y >= 0 && y <= city.height;
}

// Is this point on the sand?
export function isBeach(city, x, y) {
  return x >= city.beachX0 && x < city.waterX;
}

// The building at this point, or null.
export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// The district a point lies in, or null outside the city.
export function districtAt(city, x, y) {
  for (const d of city.districts) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return null;
}

// A point on the road network near (x, y): the closest avenue or street.
export function nearestRoadPoint(city, x, y) {
  let bestAvenue = city.avenues[0];
  for (const ax of city.avenues) if (Math.abs(ax - x) < Math.abs(bestAvenue - x)) bestAvenue = ax;
  let bestStreet = city.streets[0];
  for (const sy of city.streets) if (Math.abs(sy - y) < Math.abs(bestStreet - y)) bestStreet = sy;
  if (Math.abs(bestAvenue - x) <= Math.abs(bestStreet - y)) return { x: bestAvenue, y };
  return { x, y: bestStreet };
}

// A random point on a road, with a lane offset so cars do not all sit dead centre.
export function randomRoadPoint(city, rng) {
  const half = city.roadWidth / 2;
  const lane = rng.pick([-1, 1]) * half * 0.45;
  if (rng.chance(0.5)) {
    return { x: rng.pick(city.avenues) + lane, y: rng.range(80, city.height - 80) };
  }
  return { x: rng.range(80, city.width - 80), y: rng.pick(city.streets) + lane };
}

// A random road point a given distance from (x, y), for spawning police.
export function roadPointNear(city, rng, x, y, minD, maxD) {
  for (let tries = 0; tries < 24; tries += 1) {
    const p = randomRoadPoint(city, rng);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d >= minD && d <= maxD) return p;
  }
  return nearestRoadPoint(city, x + minD, y);
}
