// SOLMARA — the simulation: Leo, cars, traffic, pedestrians, police, the
// wanted system, combat, the four story missions, pickups, saving and loading.
// No drawing and no browser in here: the module runs in Node for tests and in
// the browser for the game. The only browser touch is localStorage, guarded
// so a test can pass its own store instead.
import { CFG, angleTo, clamp, dist, wrapAngle } from './config.js';
import { createRng } from './random.js';
import {
  buildCity, buildingAt, isBeach, isOnRoad, isWater,
  nearestRoadPoint, randomRoadPoint, roadPointNear,
} from './city.js';

// Event types, pushed onto state.events for the loop to turn into sound and text.
export const EVENT_STEAL = 'steal';
export const EVENT_CRASH = 'crash';
export const EVENT_SHOT = 'shot';
export const EVENT_PUNCH = 'punch';
export const EVENT_PICKUP = 'pickup';
export const EVENT_MISSION = 'mission';
export const EVENT_BUSTED = 'busted';
export const EVENT_DEAD = 'dead';
export const EVENT_COP_DOWN = 'copdown';

// The four jobs Mara Voss hands Leo, in order.
export const MISSIONS = [
  { title: 'Hot Wheels', pay: CFG.missionReward1 },
  { title: 'Courier Run', pay: CFG.missionReward2 },
  { title: 'The Comet GT', pay: CFG.missionReward3 },
  { title: 'Meridian Vault', pay: CFG.missionReward4 },
];

// Courier drop points, in order.
export const DROPS = ['oldMarket', 'palmsHotel', 'harborWorks'];

function storageOf(store) {
  if (store) return store;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function createWorld(seed) {
  const rng = createRng(seed);
  const city = buildCity(rng);
  const state = {
    seed,
    time: 0,
    tick: 0,
    city,
    rng,
    nextCarId: 1,
    nextPedId: 1,
    nextPickupId: 1,
    player: {
      x: city.spawn.x, y: city.spawn.y, angle: -Math.PI / 2, speed: 0,
      health: CFG.playerHealth, cash: 40, ammo: CFG.ammoStart,
      inCar: false, carId: null,
      heat: 0, wanted: 0, lastCrime: -99,
      arrestTimer: 0, busted: false, dead: false,
      punchCd: 0, shootCd: 0, walkPhase: 0,
    },
    cars: [],
    peds: [],
    bullets: [],
    pickups: [],
    particles: [],
    mission: { index: 0, stage: 0, dropsDone: 0, crackTimer: 0 },
    storyComplete: false,
    message: '',
    messageTimer: 0,
    events: [],
    copTimer: 0,
    stats: { stolen: 0, busted: 0, earned: 0 },
  };

  // The gold Comet GT, parked by the marina, waiting to be stolen.
  const comet = makeCar(state, city.cometSpot.x, city.cometSpot.y, Math.PI / 2, {
    model: 'comet', color: CFG.cometColor, driver: 'none',
  });
  state.cars.push(comet);

  // Parked cars around the city, free for the taking.
  for (let i = 0; i < 16; i += 1) {
    const p = randomRoadPoint(city, rng);
    state.cars.push(makeCar(state, p.x, p.y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), {
      driver: 'none',
    }));
  }

  // Moving traffic.
  for (let i = 0; i < CFG.trafficCount; i += 1) {
    const car = makeTrafficCar(state);
    state.cars.push(car);
  }

  // Pedestrians on the sidewalks.
  for (let i = 0; i < CFG.pedCount; i += 1) {
    state.peds.push(makePed(state, randomSidewalkPoint(city, rng)));
  }

  // Health, cash and ammo scattered on the roads.
  for (let i = 0; i < CFG.pickupCount; i += 1) {
    state.pickups.push(makePickup(state));
  }

  return state;
}

// One car. The id is unique: the counter increments on every car made, so no
// two cars ever share an id and the player's car is always the right one.
function makeCar(state, x, y, angle, opts = {}) {
  const car = {
    id: state.nextCarId,
    x, y, angle, speed: 0,
    color: opts.color ?? state.rng.pick(CFG.carColors),
    model: opts.model ?? 'sedan',
    driver: opts.driver ?? 'none',
    cruise: opts.cruise ?? 0,
    road: opts.road ?? null,
    disabled: 0,
    health: 100,
  };
  state.nextCarId += 1;
  return car;
}

// A traffic car, driving its own road with a lane offset.
function makeTrafficCar(state) {
  const rng = state.rng;
  const city = state.city;
  const onAvenue = rng.chance(0.5);
  const line = onAvenue ? rng.pick(city.avenues) : rng.pick(city.streets);
  const dir = rng.chance(0.5) ? 1 : -1;
  const lane = rng.pick([-1, 1]) * city.roadWidth * 0.22;
  const pos = onAvenue
    ? { x: line + lane, y: rng.range(90, city.height - 90) }
    : { x: rng.range(90, city.width - 90), y: line + lane };
  const car = makeCar(state, pos.x, pos.y, onAvenue ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), {
    driver: 'traffic',
    cruise: rng.range(CFG.trafficSpeedMin, CFG.trafficSpeedMax),
    road: { axis: onAvenue ? 'avenue' : 'street', line, dir, lane },
  });
  if (rng.chance(0.12)) car.color = CFG.taxiColor;
  car.speed = car.cruise;
  return car;
}

// One pedestrian. Same rule as cars: a unique id from an incrementing counter.
function makePed(state, pos) {
  const rng = state.rng;
  const ped = {
    id: state.nextPedId,
    x: pos.x, y: pos.y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(CFG.pedSpeedMin, CFG.pedSpeedMax),
    health: 50,
    color: rng.pick(['#e2a63b', '#3b7fe2', '#e26a9b', '#37b06a', '#8a5fd0', '#e2e2e2', '#c46a1e']),
    state: 'walk',
    timer: 0,
    fleeX: 0, fleeY: 0,
    road: pos.road,
  };
  state.nextPedId += 1;
  return ped;
}

// A point on a sidewalk: beside a road, off the asphalt.
function randomSidewalkPoint(city, rng) {
  const p = randomRoadPoint(city, rng);
  const half = city.roadWidth / 2;
  const onAvenue = rng.chance(0.5);
  if (onAvenue) {
    const line = rng.pick(city.avenues);
    return {
      x: line + rng.pick([-1, 1]) * (half + 16),
      y: rng.range(90, city.height - 90),
      road: { axis: 'avenue', line, dir: rng.chance(0.5) ? 1 : -1, lane: rng.pick([-1, 1]) * (half + 16) },
    };
  }
  const line = rng.pick(city.streets);
  return {
    x: rng.range(90, city.width - 90),
    y: line + rng.pick([-1, 1]) * (half + 16),
    road: { axis: 'street', line, dir: rng.chance(0.5) ? 1 : -1, lane: rng.pick([-1, 1]) * (half + 16) },
  };
}

function makePickup(state, kind) {
  const rng = state.rng;
  const p = randomRoadPoint(state.city, rng);
  return {
    id: state.nextPickupId,
    x: p.x, y: p.y,
    kind: kind ?? rng.pick(['health', 'cash', 'ammo']),
    active: true,
    timer: 0,
  };
}

// Spawn a parked car at a fixed spot (used by the screenshot scenes).
export function spawnParkedCar(state, x, y, color, model = 'sedan') {
  const car = makeCar(state, x, y, 0, { color: color ?? undefined, model, driver: 'none' });
  state.cars.push(car);
  return car;
}

// The car Leo is driving, or null.
export function playerCar(state) {
  if (!state.player.inCar) return null;
  return state.cars.find((c) => c.id === state.player.carId) ?? null;
}

// The closest car to a point, within a range.
export function nearestCar(state, x, y, range) {
  let best = null;
  let bestD = range;
  for (const car of state.cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function say(state, text) {
  state.message = text;
  state.messageTimer = CFG.messageTime;
}

function addEvent(state, type, data = {}) {
  state.events.push({ type, ...data });
}

function burst(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const v = state.rng.range(speed * 0.3, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: state.rng.range(0.25, 0.6), maxLife: 0.6,
      color, size: state.rng.range(2, 5),
    });
  }
  if (state.particles.length > 220) state.particles.splice(0, state.particles.length - 220);
}

// A point is blocked for driving: inside a building or in the sea.
function blockedForCar(state, x, y) {
  if (x < 24 || x > state.city.width - 24 || y < 24 || y > state.city.height - 24) return true;
  if (isWater(state.city, x, y)) return true;
  return buildingAt(state.city, x, y) !== null;
}

// A point is blocked on foot: buildings and the sea stop Leo, sand does not.
function blockedOnFoot(state, x, y) {
  if (x < 12 || x > state.city.width - 12 || y < 12 || y > state.city.height - 12) return true;
  if (isWater(state.city, x, y)) return true;
  return buildingAt(state.city, x, y) !== null;
}

// Move a car by (dx, dy), sliding along walls instead of sticking to them.
function moveCar(state, car, dx, dy) {
  // Collision points: the centre, the nose and tail, and the four corners,
  // so the drawn body never visibly clips a building it drove past.
  const pts = (x, y) => {
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    const px = -fy;
    const py = fx;
    return [
      [x, y],
      [x + fx * 20, y + fy * 20],
      [x - fx * 20, y - fy * 20],
      [x + fx * 20 + px * 13, y + fy * 20 + py * 13],
      [x + fx * 20 - px * 13, y + fy * 20 - py * 13],
      [x - fx * 20 + px * 13, y - fy * 20 + py * 13],
      [x - fx * 20 - px * 13, y - fy * 20 - py * 13],
    ];
  };
  const clear = (x, y) => pts(x, y).every(([px, py]) => !blockedForCar(state, px, py));
  let hit = false;
  if (clear(car.x + dx, car.y)) car.x += dx;
  else hit = true;
  if (clear(car.x, car.y + dy)) car.y += dy;
  else hit = true;
  return hit;
}

function commitCrime(state, heat) {
  const p = state.player;
  p.heat = Math.min(100, p.heat + heat);
  p.lastCrime = state.time;
  p.wanted = starsForHeat(p.heat);
}

export function starsForHeat(heat) {
  let stars = 0;
  for (const t of CFG.starThresholds) if (heat >= t) stars += 1;
  return stars;
}

// ------------------------------------------------------------------ the step

// One simulation step. `a` is the player's input for this step:
// { up, down, left, right, enterPressed, enterHeld, punchPressed,
//   shootPressed, shootX, shootY } — shootX/Y are world coordinates.
export function stepWorld(state, a, dt) {
  const p = state.player;
  state.time += dt;
  state.tick += 1;

  if (p.dead || p.busted) {
    updateParticles(state, dt);
    return;
  }

  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);

  // E: get in or out of a car.
  if (a.enterPressed) {
    if (p.inCar) exitCar(state);
    else stealCar(state);
  }

  if (p.inCar) drivePlayer(state, a, dt);
  else walkPlayer(state, a, dt);

  if (a.punchPressed) doPunch(state);
  if (a.shootPressed) doShoot(state, a.shootX, a.shootY);

  updateTraffic(state, dt);
  updatePeds(state, dt);
  updateBullets(state, dt);
  updatePickups(state, dt);
  updateParticles(state, dt);
  updateWanted(state, a, dt);
  updateMissions(state, a, dt);

  if (p.health <= 0 && !p.dead) {
    p.dead = true;
    p.health = 0;
    addEvent(state, EVENT_DEAD);
    say(state, 'WASTED — Leo is down.');
  }
  if (state.messageTimer > 0) state.messageTimer -= dt;
}

function exitCar(state) {
  const p = state.player;
  const car = playerCar(state);
  if (!car) {
    p.inCar = false;
    return;
  }
  const side = Math.PI / 2;
  const px = car.x + Math.cos(car.angle + side) * CFG.exitOffset;
  const py = car.y + Math.sin(car.angle + side) * CFG.exitOffset;
  p.x = blockedOnFoot(state, px, py) ? car.x - Math.cos(car.angle + side) * CFG.exitOffset : px;
  p.y = blockedOnFoot(state, px, py) ? car.y - Math.sin(car.angle + side) * CFG.exitOffset : py;
  p.inCar = false;
  p.carId = null;
  p.speed = 0;
  car.driver = 'none';
  car.speed *= 0.2;
}

function stealCar(state) {
  const p = state.player;
  const car = nearestCar(state, p.x, p.y, CFG.stealRange);
  if (!car) return;
  car.driver = 'player';
  p.inCar = true;
  p.carId = car.id;
  p.angle = car.angle;
  p.speed = car.speed;
  state.stats.stolen += 1;
  commitCrime(state, CFG.stealHeat);
  addEvent(state, EVENT_STEAL, { model: car.model });
  say(state, car.model === 'comet' ? 'The Comet GT is yours. Lose the heat, get it to Rico.' : 'You stole the car. The cops noticed.');
  burst(state, car.x, car.y, '#ffffff', 6, 90);
}

function walkPlayer(state, a, dt) {
  const p = state.player;
  let dx = (a.right ? 1 : 0) - (a.left ? 1 : 0);
  let dy = (a.down ? 1 : 0) - (a.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  dx /= len;
  dy /= len;
  p.angle = Math.atan2(dy, dx);
  p.walkPhase += dt * 11;
  const nx = p.x + dx * CFG.walkSpeed * dt;
  const ny = p.y + dy * CFG.walkSpeed * dt;
  if (!blockedOnFoot(state, nx, p.y)) p.x = nx;
  if (!blockedOnFoot(state, p.x, ny)) p.y = ny;
}

function drivePlayer(state, a, dt) {
  const p = state.player;
  const car = playerCar(state);
  if (!car) {
    p.inCar = false;
    return;
  }
  const steer = (a.right ? 1 : 0) - (a.left ? 1 : 0);
  if (a.up) car.speed += CFG.carAccel * dt;
  if (a.down) {
    if (car.speed > 12) car.speed -= CFG.carBrake * dt;
    else car.speed -= CFG.carReverseAccel * dt;
  }
  car.speed -= car.speed * CFG.carDrag * dt;
  car.speed = clamp(car.speed, -CFG.carMaxReverse, CFG.carMaxSpeed);
  const spd = Math.abs(car.speed);
  if (spd > 2) {
    car.angle += steer * CFG.carTurnRate * clamp(spd / 220, 0, 1) * dt * (car.speed >= 0 ? 1 : -1);
  }
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const before = car.speed;
  const hit = moveCar(state, car, fx * car.speed * dt, fy * car.speed * dt);
  if (hit) {
    if (Math.abs(before) > CFG.crashSpeed) {
      addEvent(state, EVENT_CRASH, { speed: Math.abs(before) });
      burst(state, car.x + fx * 24, car.y + fy * 24, '#ffffff', 10, 170);
      p.health = Math.max(0, p.health - 4);
    }
    car.speed *= -0.22;
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = car.speed;
}

// F: a punch at whatever is in front of Leo.
function doPunch(state) {
  const p = state.player;
  if (p.punchCd > 0) return;
  p.punchCd = CFG.punchCooldown;
  addEvent(state, EVENT_PUNCH);
  state.threat = { x: p.x, y: p.y, time: state.time };
  let best = null;
  let bestD = CFG.punchRange;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const d = dist(p.x, p.y, ped.x, ped.y);
    if (d >= bestD) continue;
    const ang = Math.abs(angleTo(p.angle, Math.atan2(ped.y - p.y, ped.x - p.x)));
    if (ang > CFG.punchArc / 2) continue;
    bestD = d;
    best = ped;
  }
  if (!best) return;
  hurtPed(state, best, CFG.punchDamage, p.angle);
  commitCrime(state, CFG.punchHeat);
}

// A mouse click: fire the gun at a world point.
function doShoot(state, tx, ty) {
  const p = state.player;
  if (p.shootCd > 0 || p.ammo <= 0) return;
  p.shootCd = CFG.shootCooldown;
  p.ammo -= 1;
  const ang = Math.atan2(ty - p.y, tx - p.x);
  state.bullets.push({
    x: p.x + Math.cos(ang) * 22,
    y: p.y + Math.sin(ang) * 22,
    vx: Math.cos(ang) * CFG.bulletSpeed,
    vy: Math.sin(ang) * CFG.bulletSpeed,
    life: CFG.bulletRange / CFG.bulletSpeed,
  });
  state.threat = { x: p.x, y: p.y, time: state.time };
  commitCrime(state, CFG.shootHeat);
  addEvent(state, EVENT_SHOT);
}

function hurtPed(state, ped, damage, fromAngle) {
  ped.health -= damage;
  ped.x += Math.cos(fromAngle) * 14;
  ped.y += Math.sin(fromAngle) * 14;
  burst(state, ped.x, ped.y, '#e23b3b', 6, 120);
  if (ped.health <= 0) {
    ped.state = 'down';
    ped.timer = 6;
    commitCrime(state, CFG.killHeat);
    if (state.rng.chance(0.5)) {
      const pick = makePickup(state, 'cash');
      pick.x = ped.x;
      pick.y = ped.y;
      state.pickups.push(pick);
    }
  } else {
    ped.state = 'flee';
    ped.timer = 3;
  }
}

function updateTraffic(state, dt) {
  const city = state.city;
  const rng = state.rng;
  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    // Slow for a car ahead on the same road.
    let want = car.cruise;
    for (const other of state.cars) {
      if (other === car || other.driver === 'none' || !other.road || !car.road) continue;
      if (other.road.axis !== car.road.axis || other.road.line !== car.road.line || other.road.dir !== car.road.dir) continue;
      const along = car.road.axis === 'avenue' ? (other.y - car.y) * car.road.dir : (other.x - car.x) * car.road.dir;
      if (along > 0 && along < 85) want = Math.min(want, Math.max(0, other.speed));
    }
    car.speed += (want - car.speed) * Math.min(1, dt * 2);
    const road = car.road;
    if (road.axis === 'avenue') {
      car.x = road.line + road.lane;
      car.angle = road.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const ny = car.y + road.dir * car.speed * dt;
      let turned = false;
      for (const s of city.streets) {
        if ((car.y - s) * (ny - s) <= 0 && Math.abs(car.y - s) > 1 && rng.chance(0.22)) {
          car.road = { axis: 'street', line: s, dir: rng.chance(0.5) ? 1 : -1, lane: rng.pick([-1, 1]) * city.roadWidth * 0.22 };
          car.y = s + car.road.lane;
          turned = true;
          break;
        }
      }
      if (!turned) {
        car.y = ny;
        if (car.y < 70 || car.y > city.height - 70) {
          road.dir *= -1;
          car.y = clamp(car.y, 70, city.height - 70);
        }
      }
    } else {
      car.y = road.line + road.lane;
      car.angle = road.dir > 0 ? 0 : Math.PI;
      const nx = car.x + road.dir * car.speed * dt;
      let turned = false;
      for (const av of city.avenues) {
        if ((car.x - av) * (nx - av) <= 0 && Math.abs(car.x - av) > 1 && rng.chance(0.22)) {
          car.road = { axis: 'avenue', line: av, dir: rng.chance(0.5) ? 1 : -1, lane: rng.pick([-1, 1]) * city.roadWidth * 0.22 };
          car.x = av + car.road.lane;
          turned = true;
          break;
        }
      }
      if (!turned) {
        car.x = nx;
        if (car.x < 70 || car.x > city.width - 70) {
          road.dir *= -1;
          car.x = clamp(car.x, 70, city.width - 70);
        }
      }
    }
  }
  // Keep the streets busy around Leo: far traffic reappears nearby.
  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    if (dist(car.x, car.y, state.player.x, state.player.y) > 1100 && rng.chance(0.02)) {
      const p = roadPointNear(city, rng, state.player.x, state.player.y, 380, 700);
      car.x = p.x;
      car.y = p.y;
    }
  }
  // Cars never overlap: push touching cars apart.
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d === 0 || d >= 44) continue;
      const push = (44 - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      a.speed *= 0.94;
      b.speed *= 0.94;
    }
  }
}

function updatePeds(state, dt) {
  const p = state.player;
  const car = playerCar(state);
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.timer -= dt;
      if (ped.timer <= 0) {
        ped.health = 50;
        ped.state = 'walk';
      }
      continue;
    }
    // A speeding car mows a pedestrian down.
    if (car && Math.abs(car.speed) > 80 && dist(car.x, car.y, ped.x, ped.y) < 30) {
      hurtPed(state, ped, 60, car.angle);
      commitCrime(state, CFG.killHeat);
      continue;
    }
    const threat = state.threat;
    if (ped.state === 'flee' || (threat && state.time - threat.time < 2 && dist(threat.x, threat.y, ped.x, ped.y) < 170)) {
      ped.state = 'flee';
      ped.timer = Math.max(ped.timer, 1.2);
      const away = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      ped.angle = away;
      ped.x += Math.cos(away) * CFG.pedFleeSpeed * dt;
      ped.y += Math.sin(away) * CFG.pedFleeSpeed * dt;
      ped.timer -= dt;
      if (ped.timer <= 0) ped.state = 'walk';
      continue;
    }
    // Stroll the sidewalk, turning at intersections sometimes.
    const road = ped.road;
    if (!road) continue;
    const step = ped.speed * dt;
    if (road.axis === 'avenue') {
      ped.x = road.line + road.lane;
      ped.angle = road.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const ny = ped.y + road.dir * step;
      let turned = false;
      for (const s of state.city.streets) {
        if ((ped.y - s) * (ny - s) <= 0 && Math.abs(ped.y - s) > 1 && state.rng.chance(0.12)) {
          ped.road = { axis: 'street', line: s, dir: state.rng.chance(0.5) ? 1 : -1, lane: state.rng.pick([-1, 1]) * (state.city.roadWidth / 2 + 16) };
          ped.y = s + ped.road.lane;
          turned = true;
          break;
        }
      }
      if (!turned) {
        ped.y = ny;
        if (ped.y < 60 || ped.y > state.city.height - 60) road.dir *= -1;
      }
    } else {
      ped.y = road.line + road.lane;
      ped.angle = road.dir > 0 ? 0 : Math.PI;
      const nx = ped.x + road.dir * step;
      let turned = false;
      for (const av of state.city.avenues) {
        if ((ped.x - av) * (nx - av) <= 0 && Math.abs(ped.x - av) > 1 && state.rng.chance(0.12)) {
          ped.road = { axis: 'avenue', line: av, dir: state.rng.chance(0.5) ? 1 : -1, lane: state.rng.pick([-1, 1]) * (state.city.roadWidth / 2 + 16) };
          ped.x = av + ped.road.lane;
          turned = true;
          break;
        }
      }
      if (!turned) {
        ped.x = nx;
        if (ped.x < 60 || ped.x > state.city.width - 60) road.dir *= -1;
      }
    }
    // Far pedestrians wander back near Leo.
    if (dist(ped.x, ped.y, p.x, p.y) > 1000 && state.rng.chance(0.01)) {
      const spot = randomSidewalkPoint(state.city, state.rng);
      ped.x = spot.x;
      ped.y = spot.y;
      ped.road = spot.road;
    }
  }
}

function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && blockedForCar(state, b.x, b.y)) {
      burst(state, b.x, b.y, '#ffcf5e', 4, 110);
      dead = true;
    }
    if (!dead) {
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 18) {
          hurtPed(state, ped, CFG.bulletDamage, Math.atan2(b.vy, b.vx));
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of state.cars) {
        if (car.driver !== 'cop' || car.disabled > 0) continue;
        if (dist(b.x, b.y, car.x, car.y) < 28) {
          car.disabled = 4;
          car.health -= CFG.bulletDamage;
          burst(state, b.x, b.y, '#5e9bff', 8, 140);
          addEvent(state, EVENT_COP_DOWN);
          dead = true;
          break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

function updatePickups(state, dt) {
  const p = state.player;
  for (const pick of state.pickups) {
    if (!pick.active) {
      pick.timer -= dt;
      if (pick.timer <= 0) {
        const spot = randomRoadPoint(state.city, state.rng);
        pick.x = spot.x;
        pick.y = spot.y;
        pick.active = true;
      }
      continue;
    }
    if (dist(p.x, p.y, pick.x, pick.y) > 28) continue;
    if (pick.kind === 'health') p.health = Math.min(CFG.playerHealth, p.health + CFG.healthPickup);
    else if (pick.kind === 'cash') {
      const amount = state.rng.int(CFG.cashPickupMin, CFG.cashPickupMax);
      p.cash += amount;
      state.stats.earned += amount;
    } else p.ammo = Math.min(CFG.ammoMax, p.ammo + CFG.ammoPickup);
    pick.active = false;
    pick.timer = CFG.pickupRespawn;
    addEvent(state, EVENT_PICKUP, { kind: pick.kind });
    burst(state, pick.x, pick.y, '#37b06a', 8, 120);
  }
}

function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
}

// Wanted heat, police spawns, the chase and the arrest. The arrest clock
// ticks exactly once per step, however many cops are holding Leo.
function updateWanted(state, a, dt) {
  const p = state.player;
  if (state.time - p.lastCrime > CFG.heatDecayDelay && p.heat > 0) {
    p.heat = Math.max(0, p.heat - CFG.heatDecay * dt);
  }
  p.wanted = starsForHeat(p.heat);

  const cops = state.cars.filter((c) => c.driver === 'cop');
  state.copTimer -= dt;
  if (p.wanted > 0 && cops.length < Math.min(p.wanted, CFG.maxCops) && state.copTimer <= 0) {
    state.copTimer = 1.5;
    const spot = roadPointNear(state.city, state.rng, p.x, p.y, CFG.copSpawnMin, CFG.copSpawnMax);
    const cop = makeCar(state, spot.x, spot.y, Math.atan2(p.y - spot.y, p.x - spot.x), {
      model: 'interceptor', color: CFG.copColor, driver: 'cop', cruise: CFG.copMaxSpeed,
    });
    state.cars.push(cop);
  }
  if (p.wanted === 0) {
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      const car = state.cars[i];
      if (car.driver === 'cop' && dist(car.x, car.y, p.x, p.y) > CFG.copDespawn) state.cars.splice(i, 1);
    }
  }

  // Each cop steers at Leo, braking hard as it closes in so it stops ON him
  // instead of blowing past and orbiting: the target speed falls to zero
  // 24 px out, and the brake bites four times faster up close.
  let nearestCop = Infinity;
  for (const cop of state.cars) {
    if (cop.driver !== 'cop') continue;
    cop.disabled = Math.max(0, cop.disabled - dt);
    const d = dist(cop.x, cop.y, p.x, p.y);
    nearestCop = Math.min(nearestCop, d);
    const close = d < CFG.policeApproachRadius;
    const target = cop.disabled > 0 ? 0 : close
      ? Math.min(CFG.policeApproachMax, Math.max(0, (d - CFG.policeStopGap) * 1.1))
      : CFG.copMaxSpeed;
    cop.speed += (target - cop.speed) * Math.min(1, dt * (close ? 5 : 2.5));
    const turn = d < CFG.policeApproachRadius ? CFG.policeTurnClose : CFG.policeTurnFar;
    const wantAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle += clamp(angleTo(cop.angle, wantAngle), -turn * dt, turn * dt);
    const hit = moveCar(state, cop, Math.cos(cop.angle) * cop.speed * dt, Math.sin(cop.angle) * cop.speed * dt);
    if (hit) cop.speed *= 0.5;
    // A cop ramming Leo's car hurts.
    if (p.inCar && d < 36) {
      p.health = Math.max(0, p.health - CFG.copRamDamage * dt);
      const car = playerCar(state);
      if (car) {
        car.x += Math.cos(cop.angle) * 12 * dt;
        car.y += Math.sin(cop.angle) * 12 * dt;
        p.x = car.x;
        p.y = car.y;
      }
    }
  }

  // The arrest: one clock for all cops, never at zero heat, never mid-crack.
  const cracking = state.mission.index === 3 && state.mission.stage === 1 && state.mission.crackTimer > 0;
  if (p.wanted > 0 && !cracking && nearestCop < CFG.arrestRange) {
    p.arrestTimer += dt;
    if (p.arrestTimer >= CFG.arrestTime) {
      p.busted = true;
      p.arrestTimer = 0;
      state.stats.busted += 1;
      addEvent(state, EVENT_BUSTED);
      say(state, 'BUSTED — the Solmara PD took Leo in.');
    }
  } else {
    p.arrestTimer = Math.max(0, p.arrestTimer - dt * 2);
  }
}

// The story: four jobs, in order.
function updateMissions(state, a, dt) {
  const p = state.player;
  const m = state.mission;
  const places = state.city.places;
  if (state.storyComplete) return;

  if (m.index === 0) {
    if (m.stage === 0 && p.inCar) {
      m.stage = 1;
      say(state, 'Get the car to Mara\'s Bar — The Rusty Anchor.');
    } else if (m.stage === 1 && p.inCar && dist(p.x, p.y, places.marasBar.x, places.marasBar.y) < CFG.arriveRadius) {
      p.cash += CFG.missionReward1;
      state.stats.earned += CFG.missionReward1;
      m.index = 1;
      m.stage = 0;
      addEvent(state, EVENT_MISSION, { index: 0 });
      say(state, 'Mission complete: Hot Wheels +$150. Mara has a courier run for you.');
    }
    return;
  }

  if (m.index === 1) {
    const drop = places[DROPS[m.dropsDone]];
    if (drop && dist(p.x, p.y, drop.x, drop.y) < CFG.arriveRadius) {
      p.cash += CFG.missionDropBonus;
      state.stats.earned += CFG.missionDropBonus;
      m.dropsDone += 1;
      addEvent(state, EVENT_PICKUP, { kind: 'drop' });
      if (m.dropsDone >= DROPS.length) {
        p.cash += CFG.missionReward2;
        state.stats.earned += CFG.missionReward2;
        m.index = 2;
        m.stage = 0;
        addEvent(state, EVENT_MISSION, { index: 1 });
        say(state, 'Mission complete: Courier Run +$300. Now steal the Comet GT at the marina.');
      } else {
        say(state, `Drop ${m.dropsDone} of 3 delivered +$50. Next stop is marked.`);
      }
    }
    return;
  }

  if (m.index === 2) {
    if (m.stage === 0) {
      const car = playerCar(state);
      if (car && car.model === 'comet') {
        m.stage = 1;
        say(state, 'The Comet GT is hot. Deliver it to Rico\'s Chop Shop.');
      }
      return;
    }
    const car = playerCar(state);
    if (car && car.model === 'comet' && dist(p.x, p.y, places.chopShop.x, places.chopShop.y) < CFG.arriveRadius) {
      p.cash += CFG.missionReward3;
      state.stats.earned += CFG.missionReward3;
      m.index = 3;
      m.stage = 0;
      addEvent(state, EVENT_MISSION, { index: 2 });
      say(state, 'Mission complete: The Comet GT +$450. One last job: the Meridian Vault.');
    }
    return;
  }

  if (m.index === 3) {
    if (m.stage === 0 && dist(p.x, p.y, places.vault.x, places.vault.y) < CFG.arriveRadius) {
      m.stage = 1;
      say(state, 'Hold E to crack the vault. The alarm will bring every cop in Solmara.');
      return;
    }
    if (m.stage === 1) {
      const near = dist(p.x, p.y, places.vault.x, places.vault.y) < CFG.crackRadius;
      if (near && a.enterHeld) {
        m.crackTimer += dt;
        if (m.crackTimer >= CFG.crackTime) {
          m.stage = 2;
          p.heat = 100;
          p.lastCrime = state.time;
          p.wanted = 5;
          addEvent(state, EVENT_MISSION, { index: 3, cracked: true });
          say(state, 'Vault cracked! Get back to Mara\'s Bar — fast.');
        }
      } else {
        m.crackTimer = Math.max(0, m.crackTimer - dt * 0.5);
      }
      return;
    }
    if (m.stage === 2 && dist(p.x, p.y, places.marasBar.x, places.marasBar.y) < CFG.arriveRadius) {
      p.cash += CFG.missionReward4;
      state.stats.earned += CFG.missionReward4;
      m.index = 4;
      state.storyComplete = true;
      addEvent(state, EVENT_MISSION, { index: 3 });
      say(state, 'Story complete: Meridian Vault +$1500. Leo is free.');
    }
  }
}

// ------------------------------------------------------------------ saving

export function saveGame(state, store) {
  const p = state.player;
  const data = {
    cash: p.cash,
    health: p.health,
    ammo: p.ammo,
    x: p.x,
    y: p.y,
    missionIndex: state.mission.index,
    missionStage: state.mission.stage,
    dropsDone: state.mission.dropsDone,
    storyComplete: state.storyComplete,
    heat: p.heat,
    time: state.time,
  };
  const s = storageOf(store);
  if (s) {
    try {
      s.setItem(CFG.saveKey, JSON.stringify(data));
    } catch {
      // Storage can be off: the save then lasts this visit only.
    }
  }
  return data;
}

export function loadSave(store) {
  const s = storageOf(store);
  if (!s) return null;
  try {
    const raw = s.getItem(CFG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(state, save) {
  const p = state.player;
  p.cash = save.cash ?? p.cash;
  p.health = save.health ?? p.health;
  p.ammo = save.ammo ?? p.ammo;
  p.x = save.x ?? p.x;
  p.y = save.y ?? p.y;
  p.heat = save.heat ?? 0;
  p.wanted = starsForHeat(p.heat);
  state.mission.index = save.missionIndex ?? 0;
  state.mission.stage = save.missionStage ?? 0;
  state.mission.dropsDone = save.dropsDone ?? 0;
  state.storyComplete = save.storyComplete ?? false;
  p.inCar = false;
  p.carId = null;
}

// ------------------------------------------------------------------ the HUD

// The map point the HUD should point Leo at, or null when there is none.
export function currentTarget(state) {
  const places = state.city.places;
  const m = state.mission;
  if (state.storyComplete) return null;
  if (m.index === 0) {
    if (m.stage === 0) return null;
    return { x: places.marasBar.x, y: places.marasBar.y, label: "Mara's Bar" };
  }
  if (m.index === 1) {
    const drop = places[DROPS[m.dropsDone]];
    if (!drop) return null;
    return { x: drop.x, y: drop.y, label: `Drop ${m.dropsDone + 1} of 3 — ${drop.name}` };
  }
  if (m.index === 2) {
    if (m.stage === 0) return { x: state.city.cometSpot.x, y: state.city.cometSpot.y, label: 'The Comet GT' };
    return { x: places.chopShop.x, y: places.chopShop.y, label: "Rico's Chop Shop" };
  }
  if (m.index === 3) {
    if (m.stage === 2) return { x: places.marasBar.x, y: places.marasBar.y, label: "Mara's Bar — escape!" };
    return { x: places.vault.x, y: places.vault.y, label: 'Meridian Vault' };
  }
  return null;
}

// The mission banner: title, objective and a one-line hint.
export function missionText(state) {
  const m = state.mission;
  if (state.storyComplete) return { title: 'Story Complete', objective: 'Leo is free — Solmara is yours.', hint: '' };
  if (m.index === 0) {
    return m.stage === 0
      ? { title: 'Mission 1 — Hot Wheels', objective: 'Steal any car. Press E next to one.', hint: 'Any parked car will do.' }
      : { title: 'Mission 1 — Hot Wheels', objective: 'Deliver the car to Mara\'s Bar.', hint: 'Follow the yellow marker.' };
  }
  if (m.index === 1) {
    return {
      title: 'Mission 2 — Courier Run',
      objective: `Drop ${m.dropsDone + 1} of 3 — ${state.city.places[DROPS[m.dropsDone]]?.name ?? ''}`,
      hint: 'Each drop pays $50. Finish all three for $300.',
    };
  }
  if (m.index === 2) {
    return m.stage === 0
      ? { title: 'Mission 3 — The Comet GT', objective: 'Steal the gold Comet GT at the marina.', hint: 'It is parked by the docks, east side.' }
      : { title: 'Mission 3 — The Comet GT', objective: 'Deliver the Comet to Rico\'s Chop Shop.', hint: 'Do not scratch the paint. Or do.' };
  }
  if (m.index === 3) {
    if (m.stage === 0) return { title: 'Mission 4 — Meridian Vault', objective: 'Get to the Meridian Vault, Downtown.', hint: 'The big bank on 1650.' };
    if (m.stage === 1) {
      return {
        title: 'Mission 4 — Meridian Vault',
        objective: `Cracking the vault — hold E! ${Math.floor((m.crackTimer / CFG.crackTime) * 100)}%`,
        hint: 'Stay close to the door. The alarm is coming.',
      };
    }
    return { title: 'Mission 4 — Meridian Vault', objective: 'Escape to Mara\'s Bar!', hint: 'Five stars. Drive like your life depends on it.' };
  }
  return { title: '', objective: '', hint: '' };
}

// A one-line wanted label for the HUD.
export function wantedLabel(wanted) {
  if (wanted === 0) return 'CLEAN';
  if (wanted === 1) return 'WANTED';
  if (wanted === 2) return 'PURSUIT';
  if (wanted === 3) return 'HUNTED';
  if (wanted === 4) return 'MANHUNT';
  return 'CITYWIDE MANHUNT';
}

// Is this point on a road? Re-exported for tests and the renderer.
export { isOnRoad, isWater, isBeach };
