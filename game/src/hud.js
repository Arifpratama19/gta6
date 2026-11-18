// HUD and minimap: money, health, wanted stars, objective, banner, and a
// live minimap of the city with the player, cars, cops and mission marker.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, BEACH_X, WATER_X, MISSIONS } from './config.js';
import { currentTarget } from './missions.js';

export function drawHUD(ctx, st, canvas) {
  const W = canvas.width;
  const H = canvas.height;
  // Money + health, top left.
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, 12, 230, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('$' + st.money, 26, 42);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(26, 52, 140, 12);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(26, 52, 140 * Math.max(0, st.hp / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.fillText('HP ' + Math.ceil(st.hp), 172, 62);
  // Wanted stars, top right.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, W - 190, 12, 178, 40, 10);
  ctx.fill();
  ctx.font = 'bold 22px monospace';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < st.wanted ? '#f1c40f' : '#555';
    ctx.fillText('★', W - 176 + i * 32, 40);
  }
  // Objective, top centre (bar sized to fit the text).
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const obj = st.objective || '';
  ctx.font = '13px monospace';
  const ow = Math.min(1120, ctx.measureText(obj).width + 24);
  roundRect(ctx, (W - ow) / 2, 12, ow, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffeaa7';
  ctx.textAlign = 'center';
  ctx.fillText(obj, W / 2, 31);
  ctx.textAlign = 'left';
  // Mission label.
  const m = MISSIONS[st.missionIndex];
  if (m && st.mode === 'playing') {
    ctx.fillStyle = '#dfe6e9';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('MISSION ' + (st.missionIndex + 1) + '/5 — ' + m.name, 26, 96);
  }
  // Banner.
  if (st.banner && st.banner.t > 0) {
    const a = Math.min(1, st.banner.t);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, W / 2 - 260, H / 2 - 90, 520, 76, 12);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(st.banner.text, W / 2, H / 2 - 58);
    ctx.fillStyle = '#fff';
    ctx.font = '15px monospace';
    ctx.fillText(st.banner.sub, W / 2, H / 2 - 32);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
  // Damage flash.
  if (st.flash > 0) {
    ctx.fillStyle = 'rgba(231,76,60,' + Math.min(0.35, st.flash) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  // (Controls are listed on the title and pause screens, so the HUD keeps
  // the bottom edge clear for the page credit line.)
  ctx.restore();
}

export function drawMinimap(ctx, st, canvas) {
  const mw = 200;
  const mh = 150;
  const mx = canvas.width - mw - 12;
  const my = canvas.height - mh - 12;
  const sx = mw / WORLD.w;
  const sy = mh / WORLD.h;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8);
  ctx.fill();
  // Ground.
  ctx.fillStyle = '#2d6a4f';
  ctx.fillRect(mx, my, mw, mh);
  // Ocean.
  ctx.fillStyle = '#1e6fa8';
  ctx.fillRect(mx + WATER_X * sx, my, (WORLD.w - WATER_X) * sx, mh);
  // Beach.
  ctx.fillStyle = '#e9d8a6';
  ctx.fillRect(mx + BEACH_X * sx, my, (WATER_X - BEACH_X) * sx, mh);
  // Roads.
  ctx.fillStyle = '#5a5a5a';
  for (const rx of ROADS_X) ctx.fillRect(mx + (rx - ROAD_W / 2) * sx, my, ROAD_W * sx, mh);
  for (const ry of ROADS_Y) ctx.fillRect(mx, my + (ry - ROAD_W / 2) * sy, mw, ROAD_W * sy);
  // Mission marker.
  const t = currentTarget(st);
  if (t) {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(mx + t.x * sx, my + t.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Cops (red), cars (white dots), gunmen (orange).
  ctx.fillStyle = '#e74c3c';
  for (const c of st.cops) {
    ctx.fillRect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#f39c12';
  for (const g of st.gunmen) {
    ctx.fillRect(mx + g.x * sx - 2, my + g.y * sy - 2, 4, 4);
  }
  // Player (green, with heading tick).
  ctx.fillStyle = '#2ecc71';
  ctx.beginPath();
  ctx.arc(mx + st.player.x * sx, my + st.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(mx + st.player.x * sx, my + st.player.y * sy);
  ctx.lineTo(
    mx + (st.player.x + Math.cos(st.player.angle) * 40) * sx,
    my + (st.player.y + Math.sin(st.player.angle) * 40) * sy,
  );
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
