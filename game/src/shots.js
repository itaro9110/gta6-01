// shots.js — deterministic staged scenes for the four screenshots.
// One file, one job: given a fresh world, it arranges one frozen moment
// that shows the game at its best. The scenes are seeded (?shot=N&seed=1)
// so re-rendering after a code change gives the same frame. Staging
// never plays the game: it places entities, pins the camera and freezes
// the simulation, so the capture shows exactly what was arranged.
// Real play is untouched — nothing here runs during a normal session.

import { PLACES, CAR_MODELS, POLICE_COLOR, MISSIONS } from './config.js';

// A car placed by hand for a shot: model, colour, angle, speed.
function stagedCar(world, x, y, angle, model, speed) {
  return {
    x, y, angle, speed: speed || 0, dir: 1, vertical: false,
    model, color: model.color, cruise: 60, parked: false,
  };
}

function stagedPed(world, x, y, shirt) {
  return {
    x, y, angle: 0, speed: 40, shirt,
    skin: '#f2c89a', dead: false, deadTimer: 0, flee: 0, tx: x, ty: y,
  };
}

function clearStreets(world) {
  world.traffic = [];
  world.parked = [];
  world.peds = [];
  world.cruisers = [];
  world.footCops = [];
  world.vipers = [];
  world.bullets = [];
  world.enemyBullets = [];
}

// Freeze the world after staging: main.js renders but never updates.
// Also clear any banner: a staged shot shows the scene, not a stale
// NEW MISSION banner left over from newGame().
function freeze(world, camX, camY) {
  world.staged = true;
  world.cameraPinned = true;
  world.camera.x = camX;
  world.camera.y = camY;
  world.frozen = true;
  world.banner = null;
  world.bannerTimer = 0;
  world.pendingBanner = null;
}

// Shot 1 — the cover. Title screen over a busy intersection: traffic,
// a police cruiser, pedestrians, and Leo on foot with his gun drawn,
// lower-left of the frame, with all three menu buttons visible.
// The title calls saveGame() once, so CONTINUE appears on the menu.
function stageTitle(world) {
  world.newGame();
  clearStreets(world);
  const camX = 1400;
  const camY = 1250;
  // Five traffic cars crossing the intersection, slow cruise.
  world.traffic = [
    stagedCar(world, 1400, 900, Math.PI / 2, CAR_MODELS[1], 60),
    stagedCar(world, 1450, 1450, -Math.PI / 2, CAR_MODELS[3], 60),
    stagedCar(world, 1050, 1250, 0, CAR_MODELS[0], 60),
    stagedCar(world, 1750, 1250, Math.PI, CAR_MODELS[2], 60),
    stagedCar(world, 1350, 1650, Math.PI / 2, CAR_MODELS[5], 60),
  ];
  // One cruiser waiting at the lights.
  world.cruisers = [{
    x: 1520, y: 1100, angle: Math.PI / 2, speed: 0,
    model: { name: 'Solmar Interceptor', color: POLICE_COLOR, accel: 480, topSpeed: 460, turn: 3.0, len: 48, wid: 23 },
    color: POLICE_COLOR, police: true, hp: 100, ramCd: 0, light: 0,
  }];
  // Four pedestrians on the sidewalks around the plaza.
  world.peds = [
    stagedPed(world, 1230, 1080, '#e84a4a'),
    stagedPed(world, 1560, 1120, '#4a7fe8'),
    stagedPed(world, 1180, 1420, '#e8c84a'),
    stagedPed(world, 1620, 1450, '#4ae88a'),
  ];
  // Leo on foot, lower-left of the frame (screen 290,510), gun out.
  world.player.x = 1050;
  world.player.y = 1400;
  world.player.inCar = null;
  world.player.aim = 0.3;
  world.player.angle = 0.3;
  world.titleCam = { x: camX, y: camY };
  // A save exists, so the title shows NEW GAME / CONTINUE / HOW TO PLAY.
  world.saveGame();
  freeze(world, camX, camY);
}

// Shot 2 — on foot on the beach road: sand, palms, the sea at the
// right edge, traffic and pedestrians in frame, and the E steal prompt.
function stageStreet(world) {
  world.newGame();
  clearStreets(world);
  const px = 3180;
  const py = 1250;
  world.player.x = px;
  world.player.y = py;
  world.player.inCar = null;
  world.player.aim = -0.4;
  world.player.angle = -0.4;
  // The stealable car, close enough for the E prompt.
  const car = stagedCar(world, 3150, 1290, 0, CAR_MODELS[3], 0);
  car.parked = true;
  world.parked = [car];
  world.stealTarget = car;
  // Four traffic cars on the beach avenue, slow cruise.
  world.traffic = [
    stagedCar(world, 3078, 1000, Math.PI / 2, CAR_MODELS[1], 60),
    stagedCar(world, 3122, 1150, -Math.PI / 2, CAR_MODELS[0], 60),
    stagedCar(world, 3078, 1500, Math.PI / 2, CAR_MODELS[2], 60),
    stagedCar(world, 3122, 1620, -Math.PI / 2, CAR_MODELS[5], 60),
  ];
  // Five pedestrians on the sidewalks right beside Leo.
  world.peds = [
    stagedPed(world, 3080, 1180, '#e84a4a'),
    stagedPed(world, 3240, 1160, '#4a7fe8'),
    stagedPed(world, 3090, 1330, '#e8c84a'),
    stagedPed(world, 3260, 1340, '#4ae88a'),
    stagedPed(world, 3150, 1100, '#e84ad8'),
  ];
  freeze(world, px, py);
}

// Shot 3 — the chase. Leo drives south down the 1800 avenue toward
// Mara's garage, three wanted stars, two cruisers on his bumper,
// spread apart laterally and staggered, never overlapping. The target
// sits ~300 m ahead, so the off-screen arrow reads in the 200–400 m band.
function stageChase(world) {
  world.newGame();
  clearStreets(world);
  // Mission 1, delivery step: the garage is the target.
  world.stepIndex = 1;
  const garage = PLACES.garage;
  // Leo in a stolen Comet, driving south on the 1800 avenue, 1500 px
  // (300 m at 5 px per metre) north of Mara's garage.
  const car = stagedCar(world, 1800, 450, Math.PI / 2, CAR_MODELS[0], 320);
  car.stolen = true;
  // The player's car must live in a drawn list: the renderer draws
  // parked/traffic/cruiser cars, and a stolen car stays "parked" in
  // the list in real play too — otherwise Leo drives an invisible car.
  world.parked = [car];
  world.player.inCar = car;
  world.player.x = car.x;
  world.player.y = car.y;
  world.player.angle = Math.PI / 2;
  world.player.cash = 350;
  world.cash = 350;
  // Three stars of heat.
  world.wantedHeat = 2.1;
  world.stars = 3;
  // Two cruisers behind, spread ±55 px laterally and staggered.
  const cruiserModel = { name: 'Solmar Interceptor', color: POLICE_COLOR, accel: 480, topSpeed: 460, turn: 3.0, len: 48, wid: 23 };
  world.cruisers = [
    { x: 1745, y: 300, angle: Math.PI / 2, speed: 380, model: cruiserModel, color: POLICE_COLOR, police: true, hp: 100, ramCd: 0, light: 0 },
    { x: 1855, y: 390, angle: Math.PI / 2, speed: 360, model: cruiserModel, color: POLICE_COLOR, police: true, hp: 100, ramCd: 0, light: 0 },
  ];
  // A little traffic ahead so the avenue feels alive.
  world.traffic = [
    stagedCar(world, 1822, 700, Math.PI / 2, CAR_MODELS[2], 90),
    stagedCar(world, 1778, 850, -Math.PI / 2, CAR_MODELS[4], 80),
  ];
  world.peds = [
    stagedPed(world, 1700, 600, '#e84a4a'),
    stagedPed(world, 1900, 650, '#4a7fe8'),
  ];
  // Sanity: garage is exactly 300 m south of Leo (1500 px / 5 px per m).
  void garage;
  freeze(world, car.x, car.y);
}

// Shot 4 — mid-fight at the harbor warehouse. Two Vipers still alive
// at full HP with bars showing, "Vipers down: 2/4" in the tracker, Leo
// firing with a tracer in flight, the strongbox in the yard, one star
// of heat with a cruiser at the frame's bottom-right edge, and the
// "✓ PROGRESS SAVED" toast on screen.
function stageMission(world) {
  world.newGame();
  clearStreets(world);
  // Mission 3, clear step, two Vipers already down.
  world.missionIndex = 2;
  world.stepIndex = 1;
  world.vipersDown = 2;
  world.kills = 2;
  world.cash = 550;
  world.player.cash = 550;
  world.strongboxSpawned = true;
  // Leo in the yard, clear of the strongbox so it cannot be collected.
  const px = 2380;
  const py = 1620;
  world.player.x = px;
  world.player.y = py;
  world.player.inCar = null;
  // Two Vipers alive at 100 HP, in frame, away from each other.
  world.vipers = [
    { x: 2520, y: 1440, angle: 0, hp: 100, maxHp: 100, fireCd: 1.2, speed: 120, alive: true },
    { x: 2620, y: 1700, angle: 0, hp: 100, maxHp: 100, fireCd: 0.8, speed: 120, alive: true },
  ];
  // Leo fires at the healthiest Viper — but 60 px to the side, outside
  // the 18 px hit radius, so the shot cannot kill or change the count.
  const v = world.vipers[0];
  const aimAt = Math.atan2(v.y + 60 - py, v.x - px);
  world.player.aim = aimAt;
  world.player.angle = aimAt;
  const gx = px + Math.cos(aimAt) * 22;
  const gy = py + Math.sin(aimAt) * 22;
  const midX = gx + Math.cos(aimAt) * 150;
  const midY = gy + Math.sin(aimAt) * 150;
  world.bullets = [{
    x: midX, y: midY, px: gx, py: gy,
    vx: Math.cos(aimAt) * 720, vy: Math.sin(aimAt) * 720,
    life: 0.7, owner: 'player',
  }];
  // One star of heat, one cruiser at the frame's bottom-right edge
  // (screen 1190,538 from a camera on Leo).
  world.wantedHeat = 0.6;
  world.stars = 1;
  const cruiserModel = { name: 'Solmar Interceptor', color: POLICE_COLOR, accel: 480, topSpeed: 460, turn: 3.0, len: 48, wid: 23 };
  world.cruisers = [
    { x: 2930, y: 1798, angle: Math.PI * 0.9, speed: 0, model: cruiserModel, color: POLICE_COLOR, police: true, hp: 100, ramCd: 0, light: 0 },
  ];
  // One parked car, fully inside the frame.
  const car = stagedCar(world, 2700, 1750, 0.2, CAR_MODELS[1], 0);
  car.parked = true;
  world.parked = [car];
  // Two pedestrians at the yard's edge.
  world.peds = [
    stagedPed(world, 2460, 1800, '#e8c84a'),
    stagedPed(world, 2700, 1500, '#4ae88a'),
  ];
  // The save toast, visible in the shot.
  world.saveToastTimer = 2.5;
  freeze(world, px, py);
}

// Stage shot n (1-4) into a fresh world. Returns the screen to show.
export function stageShot(world, n) {
  if (n === 1) {
    stageTitle(world);
    return 'title';
  }
  if (n === 2) {
    stageStreet(world);
    return 'play';
  }
  if (n === 3) {
    stageChase(world);
    return 'play';
  }
  stageMission(world);
  return 'play';
}

// The four shots, in order, for shots.json and the docs.
export const SHOT_LIST = [
  { n: 1, file: '1-title.jpg', scene: 'Title over a busy intersection — traffic, a cruiser, Leo on foot, NEW GAME / CONTINUE / HOW TO PLAY' },
  { n: 2, file: '2-street.jpg', scene: 'On foot on the beach road — sand, palms, sea at the right edge, E steal prompt, HUD + minimap' },
  { n: 3, file: '3-chase.jpg', scene: 'Westbound chase — 3 wanted stars, 2 cruisers on the bumper, target arrow ~300 m' },
  { n: 4, file: '4-mission.jpg', scene: 'Mid-fight at the warehouse — 2/4 Vipers down, tracer in flight, strongbox, save toast' },
];
