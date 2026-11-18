// world.js — the simulation of SOLMARA: player, cars, traffic, peds,
// police, wanted level, combat, missions, pickups, save and load.
// One file, one job: it owns every moving thing and every rule. It
// never draws anything (render.js does that) and never touches the DOM
// except localStorage for saves. main.js calls update(dt) once a frame
// while the game is in the 'play' screen; shots.js reaches in and
// stages scenes by setting fields directly.

import {
  WORLD_W, WORLD_H, AVENUES, STREETS, ROAD_W, SAND_X, SEA_X, PLAZA, MARINA,
  PLACES, PLAYER, CAR_MODELS, POLICE_COLOR, WANTED, POLICE, VIPER,
  TRAFFIC, PEDS, STASH_VALUE, STASH_SPOTS, KILL_PAYOUT, MISSIONS, SAVE_KEY,
} from './config.js';
import { buildCity, onRoad, inSea, onSand, collideBuildings, clampToLand } from './city.js';
import { makeRng } from './random.js';

const TAU = Math.PI * 2;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

export function createWorld(seed, audio) {
  const rng = makeRng(seed);
  const city = buildCity(seed);

  const world = {
    seed,
    rng,
    city,
    audio,
    time: 0,
    // The player: Leo Marin.
    player: {
      x: PLACES.start.x, y: PLACES.start.y, angle: -Math.PI / 2, aim: 0,
      hp: PLAYER.maxHp, cash: 0, inCar: null, speed: 0,
    },
    cash: 0,
    kills: 0,
    // Camera centre (world coords) and a small trauma-based shake.
    camera: { x: PLACES.start.x, y: PLACES.start.y },
    titleCam: { x: 1400, y: 1250 },
    shake: 0,
    // Wanted: heat is the float, stars the 0-5 display.
    wantedHeat: 0,
    stars: 0,
    lastCrimeAt: -999,
    // Mission progress.
    missionIndex: 0,
    stepIndex: 0,
    missionDone: false,
    victory: false,
    vipersDown: 0,
    strongboxSpawned: false,
    crateTaken: false,
    vaultTaken: false,
    // Entities.
    traffic: [],
    parked: [],
    peds: [],
    cruisers: [],
    footCops: [],
    vipers: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    floaters: [],
    stashes: STASH_SPOTS.map((s) => ({ ...s, found: false })),
    log: [],
    // HUD text: banners queue so MISSION COMPLETE is never overwritten
    // in the same tick by NEW MISSION (see completeMission).
    banner: null,
    bannerTimer: 0,
    pendingBanner: null,
    pendingBannerAt: 0,
    saveToastTimer: 0,
    bustWarning: 0,
    dead: null, // 'wasted' | 'busted' | null
    hurtCooldown: 0,
    // Staging support: shots.js sets these; the real game never does.
    staged: false,
  };

  // ---- spawning -------------------------------------------------------

  function randomRoadPoint() {
    if (rng.chance(0.5)) {
      return { x: rng.pick(AVENUES) + rng.range(-20, 20), y: rng.range(80, WORLD_H - 80) };
    }
    return { x: rng.range(80, WORLD_W - 80), y: rng.pick(STREETS) + rng.range(-20, 20) };
  }

  function spawnTraffic() {
    world.traffic = [];
    for (let i = 0; i < TRAFFIC.count; i++) {
      const vertical = rng.chance(0.5);
      const model = rng.pick(CAR_MODELS);
      const dir = rng.chance(0.5) ? 1 : -1;
      let x, y;
      if (vertical) {
        x = rng.pick(AVENUES) + (dir === 1 ? 22 : -22);
        y = rng.range(0, WORLD_H);
      } else {
        x = rng.range(0, WORLD_W);
        y = rng.pick(STREETS) + (dir === 1 ? 22 : -22);
      }
      world.traffic.push({
        x, y, dir, vertical,
        angle: vertical ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (dir === 1 ? 0 : Math.PI),
        speed: rng.range(TRAFFIC.speedMin, TRAFFIC.speedMax),
        model, color: model.color, cruise: rng.range(50, 90),
      });
    }
    // Parked cars sit along the roadsides, waiting to be stolen.
    world.parked = [];
    for (let i = 0; i < TRAFFIC.parkedCount; i++) {
      const p = randomRoadPoint();
      const model = rng.pick(CAR_MODELS);
      const vertical = onRoad(p.x, p.y) && Math.abs(p.x - rng.pick(AVENUES)) < 60;
      world.parked.push({
        x: p.x, y: p.y, angle: rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
        speed: 0, model, color: model.color, parked: true,
      });
    }
    // One parked car right by the plaza so mission 1 can start fast.
    world.parked.push({
      x: PLACES.start.x + 120, y: PLACES.start.y + 30, angle: 0,
      speed: 0, model: CAR_MODELS[0], color: CAR_MODELS[0].color, parked: true,
    });
  }

  function spawnPeds() {
    world.peds = [];
    const shirts = ['#e84a4a', '#4a7fe8', '#e8c84a', '#4ae88a', '#e84ad8', '#f2f2f2', '#333333', '#e88a4a'];
    for (let i = 0; i < PEDS.count; i++) {
      const p = randomRoadPoint();
      // Sidewalk offset: just off the road edge.
      const x = Math.max(20, Math.min(WORLD_W - 20, p.x + rng.range(-90, 90)));
      const y = Math.max(20, Math.min(WORLD_H - 20, p.y + rng.range(-90, 90)));
      world.peds.push({
        x, y, angle: rng.range(0, TAU), speed: rng.range(PEDS.speedMin, PEDS.speedMax),
        shirt: rng.pick(shirts), skin: rng.pick(['#f2c89a', '#c98a5a', '#8a5a3a', '#e8b88a']),
        dead: false, deadTimer: 0, flee: 0, tx: x, ty: y,
      });
    }
  }

  spawnTraffic();
  spawnPeds();

  // ---- helpers ----------------------------------------------------------

  function addFloater(x, y, text, color) {
    world.floaters.push({ x, y, text, color: color || '#ffffff', t: 0 });
    if (world.floaters.length > 24) world.floaters.shift();
  }

  function addLog(text) {
    world.log.unshift(text);
    if (world.log.length > 5) world.log.pop();
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, TAU);
      const s = rng.range(speed * 0.3, speed);
      world.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rng.range(0.3, 0.8), maxLife: 0.8, color, size: rng.range(2, 5),
      });
    }
    if (world.particles.length > 300) world.particles.splice(0, world.particles.length - 300);
  }

  function addCrime(amount) {
    world.wantedHeat = Math.min(WANTED.maxStars, world.wantedHeat + amount);
    world.lastCrimeAt = world.time;
  }

  function starsFromHeat() {
    if (world.wantedHeat <= 0.01) return 0;
    return Math.min(WANTED.maxStars, Math.ceil(world.wantedHeat - 0.001));
  }

  function currentMission() {
    return MISSIONS[world.missionIndex] || null;
  }

  function currentStep() {
    const m = currentMission();
    return m ? m.steps[world.stepIndex] || null : null;
  }

  function targetPos() {
    const step = currentStep();
    if (!step || !step.target) return null;
    const place = PLACES[step.target];
    return place ? { x: place.x, y: place.y, label: place.label } : null;
  }

  // ---- missions ---------------------------------------------------------

  function beginStep() {
    const step = currentStep();
    if (!step) return;
    if (step.kind === 'clear') {
      // Four Crimson Vipers hold the warehouse yard.
      world.vipers = [];
      const base = PLACES.warehouse;
      for (let i = 0; i < VIPER.count; i++) {
        const a = (i / VIPER.count) * TAU + 0.4;
        world.vipers.push({
          x: base.x + Math.cos(a) * 110, y: base.y + Math.sin(a) * 90,
          angle: 0, hp: VIPER.hp, maxHp: VIPER.hp, fireCd: rng.range(0.5, 1.5),
          speed: VIPER.speed, alive: true,
        });
      }
      world.vipersDown = 0;
      world.strongboxSpawned = false;
      addLog('Vipers hold the yard — take them down.');
    }
    if (step.kind === 'collect' && world.missionIndex === 3) {
      addLog('The vault is open. Grab the cash — the alarm will sound.');
    }
  }

  function startMission(i) {
    world.missionIndex = i;
    world.stepIndex = 0;
    const m = MISSIONS[i];
    world.banner = { title: `NEW MISSION — ${m.title}`, sub: m.brief, kind: 'mission' };
    world.bannerTimer = 4;
    audio.missionStart();
    addLog(`New mission: ${m.title}`);
    beginStep();
  }

  function advanceStep() {
    world.stepIndex++;
    const m = currentMission();
    if (world.stepIndex >= m.steps.length) {
      completeMission();
      return;
    }
    beginStep();
  }

  function completeMission() {
    const m = currentMission();
    world.cash += m.reward;
    world.player.cash = world.cash;
    addFloater(world.player.x, world.player.y - 30, `+$${m.reward}`, '#7CFC00');
    audio.fanfare();
    addLog(`Mission complete: ${m.title} (+$${m.reward})`);
    // The banner queue: MISSION COMPLETE stays up ~3.4 s, and only
    // then does NEW MISSION appear. Never overwrite in the same tick.
    world.banner = { title: `MISSION COMPLETE — ${m.title}`, sub: `+$${m.reward}  ·  Cash $${world.cash}`, kind: 'complete' };
    world.bannerTimer = 3.4;
    world.pendingBannerAt = world.time + 3.4;
    if (world.missionIndex + 1 < MISSIONS.length) {
      const next = MISSIONS[world.missionIndex + 1];
      world.pendingBanner = { title: `NEW MISSION — ${next.title}`, sub: next.brief, kind: 'mission' };
      world.pendingMission = world.missionIndex + 1;
    } else {
      world.pendingBanner = null;
      world.pendingMission = null;
      world.missionDone = true;
      world.victory = true;
    }
    saveGame();
  }

  function checkStep(dt) {
    const m = currentMission();
    if (!m || world.victory) return;
    const step = currentStep();
    if (!step) return;
    const p = world.player;
    if (step.kind === 'steal') {
      if (p.inCar) {
        addLog('Car secured. Get it to the garage.');
        advanceStep();
      }
      return;
    }
    if (step.kind === 'goto' || step.kind === 'escape') {
      const t = targetPos();
      if (t && dist(p.x, p.y, t.x, t.y) < (step.radius || 100)) {
        if (step.kind === 'escape' && world.missionIndex === 3 && world.stars < 2) {
          // The big score only counts as an escape while the heat is on.
          return;
        }
        advanceStep();
      }
      return;
    }
    if (step.kind === 'pickup') {
      const t = targetPos();
      if (t && dist(p.x, p.y, t.x, t.y) < 70 && !world.crateTaken) {
        world.crateTaken = true;
        audio.pickup();
        addFloater(p.x, p.y - 30, 'CRATE SECURED', '#ffd94a');
        advanceStep();
      }
      return;
    }
    if (step.kind === 'clear') {
      if (world.vipers.length > 0 && world.vipers.every((v) => !v.alive)) {
        world.strongboxSpawned = true;
        addLog('Yard clear. The strongbox is yours.');
        advanceStep();
      }
      return;
    }
    if (step.kind === 'collect') {
      const t = targetPos();
      if (!t) return;
      if (dist(p.x, p.y, t.x, t.y) < 70) {
        if (world.missionIndex === 2 && world.strongboxSpawned) {
          audio.cash();
          addFloater(p.x, p.y - 30, 'STRONGBOX +$500', '#ffd94a');
          advanceStep();
        } else if (world.missionIndex === 3 && !world.vaultTaken) {
          world.vaultTaken = true;
          addCrime(WANTED.vaultAlarm);
          audio.cash();
          burst(p.x, p.y, '#ff3b30', 18, 160);
          addFloater(p.x, p.y - 30, 'VAULT CASH!', '#ffd94a');
          addLog('Alarm tripped! Lose the heat and reach the hideout.');
          advanceStep();
        }
      }
      return;
    }
  }

  // ---- player -----------------------------------------------------------

  function nearestCar(maxDist) {
    const p = world.player;
    let best = null;
    let bestD = maxDist;
    for (const c of [...world.parked, ...world.traffic]) {
      const d = dist(p.x, p.y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    for (const c of world.cruisers) {
      const d = dist(p.x, p.y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function stealCar(car) {
    const p = world.player;
    p.inCar = car;
    car.parked = false;
    car.stolen = true;
    car.speed = 0;
    p.x = car.x;
    p.y = car.y;
    audio.door();
    addCrime(WANTED.stealCar);
    addLog(`Stole a ${car.model.name}. The law noticed.`);
    addFloater(car.x, car.y - 34, 'CAR STOLEN', '#ff9a3a');
  }

  function exitCar() {
    const p = world.player;
    const car = p.inCar;
    if (!car) return;
    p.inCar = null;
    const side = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(side) * 34;
    p.y = car.y + Math.sin(side) * 34;
    clampToLand(p, PLAYER.radius);
    audio.door();
  }

  function shootBullet(fromX, fromY, angle, owner) {
    const list = owner === 'player' ? world.bullets : world.enemyBullets;
    list.push({
      x: fromX, y: fromY, px: fromX, py: fromY,
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      life: PLAYER.bulletRange / PLAYER.bulletSpeed, owner,
    });
  }

  function playerShoot(input, view) {
    const p = world.player;
    if (p.inCar) return; // No drive-by shooting: get out to fight.
    const want = input.mouse.down || input.mouse.justDown || input.pressed('space');
    if (!want) return;
    if (world.fireCd > 0) return;
    world.fireCd = PLAYER.fireCooldown;
    const gx = p.x + Math.cos(p.aim) * 22;
    const gy = p.y + Math.sin(p.aim) * 22;
    shootBullet(gx, gy, p.aim, 'player');
    audio.shoot();
    world.shake = Math.min(world.shake + 2, 5);
    addCrime(WANTED.shootPerShot);
    // Nearby peds scatter at the sound of gunfire.
    for (const ped of world.peds) {
      if (!ped.dead && dist(ped.x, ped.y, p.x, p.y) < 320) ped.flee = 2.5;
    }
  }

  function updatePlayer(dt, input, view) {
    const p = world.player;
    if (world.fireCd > 0) world.fireCd -= dt;
    if (world.hurtCooldown > 0) world.hurtCooldown -= dt;
    // Aim follows the mouse: world point under the cursor.
    const wx = world.camera.x + (input.mouse.x - view.w / 2);
    const wy = world.camera.y + (input.mouse.y - view.h / 2);
    p.aim = angleTo(p.x, p.y, wx, wy);

    if (p.inCar) {
      const car = p.inCar;
      const model = car.model;
      const forward = input.down('w') || input.down('arrowup');
      const back = input.down('s') || input.down('arrowdown');
      const left = input.down('a') || input.down('arrowleft');
      const right = input.down('d') || input.down('arrowright');
      if (forward) car.speed += model.accel * dt;
      else if (back) car.speed -= model.accel * 0.8 * dt;
      else car.speed *= Math.pow(0.35, dt); // coast to a stop
      car.speed = Math.max(-model.topSpeed * 0.45, Math.min(model.topSpeed, car.speed));
      const steer = (left ? -1 : 0) + (right ? 1 : 0);
      if (Math.abs(car.speed) > 12) {
        car.angle += steer * model.turn * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 140);
      }
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const before = { x: car.x, y: car.y };
      collideBuildings(world.city, car, 20);
      if (car.x !== before.x || car.y !== before.y) {
        car.speed *= 0.45;
        if (Math.abs(car.speed) > 120 && world.hurtCooldown <= 0) {
          audio.crash();
          burst(car.x, car.y, '#ffb03a', 8, 120);
        }
      }
      clampToLand(car, 20);
      if (onSand(car.x, car.y)) car.speed *= Math.pow(0.5, dt);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      audio.engine(Math.abs(car.speed) / model.topSpeed);
      if (input.pressed('e')) exitCar();
      return;
    }

    audio.engine(0);
    const mv = input.moveVector();
    const running = input.down('shift');
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    p.x += mv.x * speed * dt;
    p.y += mv.y * speed * dt;
    if (mv.x !== 0 || mv.y !== 0) p.angle = Math.atan2(mv.y, mv.x);
    collideBuildings(world.city, p, PLAYER.radius);
    clampToLand(p, PLAYER.radius);

    // Steal prompt: the nearest car in reach.
    const near = nearestCar(72);
    world.stealTarget = near;
    if (input.pressed('e') && near) stealCar(near);

    playerShoot(input, view);

    // Stashes: walk over one to pocket $75.
    for (const s of world.stashes) {
      if (!s.found && dist(p.x, p.y, s.x, s.y) < 42) {
        s.found = true;
        world.cash += STASH_VALUE;
        p.cash = world.cash;
        audio.cash();
        addFloater(s.x, s.y - 20, `STASH +$${STASH_VALUE}`, '#7CFC00');
        addLog(`Found a hidden stash (+$${STASH_VALUE}).`);
      }
    }
  }

  // ---- traffic and pedestrians ------------------------------------------

  function updateTraffic(dt) {
    for (const c of world.traffic) {
      if (c.parked) continue;
      let speed = c.speed;
      // Slow down for a car ahead on the same lane.
      for (const o of world.traffic) {
        if (o === c || o.vertical !== c.vertical) continue;
        const along = c.vertical ? (o.y - c.y) * c.dir : (o.x - c.x) * c.dir;
        const lateral = c.vertical ? Math.abs(o.x - c.x) : Math.abs(o.y - c.y);
        if (along > 0 && along < 70 && lateral < 30) speed = Math.min(speed, 30);
      }
      // And for the player's car right ahead.
      const p = world.player;
      if (p.inCar) {
        const along = c.vertical ? (p.y - c.y) * c.dir : (p.x - c.x) * c.dir;
        const lateral = c.vertical ? Math.abs(p.x - c.x) : Math.abs(p.y - c.y);
        if (along > 0 && along < 70 && lateral < 30) speed = Math.min(speed, 20);
      }
      if (c.vertical) c.y += c.dir * speed * dt;
      else c.x += c.dir * speed * dt;
      // Wrap around the map edge.
      if (c.x < -60) c.x = WORLD_W + 60;
      if (c.x > WORLD_W + 60) c.x = -60;
      if (c.y < -60) c.y = WORLD_H + 60;
      if (c.y > WORLD_H + 60) c.y = -60;
      // A slow cruise keeps staged screenshots dense: cars dawdle.
      c.speed = Math.min(c.speed, c.cruise * 2);
    }
    // Traffic that hits the on-foot player knocks him down.
    const p = world.player;
    if (!p.inCar && world.hurtCooldown <= 0) {
      for (const c of world.traffic) {
        if (dist(p.x, p.y, c.x, c.y) < 30) {
          p.hp -= 8;
          world.hurtCooldown = 1;
          audio.crash();
          burst(p.x, p.y, '#ff5a3a', 10, 140);
          addLog('Hit by traffic!');
          break;
        }
      }
    }
  }

  function updatePeds(dt) {
    for (const ped of world.peds) {
      if (ped.dead) {
        ped.deadTimer -= dt;
        if (ped.deadTimer <= 0) {
          const spot = randomRoadPoint();
          ped.x = spot.x;
          ped.y = spot.y;
          ped.dead = false;
        }
        continue;
      }
      if (ped.flee > 0) {
        ped.flee -= dt;
        const away = angleTo(world.player.x, world.player.y, ped.x, ped.y);
        ped.x += Math.cos(away) * ped.speed * 2.2 * dt;
        ped.y += Math.sin(away) * ped.speed * 2.2 * dt;
        ped.angle = away;
      } else {
        if (dist(ped.x, ped.y, ped.tx, ped.ty) < 20 || rng.chance(dt * 0.05)) {
          const spot = randomRoadPoint();
          ped.tx = spot.x;
          ped.ty = spot.y;
        }
        const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
        ped.angle = a;
        ped.x += Math.cos(a) * ped.speed * dt;
        ped.y += Math.sin(a) * ped.speed * dt;
      }
      collideBuildings(world.city, ped, 10);
      clampToLand(ped, 10);
      // Run over by the player's car: a crime, and the ped is down.
      const p = world.player;
      if (p.inCar && dist(ped.x, ped.y, p.x, p.y) < 30) {
        ped.dead = true;
        ped.deadTimer = 18;
        addCrime(WANTED.hitPed);
        audio.crash();
        burst(ped.x, ped.y, '#ff5a3a', 12, 150);
        addLog('Pedestrian down — the heat rises.');
      }
    }
  }

  // ---- police -------------------------------------------------------------

  function spawnCruiser() {
    const p = world.player;
    // Pick a road point roughly 700 m away from the player.
    for (let tries = 0; tries < 12; tries++) {
      const a = rng.range(0, TAU);
      const x = p.x + Math.cos(a) * POLICE.spawnDistance;
      const y = p.y + Math.sin(a) * POLICE.spawnDistance;
      if (x < 60 || x > WORLD_W - 60 || y < 60 || y > WORLD_H - 60) continue;
      if (inSea(x, y)) continue;
      const vertical = rng.chance(0.5);
      world.cruisers.push({
        x, y, angle: rng.range(0, TAU), speed: 0,
        model: { name: 'Solmar Interceptor', color: POLICE_COLOR, accel: 480, topSpeed: 460, turn: 3.0, len: 48, wid: 23 },
        color: POLICE_COLOR, police: true, hp: 100, ramCd: 0, light: 0,
      });
      return;
    }
  }

  function spawnFootCop() {
    const p = world.player;
    const a = rng.range(0, TAU);
    const x = Math.max(40, Math.min(WORLD_W - 40, p.x + Math.cos(a) * 420));
    const y = Math.max(40, Math.min(WORLD_H - 40, p.y + Math.sin(a) * 420));
    world.footCops.push({
      x, y, angle: 0, hp: 60, fireCd: rng.range(0.5, 1.2),
      bustTimer: 0, alive: true,
    });
  }

  function updatePolice(dt) {
    const p = world.player;
    // Wanted decays only after a quiet spell with no new crime.
    if (world.time - world.lastCrimeAt > WANTED.quietSeconds && world.wantedHeat > 0) {
      world.wantedHeat = Math.max(0, world.wantedHeat - WANTED.decayPerSecond * dt);
    }
    world.stars = starsFromHeat();

    // Cruisers: one per star, up to five.
    const wantCruisers = Math.min(WANTED.maxCruisers, world.stars * WANTED.cruisersPerStar);
    while (world.cruisers.length < wantCruisers) spawnCruiser();
    if (world.stars === 0) {
      // No heat, no chase: cruisers peel off once far away.
      world.cruisers = world.cruisers.filter((c) => dist(c.x, c.y, p.x, p.y) < 900);
    }
    for (const c of world.cruisers) {
      c.light += dt * 6;
      c.ramCd -= dt;
      const target = angleTo(c.x, c.y, p.x, p.y);
      c.angle += wrapAngle(target - c.angle) * Math.min(1, 3.2 * dt);
      c.speed = Math.min(POLICE.cruiserSpeed, c.speed + 420 * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      collideBuildings(world.city, c, 20);
      clampToLand(c, 20);
      // Ram: a hard hit with a cooldown, never continuous damage.
      if (dist(c.x, c.y, p.x, p.y) < 52 && c.ramCd <= 0) {
        c.ramCd = POLICE.ramCooldown;
        if (p.inCar) {
          p.inCar.speed *= 0.55;
        } else {
          p.hp -= POLICE.cruiserRamDamage;
        }
        world.shake = Math.min(world.shake + 4, 8);
        audio.crash();
        burst(p.x, p.y, '#ffb03a', 10, 130);
      }
    }

    // Foot cops from 2 stars up: they chase, shoot, and bust.
    const wantCops = world.stars >= WANTED.footCopsFromStar
      ? Math.min(WANTED.maxFootCops, world.stars - 1)
      : 0;
    while (world.footCops.filter((c) => c.alive).length < wantCops) spawnFootCop();
    if (world.stars < WANTED.footCopsFromStar) {
      for (const c of world.footCops) c.alive = false;
    }
    world.bustWarning = 0;
    for (const cop of world.footCops) {
      if (!cop.alive) continue;
      cop.fireCd -= dt;
      const d = dist(cop.x, cop.y, p.x, p.y);
      const a = angleTo(cop.x, cop.y, p.x, p.y);
      cop.angle = a;
      if (d > 34) {
        cop.x += Math.cos(a) * POLICE.copSpeed * dt;
        cop.y += Math.sin(a) * POLICE.copSpeed * dt;
      }
      collideBuildings(world.city, cop, 11);
      clampToLand(cop, 11);
      if (d < 46 && !p.inCar) {
        // Held long enough: busted.
        cop.bustTimer += dt;
        world.bustWarning = Math.max(world.bustWarning, cop.bustTimer / PLAYER.bustHoldSeconds);
        if (cop.bustTimer >= PLAYER.bustHoldSeconds) {
          world.dead = 'busted';
          return;
        }
      } else {
        cop.bustTimer = 0;
      }
      if (world.stars >= 2 && d < POLICE.copShootRange && d > 60 && cop.fireCd <= 0) {
        cop.fireCd = POLICE.copFireCooldown * rng.range(0.9, 1.3);
        const spread = rng.range(-0.12, 0.12);
        shootBullet(cop.x, cop.y, a + spread, 'cop');
        audio.enemyShoot();
      }
    }
    world.footCops = world.footCops.filter((c) => c.alive);

    audio.siren(world.stars > 0);
  }

  // ---- combat -------------------------------------------------------------

  function updateBullets(dt) {
    const p = world.player;
    for (const b of world.bullets) {
      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H || inSea(b.x, b.y)) {
        b.life = 0;
        continue;
      }
      // Vipers.
      for (const v of world.vipers) {
        if (!v.alive) continue;
        if (dist(b.x, b.y, v.x, v.y) < 20) {
          b.life = 0;
          v.hp -= PLAYER.pistolDamage;
          burst(b.x, b.y, '#ff5a3a', 6, 100);
          if (v.hp <= 0) {
            v.alive = false;
            world.vipersDown++;
            world.kills++;
            world.cash += KILL_PAYOUT;
            p.cash = world.cash;
            addFloater(v.x, v.y - 26, `+$${KILL_PAYOUT}`, '#ffd94a');
            addLog(`Viper down (${world.vipersDown}/${VIPER.count}).`);
            burst(v.x, v.y, '#ff3b30', 16, 160);
            audio.crash();
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      // Foot cops.
      for (const cop of world.footCops) {
        if (!cop.alive) continue;
        if (dist(b.x, b.y, cop.x, cop.y) < 18) {
          b.life = 0;
          cop.hp -= PLAYER.pistolDamage;
          burst(b.x, b.y, '#ff5a3a', 6, 100);
          if (cop.hp <= 0) {
            cop.alive = false;
            world.kills++;
            world.cash += KILL_PAYOUT;
            p.cash = world.cash;
            addFloater(cop.x, cop.y - 26, `+$${KILL_PAYOUT}`, '#ffd94a');
            addCrime(0.4);
            addLog('Cop down — the whole city is coming.');
            burst(cop.x, cop.y, '#3a6fd8', 16, 160);
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      // Cruisers: bullets can wreck one, with a payout.
      for (const c of world.cruisers) {
        if (dist(b.x, b.y, c.x, c.y) < 30) {
          b.life = 0;
          c.hp -= PLAYER.pistolDamage;
          burst(b.x, b.y, '#ffb03a', 6, 100);
          if (c.hp <= 0) {
            c.wrecked = true;
            world.kills++;
            world.cash += KILL_PAYOUT;
            p.cash = world.cash;
            addCrime(WANTED.wreckCruiser);
            addFloater(c.x, c.y - 30, 'CRUISER WRECKED', '#ff9a3a');
            burst(c.x, c.y, '#ff7a3a', 26, 220);
            audio.crash();
          }
          break;
        }
      }
    }
    world.bullets = world.bullets.filter((b) => b.life > 0);
    world.cruisers = world.cruisers.filter((c) => !c.wrecked);

    for (const b of world.enemyBullets) {
      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (dist(b.x, b.y, p.x, p.y) < (p.inCar ? 26 : 16)) {
        b.life = 0;
        p.hp -= b.owner === 'viper' ? VIPER.damage : POLICE.copDamage;
        world.shake = Math.min(world.shake + 3, 7);
        burst(p.x, p.y, '#ff5a3a', 6, 110);
      }
    }
    world.enemyBullets = world.enemyBullets.filter((b) => b.life > 0);

    // Vipers fight back: close in and shoot.
    for (const v of world.vipers) {
      if (!v.alive) continue;
      v.fireCd -= dt;
      const d = dist(v.x, v.y, p.x, p.y);
      const a = angleTo(v.x, v.y, p.x, p.y);
      v.angle = a;
      if (d > 160) {
        v.x += Math.cos(a) * v.speed * dt;
        v.y += Math.sin(a) * v.speed * dt;
        collideBuildings(world.city, v, 12);
        clampToLand(v, 12);
      }
      if (d < VIPER.shootRange && v.fireCd <= 0) {
        v.fireCd = VIPER.fireCooldown * rng.range(0.9, 1.4);
        shootBullet(v.x, v.y, a + rng.range(-0.14, 0.14), 'viper');
        audio.enemyShoot();
      }
    }
  }

  // ---- save / load ----------------------------------------------------------

  function saveGame() {
    try {
      const p = world.player;
      const data = {
        cash: world.cash,
        hp: p.hp,
        mission: world.missionIndex,
        step: world.stepIndex,
        kills: world.kills,
        x: Math.round(p.x),
        y: Math.round(p.y),
        wanted: Math.round(world.wantedHeat * 100) / 100,
        stashes: world.stashes.map((s) => s.found),
        crateTaken: world.crateTaken,
        vaultTaken: world.vaultTaken,
        savedAt: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      world.saveToastTimer = 2.5;
      return true;
    } catch (err) {
      return false;
    }
  }

  function hasSave() {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch (err) {
      return false;
    }
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      world.cash = d.cash || 0;
      world.player.cash = world.cash;
      world.player.hp = d.hp || PLAYER.maxHp;
      world.player.x = d.x || PLACES.start.x;
      world.player.y = d.y || PLACES.start.y;
      world.player.inCar = null;
      world.missionIndex = d.mission || 0;
      world.stepIndex = d.step || 0;
      world.kills = d.kills || 0;
      world.wantedHeat = d.wanted || 0;
      world.stars = starsFromHeat();
      world.crateTaken = !!d.crateTaken;
      world.vaultTaken = !!d.vaultTaken;
      if (Array.isArray(d.stashes)) {
        d.stashes.forEach((f, i) => { if (world.stashes[i]) world.stashes[i].found = !!f; });
      }
      world.camera.x = world.player.x;
      world.camera.y = world.player.y;
      beginStep();
      return true;
    } catch (err) {
      return false;
    }
  }

  function newGame() {
    world.cash = 0;
    world.player.cash = 0;
    world.player.hp = PLAYER.maxHp;
    world.player.x = PLACES.start.x;
    world.player.y = PLACES.start.y;
    world.player.inCar = null;
    world.missionIndex = 0;
    world.stepIndex = 0;
    world.missionDone = false;
    world.victory = false;
    world.kills = 0;
    world.wantedHeat = 0;
    world.stars = 0;
    world.vipers = [];
    world.vipersDown = 0;
    world.strongboxSpawned = false;
    world.crateTaken = false;
    world.vaultTaken = false;
    world.cruisers = [];
    world.footCops = [];
    world.bullets = [];
    world.enemyBullets = [];
    world.dead = null;
    world.stashes.forEach((s) => { s.found = false; });
    world.log = [];
    startMission(0);
  }

  // ---- main update ----------------------------------------------------------

  function update(dt, input, view) {
    world.time += dt;
    dt = Math.min(dt, 0.05);
    // Banner queue: the pending banner appears once its time comes.
    if (world.pendingBanner && world.time >= world.pendingBannerAt) {
      world.banner = world.pendingBanner;
      world.bannerTimer = 4;
      world.pendingBanner = null;
      if (world.pendingMission !== null && world.pendingMission !== undefined) {
        const next = world.pendingMission;
        world.pendingMission = null;
        world.missionIndex = next;
        world.stepIndex = 0;
        audio.missionStart();
        addLog(`New mission: ${MISSIONS[next].title}`);
        beginStep();
      }
    }
    if (world.bannerTimer > 0) {
      world.bannerTimer -= dt;
      if (world.bannerTimer <= 0) world.banner = null;
    }
    if (world.saveToastTimer > 0) world.saveToastTimer -= dt;
    if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 22);

    updatePlayer(dt, input, view);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateBullets(dt);
    checkStep(dt);

    // Particles and floaters age out.
    for (const pt of world.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.pow(0.4, dt);
      pt.vy *= Math.pow(0.4, dt);
      pt.life -= dt;
    }
    world.particles = world.particles.filter((pt) => pt.life > 0);
    for (const f of world.floaters) {
      f.t += dt;
      f.y -= 26 * dt;
    }
    world.floaters = world.floaters.filter((f) => f.t < 1.6);

    // Camera follows the player, unless a staged shot pins it.
    if (!world.cameraPinned) {
      world.camera.x = world.player.x;
      world.camera.y = world.player.y;
    }

    // Death checks.
    if (world.player.hp <= 0 && !world.dead) {
      world.player.hp = 0;
      world.dead = 'wasted';
      audio.bust();
    }
  }

  // Public surface: methods live on the same object the simulation
  // mutates, so render.js, shots.js and main.js always see live values.
  world.update = update;
  world.currentMission = currentMission;
  world.currentStep = currentStep;
  world.targetPos = targetPos;
  world.startMission = startMission;
  world.newGame = newGame;
  world.saveGame = saveGame;
  world.loadSave = loadSave;
  world.hasSave = hasSave;
  world.addLog = addLog;
  world.addFloater = addFloater;
  world.addCrime = addCrime;
  world.burst = burst;
  world.beginStep = beginStep;
  world._spawnCruiser = spawnCruiser;
  world._spawnFootCop = spawnFootCop;
  world._shootBullet = shootBullet;
  world._starsFromHeat = starsFromHeat;
  return world;
}
