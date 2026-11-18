// render.js — everything SOLMARA draws: the city, the people, the cars,
// the HUD, the minimap and every menu screen.
// One file, one job: it reads the world and paints it. It never changes
// the simulation; it only reads. main.js hands it a canvas context and
// the current screen each frame.

import {
  WORLD_W, WORLD_H, AVENUES, STREETS, ROAD_W, SAND_X, SEA_X, PLAZA, MARINA,
  PARK_SPOTS, PLACES, PLAYER, PALETTE, CONTROLS_LINE,
} from './config.js';
import { onRoad, onSand, inSea } from './city.js';

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Word-wrap a string to lines that fit maxWidth at the current font.
export function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Button layout shared by the renderer and main.js click handling:
// the same function draws them and answers "which button is here?".
export function layoutButtons(screen, w, h, hasSave) {
  const cx = w / 2;
  const bw = 300;
  const bh = 52;
  const gap = 14;
  const out = [];
  if (screen === 'title') {
    let y = h - 250;
    out.push({ id: 'new', label: 'NEW GAME', x: cx - bw / 2, y, w: bw, h: bh });
    y += bh + gap;
    if (hasSave) {
      out.push({ id: 'continue', label: 'CONTINUE', x: cx - bw / 2, y, w: bw, h: bh });
      y += bh + gap;
    }
    out.push({ id: 'howto', label: 'HOW TO PLAY', x: cx - bw / 2, y, w: bw, h: bh });
  } else if (screen === 'pause') {
    let y = h / 2 - 60;
    for (const [id, label] of [['resume', 'RESUME'], ['save', 'SAVE GAME'], ['restart', 'RESTART MISSION'], ['quit', 'QUIT TO TITLE']]) {
      out.push({ id, label, x: cx - bw / 2, y, w: bw, h: bh });
      y += bh + gap;
    }
  } else if (screen === 'wasted' || screen === 'busted' || screen === 'victory') {
    out.push({ id: 'continue', label: screen === 'victory' ? 'FREE ROAM' : 'TRY AGAIN', x: cx - bw / 2, y: h / 2 + 60, w: bw, h: bh });
    out.push({ id: 'quit', label: 'QUIT TO TITLE', x: cx - bw / 2, y: h / 2 + 60 + bh + gap, w: bw, h: bh });
  }
  return out;
}

function drawButton(ctx, b, hover) {
  ctx.save();
  ctx.fillStyle = hover ? 'rgba(232, 74, 58, 0.95)' : 'rgba(20, 20, 26, 0.82)';
  rr(ctx, b.x, b.y, b.w, b.h, 8);
  ctx.fill();
  ctx.strokeStyle = hover ? '#ffd94a' : 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.restore();
}

// ---- people and cars ------------------------------------------------------

function drawPerson(ctx, x, y, angle, shirt, skin, scale, opts) {
  const s = scale || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 11, 5, 0, 0, TAU);
  ctx.fill();
  // Legs.
  ctx.fillStyle = '#2c2c3a';
  ctx.fillRect(-7, 4, 5, 10);
  ctx.fillRect(2, 4, 5, 10);
  // Body.
  ctx.fillStyle = shirt;
  rr(ctx, -9, -8, 18, 14, 5);
  ctx.fill();
  // Arms.
  ctx.fillStyle = shirt;
  ctx.fillRect(-12, -6, 4, 10);
  ctx.fillRect(8, -6, 4, 10);
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -14, 7.5, 0, TAU);
  ctx.fill();
  // Hair.
  ctx.fillStyle = opts && opts.hair ? opts.hair : '#2a1a12';
  ctx.beginPath();
  ctx.arc(0, -16, 7.5, Math.PI, TAU);
  ctx.fill();
  if (opts && opts.gun) {
    // Pistol arm, aimed where the player aims.
    ctx.rotate(opts.gunAngle || 0);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(8, -2, 13, 4);
    ctx.rotate(-(opts.gunAngle || 0));
  }
  if (opts && opts.scarf) {
    ctx.fillStyle = '#d84a3a';
    ctx.fillRect(-9, -8, 18, 4);
  }
  ctx.restore();
}

function drawCar(ctx, car, time) {
  const model = car.model;
  const len = model.len;
  const wid = model.wid;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, -len / 2 + 4, -wid / 2 + 5, len, wid, 8);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  rr(ctx, -len / 2, -wid / 2, len, wid, 8);
  ctx.fill();
  // Roof and windows.
  ctx.fillStyle = 'rgba(20,24,32,0.85)';
  rr(ctx, -len / 2 + 10, -wid / 2 + 4, len - 24, wid - 8, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,180,220,0.5)';
  rr(ctx, -len / 2 + 13, -wid / 2 + 6, 10, wid - 12, 3);
  ctx.fill();
  // Headlights and taillights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 5);
  ctx.fillRect(len / 2 - 3, wid / 2 - 8, 3, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-len / 2, -wid / 2 + 3, 3, 5);
  ctx.fillRect(-len / 2, wid / 2 - 8, 3, 5);
  if (car.police) {
    // Roof light bar, flashing red / blue.
    const phase = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#2f7bff';
    ctx.fillRect(-6, -wid / 2 - 2, 12, 6);
    ctx.fillStyle = phase ? '#2f7bff' : '#ff3b30';
    ctx.fillRect(-6, wid / 2 - 4, 12, 6);
    // White doors.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-4, -wid / 2 + 1, 12, wid - 2);
    ctx.fillStyle = '#1d2f4d';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 2, 2);
  }
  ctx.restore();
}

// ---- the city ---------------------------------------------------------------

function drawCity(ctx, world, view) {
  const { camera } = world;
  const x0 = camera.x - view.w / 2 - 80;
  const y0 = camera.y - view.h / 2 - 80;
  const x1 = camera.x + view.w / 2 + 80;
  const y1 = camera.y + view.h / 2 + 80;

  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Mown stripes for a little texture.
  ctx.fillStyle = PALETTE.grassDark;
  for (let y = Math.floor(y0 / 120) * 120; y < y1; y += 240) {
    ctx.fillRect(x0, y, x1 - x0, 120);
  }
  // Parks.
  for (const p of PARK_SPOTS) {
    ctx.fillStyle = PALETTE.park;
    rr(ctx, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 18);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.w / 2 - 30, p.h / 2 - 30, 0, 0, TAU);
    ctx.fill();
  }
  // Beach sand and sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(x0, SAND_X), y0, x1 - Math.max(x0, SAND_X), y1 - y0);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(Math.max(x0, SEA_X), y0, x1 - Math.max(x0, SEA_X), y1 - y0);
  // Animated wave lines at the waterline.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const wy = y0 + ((world.time * 22 + i * 260) % (y1 - y0));
    ctx.beginPath();
    for (let wx = SEA_X; wx < Math.min(x1, SEA_X + 90); wx += 18) {
      const o = Math.sin((wx + world.time * 60 + i * 40) * 0.08) * 4;
      if (wx === SEA_X) ctx.moveTo(wx, wy + o);
      else ctx.lineTo(wx, wy + o);
    }
    ctx.stroke();
  }
  // Sun Plaza: paving, fountain, ring.
  ctx.fillStyle = PALETTE.plaza;
  ctx.beginPath();
  ctx.arc(PLAZA.x, PLAZA.y, PLAZA.r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,90,40,0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(PLAZA.x, PLAZA.y, PLAZA.r, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#5fa8d8';
  ctx.beginPath();
  ctx.arc(PLAZA.x, PLAZA.y, 34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#d8c8a0';
  ctx.beginPath();
  ctx.arc(PLAZA.x, PLAZA.y, 12, 0, TAU);
  ctx.fill();
  // Marina docks: wooden planks over the water's edge.
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(MARINA.x - MARINA.w / 2, MARINA.y - MARINA.h / 2, MARINA.w, MARINA.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  for (let x = MARINA.x - MARINA.w / 2; x < MARINA.x + MARINA.w / 2; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, MARINA.y - MARINA.h / 2);
    ctx.lineTo(x, MARINA.y + MARINA.h / 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#3a6fd8';
  ctx.fillRect(MARINA.x - MARINA.w / 2, MARINA.y + MARINA.h / 2, MARINA.w, 26);

  // Roads: dark asphalt with pale edges.
  ctx.fillStyle = PALETTE.road;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, y0, ROAD_W, y1 - y0);
  for (const sy of STREETS) ctx.fillRect(x0, sy - ROAD_W / 2, x1 - x0, ROAD_W);
  ctx.strokeStyle = PALETTE.roadEdge;
  ctx.lineWidth = 2;
  for (const ax of AVENUES) {
    ctx.beginPath(); ctx.moveTo(ax - ROAD_W / 2, y0); ctx.lineTo(ax - ROAD_W / 2, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax + ROAD_W / 2, y0); ctx.lineTo(ax + ROAD_W / 2, y1); ctx.stroke();
  }
  for (const sy of STREETS) {
    ctx.beginPath(); ctx.moveTo(x0, sy - ROAD_W / 2); ctx.lineTo(x1, sy - ROAD_W / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, sy + ROAD_W / 2); ctx.lineTo(x1, sy + ROAD_W / 2); ctx.stroke();
  }
  // Lane dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const ax of AVENUES) {
    for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) ctx.fillRect(ax - 2, y, 4, 22);
  }
  for (const sy of STREETS) {
    for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x, sy - 2, 22, 4);
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(ax + i * 12 - 4, sy - ROAD_W / 2 + 6, 8, 14);
        ctx.fillRect(ax + i * 12 - 4, sy + ROAD_W / 2 - 20, 8, 14);
      }
    }
  }
  // Buildings: shadow, wall, roof, windows.
  for (const b of world.city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    ctx.fillStyle = 'rgba(255,255,220,0.85)';
    for (const win of b.windows) ctx.fillRect(b.x + win.dx, b.y + win.dy, 12, 10);
  }
  // Trees and palms.
  for (const t of world.city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = PALETTE.trunk;
    ctx.fillRect(t.x - 3, t.y - 2, 6, 10);
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y - 8, t.r, 0, TAU);
    ctx.fill();
  }
  for (const t of world.city.palms) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.strokeStyle = PALETTE.trunk;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y + 10);
    ctx.lineTo(t.x + 3, t.y - 8);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.palm;
    ctx.lineWidth = 4;
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * TAU;
      ctx.beginPath();
      ctx.moveTo(t.x + 3, t.y - 8);
      ctx.lineTo(t.x + 3 + Math.cos(ang) * 16, t.y - 8 + Math.sin(ang) * 10);
      ctx.stroke();
    }
  }
}

  // ---- entities ---------------------------------------------------------------

  function drawBeacon(ctx, world, target) {
    if (!target) return;
    const pulse = 1 + Math.sin(world.time * 4) * 0.12;
    // A pillar of gold light so the objective reads from anywhere.
    const grad = ctx.createLinearGradient(target.x, target.y - 260, target.x, target.y);
    grad.addColorStop(0, 'rgba(255, 217, 74, 0)');
    grad.addColorStop(1, 'rgba(255, 217, 74, 0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(target.x - 16, target.y - 260, 32, 260);
    // Ground ring.
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 42 * pulse, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,217,74,0.25)';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 42 * pulse, 0, TAU);
    ctx.fill();
    // Diamond marker above.
    ctx.save();
    ctx.translate(target.x, target.y - 70 - Math.sin(world.time * 3) * 6);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(-11, -11, 22, 22);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-11, -11, 22, 22);
    ctx.restore();
  }

  function drawWorldEntities(ctx, world) {
    // Stashes glint gold until found.
    for (const s of world.stashes) {
      if (s.found) continue;
      const tw = 0.6 + Math.sin(world.time * 3 + s.x) * 0.4;
      ctx.fillStyle = `rgba(255, 217, 74, ${tw})`;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
    }
    // The marina crate and the strongbox, when they are the objective.
    const step = world.currentStep();
    if (step && step.kind === 'pickup' && !world.crateTaken) {
      const c = PLACES.marinaCrate;
      ctx.fillStyle = '#b07a2a';
      ctx.fillRect(c.x - 16, c.y - 14, 32, 28);
      ctx.strokeStyle = '#5a3a10';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x - 16, c.y - 14, 32, 28);
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CRATE', c.x, c.y - 22);
    }
    if (world.strongboxSpawned) {
      const w = PLACES.warehouse;
      ctx.fillStyle = '#3a3a46';
      ctx.fillRect(w.x - 18, w.y - 40, 36, 28);
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 3;
      ctx.strokeRect(w.x - 18, w.y - 40, 36, 28);
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STRONGBOX', w.x, w.y - 48);
    }
    // Vault cash pile.
    if (world.missionIndex === 3 && !world.vaultTaken) {
      const v = PLACES.vault;
      ctx.fillStyle = '#2fae5a';
      ctx.beginPath();
      ctx.arc(v.x, v.y, 16, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', v.x, v.y + 5);
    }
    // Parked and traffic cars.
    for (const c of world.parked) drawCar(ctx, c, world.time);
    for (const c of world.traffic) drawCar(ctx, c, world.time);
    for (const c of world.cruisers) drawCar(ctx, c, world.time);
    // Pedestrians, drawn clearly as people, never dots.
    for (const ped of world.peds) {
      if (ped.dead) {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(Math.PI / 2);
        drawPerson(ctx, 0, 0, 0, ped.shirt, ped.skin, 1.15, {});
        ctx.restore();
        continue;
      }
      drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, 1.15, {});
    }
    // Foot cops in navy, with a small HP bar when hurt.
    for (const cop of world.footCops) {
      if (!cop.alive) continue;
      drawPerson(ctx, cop.x, cop.y, cop.angle, '#1d2f4d', '#e8b88a', 1.2, { gun: true, gunAngle: 0, hair: '#1d2f4d' });
      if (cop.hp < 60) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(cop.x - 18, cop.y - 34, 36, 5);
        ctx.fillStyle = '#ff5a3a';
        ctx.fillRect(cop.x - 18, cop.y - 34, 36 * (cop.hp / 60), 5);
      }
    }
    // Crimson Vipers in red, with HP bars — the mission-3 fight.
    for (const v of world.vipers) {
      if (!v.alive) continue;
      drawPerson(ctx, v.x, v.y, v.angle, '#c22a2a', '#e8b88a', 1.25, { gun: true, gunAngle: 0, hair: '#111111' });
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(v.x - 20, v.y - 38, 40, 6);
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(v.x - 20, v.y - 38, 40 * (v.hp / v.maxHp), 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(v.x - 20, v.y - 38, 40, 6);
    }
    // The player: Leo Marin, red scarf, pistol in hand.
    const p = world.player;
    if (!p.inCar) {
      drawPerson(ctx, p.x, p.y, p.angle, '#3a6fd8', '#f2c89a', 1.2, {
        gun: true, gunAngle: p.aim, scarf: true, hair: '#1a1a1a',
      });
      // Aim line, faint, so shooting reads clearly.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.aim) * 26, p.y + Math.sin(p.aim) * 26);
      ctx.lineTo(p.x + Math.cos(p.aim) * 60, p.y + Math.sin(p.aim) * 60);
      ctx.stroke();
    }
    // Bullets as bright tracers.
    ctx.lineWidth = 3;
    for (const b of world.bullets) {
      ctx.strokeStyle = '#ffe94a';
      ctx.beginPath();
      ctx.moveTo(b.px, b.py);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.px, b.py);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.lineWidth = 3;
    }
    for (const b of world.enemyBullets) {
      ctx.strokeStyle = '#ff6a3a';
      ctx.beginPath();
      ctx.moveTo(b.px, b.py);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    // Floating score text.
    ctx.textAlign = 'center';
    for (const f of world.floaters) {
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1.6);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 16px Georgia, serif';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    // Mission beacon last, so it sits above everything.
    drawBeacon(ctx, world, world.targetPos());
  }

  // ---- HUD ------------------------------------------------------------------

  function drawStar(ctx, x, y, r, filled) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * TAU - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(ang) * rad;
      const py = y + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? '#ffd94a' : 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawMinimap(ctx, world, w) {
    const size = 190;
    const x = w - size - 16;
    const y = 16;
    const scale = size / WORLD_W;
    ctx.save();
    ctx.fillStyle = 'rgba(12, 16, 22, 0.82)';
    rr(ctx, x - 6, y - 6, size + 12, size * (2600 / 3600) + 12, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(x, y, size, size * (2600 / 3600));
    ctx.clip();
    // Sea and sand.
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(x + SAND_X * scale, y, size, size * (2600 / 3600));
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(x + SAND_X * scale, y, (SEA_X - SAND_X) * scale, size * (2600 / 3600));
    // Land.
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(x, y, SAND_X * scale, size * (2600 / 3600));
    // Roads.
    ctx.strokeStyle = 'rgba(220,220,220,0.85)';
    ctx.lineWidth = 1.6;
    for (const ax of AVENUES) {
      ctx.beginPath();
      ctx.moveTo(x + ax * scale, y);
      ctx.lineTo(x + ax * scale, y + size * (2600 / 3600));
      ctx.stroke();
    }
    for (const sy of STREETS) {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * scale);
      ctx.lineTo(x + size, y + sy * scale);
      ctx.stroke();
    }
    const mh = size * (2600 / 3600);
    const dot = (wx, wy) => [x + wx * scale, y + wy * scale];
    // Police (blue), enemies (red), traffic (grey).
    ctx.fillStyle = '#7fb2ff';
    for (const c of world.cruisers) {
      const [dx, dy] = dot(c.x, c.y);
      ctx.beginPath(); ctx.arc(dx, dy, 3, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#ff5a4a';
    for (const v of world.vipers) {
      if (!v.alive) continue;
      const [dx, dy] = dot(v.x, v.y);
      ctx.beginPath(); ctx.arc(dx, dy, 3, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(200,200,200,0.8)';
    for (const c of world.traffic) {
      const [dx, dy] = dot(c.x, c.y);
      ctx.fillRect(dx - 1, dy - 1, 2, 2);
    }
    // Mission target: an 8-9 px gold blip with a white ring and pulse.
    const target = world.targetPos();
    if (target) {
      const [dx, dy] = dot(target.x, target.y);
      const pulse = 1 + Math.sin(world.time * 5) * 0.18;
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(dx, dy, 4.5 * pulse, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(dx, dy, 7 * pulse, 0, TAU);
      ctx.stroke();
    }
    // Player: white dot with a dark ring.
    const [px, py] = dot(world.player.x, world.player.y);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, TAU);
    ctx.stroke();
    // View rectangle.
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    const vw = 1280 * scale;
    const vh = 720 * scale;
    ctx.strokeRect(px - vw / 2, py - vh / 2, vw, vh);
    ctx.restore();
    return { x, y, size, h: mh };
  }

  function drawHUD(ctx, world, w, h, view) {
    // Top-left: cash, health, wanted stars.
    ctx.save();
    ctx.fillStyle = 'rgba(12, 16, 22, 0.75)';
    rr(ctx, 14, 14, 250, 92, 10);
    ctx.fill();
    ctx.fillStyle = '#7CFC00';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`$${world.cash}`, 26, 46);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px Georgia, serif';
    ctx.fillText(`LEO MARIN  ·  ${world.kills} down`, 26, 66);
    // Health bar.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(26, 74, 180, 10);
    ctx.fillStyle = world.player.hp > 40 ? '#7CFC00' : '#ff5a3a';
    ctx.fillRect(26, 74, 180 * Math.max(0, world.player.hp / PLAYER.maxHp), 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(26, 74, 180, 10);
    // Stars row, just under the cash panel.
    ctx.save();
    ctx.fillStyle = 'rgba(12, 16, 22, 0.75)';
    rr(ctx, 14, 114, 250, 40, 10);
    ctx.fill();
    for (let i = 0; i < 5; i++) drawStar(ctx, 36 + i * 34, 134, 11, i < world.stars);
    ctx.fillStyle = world.stars > 0 ? '#ffb03a' : 'rgba(255,255,255,0.6)';
    ctx.font = 'bold 12px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(world.stars > 0 ? 'WANTED' : 'CLEAN', 196, 138);
    ctx.restore();

    // Minimap, top-right.
    const map = drawMinimap(ctx, world, w);

    // Mission tracker, under the minimap.
    const m = world.currentMission();
    if (m) {
      const step = world.currentStep();
      const ty = map.y + map.h + 18;
      ctx.save();
      ctx.fillStyle = 'rgba(12, 16, 22, 0.8)';
      rr(ctx, w - 222, ty, 206, 96, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 15px Georgia, serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${m.id}. ${m.title}  ·  $${m.reward}`, w - 212, ty + 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px Georgia, serif';
      let stepText = step ? step.text : 'Done';
      if (step && step.kind === 'clear') stepText = `Defeat the Crimson Vipers (${world.vipersDown}/4 down)`;
      const lines = wrapText(ctx, stepText, 186);
      lines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, w - 212, ty + 44 + i * 17));
      const target = world.targetPos();
      if (target) {
        const d = Math.round(Math.hypot(world.player.x - target.x, world.player.y - target.y) / 5);
        ctx.fillStyle = '#ffd94a';
        ctx.fillText(`◈ ${target.label} — ${d} m`, w - 212, ty + 84);
      }
      ctx.restore();
    }

    // Banner: mission complete / new mission, centred near the top.
    if (world.banner) {
      const bw = 640;
      const bx = (w - bw) / 2;
      const by = 24;
      ctx.save();
      ctx.fillStyle = world.banner.kind === 'complete' ? 'rgba(20, 60, 20, 0.88)' : 'rgba(12, 16, 22, 0.88)';
      rr(ctx, bx, by, bw, 92, 10);
      ctx.fill();
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 22px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(world.banner.title, w / 2, by + 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = '15px Georgia, serif';
      const briefLines = wrapText(ctx, world.banner.sub, bw - 40);
      briefLines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, w / 2, by + 58 + i * 19));
      ctx.restore();
    }

    // Off-screen target arrow: a gold chevron at the frame edge with distance.
    const target = world.targetPos();
    if (target) {
      const sx = target.x - world.camera.x + view.w / 2;
      const sy = target.y - world.camera.y + view.h / 2;
      const dPx = Math.hypot(target.x - world.player.x, target.y - world.player.y);
      if (dPx > 200 && (sx < 60 || sx > w - 60 || sy < 60 || sy > h - 60)) {
        const ang = Math.atan2(sy - h / 2, sx - w / 2);
        const ax = w / 2 + Math.cos(ang) * (w / 2 - 70);
        const ay = h / 2 + Math.sin(ang) * (h / 2 - 70);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.fillStyle = '#ffd94a';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -12);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#ffd94a';
        ctx.font = 'bold 14px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(dPx / 5)} m`, ax, ay + 30);
      }
    }

    // Steal prompt, above the controls pill.
    if (world.stealTarget && !world.player.inCar) {
      ctx.save();
      ctx.fillStyle = 'rgba(12, 16, 22, 0.85)';
      const label = `Press E to steal this car — ${world.stealTarget.model.name}`;
      ctx.font = 'bold 17px Georgia, serif';
      const tw = ctx.measureText(label).width + 36;
      rr(ctx, w / 2 - tw / 2, h - 96, tw, 36, 18);
      ctx.fill();
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(label, w / 2, h - 72);
      ctx.restore();
    }

    // BUSTED warning bar.
    if (world.bustWarning > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(120, 10, 10, 0.9)';
      rr(ctx, w / 2 - 190, 130, 380, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('BUSTED INCOMING — BREAK AWAY!', w / 2, 153);
      ctx.fillStyle = '#ff5a3a';
      ctx.fillRect(w / 2 - 180, 158, 360 * world.bustWarning, 4);
      ctx.restore();
    }

    // Save toast, bottom-right.
    if (world.saveToastTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, world.saveToastTimer);
      ctx.fillStyle = 'rgba(20, 60, 20, 0.92)';
      const label = '✓ PROGRESS SAVED';
      ctx.font = 'bold 15px Georgia, serif';
      const tw = ctx.measureText(label).width + 28;
      rr(ctx, w - tw - 18, h - 62, tw, 32, 8);
      ctx.fill();
      ctx.fillStyle = '#7CFC00';
      ctx.textAlign = 'center';
      ctx.fillText(label, w - tw / 2 - 18, h - 41);
      ctx.restore();
    }

    // Event log, bottom-left.
    ctx.save();
    ctx.font = '13px Georgia, serif';
    ctx.textAlign = 'left';
    world.log.slice(0, 4).forEach((line, i) => {
      ctx.fillStyle = `rgba(255,255,255,${0.85 - i * 0.18})`;
      ctx.fillText(line, 16, h - 96 - i * 18);
    });
    ctx.restore();

    // Controls line in a pill, never clipped at the frame edge.
    ctx.save();
    ctx.font = '14px Georgia, serif';
    const cw = ctx.measureText(CONTROLS_LINE).width + 36;
    ctx.fillStyle = 'rgba(12, 16, 22, 0.78)';
    rr(ctx, w / 2 - cw / 2, h - 34, cw, 24, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(CONTROLS_LINE, w / 2, h - 17);
    ctx.restore();
  }

  // ---- screens ----------------------------------------------------------------

  function drawTitle(ctx, world, w, h, mouse, hasSave) {
    // The staged city shows through a dim backdrop (0.45, not darker:
    // the street life must stay visible behind the menu).
    ctx.fillStyle = 'rgba(8, 10, 18, 0.45)';
    ctx.fillRect(0, 0, w, h);
    // Top gradient for the title text.
    const grad = ctx.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, 'rgba(8,10,18,0.55)');
    grad.addColorStop(1, 'rgba(8,10,18,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, 300);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 92px Georgia, serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 18;
    ctx.fillText('SOLMARA', w / 2, 128);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 24px Georgia, serif';
    ctx.fillText('An Open-World Crime Story', w / 2, 168);
    ctx.font = '16px Georgia, serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('Leo Marin is back — broke, wanted, one job away from freedom.', w / 2, 200);
    ctx.restore();
    const buttons = layoutButtons('title', w, h, hasSave);
    for (const b of buttons) {
      const hover = mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
      drawButton(ctx, b, hover);
    }
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('An original city, story and soundtrack — no borrowed names, maps or music.', w / 2, h - 18);
    ctx.restore();
  }

  function drawHowTo(ctx, w, h, mouse) {
    ctx.fillStyle = 'rgba(8, 10, 18, 0.82)';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillText('HOW TO PLAY', w / 2, 90);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Georgia, serif';
    const lines = [
      'WASD — walk (Shift to run) · Mouse — aim · Click / Space — shoot your pistol',
      'Walk up to any car and press E to steal it. E again to get out. W/S drive, A/D steer.',
      'Crimes raise your wanted level (0–5 stars). Cops chase, ram and shoot.',
      'If a cop holds you for a few seconds, you are BUSTED and lose 15% of your cash.',
      'Follow the gold beacon: four missions from Mara Voss, $200 to $1,500 a job.',
      'Find all 8 hidden gold stashes ($75 each). Your progress autosaves after every mission.',
      'P — pause · M — mute the music',
    ];
    lines.forEach((ln, i) => ctx.fillText(ln, w / 2, 160 + i * 44));
    ctx.restore();
    drawButton(ctx, { id: 'back', label: 'BACK', x: w / 2 - 150, y: h - 130, w: 300, h: 52 }, false);
  }

  function drawPause(ctx, world, w, h, mouse) {
    ctx.fillStyle = 'rgba(8, 10, 18, 0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText('PAUSED', w / 2, h / 2 - 130);
    ctx.font = '17px Georgia, serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const m = world.currentMission();
    ctx.fillText(m ? `Mission ${m.id}: ${m.title}  ·  Cash $${world.cash}  ·  ${world.kills} down` : `Cash $${world.cash}`, w / 2, h / 2 - 92);
    ctx.restore();
    const buttons = layoutButtons('pause', w, h, true);
    for (const b of buttons) {
      const hover = mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
      drawButton(ctx, b, hover);
    }
  }

  function drawEnd(ctx, screen, world, w, h, mouse) {
    const isVictory = screen === 'victory';
    ctx.fillStyle = isVictory ? 'rgba(10, 40, 16, 0.72)' : 'rgba(60, 8, 8, 0.72)';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = isVictory ? '#7CFC00' : '#ff5a3a';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText(isVictory ? 'THE BIG SCORE!' : screen === 'wasted' ? 'WASTED' : 'BUSTED', w / 2, h / 2 - 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = '19px Georgia, serif';
    if (isVictory) {
      ctx.fillText('All four jobs done. Mara pays out — Solmara is yours now.', w / 2, h / 2 - 16);
      ctx.fillText(`Final cash $${world.cash}  ·  ${world.kills} enemies down  ·  ${world.stashes.filter((s) => s.found).length}/8 stashes found`, w / 2, h / 2 + 16);
    } else if (screen === 'wasted') {
      ctx.fillText('Leo went down. The city keeps moving without him.', w / 2, h / 2 - 16);
      ctx.fillText('You lose 10% of your cash. Try again.', w / 2, h / 2 + 16);
    } else {
      ctx.fillText('The Solmara PD finally got their hands on you.', w / 2, h / 2 - 16);
      ctx.fillText('You lose 15% of your cash. Try again.', w / 2, h / 2 + 16);
    }
    ctx.restore();
    const buttons = layoutButtons(screen, w, h, true);
    for (const b of buttons) {
      const hover = mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
      drawButton(ctx, b, hover);
    }
  }

  // The one entry point main.js calls every frame.
  export function renderGame(ctx, world, screen, view, mouse, hasSave) {
    const w = view.w;
    const h = view.h;
    ctx.save();
    // Camera with a little shake on impacts.
    const shx = world.shake ? (Math.random() - 0.5) * world.shake : 0;
    const shy = world.shake ? (Math.random() - 0.5) * world.shake : 0;
    const camX = world.camera.x + shx;
    const camY = world.camera.y + shy;
    ctx.translate(w / 2 - camX, h / 2 - camY);
    drawCity(ctx, world, view);
    drawWorldEntities(ctx, world);
    ctx.restore();

    if (screen === 'play' || screen === 'pause') {
      drawHUD(ctx, world, w, h, view);
    }
    if (screen === 'title') drawTitle(ctx, world, w, h, mouse, hasSave);
    else if (screen === 'howto') drawHowTo(ctx, w, h, mouse);
    else if (screen === 'pause') drawPause(ctx, world, w, h, mouse);
    else if (screen === 'wasted' || screen === 'busted' || screen === 'victory') drawEnd(ctx, screen, world, w, h, mouse);
  }
