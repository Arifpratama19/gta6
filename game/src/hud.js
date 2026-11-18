// SOLMAR BAY — the HUD: wanted stars, cash, health, speed, clock and the minimap.
// One job: turn game state into DOM and the round minimap canvas.

import { WORLD, districtAt } from './config.js';

export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      wanted: document.getElementById('wanted'),
      cash: document.getElementById('cash'),
      missionTitle: document.getElementById('mission-title'),
      missionText: document.getElementById('mission-text'),
      missionTimer: document.getElementById('mission-timer'),
      clock: document.getElementById('clock'),
      district: document.getElementById('district'),
      minimap: document.getElementById('minimap'),
      healthFill: document.getElementById('health-fill'),
      speedo: document.getElementById('speedo'),
      vehicleName: document.getElementById('vehicle-name'),
      toast: document.getElementById('toast'),
      hint: document.getElementById('hint'),
      crosshair: document.getElementById('crosshair'),
      damageFlash: document.getElementById('damage-flash'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = null;
    this.clockMinutes = 18 * 60 + 42;
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  toast(text, ms = 2600) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), ms);
  }

  flashDamage() {
    this.el.damageFlash.style.opacity = '1';
    setTimeout(() => { this.el.damageFlash.style.opacity = '0'; }, 140);
  }

  setCrosshair(on) { this.el.crosshair.style.display = on ? 'block' : 'none'; }

  update(state, dt) {
    // Wanted stars: filled gold, empty dim.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.stars ? '★' : '<span class="dim">★</span>';
    this.el.wanted.innerHTML = stars;
    this.el.cash.innerHTML = `$${state.cash.toLocaleString('en-US')} <small>SOLMAR BANK</small>`;
    this.el.missionTitle.textContent = state.missionTitle;
    this.el.missionText.textContent = state.missionText;
    this.el.missionTimer.textContent = state.missionTimer != null
      ? `⏱ ${Math.ceil(state.missionTimer)}s left` : '';
    this.clockMinutes = (this.clockMinutes + dt * 0.9) % (24 * 60);
    const hh = String(Math.floor(this.clockMinutes / 60)).padStart(2, '0');
    const mm = String(Math.floor(this.clockMinutes % 60)).padStart(2, '0');
    this.el.clock.textContent = `${hh}:${mm}`;
    this.el.district.textContent = districtAt(state.playerX, state.playerZ);
    const hp = Math.max(0, state.health);
    this.el.healthFill.style.width = `${hp}%`;
    this.el.healthFill.classList.toggle('low', hp < 35);
    const mph = Math.round(Math.abs(state.speed) * 2.237);
    this.el.speedo.innerHTML = state.inCar ? `${mph} <small>MPH</small>` : '—';
    this.el.vehicleName.textContent = state.vehicleName;
    this.el.hint.textContent = state.inCar
      ? 'WASD drive · Space handbrake · E exit car · Click shoot · M missions · P pause'
      : 'WASD move · Shift sprint · E enter car · Mouse aim · Click shoot · M missions · P pause';
    this.drawMinimap(state);
  }

  // Top-down map: sea, sand, roads, buildings, objective, cars, player arrow.
  drawMinimap(s) {
    const ctx = this.mapCtx;
    const S = 208;
    const half = WORLD.half + WORLD.beachDepth + 10;
    const toMap = (x, z) => [S / 2 + (x / half) * (S / 2 - 6), S / 2 + (z / half) * (S / 2 - 6)];
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.clip();
    // Sea and sand at the bottom.
    ctx.fillStyle = '#0e6f8e';
    ctx.fillRect(0, 0, S, S);
    const [bx0, by0] = toMap(-WORLD.half - 10, WORLD.half);
    const [bx1, by1] = toMap(WORLD.half + 10, WORLD.half + WORLD.beachDepth);
    ctx.fillStyle = '#e8c98f';
    ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    // City ground.
    const [gx0, gy0] = toMap(-WORLD.half, -WORLD.half);
    const [gx1, gy1] = toMap(WORLD.half, WORLD.half);
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    // Roads.
    ctx.strokeStyle = '#55555f';
    ctx.lineWidth = 5;
    const pitch = WORLD.block + WORLD.road;
    for (let i = 0; i <= WORLD.blocks; i++) {
      const c = -WORLD.half + WORLD.road / 2 + i * pitch;
      const [ax, ay] = toMap(c, -WORLD.half);
      const [bx, by] = toMap(c, WORLD.half);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const [cx, cy] = toMap(-WORLD.half, c);
      const [dx, dy] = toMap(WORLD.half, c);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke();
    }
    // Buildings as warm blocks.
    ctx.fillStyle = '#c9a06a';
    for (const b of s.buildings) {
      const [x, y] = toMap(b.x - b.halfW, b.z - b.halfD);
      const [x2, y2] = toMap(b.x + b.halfW, b.z + b.halfD);
      ctx.fillRect(x, y, Math.max(1.5, x2 - x), Math.max(1.5, y2 - y));
    }
    // Objective marker.
    if (s.objective) {
      const [ox, oy] = toMap(s.objective[0], s.objective[1]);
      ctx.fillStyle = '#ffc300';
      ctx.beginPath(); ctx.arc(ox, oy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ox, oy, 9, 0, Math.PI * 2); ctx.stroke();
    }
    // Traffic dots, police as blue/red flashes.
    ctx.fillStyle = '#fff';
    for (const c of s.traffic) { const [x, y] = toMap(c.x, c.z); ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
    for (const c of s.police) {
      const [x, y] = toMap(c.x, c.z);
      ctx.fillStyle = (Math.floor(performance.now() / 300) % 2 === 0) ? '#ff3030' : '#3050ff';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow, rotated to heading.
    const [px, py] = toMap(s.playerX, s.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(s.playerHeading);
    ctx.fillStyle = '#ffe66d';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S / 2 - 4, 13);
    ctx.restore();
  }
}
