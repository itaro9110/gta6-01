// SOLMARA — every number in one place.
// The whole game reads its tuning from here, so a balance change is one edit.

export const CFG = {
  // The city, in world pixels.
  worldWidth: 3600,
  worldHeight: 2600,
  avenues: [300, 750, 1200, 1650, 2100, 2550, 3000],
  streets: [250, 600, 950, 1300, 1650, 2000, 2350],
  roadWidth: 112,

  // Leo on foot.
  walkSpeed: 178,
  playerHealth: 100,
  playerRadius: 15,

  // Fists and the gun.
  punchRange: 50,
  punchDamage: 22,
  punchCooldown: 0.45,
  punchArc: 1.9,
  shootCooldown: 0.28,
  bulletSpeed: 920,
  bulletRange: 540,
  bulletDamage: 30,
  ammoStart: 24,
  ammoMax: 48,

  // Cars.
  carAccel: 430,
  carReverseAccel: 270,
  carMaxSpeed: 520,
  carMaxReverse: 170,
  carTurnRate: 2.7,
  carBrake: 560,
  carDrag: 0.55,
  carLength: 52,
  carWidth: 26,
  crashSpeed: 120,
  stealRange: 78,
  exitOffset: 46,

  // Traffic and pedestrians.
  trafficCount: 26,
  trafficSpeedMin: 140,
  trafficSpeedMax: 235,
  pedCount: 30,
  pedSpeedMin: 52,
  pedSpeedMax: 88,
  pedFleeSpeed: 150,

  // Police.
  maxCops: 5,
  copMaxSpeed: 565,
  copAccel: 480,
  policeApproachRadius: 150,
  policeApproachSpeed: 60,
  policeApproachMax: 90,
  policeStopGap: 24,
  policeTurnClose: 5.0,
  policeTurnFar: 3.2,
  arrestRange: 46,
  arrestTime: 2.2,
  copSpawnMin: 340,
  copSpawnMax: 560,
  copDespawn: 950,
  copRamDamage: 7,

  // Wanted heat. Stars are cut from heat: 0 below 10, then 1..5.
  starThresholds: [10, 25, 45, 65, 85],
  heatDecay: 2.2,
  heatDecayDelay: 4,
  stealHeat: 25,
  punchHeat: 10,
  shootHeat: 8,
  killHeat: 20,

  // Missions.
  missionReward1: 150,
  missionReward2: 300,
  missionDropBonus: 50,
  missionReward3: 450,
  missionReward4: 1500,
  crackTime: 6,
  arriveRadius: 95,
  crackRadius: 85,

  // Pickups.
  pickupCount: 14,
  pickupRespawn: 20,
  healthPickup: 30,
  cashPickupMin: 40,
  cashPickupMax: 65,
  ammoPickup: 12,

  // Camera and feel.
  cameraFollow: 7.5,
  messageTime: 4,

  // Saving.
  saveKey: 'solmara-save-v1',

  // Car paint jobs. The gold one is the Comet GT, the mission-3 target.
  carColors: [
    '#e23b3b', '#3b7fe2', '#e2a63b', '#37b06a', '#8a5fd0',
    '#e2e2e2', '#2b2f38', '#e26a9b', '#3bb8c4', '#c46a1e',
  ],
  cometColor: '#e8b820',
  copColor: '#1c2430',
  taxiColor: '#f2c200',
};

// Clamp a number between two bounds.
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Wrap an angle to (-PI, PI].
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

// Shortest signed turn from angle `from` toward angle `to`.
export function angleTo(from, to) {
  return wrapAngle(to - from);
}

// Distance between two points.
export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
