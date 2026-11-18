// SOLMARA — boot and the one loop.
// Input is read every frame, the world advances in fixed 1/60 s steps, and
// the renderer paints what is there. Screens: title, play, pause, busted,
// wasted and story complete.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. In game mode the debug handle
// window.__solmara exposes the world for tests.
import { CFG } from './config.js';
import { createRng } from './random.js';
import {
  EVENT_BUSTED, EVENT_CRASH, EVENT_DEAD, EVENT_MISSION, EVENT_PICKUP,
  EVENT_PUNCH, EVENT_SHOT, EVENT_STEAL,
  applySave, createWorld, loadSave, playerCar, saveGame, stepWorld,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_CONTINUE, ACTION_ENTER, ACTION_PAUSE,
  ACTION_PUNCH, ACTION_SHOOT, createInput,
} from './input.js';
import {
  SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_DEAD, SCREEN_PAUSE,
  SCREEN_PLAY, SCREEN_TITLE, createRenderer,
} from './render.js';
import { createAudio } from './audio.js';
import { shotSeconds, stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function announce(message) {
  status.textContent = message;
}

// ------------------------------------------------------------------ shots

function runShot(name) {
  const state = createWorld(seed);
  const scene = stageShot(state, name);
  const seconds = shotSeconds(name);
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(state, scene.drive(state), STEP);
  }
  // A chase scene is a chase, not an arrest: if the autopilot got caught
  // during the run, revive Leo for the frame and push the holding cops off
  // him, so the picture shows the pursuit in progress.
  if (state.player.busted || state.player.dead) {
    state.player.busted = false;
    state.player.dead = false;
    state.player.health = Math.max(state.player.health, 60);
    state.player.arrestTimer = 0;
    state.message = '';
    state.messageTimer = 0;
    for (const cop of state.cars) {
      if (cop.driver !== 'cop') continue;
      const d = Math.hypot(cop.x - state.player.x, cop.y - state.player.y);
      if (d < 130) {
        const a = Math.atan2(cop.y - state.player.y, cop.x - state.player.x);
        cop.x = state.player.x + Math.cos(a) * 140;
        cop.y = state.player.y + Math.sin(a) * 140;
      }
    }
  }
  // Snap the camera onto Leo: a shot paints only twice, and a smooth
  // follow would still be travelling from the spawn point.
  const camera = { x: state.player.x, y: state.player.y };
  renderer.resize();
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, camera, { saveExists: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// ------------------------------------------------------------------ the game

function runGame() {
  const input = createInput(canvas);
  let state = createWorld(seed);
  let screen = SCREEN_TITLE;
  let save = loadSave();
  let camera = { x: state.player.x, y: state.player.y };
  let accumulator = 0;
  let last = performance.now();
  let storyShown = false;

  // The debug handle tests use: the live world, one step, the save, and the
  // screen the game is on.
  window.__solmara = { state, stepWorld, saveGame, loadSave, CFG, version: 'solmara-5.2', screen: () => screen };

  function startFresh() {
    state = createWorld(seed);
    window.__solmara.state = state;
    camera = { x: state.player.x, y: state.player.y };
    storyShown = false;
    screen = SCREEN_PLAY;
    audio.ensure();
    audio.startMusic();
    announce('Playing. Steal a car — press E next to one.');
  }

  function startContinued() {
    const loaded = loadSave();
    if (!loaded) {
      startFresh();
      return;
    }
    state = createWorld(seed);
    applySave(state, loaded);
    window.__solmara.state = state;
    camera = { x: state.player.x, y: state.player.y };
    storyShown = false;
    screen = SCREEN_PLAY;
    audio.ensure();
    audio.startMusic();
    announce(`Continuing. Cash $${state.player.cash}.`);
  }

  // Busted or wasted: Leo loses some cash, wakes up at Mara's Bar, and the
  // cops forget him. The story goes on.
  function respawn(fine, label) {
    const p = state.player;
    p.cash = Math.max(0, p.cash - fine);
    p.health = CFG.playerHealth;
    p.heat = 0;
    p.wanted = 0;
    p.arrestTimer = 0;
    p.busted = false;
    p.dead = false;
    p.inCar = false;
    p.carId = null;
    p.x = state.city.places.marasBar.x;
    p.y = state.city.places.marasBar.y + 40;
    p.angle = -Math.PI / 2;
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      if (state.cars[i].driver === 'cop') state.cars.splice(i, 1);
    }
    camera = { x: p.x, y: p.y };
    screen = SCREEN_PLAY;
    saveGame(state);
    announce(`${label} Leo wakes up at Mara's Bar, $${fine} lighter.`);
  }

  function handleEvents() {
    const events = state.events;
    if (events.length === 0) return;
    for (const ev of events) {
      if (ev.type === EVENT_STEAL) audio.doorSlam();
      else if (ev.type === EVENT_CRASH) audio.crash();
      else if (ev.type === EVENT_SHOT) audio.shot();
      else if (ev.type === EVENT_PUNCH) audio.punch();
      else if (ev.type === EVENT_PICKUP) audio.pickup();
      else if (ev.type === EVENT_MISSION) {
        audio.mission();
        audio.cash();
        saveGame(state);
      } else if (ev.type === EVENT_BUSTED) {
        audio.busted();
        screen = SCREEN_BUSTED;
      } else if (ev.type === EVENT_DEAD) {
        audio.busted();
        screen = SCREEN_DEAD;
      }
    }
    events.length = 0;
  }

  function handleActions(taken) {
    const flags = taken.actions;
    if (input.takeMute()) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (flags & ACTION_CONTINUE && save) startContinued();
      else if (flags & ACTION_CONFIRM) startFresh();
      return;
    }
    if (screen === SCREEN_PAUSE) {
      if (flags & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_BUSTED) {
      if (flags & ACTION_CONFIRM) respawn(100, 'Busted.');
      return;
    }
    if (screen === SCREEN_DEAD) {
      if (flags & ACTION_CONFIRM) respawn(150, 'Wasted.');
      return;
    }
    if (screen === SCREEN_COMPLETE) {
      if (flags & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Free roam. Solmara is yours.');
      }
      return;
    }
    if (flags & ACTION_PAUSE) {
      screen = SCREEN_PAUSE;
      saveGame(state);
      announce('Paused. Progress saved.');
    }
  }

  function readWorldActions(taken) {
    const axes = input.axes();
    const flags = taken.actions;
    const mouse = input.mouse;
    let shootX = 0;
    let shootY = 0;
    if (taken.clicked) {
      const scale = renderer.view.h / 720;
      shootX = camera.x + (mouse.clickX - renderer.view.w / 2) / scale;
      shootY = camera.y + (mouse.clickY - renderer.view.h / 2) / scale;
    }
    return {
      up: axes.up,
      down: axes.down,
      left: axes.left,
      right: axes.right,
      enterPressed: (flags & ACTION_ENTER) !== 0,
      enterHeld: input.enterHeld(),
      punchPressed: (flags & ACTION_PUNCH) !== 0,
      shootPressed: taken.clicked,
      shootX,
      shootY,
    };
  }

  function step(taken) {
    if (screen === SCREEN_TITLE) {
      stepWorld(state, {
        up: false, down: false, left: false, right: false,
        enterPressed: false, enterHeld: false, punchPressed: false,
        shootPressed: false, shootX: 0, shootY: 0,
      }, STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const actions = readWorldActions(taken);
    stepWorld(state, actions, STEP);
    handleEvents();
    const p = state.player;
    const car = playerCar(state);
    audio.setEngine(car ? Math.abs(car.speed) / CFG.carMaxSpeed : 0, p.inCar);
    audio.setSiren(p.wanted > 0, state.time);
    if (state.storyComplete && !storyShown) {
      storyShown = true;
      screen = SCREEN_COMPLETE;
      saveGame(state);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One-shot presses are taken once per frame and shared by the screen
    // handler and the step, so a press is never lost or counted twice.
    const taken = input.takeActions();
    handleActions(taken);
    accumulator += dt;
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step(taken);
      accumulator -= STEP;
      if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) {
        accumulator = 0;
        break;
      }
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    const p = state.player;
    const follow = 1 - Math.exp(-CFG.cameraFollow * dt);
    camera.x += (p.x - camera.x) * follow;
    camera.y += (p.y - camera.y) * follow;
    // The save is only re-read on the title screen, where Continue lives;
    // reading localStorage every frame would be pure waste.
    if (screen === SCREEN_TITLE) save = loadSave();
    renderer.draw(state, screen, camera, { saveExists: save !== null });
  }

  // Leaving the tab pauses a running game rather than letting the city run on.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSE;
      saveGame(state);
      announce('Paused.');
    }
  });

  announce('SOLMARA. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
