// config.js — every tunable number, place, mission and colour of SOLMARA.
// One file, one job: if you want to rebalance the game, you only edit here.
// Nothing in this file imports anything else; world.js, render.js and
// shots.js all read from it, so the numbers stay consistent everywhere.

export const WORLD_W = 3600;
export const WORLD_H = 2600;
export const ROAD_W = 92;

// The road grid: 8 north-south avenues, 7 east-west streets.
export const AVENUES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3100];
export const STREETS = [200, 550, 900, 1250, 1600, 1950, 2300];

// The beach: sand starts here, the sea starts a little further east.
export const SAND_X = 3300;
export const SEA_X = 3480;

// Sun Plaza (city centre), the marina docks (south-west) and the beach.
export const PLAZA = { x: 1400, y: 1250, r: 170 };
export const MARINA = { x: 420, y: 2380, w: 560, h: 150 };
export const PARK_SPOTS = [
  { x: 800, y: 725, w: 260, h: 200 },
  { x: 2000, y: 1075, w: 260, h: 200 },
  { x: 800, y: 1775, w: 260, h: 200 },
  { x: 2400, y: 2125, w: 260, h: 200 },
];

// Named places the missions and the HUD point at.
export const PLACES = {
  garage: { x: 1800, y: 1950, label: "Mara's Garage" },
  marinaCrate: { x: 430, y: 2350, label: 'Marina Crate' },
  hideout: { x: 1000, y: 200, label: 'Hideout' },
  warehouse: { x: 2500, y: 1550, label: 'Harbor Warehouse' },
  vault: { x: 2200, y: 900, label: 'Meridian Vault' },
  start: { x: 1400, y: 1250, label: 'Sun Plaza' },
};

// The player: Leo Marin, back in Solmara, broke and one job from freedom.
export const PLAYER = {
  walkSpeed: 165,
  runSpeed: 265,
  radius: 13,
  maxHp: 100,
  pistolDamage: 34,
  fireCooldown: 0.26,
  bulletSpeed: 720,
  bulletRange: 560,
  bustHoldSeconds: 2.4,
};

// Cars: a small roster of original Solmara models, each with its own feel.
export const CAR_MODELS = [
  { name: 'Solmar Comet', color: '#d84a3a', accel: 420, topSpeed: 430, turn: 2.9, len: 46, wid: 22 },
  { name: 'Vela Cruiser', color: '#3a6fd8', accel: 360, topSpeed: 380, turn: 2.6, len: 50, wid: 24 },
  { name: 'Corso Taxi', color: '#e8b73a', accel: 340, topSpeed: 360, turn: 2.7, len: 48, wid: 23 },
  { name: 'Brisa Coupe', color: '#39b06a', accel: 460, topSpeed: 470, turn: 3.1, len: 44, wid: 21 },
  { name: 'Toro Van', color: '#8a7f74', accel: 300, topSpeed: 320, turn: 2.2, len: 56, wid: 26 },
  { name: 'Lumen Sport', color: '#b44ad8', accel: 500, topSpeed: 520, turn: 3.3, len: 44, wid: 21 },
];
export const POLICE_COLOR = '#1d2f4d';
export const POLICE_LIGHT_A = '#ff3b30';
export const POLICE_LIGHT_B = '#2f7bff';

// Wanted: 0 to 5 stars. Crime adds heat, laying low cools it down.
export const WANTED = {
  maxStars: 5,
  shootPerShot: 0.15,
  stealCar: 0.6,
  hitPed: 0.8,
  wreckCruiser: 1.0,
  vaultAlarm: 2.0,
  decayPerSecond: 0.045,
  quietSeconds: 6,
  cruisersPerStar: 1,
  maxCruisers: 5,
  footCopsFromStar: 2,
  maxFootCops: 4,
};

// Police behaviour.
export const POLICE = {
  cruiserSpeed: 400,
  cruiserRamDamage: 8,
  ramCooldown: 0.8,
  copSpeed: 175,
  copShootRange: 380,
  copDamage: 7,
  copFireCooldown: 0.9,
  spawnDistance: 700,
};

// The Crimson Vipers, the crew guarding the harbor strongbox.
export const VIPER = {
  count: 4,
  hp: 100,
  speed: 120,
  shootRange: 420,
  damage: 9,
  fireCooldown: 1.1,
};

// Traffic and pedestrians.
export const TRAFFIC = { count: 26, speedMin: 90, speedMax: 170, parkedCount: 14 };
export const PEDS = { count: 42, speedMin: 28, speedMax: 62 };

// Side content: 8 hidden stashes, each worth $75.
export const STASH_VALUE = 75;
export const STASH_SPOTS = [
  { x: 385, y: 385 }, { x: 1210, y: 720 }, { x: 2390, y: 380 },
  { x: 3010, y: 1080 }, { x: 620, y: 1430 }, { x: 1990, y: 2130 },
  { x: 3350, y: 1780 }, { x: 1620, y: 2400 },
];
export const KILL_PAYOUT = 25;

// The story: four missions from Mara Voss, escalating to the big score.
// Each step is one verb the world knows how to check: steal, goto,
// pickup, clear, collect, escape. The world advances a step when its
// condition is met; the renderer shows the current step in the tracker.
export const MISSIONS = [
  {
    id: 1,
    title: 'WHEELS UP',
    reward: 200,
    brief: "Mara needs wheels. Steal any car on the street and bring it to her garage.",
    steps: [
      { kind: 'steal', text: 'Steal a car (walk up and press E)', target: null },
      { kind: 'goto', text: "Deliver the car to Mara's Garage", target: 'garage', radius: 110 },
    ],
  },
  {
    id: 2,
    title: 'THE PICKUP',
    reward: 350,
    brief: 'A crate waits at the old marina. Grab it and slip away to the hideout.',
    steps: [
      { kind: 'goto', text: 'Reach the crate at the old marina', target: 'marinaCrate', radius: 90 },
      { kind: 'pickup', text: 'Pick up the crate (press E)', target: 'marinaCrate', radius: 70 },
      { kind: 'goto', text: 'Escape to the hideout up north', target: 'hideout', radius: 110 },
    ],
  },
  {
    id: 3,
    title: 'HARBOR HEAT',
    reward: 500,
    brief: 'Four Crimson Vipers guard a strongbox at the harbor warehouse. Clear them out.',
    steps: [
      { kind: 'goto', text: 'Reach the harbor warehouse yard', target: 'warehouse', radius: 130 },
      { kind: 'clear', text: 'Defeat the Crimson Vipers (0/4 down)', target: 'warehouse', radius: 260 },
      { kind: 'collect', text: 'Take the strongbox from the yard', target: 'warehouse', radius: 70 },
    ],
  },
  {
    id: 4,
    title: 'THE BIG SCORE',
    reward: 1500,
    brief: 'The Meridian vault holds the whole season. Trip the alarm, grab the cash, run.',
    steps: [
      { kind: 'goto', text: 'Reach the Meridian Vault', target: 'vault', radius: 100 },
      { kind: 'collect', text: 'Grab the vault cash (alarm will sound)', target: 'vault', radius: 70 },
      { kind: 'escape', text: 'Escape to the hideout with the heat on', target: 'hideout', radius: 110 },
    ],
  },
];

// The palette: a sun-soaked coastal city at golden hour.
export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e8d29a',
  sea: '#2f7fb8',
  seaDeep: '#256b9e',
  road: '#3d3d46',
  roadEdge: '#2c2c33',
  lane: '#e8d44d',
  sidewalk: '#b9b3a4',
  plaza: '#cbb98f',
  park: '#5d9b4a',
  buildingRoof: ['#c96f4a', '#4a7fc9', '#c9a44a', '#7a5fc9', '#4ac9a2', '#c94a6f'],
  buildingWall: ['#e8d8c0', '#d8c8b0', '#c8b8a0', '#e0cbb2'],
  tree: '#2f7a3a',
  palm: '#3a8a44',
  trunk: '#8a6a4a',
};

// Save-game key in localStorage.
export const SAVE_KEY = 'solmara-save-v1';

// The controls line shown at the bottom of the screen.
export const CONTROLS_LINE =
  'WASD move / drive  ·  E steal car  ·  Mouse aim, Click shoot  ·  Shift run  ·  P pause  ·  M mute';
