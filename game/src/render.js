// SOLMARA — all drawing: the city, cars, characters, the HUD and the minimap.
// Flat 2D top-down, bright solid colours, thick outlines. The renderer takes
// the world's state and a camera and paints one frame; screens are overlays.
import { CFG } from './config.js';
import { districtAt } from './city.js';
import { currentTarget, missionText, wantedLabel } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_DEAD = 'dead';
export const SCREEN_COMPLETE = 'complete';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const VIEW_HEIGHT = 720;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 1280, h: 720, dpr: 1, scale: 1 };
  const fonts = new Map();

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    view.w = w;
    view.h = h;
    view.dpr = dpr;
    view.scale = h / VIEW_HEIGHT;
  }

  function text(value, x, y, size, color, align = 'left', weight = 700) {
    const key = `${weight}:${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function outlineText(value, x, y, size, color, align = 'left') {
    ctx.font = `${800} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = Math.max(3, size / 6);
    ctx.strokeStyle = 'rgba(20, 24, 34, 0.85)';
    ctx.strokeText(value, x, y);
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  }

  // ---------------------------------------------------------- the city

  function drawCity(state) {
    const city = state.city;
    const t = state.time;

    // Base ground, then one tinted block per district.
    ctx.fillStyle = '#8fae6a';
    ctx.fillRect(0, 0, city.width, city.height);
    for (const d of city.districts) {
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }

    // The sea and the sand, east edge.
    ctx.fillStyle = '#2f7fc4';
    ctx.fillRect(city.waterX, 0, city.width - city.waterX, city.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    for (let y = 120; y < city.height; y += 260) {
      ctx.beginPath();
      ctx.moveTo(city.waterX + 30, y + Math.sin(t * 1.4 + y) * 8);
      ctx.quadraticCurveTo(city.waterX + 110, y + 26, city.waterX + 190, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#f2df9a';
    ctx.fillRect(city.beachX0, 0, city.waterX - city.beachX0, city.height);

    // Roads: asphalt, then a dashed centre line.
    ctx.fillStyle = '#3a3f4a';
    for (const ax of city.avenues) ctx.fillRect(ax - city.roadWidth / 2, 0, city.roadWidth, city.height);
    for (const sy of city.streets) ctx.fillRect(0, sy - city.roadWidth / 2, city.width, city.roadWidth);
    ctx.strokeStyle = '#f2c200';
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 22]);
    ctx.beginPath();
    for (const ax of city.avenues) {
      ctx.moveTo(ax, 0);
      ctx.lineTo(ax, city.height);
    }
    for (const sy of city.streets) {
      ctx.moveTo(0, sy);
      ctx.lineTo(city.width, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Liberty Plaza: pale stone, a fountain, and its name.
    const pz = city.plaza;
    ctx.fillStyle = '#e8e0c8';
    ctx.fillRect(pz.x, pz.y, pz.w, pz.h);
    ctx.strokeStyle = '#8a7a5a';
    ctx.lineWidth = 4;
    ctx.strokeRect(pz.x, pz.y, pz.w, pz.h);
    ctx.fillStyle = '#4a90d8';
    ctx.beginPath();
    ctx.arc(pz.cx, pz.cy, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2f5a8a';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#bfe0f2';
    ctx.beginPath();
    ctx.arc(pz.cx, pz.cy, 26, 0, Math.PI * 2);
    ctx.fill();
    text('LIBERTY PLAZA', pz.cx, pz.y + 30, 20, '#6a5a3a', 'center');

    // Marina docks and moored boats.
    ctx.fillStyle = '#8a6a4a';
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(3230, 300 + i * 180, 110, 22);
    }
    for (let i = 0; i < 4; i += 1) {
      const by = 330 + i * 180;
      ctx.fillStyle = ['#e2e2e2', '#e23b3b', '#3b7fe2', '#f2c200'][i];
      ctx.beginPath();
      ctx.ellipse(3420, by, 46, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1c2430';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Buildings: solid fill, thick outline, a lighter roof inset.
    for (const b of city.buildings) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#1c2430';
      ctx.lineWidth = 4;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, Math.max(10, b.h * 0.22));
      if (b.label === 'Meridian Vault') {
        // The big dollar sign owns the centre; the name goes above the roof.
        text(b.label, b.x + b.w / 2, b.y - 10, 15, '#ffffff', 'center');
      } else if (b.label) {
        text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5, 15, '#ffffff', 'center');
      }
    }

    // The vault gets a big dollar sign so the mission target reads at a glance.
    const vault = city.buildings.find((b) => b.label === 'Meridian Vault');
    if (vault) {
      outlineText('$', vault.x + vault.w / 2, vault.y + vault.h / 2 + 4, 44, '#f2c200', 'center');
    }

    // Beach umbrellas.
    for (const u of city.umbrellas) {
      ctx.strokeStyle = '#6a4a2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(u.x, u.y - 16);
      ctx.stroke();
      ctx.fillStyle = u.color;
      ctx.beginPath();
      ctx.arc(u.x, u.y - 18, 20, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#1c2430';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // District names, faint, across their ground.
    text('OLD TOWN', 300, 480, 30, 'rgba(40,40,30,0.35)', 'center');
    text('DOWNTOWN', 1875, 480, 30, 'rgba(40,40,30,0.35)', 'center');
    text('MARINA BAY', 3075, 480, 30, 'rgba(40,40,30,0.35)', 'center');
    text('HARBOR WORKS', 1275, 2350, 30, 'rgba(40,40,30,0.35)', 'center');
    text('SOLMARA BEACH', 3075, 2350, 30, 'rgba(40,40,30,0.35)', 'center');
  }

  // ---------------------------------------------------------- the actors

  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Wheels.
    ctx.fillStyle = '#14181f';
    ctx.fillRect(-20, -15, 12, 7);
    ctx.fillRect(-20, 8, 12, 7);
    ctx.fillRect(10, -15, 12, 7);
    ctx.fillRect(10, 8, 12, 7);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -26, -13, 52, 26, 8);
    ctx.fill();
    ctx.strokeStyle = '#14181f';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Windshield and roof.
    ctx.fillStyle = '#bfe0f2';
    ctx.fillRect(8, -10, 9, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-8, -10, 14, 20);
    // Headlights.
    ctx.fillStyle = '#fff6b0';
    ctx.fillRect(24, -10, 3, 6);
    ctx.fillRect(24, 4, 3, 6);
    if (car.model === 'comet') {
      ctx.fillStyle = '#1c2430';
      ctx.fillRect(-28, -11, 5, 22);
    }
    if (car.driver === 'cop') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-6, -12, 12, 24);
      const flash = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
      ctx.fillRect(-4, -15, 8, 6);
      ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
      ctx.fillRect(-4, 9, 8, 6);
    }
    if (car.color === CFG.taxiColor) {
      ctx.fillStyle = '#1c2430';
      for (let i = 0; i < 4; i += 1) ctx.fillRect(-14 + i * 8, -12, 5, 4);
    }
    ctx.restore();
  }

  function drawPed(ped, time) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#14181f';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      return;
    }
    const bob = Math.sin(time * 10 + ped.id) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, bob * 0.4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#14181f';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3 - 2 + bob * 0.4, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.inCar) {
      const car = state.cars.find((c) => c.id === p.carId);
      if (car) {
        const pulse = 1 + Math.sin(state.time * 5) * 0.12;
        ctx.strokeStyle = '#f2c200';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(car.x, car.y, 40 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    const bob = Math.sin(p.walkPhase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Leo: teal jacket, dark trousers, so he reads against the crowd.
    ctx.fillStyle = '#1f8a70';
    ctx.beginPath();
    ctx.arc(0, bob * 0.3, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#14181f';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4 - 1 + bob * 0.3, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c2430';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4 - 4 + bob * 0.3, 6.5, Math.PI, 0);
    ctx.fill();
    ctx.restore();
  }

  function drawPickups(state) {
    for (const pick of state.pickups) {
      if (!pick.active) continue;
      const bob = Math.sin(state.time * 3 + pick.id) * 3;
      ctx.save();
      ctx.translate(pick.x, pick.y + bob);
      if (pick.kind === 'health') {
        ctx.fillStyle = '#e23b3b';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#14181f';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2.5, -8, 5, 16);
        ctx.fillRect(-8, -2.5, 16, 5);
      } else if (pick.kind === 'cash') {
        ctx.fillStyle = '#37b06a';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#14181f';
        ctx.lineWidth = 3;
        ctx.stroke();
        text('$', 0, 5, 16, '#ffffff', 'center');
      } else {
        ctx.fillStyle = '#f2c200';
        roundRect(ctx, -11, -9, 22, 18, 4);
        ctx.fill();
        ctx.strokeStyle = '#14181f';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#1c2430';
        ctx.fillRect(-6, -5, 3, 10);
        ctx.fillRect(-1, -5, 3, 10);
        ctx.fillRect(4, -5, 3, 10);
      }
      ctx.restore();
    }
  }

  // ---------------------------------------------------------- HUD, minimap, screens

  function drawTargetMarker(state) {
    const target = currentTarget(state);
    if (!target) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.strokeStyle = '#f2c200';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 52);
    ctx.lineTo(target.x, target.y - 22);
    ctx.stroke();
    ctx.fillStyle = '#f2c200';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 18);
    ctx.lineTo(target.x - 9, target.y - 34);
    ctx.lineTo(target.x + 9, target.y - 34);
    ctx.closePath();
    ctx.fill();
  }

  function drawBulletsAndParticles(state) {
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, screen) {
    const p = state.player;
    const w = view.w;
    const h = view.h;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

    // Top-left: health, cash, ammo.
    ctx.fillStyle = 'rgba(20,24,34,0.72)';
    roundRect(ctx, 14, 12, 250, 108, 12);
    ctx.fill();
    text('LEO MARIN', 28, 38, 15, '#8b93a3');
    ctx.fillStyle = '#3a3f4a';
    roundRect(ctx, 28, 46, 180, 16, 8);
    ctx.fill();
    ctx.fillStyle = p.health > 30 ? '#37b06a' : '#e23b3b';
    roundRect(ctx, 28, 46, Math.max(8, 180 * (p.health / CFG.playerHealth)), 16, 8);
    ctx.fill();
    text(`${Math.ceil(p.health)}`, 216, 60, 15, '#ffffff');
    text(`$${p.cash}`, 28, 88, 22, '#f2c200');
    text(p.inCar ? 'DRIVING' : 'ON FOOT', 150, 88, 15, '#ffffff');
    text(`Ammo ${p.ammo}`, 28, 104, 13, '#bfe0f2');

    // Top-centre: wanted stars and label.
    const label = wantedLabel(p.wanted);
    ctx.fillStyle = 'rgba(20,24,34,0.72)';
    roundRect(ctx, w / 2 - 130, 12, 260, 56, 12);
    ctx.fill();
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < p.wanted ? '★' : '☆';
    text(stars, w / 2, 38, 22, p.wanted > 0 ? '#ff5e4a' : '#8b93a3', 'center');
    text(label, w / 2, 58, 13, p.wanted > 0 ? '#ff9a8a' : '#8b93a3', 'center');

    // Arrest warning.
    if (p.arrestTimer > 0.2) {
      outlineText('THE COPS ARE GRABBING YOU — DRIVE!', w / 2, 100, 22, '#ff5e4a', 'center');
    }
    // Vault crack progress: the label sits above the bar, never on the fill.
    if (state.mission.index === 3 && state.mission.stage === 1 && state.mission.crackTimer > 0) {
      const frac = state.mission.crackTimer / CFG.crackTime;
      text('CRACKING THE VAULT...', w / 2, 104, 13, '#ffffff', 'center');
      ctx.fillStyle = 'rgba(20,24,34,0.72)';
      roundRect(ctx, w / 2 - 160, 110, 320, 28, 10);
      ctx.fill();
      ctx.fillStyle = '#f2c200';
      roundRect(ctx, w / 2 - 150, 117, 300 * frac, 14, 7);
      ctx.fill();
    }

    // Mission banner, top-right.
    const mt = missionText(state);
    const target = currentTarget(state);
    ctx.fillStyle = 'rgba(20,24,34,0.72)';
    roundRect(ctx, w - 364, 12, 350, 92, 12);
    ctx.fill();
    text(mt.title.toUpperCase(), w - 350, 38, 15, '#f2c200');
    text(mt.objective, w - 350, 62, 14, '#ffffff');
    if (target) {
      const d = Math.round(Math.hypot(target.x - p.x, target.y - p.y));
      text(`${target.label} — ${d}m`, w - 350, 88, 13, '#bfe0f2');
    } else if (mt.hint) {
      text(mt.hint, w - 350, 88, 13, '#bfe0f2');
    }

    // Toast message, bottom-centre.
    if (state.messageTimer > 0 && state.message) {
      ctx.globalAlpha = Math.min(1, state.messageTimer);
      ctx.fillStyle = 'rgba(20,24,34,0.78)';
      const tw = ctx.measureText(state.message).width + 36;
      roundRect(ctx, w / 2 - tw / 2, h - 84, tw, 34, 10);
      ctx.fill();
      text(state.message, w / 2, h - 60, 15, '#ffffff', 'center');
      ctx.globalAlpha = 1;
    }

    // Controls hint, bottom-left.
    text('WASD move/drive · E steal/crack · F punch · Click shoot · P pause · M mute', 16, h - 14, 12, 'rgba(255,255,255,0.75)');

    drawMinimap(state);
  }

  function drawMinimap(state) {
    const w = view.w;
    const h = view.h;
    const mw = 220;
    const mh = 158;
    const mx = w - mw - 14;
    const my = h - mh - 14;
    const sx = mw / state.city.width;
    const sy = mh / state.city.height;
    ctx.fillStyle = 'rgba(20,24,34,0.78)';
    roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 26, 10);
    ctx.fill();
    // Ground, water, roads.
    ctx.fillStyle = '#5a7a4a';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2f7fc4';
    ctx.fillRect(mx + state.city.waterX * sx, my, mw - state.city.waterX * sx, mh);
    ctx.fillStyle = '#f2df9a';
    ctx.fillRect(mx + state.city.beachX0 * sx, my, (state.city.waterX - state.city.beachX0) * sx, mh);
    ctx.strokeStyle = '#3a3f4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const ax of state.city.avenues) {
      ctx.moveTo(mx + ax * sx, my);
      ctx.lineTo(mx + ax * sx, my + mh);
    }
    for (const sy2 of state.city.streets) {
      ctx.moveTo(mx, my + sy2 * sy);
      ctx.lineTo(mx + mw, my + sy2 * sy);
    }
    ctx.stroke();
    // Places.
    ctx.fillStyle = '#f2c200';
    for (const key of Object.keys(state.city.places)) {
      const pl = state.city.places[key];
      ctx.beginPath();
      ctx.arc(mx + pl.x * sx, my + pl.y * sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Target marker, pulsing.
    const target = currentTarget(state);
    if (target) {
      ctx.strokeStyle = '#f2c200';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx + target.x * sx, my + target.y * sy, 5 + Math.sin(state.time * 4) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Cops as red dots, Leo as a white arrow.
    ctx.fillStyle = '#ff5e4a';
    for (const car of state.cars) {
      if (car.driver !== 'cop') continue;
      ctx.beginPath();
      ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    ctx.save();
    ctx.translate(mx + p.x * sx, my + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // District name under the map.
    const d = districtAt(state.city, p.x, p.y);
    text(d ? d.name.toUpperCase() : 'SOLMARA', mx + mw / 2, my + mh + 15, 12, '#ffffff', 'center');
  }

  // ---------------------------------------------------------- screens

  function drawPanel(title, lines, prompt, accent) {
    const w = view.w;
    const h = view.h;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = 'rgba(12,16,26,0.55)';
    ctx.fillRect(0, 0, w, h);
    const pw = 640;
    const ph = 150 + lines.length * 30 + 70;
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;
    ctx.fillStyle = 'rgba(20,24,34,0.92)';
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.stroke();
    outlineText(title, w / 2, py + 74, 52, accent, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], w / 2, py + 118 + i * 30, 17, '#eef1f5', 'center');
    }
    text(prompt, w / 2, py + ph - 28, 16, '#f2c200', 'center');
  }

  function drawTitle(state, saveExists) {
    const w = view.w;
    const h = view.h;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = 'rgba(12,16,26,0.45)';
    ctx.fillRect(0, 0, w, h);
    outlineText('SOLMARA', w / 2, h * 0.3, 96, '#f2c200', 'center');
    outlineText('An open-world crime story', w / 2, h * 0.3 + 44, 26, '#ffffff', 'center');
    text('Leo Marin came home broke and wanted. Mara Voss has four jobs for him —', w / 2, h * 0.42, 17, '#eef1f5', 'center');
    text('and the last one is the $1,500 Meridian Vault.', w / 2, h * 0.42 + 26, 17, '#eef1f5', 'center');
    text('WASD walk / drive · E steal a car, hold E to crack the vault · F punch · Click to shoot', w / 2, h * 0.56, 16, '#bfe0f2', 'center');
    text('P pause · M mute · progress saves in this browser', w / 2, h * 0.56 + 26, 16, '#bfe0f2', 'center');
    if (saveExists) {
      text('Press C to continue your saved game', w / 2, h * 0.68, 17, '#37b06a', 'center');
      text('Press SPACE or click to start a new game', w / 2, h * 0.68 + 28, 18, '#f2c200', 'center');
    } else {
      text('Press SPACE or click to start', w / 2, h * 0.68, 20, '#f2c200', 'center');
    }
  }

  // ---------------------------------------------------------- one frame

  // Paint one frame. `camera` is the world point at the centre of the screen.
  function draw(state, screen, camera, info = {}) {
    const dpr = view.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, view.w, view.h);
    const scale = view.scale;
    const vw = view.w / scale;
    const vh = view.h / scale;
    const cx = Math.max(vw / 2, Math.min(state.city.width - vw / 2, camera.x));
    const cy = Math.max(vh / 2, Math.min(state.city.height - vh / 2, camera.y));
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (view.w / 2 - cx * scale), dpr * (view.h / 2 - cy * scale));

    drawCity(state);
    drawTargetMarker(state);
    drawPickups(state);
    for (const car of state.cars) drawCar(car, state.time);
    for (const ped of state.peds) drawPed(ped, state.time);
    drawBulletsAndParticles(state);
    drawPlayer(state);

    if (screen === SCREEN_TITLE) {
      drawTitle(state, info.saveExists);
      return;
    }
    drawHud(state, screen);
    if (screen === SCREEN_PAUSE) {
      drawPanel('PAUSED', ['The city waits for no one. Except now.', `Cash $${state.player.cash} · ${missionText(state).title}`], 'Press P or click to resume', '#bfe0f2');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Solmara PD took Leo in.', `Cash kept: $${state.player.cash}`, 'Mara will bail him out. Probably.'], 'Press SPACE to try again', '#ff5e4a');
    } else if (screen === SCREEN_DEAD) {
      drawPanel('WASTED', ['Leo went down in the streets of Solmara.', `Cash kept: $${state.player.cash}`], 'Press SPACE to try again', '#ff5e4a');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('STORY COMPLETE', ['Leo cracked the Meridian Vault and walked away clean.', `$${state.player.cash} in his pocket. Solmara is his now.`, 'Thanks for playing SOLMARA.'], 'Press SPACE to keep playing', '#f2c200');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize, view };
}
