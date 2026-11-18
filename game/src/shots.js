// SOLMARA — the screenshot scenes behind ?shot=start|drive|chase|mission.
// Each one plays the real rules forward from a fresh world for a fixed time,
// steered by a simple autopilot that drives Leo's car toward his mission
// target, so the frame is what a short game really looks like and the same
// seed always gives the same frame. The camera snaps onto Leo before the
// paint: a shot paints only twice, and a smooth camera would still be
// travelling from the spawn point.
import { CFG } from './config.js';
import { currentTarget, spawnParkedCar } from './world.js';

// How long each scene runs before its frame is taken.
export const SHOT_SECONDS = { start: 6, drive: 14, chase: 8, mission: 3 };

// The autopilot: drive toward the mission target, reverse out if stuck.
function makeDriver() {
  let stuckTime = 0;
  let reversing = 0;
  return function drive(state) {
    const p = state.player;
    const target = currentTarget(state);
    const a = { up: false, down: false, left: false, right: false, enterPressed: false, enterHeld: false, punchPressed: false, shootPressed: false, shootX: 0, shootY: 0 };
    if (reversing > 0) {
      reversing -= 1 / 60;
      a.down = true;
      a.left = true;
      return a;
    }
    if (p.inCar) {
      const car = state.cars.find((c) => c.id === p.carId);
      if (!car) return a;
      if (Math.abs(car.speed) < 20) {
        stuckTime += 1 / 60;
        if (stuckTime > 1.5) {
          stuckTime = 0;
          reversing = 0.9;
          return a;
        }
      } else {
        stuckTime = 0;
      }
      const tx = target ? target.x : car.x + Math.cos(car.angle) * 400;
      const ty = target ? target.y : car.y + Math.sin(car.angle) * 400;
      const want = Math.atan2(ty - car.y, tx - car.x);
      let turn = want - car.angle;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      a.up = true;
      if (turn > 0.12) a.right = true;
      else if (turn < -0.12) a.left = true;
      return a;
    }
    // On foot: walk toward the target.
    if (!target) return a;
    const want = Math.atan2(target.y - p.y, target.x - p.x);
    const dx = Math.cos(want);
    const dy = Math.sin(want);
    a.up = dy < -0.3;
    a.down = dy > 0.3;
    a.left = dx < -0.3;
    a.right = dx > 0.3;
    return a;
  };
}

function idleActions() {
  return { up: false, down: false, left: false, right: false, enterPressed: false, enterHeld: false, punchPressed: false, shootPressed: false, shootX: 0, shootY: 0 };
}

// Put Leo in the closest parked car, the way the E key would.
function putLeoInCar(state) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.driver !== 'none') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return;
  best.driver = 'player';
  p.inCar = true;
  p.carId = best.id;
  p.angle = best.angle;
  p.x = best.x;
  p.y = best.y;
}

// Set the scene up and return its screen plus a driver for the run.
export function stageShot(state, name) {
  const driver = makeDriver();
  if (name === 'drive') {
    putLeoInCar(state);
    state.player.heat = 25;
    state.player.wanted = 1;
    state.player.lastCrime = state.time;
    state.mission.index = 0;
    state.mission.stage = 1;
    state.message = '';
    state.messageTimer = 0;
    return { screen: 'play', drive: driver };
  }
  if (name === 'chase') {
    putLeoInCar(state);
    state.player.heat = 88;
    state.player.wanted = 5;
    state.player.lastCrime = state.time;
    // A yellow taxi crossing the avenue, for a busier frame.
    spawnParkedCar(state, 1650, 700, CFG.taxiColor, 'taxi');
    state.message = '';
    state.messageTimer = 0;
    return { screen: 'play', drive: driver };
  }
  if (name === 'mission') {
    const p = state.player;
    p.x = 1650;
    p.y = 1360;
    p.angle = Math.PI / 2;
    p.heat = 28;
    p.wanted = 2;
    p.lastCrime = state.time;
    state.mission.index = 3;
    state.mission.stage = 1;
    state.mission.crackTimer = CFG.crackTime * 0.55;
    state.message = '';
    state.messageTimer = 0;
    return { screen: 'play', drive: () => idleActions() };
  }
  // start: the title screen over a living city.
  return { screen: 'title', drive: () => idleActions() };
}

// The seconds a scene runs, by name (anything else is the title scene).
export function shotSeconds(name) {
  return SHOT_SECONDS[name] ?? SHOT_SECONDS.start;
}
