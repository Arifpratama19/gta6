// hud.js — on-screen HUD (health, money, stars, minimap, objectives) + menus.
import { WORLD, MISSIONS } from "./config.js";
import { LANDMARKS } from "./city.js";

// --- in-game HUD, drawn on the main canvas in screen space ---
export function drawHUD(ctx, state, cam) {
  const p = state.player;
  const W = cam.w, H = cam.h;
  ctx.save();
  // top-left: health + money
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath(); ctx.roundRect(12, 12, 230, 58, 8); ctx.fill();
  ctx.fillStyle = "#e33";
  ctx.fillRect(22, 22, 210 * Math.max(0, p.health / 100), 14);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(22, 22, 210, 14);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("RICO VEGA", 22, 54);
  ctx.fillStyle = "#7dff8a";
  ctx.font = "bold 17px sans-serif";
  ctx.fillText("$" + Math.floor(p.money).toLocaleString(), 130, 54);
  // top-right: wanted stars
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath(); ctx.roundRect(W - 178, 12, 166, 40, 8); ctx.fill();
  ctx.font = "22px sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.wanted ? "#ffd94a" : "rgba(255,255,255,0.25)";
    ctx.fillText("★", W - 156 + i * 30, 40);
  }
  // bottom-centre: current objective
  const m = state.mission;
  if (m.index < MISSIONS.length && m.target) {
    const label = m.target.label + (m.index === 4 && m.phase === "go" ? "  (hold " + Math.ceil(Math.max(0, 5 - (m.data.hold || 0))) + "s)" : "");
    ctx.font = "bold 15px sans-serif";
    const w = ctx.measureText(label).width + 28;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath(); ctx.roundRect((W - w) / 2, H - 118, w, 32, 8); ctx.fill();
    ctx.fillStyle = "#ffd94a";
    ctx.textAlign = "center";
    ctx.fillText("◆ " + label, W / 2, H - 96);
    // mission title
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "13px sans-serif";
    ctx.fillText(MISSIONS[m.index].title + "  •  $" + MISSIONS[m.index].pay, W / 2, H - 128);
  } else if (m.index >= MISSIONS.length) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FREE ROAM — Solmar Bay is yours", W / 2, H - 100);
  }
  // busted meter
  if (state.busted > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath(); ctx.roundRect(W / 2 - 130, 64, 260, 30, 8); ctx.fill();
    ctx.fillStyle = "#ff3b30";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BUSTED IN " + Math.ceil(2.5 - state.busted) + "… RUN!", W / 2, 85);
  }
  // mission banner
  if (m.banner) {
    const a = Math.min(1, m.banner.t);
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    const bw = Math.min(W - 80, 560);
    ctx.beginPath(); ctx.roundRect((W - bw) / 2, 110, bw, 74, 10); ctx.fill();
    ctx.fillStyle = "#ffd94a";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(m.banner.text, W / 2, 140);
    ctx.fillStyle = "#fff";
    ctx.font = "14px sans-serif";
    ctx.fillText(m.banner.sub, W / 2, 166);
    ctx.globalAlpha = 1;
  }
  drawMinimap(ctx, state, W, H);
  ctx.restore();
}

function drawMinimap(ctx, state, W, H) {
  const size = 168;
  const mx = W - size - 14, my = H - size - 14;
  const sx = size / WORLD.w, sy = size / WORLD.h;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath(); ctx.roundRect(mx - 5, my - 5, size + 10, size + 10, 8); ctx.fill();
  // ocean + beach + land
  ctx.fillStyle = "#14639a";
  ctx.fillRect(mx, my, size, size);
  ctx.fillStyle = "#e8d39a";
  ctx.fillRect(mx + 2180 * sx, my, (2380 - 2180) * sx, size);
  ctx.fillStyle = "#5d7a45";
  ctx.fillRect(mx, my, 2180 * sx, size);
  // roads
  ctx.strokeStyle = "rgba(40,40,50,0.9)";
  ctx.lineWidth = 2;
  for (const rx of state.city.vRoads) {
    ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + size); ctx.stroke();
  }
  for (const ry of state.city.hRoads) {
    ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + size, my + ry * sy); ctx.stroke();
  }
  // mission marker
  const m = state.mission;
  if (m.target) {
    const tx = mx + m.target.x * sx, ty = my + m.target.y * sy;
    ctx.fillStyle = "#ffd94a";
    ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // police dots
  ctx.fillStyle = "#4a7dff";
  for (const c of state.cars) {
    if (!c.isCop || c.destroyed) continue;
    ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // player arrow
  const p = state.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // north label
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("N", mx + 4, my + 13);
  ctx.restore();
}

// --- DOM menus (start / pause / dead / busted / complete) ---
export function setMenu(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? "flex" : "none";
}
export function setMenuText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
