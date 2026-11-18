// SOLMAR BAY — the HUD: cash, stars, health, speed, the mission objective,
// the message feed, and the circular minimap drawn on a 2D canvas from the
// same city data the 3D world uses.

import { WORLD, PITCH, roadLines, districtAt } from './config.js';
import { clamp } from './util.js';

export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      cash: document.getElementById('cash-value'),
      stars: document.getElementById('stars'),
      clock: document.getElementById('clock'),
      district: document.getElementById('district'),
      healthFill: document.getElementById('health-fill'),
      armorFill: document.getElementById('armor-fill'),
      speed: document.getElementById('speed'),
      carName: document.getElementById('car-name'),
      weapon: document.getElementById('weapon'),
      missionTitle: document.getElementById('mission-title'),
      missionText: document.getElementById('mission-text'),
      missionSub: document.getElementById('mission-sub'),
      feed: document.getElementById('feed'),
      banner: document.getElementById('banner'),
      bannerTitle: document.getElementById('banner-title'),
      bannerSub: document.getElementById('banner-sub'),
      hint: document.getElementById('hint'),
      crosshair: document.getElementById('crosshair'),
      damage: document.getElementById('damage'),
      flash: document.getElementById('wanted-flash'),
    };
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.bannerTimer = 0;
    this.feedLines = [];
    this.gameMinutes = 12 * 60; // the clock starts at noon
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  setCash(v) { this.el.cash.textContent = v.toLocaleString('en-US'); }

  setStars(n) {
    const el = this.el.stars;
    let html = '';
    for (let i = 0; i < 5; i++) html += `<span class="${i < n ? 'lit' : ''}">★</span>`;
    el.innerHTML = html;
    el.classList.toggle('hot', n >= 3);
  }

  setHealth(h, armor) {
    this.el.healthFill.style.width = `${clamp(h, 0, 100)}%`;
    this.el.healthFill.classList.toggle('low', h < 30);
    this.el.armorFill.style.width = `${clamp(armor, 0, 100)}%`;
  }

  setSpeed(mph, carName) {
    this.el.speed.innerHTML = `${Math.round(mph)} <small>MPH</small>`;
    this.el.carName.textContent = carName || '';
  }

  setObjective(o) {
    this.el.missionTitle.textContent = o.title;
    this.el.missionText.textContent = o.text;
    this.el.missionSub.textContent = o.sub || '';
  }

  setCrosshair(on) { this.el.crosshair.classList.toggle('hidden', !on); }

  setHint(text) { this.el.hint.textContent = text; }

  setDamage(amount) {
    this.el.damage.style.opacity = clamp(amount, 0, 1).toFixed(2);
  }

  setSirenFlash(on, phase) {
    this.el.flash.style.opacity = on ? (0.25 + 0.2 * Math.sin(phase * 6)) : 0;
  }

  showBanner(title, sub, seconds = 3) {
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub || '';
    this.el.banner.classList.add('show');
    this.bannerTimer = seconds;
  }

  feed(text, kind = '') {
    const line = document.createElement('div');
    line.className = `feed-line ${kind}`;
    line.textContent = text;
    this.el.feed.appendChild(line);
    this.feedLines.push(line);
    while (this.feedLines.length > 4) {
      const old = this.feedLines.shift();
      old.remove();
    }
    setTimeout(() => { line.style.opacity = '0'; line.style.transition = 'opacity .6s'; }, 4200);
    setTimeout(() => { line.remove(); }, 4900);
  }

  update(dt, playerPos) {
    // In-game clock: one game hour per two real minutes.
    this.gameMinutes = (this.gameMinutes + dt * 0.5) % (24 * 60);
    const hh = Math.floor(this.gameMinutes / 60);
    const mm = Math.floor(this.gameMinutes % 60);
    const icon = hh >= 6 && hh < 18 ? '☀' : '☾';
    this.el.clock.childNodes[0].textContent = `${icon} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  •  `;
    this.el.district.textContent = districtAt(playerPos.x, playerPos.z);
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.classList.remove('show');
    }
  }

  // ---- the minimap ---------------------------------------------------------
  // North-up, 220px across, showing roads, the beach, the player arrow, the
  // mission marker, police cruisers and traffic.
  drawMinimap(state) {
    const ctx = this.mapCtx;
    const S = 220;
    const scale = S / (WORLD.cityHalf * 2 + 60);
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    ctx.clearRect(0, 0, S, S);

    // Water and sand at the south edge.
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(0, S / 2 + WORLD.beachZ * scale, S, S);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, S / 2 + (WORLD.beachZ - 30) * scale, S, 30 * scale + 4);
    // City ground.
    ctx.fillStyle = '#2c3d5c';
    ctx.fillRect(0, 0, S, S / 2 + WORLD.beachZ * scale);
    // Blocks.
    ctx.fillStyle = '#4a5f86';
    const half = (9 * PITCH) / 2;
    for (let bx = 0; bx < 9; bx++) {
      for (let bz = 0; bz < 9; bz++) {
        const [x, z] = toMap(-half + bx * PITCH + 6, -half + bz * PITCH + 6);
        ctx.fillRect(x, z, 42 * scale, 42 * scale);
      }
    }
    // Roads.
    ctx.strokeStyle = '#8a94a6';
    ctx.lineWidth = 2;
    for (const c of roadLines()) {
      const [x1] = toMap(c, -half);
      const [x2] = toMap(c, half);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
      const [, z1] = toMap(-half, c);
      ctx.beginPath(); ctx.moveTo(0, z1); ctx.lineTo(S, z1); ctx.stroke();
    }
    // Park and pier.
    ctx.fillStyle = '#5da24f';
    const [px, pz] = toMap(0, 0);
    ctx.fillRect(px - 20 * scale, pz - 20 * scale, 40 * scale, 40 * scale);
    ctx.strokeStyle = '#8a6d3b'; ctx.lineWidth = 3;
    ctx.beginPath();
    const [ax, az] = toMap(14, WORLD.beachZ);
    const [bx2, bz2] = toMap(14, WORLD.beachZ + 62);
    ctx.moveTo(ax, az); ctx.lineTo(bx2, bz2); ctx.stroke();

    // Mission marker.
    if (state.marker) {
      const [mx, mz] = toMap(state.marker.pos.x, state.marker.pos.z);
      const pulse = 6 + Math.sin(performance.now() / 200) * 2;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(mx, mz, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, mz, pulse + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // Traffic (grey dots) and police (flashing blue/red).
    ctx.fillStyle = '#cbd5e1';
    for (const car of state.traffic) {
      const [cx, cz] = toMap(car.pos.x, car.pos.z);
      ctx.fillRect(cx - 1.5, cz - 1.5, 3, 3);
    }
    const flashOn = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = flashOn ? '#3b82f6' : '#ef4444';
    for (const car of state.policeCars) {
      const [cx, cz] = toMap(car.pos.x, car.pos.z);
      ctx.beginPath(); ctx.arc(cx, cz, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // The player: a white arrow that turns with the heading.
    const [ux, uz] = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(ux, uz);
    ctx.rotate(-state.player.heading + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
