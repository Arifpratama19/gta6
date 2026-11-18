// SOLMAR BAY — Vice Coast Stories. Main loop, rendering, menus.
// Top-down 2D open-world crime game: on foot + driving, traffic, police,
// 5-mission story, pistol combat, HUD + minimap, localStorage saves.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, BEACH_X, WATER_X, SITES, CAR, PLAYER, MISSIONS, SAVE_KEY } from './config.js';
import { clamp, dist } from './util.js';
import { newGame, addBanner } from './state.js';
import { initInput, moveAxis, consumeAction, consumeClick, mouse, endFrame, isDown } from './input.js';
import { isOnRoad, pointInBuilding } from './city.js';
import { nearestCar, enterCar, exitCar, stealCar, updateCar } from './vehicles.js';
import { updatePlayerOnFoot, aimAngle, tryShoot } from './player.js';
import { updatePeds } from './people.js';
import { updateWanted, wastedRespawn, bustPlayer } from './police.js';
import { updateBullets, updateGunmen } from './combat.js';
import { startMission, updateMissions, currentTarget } from './missions.js';
import { drawHUD, drawMinimap } from './hud.js';
import { saveGame, loadSave, hasSave, applySave } from './save.js';
import { unlockAudio, shot, setSiren, setEngine, click, pickup } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let st = newGame(1337);
st.mode = 'title';

initInput(canvas, unlockAudio);

if (new URLSearchParams(location.search).get('autostart') === '1') {
  startNewGame();
}

function startNewGame() {
  st = newGame(1337);
  st.mode = 'playing';
  startMission(st, 0);
  addBanner(st, 'SOLMAR BAY', 'Rico Vega — Vice Coast Stories');
  click();
}

function continueGame() {
  const d = loadSave();
  if (!d) return;
  st = newGame(1337);
  applySave(st, d);
  addBanner(st, 'Welcome back, Rico', 'Save loaded.');
  click();
}

function update(dt) {
  const mode = st.mode;
  if (mode === 'title') {
    if (consumeAction('Enter') || consumeClick()) startNewGame();
    else if (consumeAction('KeyC') && hasSave()) continueGame();
    return;
  }
  if (mode === 'paused') {
    if (consumeAction('Escape') || consumeAction('Enter')) st.mode = 'playing';
    else if (consumeAction('KeyP')) {
      saveGame(st);
      addBanner(st, 'Saved', 'Progress saved.');
    } else if (consumeAction('KeyR')) startNewGame();
    else if (consumeAction('KeyQ')) {
      st = newGame(1337);
      st.mode = 'title';
    }
    consumeClick();
    return;
  }
  if (mode === 'busted') {
    if (consumeAction('Enter') || consumeClick()) st.mode = 'playing';
    return;
  }
  if (mode === 'wasted') {
    if (consumeAction('Enter') || consumeClick()) wastedRespawn(st);
    return;
  }
  // playing / complete: full world update.
  if (consumeAction('Escape')) {
    st.mode = 'paused';
    return;
  }
  if (consumeAction('KeyP')) {
    if (saveGame(st)) addBanner(st, 'Saved', 'Progress saved. (P)');
  }
  if (consumeAction('KeyR')) {
    startNewGame();
    return;
  }
  const axis = moveAxis();
  if (st.player.inCar) {
    if (consumeAction('KeyE')) exitCar(st);
  } else {
    updatePlayerOnFoot(st, dt, axis, canvas, isDown('ShiftLeft') || isDown('ShiftRight'));
    if (consumeAction('KeyE')) {
      const car = nearestCar(st, st.player.x, st.player.y, PLAYER.enterRadius);
      if (car && !car.cop) {
        if (car.id === 'starter') enterCar(st, car);
        else stealCar(st, car);
      }
    }
    if (mouse.down) {
      const b = tryShoot(st, aimAngle(st, canvas, st.camera));
      if (b) shot();
    }
  }
  for (const car of st.cars) updateCar(st, car, dt, axis);
  updatePeds(st, dt);
  updateWanted(st, dt);
  updateBullets(st, dt);
  updateGunmen(st, dt);
  updateMissions(st, dt);
  // Particles.
  for (const pt of st.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.t -= dt;
  }
  st.particles = st.particles.filter((p) => p.t > 0);
  // Camera follows the player.
  const tx = clamp(st.player.x, canvas.width / 2, WORLD.w - canvas.width / 2);
  const ty = clamp(st.player.y, canvas.height / 2, WORLD.h - canvas.height / 2);
  st.camera.x += (tx - st.camera.x) * Math.min(1, dt * 6);
  st.camera.y += (ty - st.camera.y) * Math.min(1, dt * 6);
  if (st.banner) {
    st.banner.t -= dt;
    if (st.banner.t <= 0) st.banner = null;
  }
  st.flash = Math.max(0, st.flash - dt);
  st.time += dt;
  // Audio state.
  setSiren(st.wanted > 0);
  const car = st.player.inCar ? st.cars.find((c) => c.id === st.player.inCar) : null;
  setEngine(car ? Math.abs(car.speed) / CAR.maxSpeed : 0);
  endFrame();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const mode = st.mode;
  if (mode === 'title') {
    drawWorld();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SOLMAR BAY', canvas.width / 2, 200);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('— Vice Coast Stories —', canvas.width / 2, 240);
    ctx.font = '18px monospace';
    ctx.fillStyle = '#dfe6e9';
    ctx.fillText('Rico Vega is back on the coast. Five missions. One city. No rules.', canvas.width / 2, 300);
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('ENTER — New Game', canvas.width / 2, 380);
    if (hasSave()) {
      ctx.fillStyle = '#f1c40f';
      ctx.fillText('C — Continue', canvas.width / 2, 420);
    }
    ctx.fillStyle = '#b2bec3';
    ctx.font = '15px monospace';
    ctx.fillText('WASD move / drive · E enter & exit cars · Mouse aim, Click shoot', canvas.width / 2, 490);
    ctx.fillText('P save · Esc pause · Steal cars, dodge the cops, finish the story', canvas.width / 2, 516);
    ctx.textAlign = 'left';
    return;
  }
  drawWorld();
  drawHUD(ctx, st, canvas);
  drawMinimap(ctx, st, canvas);
  if (mode === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, 300);
    ctx.font = '18px monospace';
    ctx.fillStyle = '#dfe6e9';
    ctx.fillText('Esc — Resume · P — Save · R — Restart · Q — Quit to title', canvas.width / 2, 350);
    ctx.textAlign = 'left';
  } else if (mode === 'busted') {
    overlayScreen('BUSTED', 'Hospital bill: $100. Press ENTER to keep going.');
  } else if (mode === 'wasted') {
    overlayScreen('WASTED', 'Press ENTER to wake up at the hospital.');
  } else if (mode === 'complete') {
    // Free roam continues under the HUD; show a small completion ribbon.
    ctx.fillStyle = 'rgba(46,204,113,0.9)';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★ STORY COMPLETE — FREE ROAM ★', canvas.width / 2, canvas.height - 34);
    ctx.textAlign = 'left';
  }
}

function overlayScreen(title, sub) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 56px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, 320);
  ctx.fillStyle = '#fff';
  ctx.font = '18px monospace';
  ctx.fillText(sub, canvas.width / 2, 370);
  ctx.textAlign = 'left';
}

function drawWorld() {
  const cam = st.camera;
  const ox = canvas.width / 2 - cam.x;
  const oy = canvas.height / 2 - cam.y;
  ctx.save();
  ctx.translate(ox, oy);
  // Ground: grass, then beach, then ocean.
  ctx.fillStyle = '#3d8b4f';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.fillStyle = '#e9d8a6';
  ctx.fillRect(BEACH_X, 0, WATER_X - BEACH_X, WORLD.h);
  ctx.fillStyle = '#1e6fa8';
  ctx.fillRect(WATER_X, 0, WORLD.w - WATER_X, WORLD.h);
  // Ocean shimmer lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (let y = 60; y < WORLD.h; y += 140) {
    ctx.beginPath();
    ctx.moveTo(WATER_X + 20, y);
    ctx.lineTo(WORLD.w - 20, y + 30);
    ctx.stroke();
  }
  // Roads.
  ctx.fillStyle = '#4a4a4a';
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.h);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.w, ROAD_W);
  ctx.fillStyle = '#4a4a4a';
  // Road centre dashes.
  ctx.strokeStyle = '#f5d76e';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const rx of ROADS_X) {
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, WORLD.h);
    ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(WORLD.w, ry);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Pier (wooden walkway into the ocean).
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(2220, 880, 170, 40);
  ctx.strokeStyle = '#6b4423';
  ctx.lineWidth = 2;
  for (let x = 2230; x < 2390; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 880);
    ctx.lineTo(x, 920);
    ctx.stroke();
  }
  // Marina docks.
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(2030, 1470, 120, 14);
  ctx.fillRect(2030, 1530, 120, 14);
  // Buildings.
  for (const b of st.city.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x, b.y + b.h - 10, b.w, 10);
    if (b.roof) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    }
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + b.w / 2 - 2, b.y - 14, 4, 14);
    }
  }
  // Palm trees.
  for (const t of st.city.trees) {
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(t.x - 1, t.y - 1, 3, 3);
  }
  // Named sites.
  drawSite(SITES.motel, '#e67e22', 'MOTEL');
  drawSite(SITES.casino, '#9b59b6', 'CASINO');
  drawSite(SITES.chopShop, '#7f8c8d', 'CHOP SHOP');
  drawSite(SITES.hospital, '#e74c3c', 'HOSPITAL');
  drawSite(SITES.marina, '#16a085', 'MARINA');
  // Mission target ring.
  const t = currentTarget(st);
  if (t && (st.mode === 'playing' || st.mode === 'complete')) {
    const pulse = 1 + Math.sin(st.time * 4) * 0.15;
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 46 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t.name.toUpperCase(), t.x, t.y - 56);
    ctx.textAlign = 'left';
  }
  // Cars.
  for (const car of st.cars) drawCar(car);
  // Pedestrians.
  for (const ped of st.peds) {
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Gunmen.
  for (const g of st.gunmen) {
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(g.x, g.y, GUNMAN_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2d3436';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.angle) * 26, g.y + Math.sin(g.angle) * 26);
    ctx.stroke();
    // Health bar.
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(g.x - 16, g.y - 28, 32, 5);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(g.x - 16, g.y - 28, 32 * Math.max(0, g.hp / 100), 5);
  }
  // Bullets.
  ctx.strokeStyle = '#ffeaa7';
  ctx.lineWidth = 3;
  for (const b of st.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.px, b.py);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Particles.
  for (const p of st.particles) {
    ctx.globalAlpha = Math.max(0, p.t * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  // Player.
  const pl = st.player;
  if (!pl.inCar) {
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(pl.x, pl.y, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e8449';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pl.x, pl.y);
    ctx.lineTo(pl.x + Math.cos(pl.angle) * 22, pl.y + Math.sin(pl.angle) * 22);
    ctx.stroke();
    // Pistol.
    ctx.strokeStyle = '#2d3436';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pl.x + Math.cos(pl.angle) * 14, pl.y + Math.sin(pl.angle) * 14);
    ctx.lineTo(pl.x + Math.cos(pl.angle) * 26, pl.y + Math.sin(pl.angle) * 26);
    ctx.stroke();
  }
  ctx.restore();
}

const GUNMAN_R = 15;

function drawSite(site, color, label) {
  ctx.fillStyle = color;
  ctx.fillRect(site.x - 34, site.y - 22, 68, 44);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, site.x, site.y + 4);
  ctx.textAlign = 'left';
}

function drawCar(car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = car.cop ? '#1a1a2e' : car.color;
  ctx.fillRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width);
  ctx.fillStyle = car.cop ? '#fff' : 'rgba(0,0,0,0.35)';
  ctx.fillRect(-8, -CAR.width / 2 + 3, 16, CAR.width - 6);
  if (car.cop) {
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-CAR.length / 2 + 4, -CAR.width / 2, 8, 6);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(-CAR.length / 2 + 4, CAR.width / 2 - 6, 8, 6);
  }
  ctx.fillStyle = '#ffeaa7';
  ctx.fillRect(CAR.length / 2 - 4, -CAR.width / 2 + 4, 3, 5);
  ctx.fillRect(CAR.length / 2 - 4, CAR.width / 2 - 9, 3, 5);
  if (car.id === 'comet') {
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('COMET GT', 0, -CAR.width / 2 - 6);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

// Debug / automation hook (read-only from the outside).
window.__solmar = {
  version: 'r6',
  get state() {
    return st;
  },
  canvas,
  newGame: startNewGame,
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    update(dt);
  } catch (e) {
    console.error('update error', e);
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
