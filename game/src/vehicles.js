// vehicles.js — cars: arcade driving physics, traffic AI, parking, theft, damage.
import { CAR, PALETTE } from "./config.js";
import { keys } from "./input.js";
import { collideCircle, nearestNode, randomRoadPoint, onRoad } from "./city.js";
import { clamp, dist, angleDiff, circleOBB, mulberry32, pick, rand } from "./util.js";
import { sfxCrash } from "./audio.js";

let carId = 1;

export function createCar(x, y, angle, opts) {
  const o = opts || {};
  return {
    id: carId++,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    color: o.color || pick(o.rng || Math.random, PALETTE.carColors),
    isCop: !!o.isCop,
    parked: !!o.parked,
    driver: o.driver || null, // "player" | "traffic" | "cop" | null
    health: CAR.health,
    destroyed: false,
    stolen: false,
    // traffic AI
    target: o.target || null,
    cruise: o.cruise || 150,
    stuck: 0,
  };
}

// --- player driving (arcade physics with drift) ---
function drivePlayerCar(state, c, dt) {
  const fwdX = Math.cos(c.angle), fwdY = Math.sin(c.angle);
  const rightX = -fwdY, rightY = fwdX;
  let vF = c.vx * fwdX + c.vy * fwdY;
  let vL = c.vx * rightX + c.vy * rightY;
  const throttle = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (throttle > 0) vF += CAR.accel * dt;
  else if (throttle < 0) {
    if (vF > 20) vF -= CAR.brake * dt; else vF -= CAR.reverseAccel * dt;
  } else {
    vF -= vF * 0.6 * dt; // coast drag
  }
  if (keys.brake) vF -= Math.sign(vF) * CAR.brake * 0.8 * dt;
  vF = clamp(vF, -CAR.maxReverse, CAR.maxSpeed);
  // steering scales with speed so the car doesn't spin in place
  const steerAuthority = clamp(Math.abs(vF) / 140, 0, 1);
  c.angle += steer * CAR.turnRate * steerAuthority * Math.sign(vF || 1) * dt;
  // grip damps sideways slide (a little drift survives at speed)
  vL *= Math.exp(-CAR.grip * dt);
  const nfx = Math.cos(c.angle), nfy = Math.sin(c.angle);
  const nrx = -nfy, nry = nfx;
  c.vx = nfx * vF + nrx * vL;
  c.vy = nfy * vF + nry * vL;
  c.speed = Math.hypot(c.vx, c.vy);
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  // keep the player on the road grid-ish: buildings and water block
  const px = c.x, py = c.y;
  if (collideCircle(state.city, c, 20)) {
    if (c.speed > 260) { c.health -= 8; sfxCrash(); state.events.push({ type: "crash", x: c.x, y: c.y }); }
    c.vx *= 0.4; c.vy *= 0.4;
  }
  void px; void py;
}

// --- traffic AI: follow the road graph node to node ---
function driveTrafficCar(state, c, dt) {
  if (!c.target) c.target = nearestNode(state.city, c.x, c.y);
  const dx = c.target.x - c.x, dy = c.target.y - c.y;
  const d = Math.hypot(dx, dy);
  if (d < 26) {
    // pick a neighbouring node that is not the one we just came from
    const opts = state.city.nodes.filter(n =>
      (Math.abs(n.x - c.target.x) < 1 && Math.abs(n.y - c.target.y) > 200 && Math.abs(n.y - c.target.y) < 420) ||
      (Math.abs(n.y - c.target.y) < 1 && Math.abs(n.x - c.target.x) > 200 && Math.abs(n.x - c.target.x) < 420));
    c.target = opts.length ? pick(Math.random, opts) : nearestNode(state.city, c.x + (Math.random() - 0.5) * 400, c.y + (Math.random() - 0.5) * 400);
    return;
  }
  const want = Math.atan2(dy, dx);
  const turn = angleDiff(c.angle, want);
  c.angle += clamp(turn, -2.2 * dt, 2.2 * dt);
  // slow for cars ahead
  let slow = false;
  for (const o of state.cars) {
    if (o === c || o.destroyed) continue;
    const od = dist(c.x, c.y, o.x, o.y);
    if (od < 70) {
      const ahead = (o.x - c.x) * Math.cos(c.angle) + (o.y - c.y) * Math.sin(c.angle);
      if (ahead > 0) { slow = true; break; }
    }
  }
  const targetSpeed = slow ? 0 : c.cruise;
  c.speed += clamp(targetSpeed - c.speed, -260 * dt, 160 * dt);
  c.vx = Math.cos(c.angle) * c.speed;
  c.vy = Math.sin(c.angle) * c.speed;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  // traffic stays on roads; if it somehow leaves, snap back toward the node
  if (!onRoad(state.city, c.x, c.y)) {
    const n = nearestNode(state.city, c.x, c.y);
    c.x += (n.x - c.x) * 0.5 * dt;
    c.y += (n.y - c.y) * 0.5 * dt;
  }
}

// car vs car: push apart, damage, slow down
function collideCars(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.destroyed) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.destroyed) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 44;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
        if (rel > 140) {
          a.health -= 6; b.health -= 6;
          a.vx *= 0.7; a.vy *= 0.7; b.vx *= 0.7; b.vy *= 0.7;
          if (a.driver === "player" || b.driver === "player") sfxCrash();
        }
      }
    }
  }
}

export function updateVehicles(state, dt) {
  for (const c of state.cars) {
    if (c.destroyed) continue;
    if (c.health <= 0) {
      c.destroyed = true;
      c.driver = null;
      state.events.push({ type: "explode", x: c.x, y: c.y });
      if (state.player.car === c) {
        state.player.car = null;
        state.player.onFoot = true;
        state.player.x = c.x + 40; state.player.y = c.y;
      }
      continue;
    }
    if (c.driver === "player") drivePlayerCar(state, c, dt);
    else if (c.driver === "traffic" && !c.parked) driveTrafficCar(state, c, dt);
    else if (c.driver === "cop") { /* police.js drives cop cars */ }
    // parked cars do not move
  }
  collideCars(state);
  // keep traffic topped up near the player
  const p = state.player;
  let traffic = 0;
  for (const c of state.cars) if (!c.destroyed && c.driver === "traffic") traffic++;
  if (traffic < 9 && Math.random() < dt * 0.5) {
    const pt = randomRoadPoint(state.city, Math.random);
    if (dist(pt.x, pt.y, p.x, p.y) > 500) {
      const nc = createCar(pt.x, pt.y, Math.random() * Math.PI * 2, { driver: "traffic", cruise: 130 + Math.random() * 70 });
      nc.target = nearestNode(state.city, pt.x, pt.y);
      state.cars.push(nc);
    }
  }
  // despawn far-away traffic
  state.cars = state.cars.filter(c => c.destroyed || c.driver === "player" || c.parked || dist(c.x, c.y, p.x, p.y) < 1400 || c.isCop);
}

export function drawCar(ctx, c, cam, time) {
  if (c.destroyed) {
    // wreck: dark burnt shell
    ctx.save();
    ctx.translate(c.x - cam.x, c.y - cam.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(-23, -11, 46, 22);
    ctx.restore();
    return;
  }
  const sx = c.x - cam.x, sy = c.y - cam.y;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath(); ctx.ellipse(2, 4, 24, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(c.angle);
  // body
  ctx.fillStyle = c.isCop ? PALETTE.policeCar : c.color;
  ctx.beginPath();
  ctx.roundRect(-23, -11, 46, 22, 6);
  ctx.fill();
  // cabin / windshield
  ctx.fillStyle = "rgba(20,30,44,0.9)";
  ctx.fillRect(-4, -9, 12, 18);
  ctx.fillStyle = "rgba(180,220,255,0.55)";
  ctx.fillRect(8, -8, 4, 16);
  // headlights / taillights
  ctx.fillStyle = "#fff8c8";
  ctx.fillRect(21, -9, 3, 5); ctx.fillRect(21, 4, 3, 5);
  ctx.fillStyle = "#ff2a2a";
  ctx.fillRect(-24, -9, 3, 5); ctx.fillRect(-24, 4, 3, 5);
  if (c.isCop) {
    // flashing light bar
    const on = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = on ? "#ff2a2a" : "#2a5aff";
    ctx.fillRect(-2, -11, 5, 5);
    ctx.fillStyle = on ? "#2a5aff" : "#ff2a2a";
    ctx.fillRect(-2, 6, 5, 5);
    ctx.fillStyle = "#e8e8e8";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("POLICE", 0, 2);
  }
  // damage smoke
  if (c.health < 40) {
    ctx.fillStyle = "rgba(120,120,120,0.5)";
    ctx.beginPath(); ctx.arc(-14 + Math.random() * 6, (Math.random() - 0.5) * 8, 5 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
