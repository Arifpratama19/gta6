// main.js — SOLMAR BAY's entry point: the game loop, the camera, all the
// rendering, the mode machine, and the debug hook the tests drive.
import { WORLD, START_MONEY, BEACH_X, OCEAN_X, PALETTE } from './config.js';
import { clamp, lerp, dist } from './util.js';
import { buildCity } from './city.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { createPlayer, updatePlayerOnFoot, nearestCar, enterCar, exitCar } from './player.js';
import { makeCar, spawnTraffic, updateTraffic, updatePlayerCar } from './vehicles.js';
import { spawnPeds, updatePeds } from './people.js';
import { addWanted, clearWanted, updatePolice } from './police.js';
import { createCombat, firePistol, updateBullets } from './combat.js';
import { startMission, updateMission, missionTarget, currentMission } from './missions.js';
import { saveGame, loadGame, clearSave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const VIEW_W = 1280;
const VIEW_H = 720;

const state = {
  mode: 'title',
  time: 0,
  city: null,
  player: null,
  cars: [],
  peds: [],
  bullets: [],
  particles: [],
  cops: [],
  wanted: 0,
  wantedTimer: 0,
  spawnCooldown: 0,
  bustTimer: 0,
  money: START_MONEY,
  mission: 0,
  missionStage: 0,
  missionKills: 0,
  checkpointIndex: 0,
  missionData: {},
  camera: { x: 1200, y: 900 },
  input: new Input(canvas),
  audio: new AudioEngine(),
  hud: new Hud(),
  combat: createCombat(),
  interactQueued: false,
  lastShotCrime: -99,
  saveTimer: 0,
};
state.addWanted = (stars, reason) => addWanted(state, stars, reason);
state.save = () => saveGame(state);

state.bust = (reason) => {
  if (state.mode !== 'play') return;
  state.mode = 'busted';
  state.money = Math.max(0, state.money - 150);
  clearWanted(state);
  state.audio.busted();
  state.audio.setEngine(0);
  state.hud.showEnd('BUSTED', reason + ' You paid a $150 fine and woke up at the hospital. Press Enter to get back out there.');
};

state.wasted = (reason) => {
  if (state.mode !== 'play') return;
  state.mode = 'wasted';
  clearWanted(state);
  state.audio.busted();
  state.audio.setEngine(0);
  state.hud.showEnd('WASTED', reason + ' You woke up at the hospital. Press Enter to get back out there.');
};

function newGame(fromSave) {
  const save = fromSave ? loadGame() : null;
  state.city = buildCity();
  state.player = createPlayer(1120, 1060);
  state.cars = [];
  state.peds = [];
  state.bullets = [];
  state.particles = [];
  state.cops = [];
  state.wanted = 0;
  state.wantedTimer = 0;
  state.spawnCooldown = 0; // initialised here; police also defends it.
  state.money = save ? save.money : START_MONEY;
  state.mission = 0;
  state.missionStage = 0;
  state.missionKills = 0;
  state.checkpointIndex = 0;
  state.missionData = {};
  state.interactQueued = false;
  state.lastShotCrime = -99;
  state.combat = createCombat();
  // Rico's own car, parked on the road just north of him.
  const comet = makeCar({
    name: 'Comet',
    x: 1080, y: 1000, angle: -Math.PI / 2,
    color: '#d94f3d', owned: true,
  });
  state.cars.push(comet);
  state.cars.push(...spawnTraffic(state.city, Math.random, 24));
  state.peds.push(...spawnPeds(state.city, Math.random, 26));
  if (save) {
    state.player.hp = save.hp;
    state.player.x = save.x;
    state.player.y = save.y;
    startMission(state, save.mission);
  } else {
    startMission(state, 0);
  }
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  state.mode = 'play';
  state.hud.hideTitle();
  state.hud.hideEnd();
  state.hud.hidePause();
}

function respawn() {
  const hospital = state.city.hospital;
  state.player.hp = state.player.maxHp;
  state.player.x = hospital.x;
  state.player.y = hospital.y;
  if (state.player.inCar) {
    state.player.inCar.driver = null;
    state.player.inCar = null;
  }
  state.player.invulnerable = 2;
  state.bullets = [];
  state.cars = state.cars.filter((c) => !c.isCop);
  state.cops = [];
  state.mode = 'play';
  state.hud.hideEnd();
  restartMissionSafe();
  state.hud.toast('Back on the streets. The mission restarts.');
}

function restartMissionSafe() {
  // Re-run the current mission from stage 0 (the GT / gunmen reset too).
  startMission(state, state.mission);
}

function screenToWorld(mx, my) {
  const r = canvas.getBoundingClientRect();
  const scaleX = VIEW_W / r.width;
  const scaleY = VIEW_H / r.height;
  return {
    x: state.camera.x - VIEW_W / 2 + mx * scaleX,
    y: state.camera.y - VIEW_H / 2 + my * scaleY,
  };
}

function update(dt) {
  const p = state.player;
  const input = state.input;

  if (input.wasPressed('Escape')) {
    if (state.mode === 'play') {
      state.mode = 'pause';
      state.hud.showPause();
    } else if (state.mode === 'pause') {
      state.mode = 'play';
      state.hud.hidePause();
    }
  }
  if (state.mode !== 'play') return;

  // Enter / exit cars, and the vault grab.
  if (input.wasPressed('KeyE')) {
    state.interactQueued = true;
    if (p.inCar) {
      exitCar(state);
      state.audio.blip(300, 0.06, 'square', 0.08);
    } else {
      const car = nearestCar(state, 78);
      if (car) {
        if (!car.owned && car.driver !== 'player') {
          state.addWanted(2, 'You stole the ' + car.name + '!');
        }
        enterCar(state, car);
        state.audio.blip(420, 0.07, 'sine', 0.12);
      }
    }
  }
  // Shooting: mouse click, or F to fire where Rico faces.
  if (input.mouse.clicked || (input.mouse.down && state.combat.fireCooldown <= 0)) {
    const w = screenToWorld(input.mouse.x, input.mouse.y);
    if (firePistol(state, w.x, w.y)) {
      // Shots draw the law — except on the Pier, where the gangs settle
      // their own scores and the cops stay clear.
      const pierShootout = state.mission === 2 && state.missionStage === 1;
      if (!pierShootout && state.time - state.lastShotCrime > 10) {
        state.lastShotCrime = state.time;
        state.addWanted(1, 'Shots fired in the city!');
      }
    }
  }
  if (input.wasPressed('KeyF')) {
    const tx = p.x + Math.cos(p.angle) * 100;
    const ty = p.y + Math.sin(p.angle) * 100;
    if (firePistol(state, tx, ty)) {
      const pierShootout = state.mission === 2 && state.missionStage === 1;
      if (!pierShootout && state.time - state.lastShotCrime > 10) {
        state.lastShotCrime = state.time;
        state.addWanted(1, 'Shots fired in the city!');
      }
    }
  }

  if (p.inCar) {
    updatePlayerCar(state, dt);
  } else {
    updatePlayerOnFoot(state, dt);
  }
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateBullets(state, dt);
  updateMission(state, dt);

  // Particles.
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
  // Prune the dead.
  if (state.peds.length > 40) {
    state.peds = state.peds.filter((ped) => !ped.dead);
  }

  // Camera follows the player, clamped to the world.
  const tx = clamp(p.x, VIEW_W / 2, WORLD.w - VIEW_W / 2);
  const ty = clamp(p.y, VIEW_H / 2, WORLD.h - VIEW_H / 2);
  state.camera.x = lerp(state.camera.x, tx, 1 - Math.pow(0.001, dt));
  state.camera.y = lerp(state.camera.y, ty, 1 - Math.pow(0.001, dt));

  // Engine and siren follow the action.
  const speed01 = p.inCar ? Math.abs(p.inCar.speed) / 660 : 0;
  state.audio.setEngine(speed01);

  // Autosave every 20 seconds.
  state.saveTimer += dt;
  if (state.saveTimer > 20) {
    state.saveTimer = 0;
    state.save();
  }
  state.interactQueued = false;
}

function drawCar(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  const w = 46;
  const h = 24;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = c.wrecked ? '#3a3a3a' : c.color;
  roundRect(-w / 2, -h / 2, w, h, 7);
  ctx.fill();
  ctx.fillStyle = c.isCop ? PALETTE.copWhite : 'rgba(20,30,40,0.85)';
  roundRect(-w / 2 + 8, -h / 2 + 4, 12, h - 8, 3);
  ctx.fill();
  roundRect(w / 2 - 16, -h / 2 + 4, 10, h - 8, 3);
  ctx.fill();
  if (c.isCop) {
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-4, -h / 2 - 1, 8, 4);
    ctx.fillStyle = '#2b6cff';
    ctx.fillRect(-4, h / 2 - 3, 8, 4);
  }
  if (!c.wrecked) {
    ctx.fillStyle = 'rgba(255,255,190,0.85)';
    ctx.fillRect(w / 2 - 2, -h / 2 + 3, 3, 4);
    ctx.fillRect(w / 2 - 2, h / 2 - 7, 3, 4);
  }
  ctx.restore();
  if (c.hp < 45 && !c.wrecked) {
    ctx.fillStyle = 'rgba(90,90,90,0.5)';
    ctx.beginPath();
    ctx.arc(c.x - 10, c.y - 6, 7 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function render() {
  const cam = state.camera;
  const ox = cam.x - VIEW_W / 2;
  const oy = cam.y - VIEW_H / 2;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(-ox, -oy);

  // Ground.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  // Ocean and sand on the east edge.
  ctx.fillStyle = PALETTE.oceanDeep;
  ctx.fillRect(OCEAN_X, 0, WORLD.w - OCEAN_X, WORLD.h);
  ctx.fillStyle = PALETTE.ocean;
  ctx.fillRect(OCEAN_X, 0, WORLD.w - OCEAN_X, WORLD.h);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(BEACH_X, 0, OCEAN_X - BEACH_X, WORLD.h);
  // Gentle waves.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let y = 0; y < WORLD.h; y += 90) {
    const wob = Math.sin((state.time * 0.7 + y) / 60) * 6;
    ctx.beginPath();
    ctx.moveTo(OCEAN_X + 4 + wob, y);
    ctx.lineTo(OCEAN_X + 26 + wob, y + 22);
    ctx.stroke();
  }

  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const rx of state.city.roadsV) ctx.fillRect(rx - 32, 0, 64, WORLD.h);
  for (const ry of state.city.roadsH) ctx.fillRect(0, ry - 32, BEACH_X, 64);
  // Centre dashes.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const rx of state.city.roadsV) {
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, WORLD.h);
    ctx.stroke();
  }
  for (const ry of state.city.roadsH) {
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(BEACH_X, ry);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings.
  for (const b of state.city.buildings) {
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let f = 1; f < b.floors; f++) {
      ctx.fillRect(b.x + 6, b.y + 4 + (f * (b.h - 8)) / b.floors, b.w - 12, 2);
    }
  }

  // Landmarks.
  drawLandmark(state.city.marina, '#2e7f9e', 'MARINA');
  drawLandmark(state.city.casino, '#7a4fd9', 'CASINO AURORA');
  drawLandmark(state.city.motel, '#4f9fd9', 'MOTEL CORAL');
  drawLandmark(state.city.chopShop, '#8a5a3d', 'CHOP SHOP');
  drawLandmark(state.city.hospital, '#e8e8e8', 'HOSPITAL');
  // Pier planks into the sea.
  ctx.fillStyle = '#a9804f';
  ctx.fillRect(state.city.pier.x - 8, state.city.pier.y - 60, 16, 130);
  ctx.fillStyle = '#8a6a3d';
  for (let y = state.city.pier.y - 60; y < state.city.pier.y + 70; y += 14) {
    ctx.fillRect(state.city.pier.x - 8, y, 16, 3);
  }
  // Speedboat at the marina.
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath();
  ctx.ellipse(state.city.boat.x, state.city.boat.y, 26, 10, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d94f3d';
  ctx.fillRect(state.city.boat.x - 14, state.city.boat.y - 4, 16, 8);

  // Palm trees.
  for (const palm of state.city.palms) {
    ctx.fillStyle = '#6a4a2d';
    ctx.fillRect(palm.x - 2, palm.y - 2, 4, 4);
    ctx.fillStyle = PALETTE.palm;
    ctx.beginPath();
    ctx.arc(palm.x, palm.y, palm.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mission marker: pulsing diamond and a beam of light.
  const target = missionTarget(state);
  if (target && state.mode === 'play') {
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.fillStyle = 'rgba(255,225,77,0.18)';
    ctx.fillRect(target.x - 26, target.y - 90, 52, 90);
    ctx.fillStyle = '#ffe14d';
    ctx.save();
    ctx.translate(target.x, target.y - 46);
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 12);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 30 + Math.sin(state.time * 4) * 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Cars, peds, player, bullets, particles.
  for (const car of state.cars) drawCar(car);
  for (const ped of state.peds) {
    if (ped.dead) continue;
    ctx.fillStyle = ped.gunman ? '#c22f2f' : ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, ped.gunman ? 11 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ped.x, ped.y);
    ctx.lineTo(ped.x + Math.cos(ped.angle) * 12, ped.y + Math.sin(ped.angle) * 12);
    ctx.stroke();
    if (ped.gunman) {
      ctx.fillStyle = '#222';
      ctx.fillRect(ped.x + Math.cos(ped.angle) * 12 - 2, ped.y + Math.sin(ped.angle) * 12 - 2, 8, 4);
    }
  }
  const p = state.player;
  if (!p.inCar) {
    ctx.fillStyle = '#1d6fd9';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18);
    ctx.stroke();
    if (p.invulnerable > 0 && Math.floor(state.time * 8) % 2 === 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 19, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#ffe14d';
  ctx.lineWidth = 3;
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.px, b.py);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const pt of state.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (0.5 + pt.life / pt.max), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Sun-soaked vignette.
  const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
  grad.addColorStop(0, 'rgba(255,220,120,0)');
  grad.addColorStop(1, 'rgba(255,190,80,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawLandmark(spot, color, label) {
  ctx.fillStyle = color;
  ctx.fillRect(spot.x - 34, spot.y - 22, 68, 44);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, spot.x, spot.y + 3);
}

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  state.time += dt;
  if (state.mode === 'play' || state.mode === 'pause') {
    update(dt);
  }
  if (state.city) {
    render();
    if (state.mode === 'play') state.hud.update(state);
  }
  state.input.endFrame();
  requestAnimationFrame(frame);
}

// Buttons.
document.getElementById('btn-new').addEventListener('click', () => {
  state.audio.ensure();
  clearSave();
  newGame(false);
});
document.getElementById('btn-continue').addEventListener('click', () => {
  state.audio.ensure();
  newGame(true);
});
document.getElementById('btn-resume').addEventListener('click', () => {
  state.mode = 'play';
  state.hud.hidePause();
});
document.getElementById('btn-restart').addEventListener('click', () => {
  state.hud.hidePause();
  newGame(false);
});
document.getElementById('btn-end').addEventListener('click', () => {
  state.hud.hideEnd();
  respawn();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && (state.mode === 'busted' || state.mode === 'wasted')) {
    state.hud.hideEnd();
    respawn();
  }
  if (e.code === 'Enter' && state.mode === 'complete') {
    state.mode = 'play';
    state.hud.hideEnd();
  }
  if (e.code === 'KeyM') {
    state.audio.muted = !state.audio.muted;
  }
});

// Debug hook for headless verification (and curious players).
window.__solmar = {
  state,
  version: 'r4',
  start: () => newGame(false),
  newGame,
  teleport(x, y) {
    state.player.x = x;
    state.player.y = y;
    if (state.player.inCar) {
      state.player.inCar.x = x;
      state.player.inCar.y = y;
    }
    state.camera.x = x;
    state.camera.y = y;
  },
  setWanted(n) {
    state.wanted = n;
    state.wantedTimer = 26;
  },
  skipToMission(n) {
    startMission(state, n);
  },
  save: () => saveGame(state),
  load: () => loadGame(),
};

// Title screen first; the Continue button only shows with a save.
state.city = buildCity();
state.player = createPlayer(1120, 1060);
state.cars = [makeCar({ name: 'Comet', x: 1080, y: 1000, angle: -Math.PI / 2, color: '#d94f3d', owned: true })];
state.cars.push(...spawnTraffic(state.city, Math.random, 24));
state.peds.push(...spawnPeds(state.city, Math.random, 26));
state.hud.showTitle();
if (!loadGame()) {
  document.getElementById('btn-continue').style.display = 'none';
}
const params = new URLSearchParams(window.location.search);
if (params.get('autostart') === '1') {
  state.audio.ensure();
  newGame(false);
  const m = params.get('mission');
  if (m !== null) startMission(state, parseInt(m, 10));
}
requestAnimationFrame(frame);
