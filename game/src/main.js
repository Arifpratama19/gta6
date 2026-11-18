// main.js — SOLMAR BAY game loop, state, rendering, camera, events, respawn.
import { WORLD, PALETTE, PLAYER, CAR, MISSIONS } from "./config.js";
import { clamp, dist, mulberry32, rand, pick, circleOBB } from "./util.js";
import { ensureAudio, setEngine, setMuted, isMuted, sfxClick, sfxCrash, sfxPickup } from "./audio.js";
import { keys, mouse, initInput, consumeMute, consumePause, consumeClick } from "./input.js";
import { generateCity, LANDMARKS, collideCircle, randomRoadPoint, onRoad } from "./city.js";
import { createPlayer, updatePlayer, drawPlayer } from "./player.js";
import { createCar, updateVehicles, drawCar } from "./vehicles.js";
import { spawnPeds, updatePeds, drawPeds } from "./people.js";
import { addWanted, updatePolice } from "./police.js";
import { updateCombat, drawCombat } from "./combat.js";
import { createMissionState, startMission, updateMissions } from "./missions.js";
import { drawHUD, setMenu, setMenuText } from "./hud.js";
import { saveGame, loadGame, hasSave, clearSave } from "./save.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const state = {
  mode: "menu", // menu | play | pause | dead | busted
  city: null,
  cityWorld: WORLD,
  player: null,
  cars: [],
  peds: [],
  enemies: [],
  bullets: [],
  particles: [],
  mission: createMissionState(),
  wanted: 0,
  wantedTimer: 0,
  events: [],
  busted: 0,
  cam: { x: 0, y: 0, w: 1280, h: 720 },
  time: 0,
  _shootT: 0, _regenT: 0, _sirenT: 0,
};

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  state.cam.w = canvas.width;
  state.cam.h = canvas.height;
}
window.addEventListener("resize", resize);
resize();

function spawnParticles(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.3 + Math.random() * 0.7) * (speed || 160);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.5, maxLife: 0.9,
      color: color || "#ff9a3c",
      size: 2 + Math.random() * 4,
    });
  }
}

function newGame() {
  const rng = mulberry32(1337);
  state.city = generateCity(1337);
  state.player = createPlayer(1000, 1000);
  state.cars = [];
  state.peds = [];
  state.enemies = [];
  state.bullets = [];
  state.particles = [];
  state.wanted = 0;
  state.wantedTimer = 0;
  state.busted = 0;
  state.events = [];
  state.mission = createMissionState();
  // traffic + parked cars
  for (let i = 0; i < 10; i++) {
    const pt = randomRoadPoint(state.city, rng);
    const c = createCar(pt.x, pt.y, rng() * Math.PI * 2, { driver: "traffic", cruise: 130 + rng() * 70, rng });
    state.cars.push(c);
  }
  for (let i = 0; i < 7; i++) {
    const pt = randomRoadPoint(state.city, rng);
    const c = createCar(pt.x + rand(rng, -30, 30), pt.y + rand(rng, -30, 30), (rng() < 0.5 ? 0 : Math.PI / 2) + rand(rng, -0.1, 0.1), { parked: true, rng });
    state.cars.push(c);
  }
  // a starter car right next to the player, parked ON the road facing north
  // (x=960 is a road centreline, so driving forward stays on asphalt)
  const starter = createCar(960, 1030, -Math.PI / 2, { color: "#2a6fd4", parked: true });
  state.cars.push(starter);
  spawnPeds(state, 26, rng);
  startMission(state, 0);
  state.mode = "play";
  setMenu("menu-start", false);
  setMenu("menu-pause", false);
  setMenu("menu-dead", false);
  setMenu("menu-help", false);
  ensureAudio();
}

function continueGame() {
  const d = loadGame();
  newGame();
  if (!d) return;
  state.player.money = d.money;
  state.player.health = d.health;
  state.player.x = d.x;
  state.player.y = d.y;
  startMission(state, Math.min(d.missionIndex, MISSIONS.length - 1));
}

function respawn(reason) {
  const p = state.player;
  p.health = PLAYER.health;
  p.dead = false;
  p.onFoot = true;
  p.car = null;
  p.x = LANDMARKS.hospital.x;
  p.y = LANDMARKS.hospital.y;
  p.money = Math.max(0, p.money - 200);
  state.wanted = 0;
  state.wantedTimer = 0;
  state.busted = 0;
  state.enemies = [];
  state.bullets = [];
  // clear the cops, restart the current mission
  state.cars = state.cars.filter(c => !c.isCop);
  startMission(state, Math.min(state.mission.index, MISSIONS.length - 1));
  state.mode = "play";
  setMenu("menu-dead", false);
  saveGame(state);
}

function processEvents() {
  for (const e of state.events) {
    if (e.type === "stolen") {
      addWanted(state, 1, e.x, e.y);
    } else if (e.type === "pedDown") {
      addWanted(state, 1, e.x, e.y);
    } else if (e.type === "explode") {
      spawnParticles(e.x, e.y, 26, "#ff7a2a", 260);
      spawnParticles(e.x, e.y, 14, "#555", 120);
      sfxCrash();
    } else if (e.type === "crash") {
      spawnParticles(e.x, e.y, 6, "#ccc", 90);
    } else if (e.type === "shot") {
      spawnParticles(e.x, e.y, 2, "#ffd94a", 60);
    } else if (e.type === "missionDone" || e.type === "storyDone") {
      saveGame(state);
    } else if (e.type === "playerDead") {
      state.mode = "dead";
      setMenuText("dead-title", "WASTED");
      setMenuText("dead-sub", "Rico went down. The hospital patched him up — minus $200.");
      setMenu("menu-dead", true);
    } else if (e.type === "busted") {
      state.mode = "busted";
      setMenuText("dead-title", "BUSTED");
      setMenuText("dead-sub", "The cops took Rico in. He posted bail — minus $200.");
      setMenu("menu-dead", true);
    }
  }
  state.events = [];
}

// the player's car running over a pedestrian is a crime
function carVsPeds() {
  const p = state.player;
  if (p.onFoot || !p.car || p.car.destroyed) return;
  const c = p.car;
  if (c.speed < 60) return;
  for (const ped of state.peds) {
    if (ped.state === "down") continue;
    if (circleOBB(ped.x, ped.y, 10, c.x, c.y, c.angle, 23, 11)) {
      ped.state = "down";
      ped.downTimer = 6;
      state.events.push({ type: "pedDown", x: ped.x, y: ped.y });
      sfxCrash();
    }
  }
}

function update(dt) {
  state.time += dt;
  if (consumeMute()) setMuted(!isMuted());
  if (consumePause()) {
    if (state.mode === "play") { state.mode = "pause"; setMenu("menu-pause", true); }
    else if (state.mode === "pause") { state.mode = "play"; setMenu("menu-pause", false); }
  }
  if (state.mode !== "play") return;
  // mouse in world coords (for aiming)
  mouse.wx = mouse.x + state.cam.x;
  mouse.wy = mouse.y + state.cam.y;
  updatePlayer(state, dt);
  updateVehicles(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateCombat(state, dt);
  updateMissions(state, dt);
  carVsPeds();
  // particles
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.94; pt.vy *= 0.94;
    pt.life -= dt;
  }
  state.particles = state.particles.filter(pt => pt.life > 0);
  // engine sound follows the car
  const driving = !state.player.onFoot && state.player.car;
  setEngine(driving ? Math.min(1, state.player.car.speed / CAR.maxSpeed) : 0, !!driving);
  processEvents();
  // camera follows the player (or their car)
  const focus = state.player;
  const tx = focus.x - state.cam.w / 2;
  const ty = focus.y - state.cam.h / 2;
  state.cam.x = clamp(tx, 0, Math.max(0, WORLD.w - state.cam.w));
  state.cam.y = clamp(ty, 0, Math.max(0, WORLD.h - state.cam.h));
}

function drawBuilding(ctx, b, cam) {
  const sx = b.x - cam.x, sy = b.y - cam.y;
  if (sx + b.w < -80 || sx > cam.w + 80 || sy + b.h < -80 || sy > cam.h + 80) return;
  // drop shadow (fake height)
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(sx + b.height * 0.35, sy + b.height * 0.35, b.w, b.h);
  // wall face
  ctx.fillStyle = b.wall;
  ctx.fillRect(sx + b.height * 0.22, sy + b.height * 0.22, b.w, b.h);
  // roof
  ctx.fillStyle = b.roof;
  ctx.fillRect(sx, sy, b.w, b.h);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, sy, b.w, b.h);
  // roof details: AC unit + skylights
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(sx + 8, sy + 8, 14, 10);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  const cols = Math.max(1, Math.floor(b.w / 34)), rows = Math.max(1, Math.floor(b.h / 34));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    ctx.fillRect(sx + 10 + i * 34, sy + 26 + j * 34, 16, 12);
  }
}

function render() {
  const cam = state.cam;
  const vw = cam.w, vh = cam.h;
  ctx.clearRect(0, 0, vw, vh);
  if (!state.city) {
    // menu backdrop: paint the ocean + a hint of the coast
    ctx.fillStyle = PALETTE.oceanDeep;
    ctx.fillRect(0, 0, vw, vh);
    return;
  }
  // --- ground ---
  ctx.fillStyle = PALETTE.oceanDeep;
  ctx.fillRect(0, 0, vw, vh);
  // land
  ctx.fillStyle = "#6f9a4e";
  ctx.fillRect(-cam.x, -cam.y, WORLD.waterX, WORLD.h);
  // beach
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(WORLD.beachX - cam.x, -cam.y, WORLD.waterX - WORLD.beachX, WORLD.h);
  ctx.fillStyle = PALETTE.sandWet;
  ctx.fillRect(WORLD.waterX - 26 - cam.x, -cam.y, 26, WORLD.h);
  // ocean waves (animated)
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const wy = ((state.time * 22 + i * 330) % (WORLD.h + 120)) - 60;
    ctx.beginPath();
    ctx.moveTo(WORLD.waterX + 8 - cam.x, wy - cam.y);
    ctx.quadraticCurveTo(WORLD.waterX + 40 - cam.x, wy + 12 - cam.y, WORLD.waterX + 8 - cam.x, wy + 24 - cam.y);
    ctx.stroke();
  }
  // roads
  ctx.fillStyle = PALETTE.road;
  for (const rx of state.city.vRoads) ctx.fillRect(rx - WORLD.roadW / 2 - cam.x, -cam.y, WORLD.roadW, WORLD.h);
  for (const ry of state.city.hRoads) ctx.fillRect(-cam.x, ry - WORLD.roadW / 2 - cam.y, WORLD.beachX, WORLD.roadW);
  // sidewalks
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of state.city.vRoads) {
    ctx.fillRect(rx - WORLD.roadW / 2 - WORLD.sidewalkW - cam.x, -cam.y, WORLD.sidewalkW, WORLD.h);
    ctx.fillRect(rx + WORLD.roadW / 2 - cam.x, -cam.y, WORLD.sidewalkW, WORLD.h);
  }
  for (const ry of state.city.hRoads) {
    ctx.fillRect(-cam.x, ry - WORLD.roadW / 2 - WORLD.sidewalkW - cam.y, WORLD.beachX, WORLD.sidewalkW);
    ctx.fillRect(-cam.x, ry + WORLD.roadW / 2 - cam.y, WORLD.beachX, WORLD.sidewalkW);
  }
  // lane dashes
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (const rx of state.city.vRoads) {
    ctx.beginPath(); ctx.moveTo(rx - cam.x, -cam.y); ctx.lineTo(rx - cam.x, WORLD.h - cam.y); ctx.stroke();
  }
  for (const ry of state.city.hRoads) {
    ctx.beginPath(); ctx.moveTo(-cam.x, ry - cam.y); ctx.lineTo(WORLD.beachX - cam.x, ry - cam.y); ctx.stroke();
  }
  ctx.setLineDash([]);
  // buildings
  for (const b of state.city.buildings) drawBuilding(ctx, b, cam);
  // mission marker (pulsing)
  const m = state.mission;
  if (m.target && state.mode === "play") {
    const pulse = 1 + Math.sin(state.time * 5) * 0.18;
    const mx = m.target.x - cam.x, my = m.target.y - cam.y;
    ctx.save();
    ctx.strokeStyle = "#ffd94a";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mx, my, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ffd94a";
    ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#222";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("◆", mx, my + 4);
    ctx.restore();
  }
  // cars (sorted so nearer ones draw later — simple y sort)
  const cars = [...state.cars].sort((a, b) => a.y - b.y);
  for (const c of cars) {
    if (c.x - cam.x < -60 || c.x - cam.x > vw + 60 || c.y - cam.y < -60 || c.y - cam.y > vh + 60) continue;
    drawCar(ctx, c, cam, state.time);
  }
  drawPeds(ctx, state, cam);
  drawCombat(ctx, state, cam);
  drawPlayer(ctx, state.player, cam);
  // particles
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // HUD
  if (state.mode === "play" || state.mode === "pause") drawHUD(ctx, state, cam);
  // vignette
  const grad = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
}

// --- wiring: menu buttons ---
function bind(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", () => { sfxClick(); ensureAudio(); fn(); });
}
bind("btn-new", () => { clearSave(); newGame(); });
bind("btn-continue", () => { continueGame(); });
bind("btn-help", () => { setMenu("menu-help", true); });
bind("btn-help-close", () => { setMenu("menu-help", false); });
bind("btn-resume", () => { state.mode = "play"; setMenu("menu-pause", false); });
bind("btn-restart", () => { newGame(); });
bind("btn-quit", () => { saveGame(state); state.mode = "menu"; setMenu("menu-pause", false); setMenu("menu-start", true); refreshMenu(); });
bind("btn-respawn", () => { respawn(); });
bind("btn-menu-new", () => { clearSave(); newGame(); });

function refreshMenu() {
  const has = hasSave();
  const cont = document.getElementById("btn-continue");
  if (cont) cont.style.display = has ? "block" : "none";
  const note = document.getElementById("save-note");
  if (note) {
    const d = loadGame();
    note.textContent = d ? ("Save found: mission " + (d.missionIndex + 1) + " of 5, $" + d.money.toLocaleString() + ".") : "";
  }
}

// --- boot ---
initInput(canvas);
refreshMenu();
setMenu("menu-start", true);
let last = performance.now();
function loop(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// expose a tiny debug handle for headless verification
window.__solmar = { state, newGame, continueGame };
