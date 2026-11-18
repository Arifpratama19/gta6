// hud.js — the HUD (health, money, wanted stars, objective), the minimap,
// toasts, and the title / pause / end screens.
import { WORLD, BEACH_X, OCEAN_X } from './config.js';
import { missionObjective, missionTarget } from './missions.js';

export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      hp: document.getElementById('hp-fill'),
      hpText: document.getElementById('hp-text'),
      money: document.getElementById('money'),
      stars: document.getElementById('stars'),
      objective: document.getElementById('objective'),
      speed: document.getElementById('speed'),
      toasts: document.getElementById('toasts'),
      title: document.getElementById('title-screen'),
      pause: document.getElementById('pause-screen'),
      end: document.getElementById('end-screen'),
      endTitle: document.getElementById('end-title'),
      endText: document.getElementById('end-text'),
      briefing: document.getElementById('briefing'),
      minimap: document.getElementById('minimap'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimers = [];
  }

  toast(msg) {
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = msg;
    this.el.toasts.appendChild(div);
    while (this.el.toasts.children.length > 4) {
      this.el.toasts.removeChild(this.el.toasts.firstChild);
    }
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 4200);
  }

  setBriefing(text) {
    this.el.briefing.textContent = text;
    this.el.briefing.classList.add('show');
    setTimeout(() => this.el.briefing.classList.remove('show'), 6000);
  }

  update(state) {
    const p = state.player;
    const hpPct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
    this.el.hp.style.width = hpPct + '%';
    this.el.hp.style.background = hpPct > 50 ? '#58d158' : hpPct > 25 ? '#e8c53d' : '#e84f3d';
    this.el.hpText.textContent = 'HP ' + hpPct;
    this.el.money.textContent = '$' + state.money.toLocaleString('en-US');
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.classList.toggle('hot', state.wanted >= 3);
    this.el.objective.textContent = '◆ ' + missionObjective(state);
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.inCar.speed) * 0.36);
      this.el.speed.textContent = kmh + ' km/h  ·  ' + p.inCar.name;
      this.el.speed.classList.add('show');
    } else {
      this.el.speed.classList.remove('show');
    }
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    const W = 208;
    const H = 156;
    const sx = W / WORLD.w;
    const sy = H / WORLD.h;
    ctx.clearRect(0, 0, W, H);
    // Land.
    ctx.fillStyle = '#5d8a48';
    ctx.fillRect(0, 0, W, H);
    // Ocean.
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(OCEAN_X * sx, 0, W - OCEAN_X * sx, H);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(BEACH_X * sx, 0, (OCEAN_X - BEACH_X) * sx, H);
    // Roads.
    ctx.strokeStyle = '#3d3a38';
    ctx.lineWidth = 3;
    for (const rx of state.city.roadsV) {
      ctx.beginPath();
      ctx.moveTo(rx * sx, 0);
      ctx.lineTo(rx * sx, H);
      ctx.stroke();
    }
    for (const ry of state.city.roadsH) {
      ctx.beginPath();
      ctx.moveTo(0, ry * sy);
      ctx.lineTo(W, ry * sy);
      ctx.stroke();
    }
    // Mission marker.
    const target = missionTarget(state);
    if (target) {
      const mx = target.x * sx;
      const my = target.y * sy;
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.moveTo(mx, my - 7);
      ctx.lineTo(mx + 6, my);
      ctx.lineTo(mx, my + 7);
      ctx.lineTo(mx - 6, my);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7a5b00';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Traffic and parked cars.
    ctx.fillStyle = '#f2f2f2';
    for (const car of state.cars) {
      if (car.wrecked) continue;
      ctx.fillRect(car.x * sx - 2, car.y * sy - 2, 4, 4);
    }
    // Cops in red.
    ctx.fillStyle = '#ff4d4d';
    for (const cop of state.cops) {
      ctx.beginPath();
      ctx.arc(cop.x * sx, cop.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player.
    const p = state.player;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x * sx, p.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Viewport frame.
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  showTitle() {
    this.el.title.classList.remove('hidden');
    this.el.pause.classList.add('hidden');
    this.el.end.classList.add('hidden');
    this.el.hud.classList.add('hidden');
  }
  hideTitle() {
    this.el.title.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
  }
  showPause() {
    this.el.pause.classList.remove('hidden');
  }
  hidePause() {
    this.el.pause.classList.add('hidden');
  }
  showEnd(title, text) {
    this.el.endTitle.textContent = title;
    this.el.endText.textContent = text;
    this.el.end.classList.remove('hidden');
  }
  hideEnd() {
    this.el.end.classList.add('hidden');
  }
  showComplete(money) {
    this.showEnd(
      'SOLMAR IS YOURS',
      `Rico finished the whole chain — every mission done. Final cash: $${money.toLocaleString('en-US')}. Press Enter to keep playing the open city.`
    );
  }
}
