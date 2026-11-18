// SOLMARA — An Open-World Crime Story.
// ============================================================
// A complete open-world crime game that runs entirely in your
// browser from static files: no downloads, no server, no network.
//
// THE PREMISE: Leo Marin is back in Solmara, a sun-soaked fictional
// coastal city of avenues, plazas, a marina and a beach — broke,
// wanted, and one job away from freedom. Mara Voss, the fixer who
// runs the city's jobs, has four missions for him, and each one pays.
//
// THE CITY: a 3600 x 2600 open world with a road grid, live traffic,
// pedestrians on the sidewalks, parks, Sun Plaza with its fountain,
// the old marina docks, and a beach with animated sea at the east
// edge. Walk it on foot or steal any car you see and drive it.
//
// CONTROLS: WASD to walk or drive, mouse to aim, Click or Space to
// fire your pistol, E to steal a car (E again to get out), Shift to
// run, P to pause, M to mute the music.
//
// MISSIONS (four, from Mara Voss, each with a briefing, a gold
// beacon in the world and a blip on the minimap):
//   1. WHEELS UP ($200) — steal any car and deliver it to her garage.
//   2. THE PICKUP ($350) — grab a crate at the old marina, then slip
//      away to the hideout up north.
//   3. HARBOR HEAT ($500) — defeat four Crimson Vipers holding the
//      harbor warehouse yard, then take their strongbox.
//   4. THE BIG SCORE ($1,500) — hit the Meridian Vault, trip the
//      alarm, and escape to the hideout with the heat on.
// Finish all four and the victory screen pays out — then free roam
// continues, with the whole city still yours to explore.
//
// WANTED (0 to 5 stars): stealing cars, shooting, hitting pedestrians
// and wrecking police cruisers all raise the heat. Police cruisers
// chase and ram you; from two stars, foot cops chase and shoot too.
// If a cop holds you for a few seconds you are BUSTED and lose 15%
// of your cash. Lay low and the heat cools off. If your health hits
// zero, you are WASTED and lose 10%.
//
// HUD AND MINIMAP: cash, a health bar, the wanted stars, a mission
// tracker with the live distance to your objective, a live minimap
// showing roads, the sea, you, your target, the police and your
// enemies, an off-screen arrow to the objective, and an event log.
//
// SAVE: your progress autosaves after every mission, and you can save
// from the pause menu. The title screen offers CONTINUE whenever a
// save exists, or NEW GAME and HOW TO PLAY.
//
// SIDE CONTENT: eight hidden gold stashes worth $75 each are tucked
// around the city, and taking down a Viper or a cop pays $25.
//
// AUDIO: all sound is synthesized live with WebAudio — a bass-and-
// hats groove, engine hum, two-tone police sirens, gunshots, pickups
// and a mission fanfare. Nothing is downloaded; M mutes it.
//
// FILE MAP (one job per file, so the structure reads at a glance):
//   game/src/config.js — every number, place, mission and colour.
//   game/src/random.js — seeded random numbers (mulberry32).
//   game/src/city.js — the city: roads, buildings, parks, beach.
//   game/src/input.js — keyboard and mouse, edge-triggered.
//   game/src/audio.js — synthesized music and sound effects.
//   game/src/world.js — the simulation: driving, police, combat,
//     wanted, missions, pickups, save and load.
//   game/src/render.js — canvas drawing: city, HUD, minimap, menus.
//   game/src/shots.js — the four staged screenshot scenes.
//   game/src/main.js — this file: the loop and the screen flow.
// ============================================================

import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { renderGame, layoutButtons } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const VIEW = { w: canvas.width, h: canvas.height };

const params = new URLSearchParams(window.location.search);
const shotParam = Number(params.get('shot') || 0);
const seedParam = Number(params.get('seed') || 1);

const audio = createAudio();
const input = createInput(canvas);
const world = createWorld(seedParam, audio);

let screen = 'title';
let prevScreen = 'title';
let deathApplied = false;

// Shot mode: a seeded, frozen staged scene for screenshots.
if (shotParam >= 1 && shotParam <= 4) {
  screen = stageShot(world, shotParam);
} else {
  world.newGame();
  // The title backdrop: Leo on foot near Sun Plaza, camera pinned.
  world.player.x = 1050;
  world.player.y = 1400;
  world.player.inCar = null;
  world.cameraPinned = true;
  world.camera.x = 1400;
  world.camera.y = 1250;
  world.titleCam = { x: 1400, y: 1250 };
}

function hasSave() {
  return world.hasSave();
}

function startPlaying(fromSave) {
  if (fromSave) {
    world.loadSave();
  } else {
    world.newGame();
  }
  world.cameraPinned = false;
  world.frozen = false;
  world.dead = null;
  deathApplied = false;
  screen = 'play';
  audio.unlock();
}

function respawnAfterDeath() {
  const p = world.player;
  const loss = screen === 'busted' ? 0.15 : 0.10;
  world.cash = Math.floor(world.cash * (1 - loss));
  p.cash = world.cash;
  p.hp = 100;
  p.x = 1400;
  p.y = 1250;
  p.inCar = null;
  world.wantedHeat = 0;
  world.stars = 0;
  world.cruisers = [];
  world.footCops = [];
  world.bullets = [];
  world.enemyBullets = [];
  world.dead = null;
  world.camera.x = p.x;
  world.camera.y = p.y;
  deathApplied = false;
  screen = 'play';
}

function clickButton(id) {
  audio.unlock();
  if (screen === 'title') {
    if (id === 'new') startPlaying(false);
    else if (id === 'continue') startPlaying(true);
    else if (id === 'howto') { prevScreen = 'title'; screen = 'howto'; }
  } else if (screen === 'howto') {
    if (id === 'back') screen = prevScreen;
  } else if (screen === 'pause') {
    if (id === 'resume') screen = 'play';
    else if (id === 'save') world.saveGame();
    else if (id === 'restart') {
      world.newGame();
      world.cameraPinned = false;
      screen = 'play';
    } else if (id === 'quit') {
      screen = 'title';
      world.cameraPinned = true;
      world.camera.x = world.titleCam.x;
      world.camera.y = world.titleCam.y;
    }
  } else if (screen === 'wasted' || screen === 'busted' || screen === 'victory') {
    if (id === 'continue') {
      if (screen === 'victory') screen = 'play';
      else respawnAfterDeath();
    } else if (id === 'quit') {
      screen = 'title';
      world.cameraPinned = true;
      world.camera.x = world.titleCam.x;
      world.camera.y = world.titleCam.y;
    }
  }
}

function buttonAt(x, y) {
  if (screen === 'howto') {
    if (x >= VIEW.w / 2 - 150 && x <= VIEW.w / 2 + 150 && y >= VIEW.h - 130 && y <= VIEW.h - 78) return 'back';
    return null;
  }
  const buttons = layoutButtons(screen, VIEW.w, VIEW.h, hasSave());
  for (const b of buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  if (screen === 'play') return;
  const id = buttonAt(x, y);
  if (id) clickButton(id);
});

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'm') audio.setMuted(!audio.isMuted());
  if ((k === 'p' || k === 'escape') && (screen === 'play' || screen === 'pause')) {
    screen = screen === 'play' ? 'pause' : 'play';
  }
  if (k === 'enter' && screen === 'title') startPlaying(false);
});

// The frame loop: simulate while playing, always render.
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (screen === 'title') {
    // The title camera never drifts: restore the staged anchor.
    world.camera.x = world.titleCam.x;
    world.camera.y = world.titleCam.y;
    world.time += dt;
  } else if (screen === 'play' && !world.frozen) {
    world.update(dt, input, VIEW);
    if (world.dead && !deathApplied) {
      deathApplied = true;
      screen = world.dead === 'busted' ? 'busted' : 'wasted';
      audio.bust();
    } else if (world.victory && screen === 'play') {
      screen = 'victory';
    }
  } else if (screen === 'play' && world.frozen) {
    // Staged shots: the world holds still, but time ticks so the
    // minimap pulse, the beacon and the sea keep animating.
    world.time += dt;
  }

  renderGame(ctx, world, screen, VIEW, input.mouse, hasSave());
  input.endFrame();
  requestAnimationFrame(frame);
}

// Test hooks: the headless playtests drive the game through these.
window.__solmara = {
  world,
  input,
  audio,
  get screen() { return screen; },
  set screen(s) { screen = s; },
  startPlaying,
  clickButton,
  VIEW,
};

requestAnimationFrame(frame);
