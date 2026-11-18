// HUD: cash, health, wanted stars, mission objective, speed, the message
// feed, the live minimap, and the start / pause / game-over screens.

import { CONFIG, CONTROLS, STORY } from './config.js';
import { clockString, money } from './util.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = (id) => document.getElementById(id);
    this.mapCtx = this.el('minimap').getContext('2d');
    this.messages = [];
    this.bannerTimer = 0;
    this.wantedFlash = 0;
    this.buildMenu();
  }

  buildMenu() {
    const controlsHtml = CONTROLS.map(([k, v]) => `<div class="ctl"><b>${k}</b><span>${v}</span></div>`).join('');
    this.el('menu-body').innerHTML = `
      <p class="tagline">${STORY.intro}</p>
      <div class="controls">${controlsHtml}</div>
      <p class="hint">Steal cars, run missions for Mara Solis, dodge the Solmar Bay PD — and don't let the Coral Kings catch you slipping.</p>`;
  }

  show(screen) {
    for (const id of ['menu', 'pause', 'over']) {
      this.el(id).classList.toggle('hidden', id !== screen);
    }
    this.el('hud').classList.toggle('hidden', screen === 'menu');
    this.el('crosshair').classList.toggle('hidden', screen !== 'playing' || !!this.game.player.driving);
  }

  showBanner(title, sub) {
    this.el('banner-title').textContent = title;
    this.el('banner-sub').textContent = sub || '';
    this.el('banner').classList.remove('hidden');
    this.bannerTimer = 3.2;
  }

  hideBanner() {
    this.el('banner').classList.add('hidden');
  }

  message(text) {
    this.messages.push({ text, t: 0 });
    if (this.messages.length > 4) this.messages.shift();
    const feed = this.el('feed');
    feed.innerHTML = this.messages.map((m) => `<div class="msg">${m.text}</div>`).join('');
  }

  flashWanted() {
    this.wantedFlash = 1;
  }

  update(dt) {
    const g = this.game;
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.hideBanner();
    }
    if (this.wantedFlash > 0) this.wantedFlash -= dt;
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter((m) => m.t < 9);
    if (g.state !== 'playing') return;

    this.el('cash').textContent = money(g.cash);
    this.el('health-fill').style.width = Math.max(0, g.health) + '%';
    this.el('health-fill').style.background = g.health > 50 ? '#22c55e' : g.health > 25 ? '#f59e0b' : '#ef4444';
    this.el('armor-fill').style.width = Math.max(0, g.armor) + '%';
    const stars = '★'.repeat(g.police.wanted) + '☆'.repeat(5 - g.police.wanted);
    const wantedEl = this.el('wanted');
    wantedEl.textContent = stars;
    wantedEl.style.color = this.wantedFlash > 0 && Math.sin(g.time * 16) > 0 ? '#ffffff' : '#ffd60a';
    this.el('objective').textContent = g.missions.objectiveText();
    this.el('district').textContent = g.city.districtAt(g.player.x, g.player.z);
    this.el('clock').textContent = clockString(g.dayHours);
    const speed = g.player.driving ? Math.abs(g.player.driving.speed) * 3.6 : 0;
    this.el('speed').textContent = g.player.driving ? Math.round(speed) + ' km/h' : '';
    this.el('mission-count').textContent = `Jobs done: ${g.missions.completed} / 5`;
    this.el('crosshair').classList.toggle('hidden', !!g.player.driving || !!g.noCrosshair);
    this.drawMinimap();
  }

  drawMinimap() {
    const g = this.game;
    const ctx = this.mapCtx;
    const S = 190;
    const scale = S / 920;
    const toMap = (x, z) => [(x + 460) * scale, (z + 460) * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(8, 20, 32, 0.88)';
    ctx.fillRect(0, 0, S, S);
    // Ocean + beach.
    ctx.fillStyle = '#1b7fa8';
    ctx.fillRect((380 + 460) * scale, 0, S - (380 + 460) * scale, S);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect((380 + 460) * scale - 6, 0, 6, S);
    // Roads.
    ctx.strokeStyle = '#5b6470';
    ctx.lineWidth = 3;
    for (const z of g.city.roadsH) {
      const [x1, y1] = toMap(-460, z);
      const [x2, y2] = toMap(460, z);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    for (const x of g.city.roadsV) {
      const [x1, y1] = toMap(x, -460);
      const [x2, y2] = toMap(x, 460);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    // Mission marker.
    const step = g.missions.currentStep();
    if (step && step.x !== undefined && !g.missions.done) {
      const [mx, my] = toMap(step.x, step.z);
      const pulse = 5 + Math.sin(g.time * 5) * 2;
      ctx.fillStyle = '#ffc300';
      ctx.beginPath();
      ctx.arc(mx, my, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Cop blips.
    ctx.fillStyle = Math.sin(g.time * 8) > 0 ? '#ff4444' : '#4488ff';
    for (const c of g.police.copCars) {
      const [cx, cy] = toMap(c.mesh.position.x, c.mesh.position.z);
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Enemy blips.
    ctx.fillStyle = '#ff2222';
    for (const e of g.combat.enemies) {
      const [ex, ey] = toMap(e.mesh.position.x, e.mesh.position.z);
      ctx.fillRect(ex - 2.5, ey - 2.5, 5, 5);
    }
    // Player arrow.
    const [px, py] = toMap(g.player.x, g.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-g.player.heading + Math.PI);
    ctx.fillStyle = g.player.driving ? '#4ade80' : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North + view cone.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', 6, 14);
  }
}
