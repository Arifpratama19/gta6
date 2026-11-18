// player.js — Rico Vega on foot and behind the wheel.
import { PLAYER, CAR } from "./config.js";
import { keys, mouse, consumeEnter } from "./input.js";
import { collideCircle } from "./city.js";
import { clamp, dist } from "./util.js";

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, // facing up
    vx: 0, vy: 0,
    health: PLAYER.health,
    money: PLAYER.startMoney,
    onFoot: true,
    car: null,          // car object when driving
    hurtTimer: 0,       // brief invulnerability flash after damage
    dead: false,
  };
}

// find the nearest usable car within reach (parked or traffic, not a cop car)
export function nearestCar(state, x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of state.cars) {
    if (c.destroyed || c.isCop) continue;
    const d = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function updatePlayer(state, dt) {
  const p = state.player;
  if (p.dead) return;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;

  // E: enter / exit car
  if (consumeEnter()) {
    if (p.onFoot) {
      const c = nearestCar(state, p.x, p.y, 56);
      if (c) {
        p.onFoot = false;
        p.car = c;
        c.driver = "player";
        c.stolen = true;
        if (c.parked) {
          c.parked = false;
          state.events.push({ type: "stolen", x: c.x, y: c.y });
        }
      }
    } else if (p.car) {
      const c = p.car;
      c.driver = null;
      c.speed = 0;
      // step out to the side of the car
      const side = Math.PI / 2;
      p.x = c.x + Math.cos(c.angle + side) * 34;
      p.y = c.y + Math.sin(c.angle + side) * 34;
      p.angle = c.angle;
      p.onFoot = true;
      p.car = null;
      collideCircle(state.city, p, PLAYER.radius);
    }
  }

  if (p.onFoot) {
    let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len; my /= len;
      const sp = keys.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      p.x += mx * sp * dt;
      p.y += my * sp * dt;
      p.angle = Math.atan2(my, mx);
      collideCircle(state.city, p, PLAYER.radius);
    }
    // aim toward the mouse
    if (mouse.wx !== undefined) {
      p.angle = Math.atan2(mouse.wy - p.y, mouse.wx - p.x);
    }
  } else if (p.car) {
    // riding in a car: the player sits where the car is
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
  }
  // (driving is handled by vehicles.js — the car moves, the player rides along)
  p.x = clamp(p.x, 0, state.cityWorld.w);
  p.y = clamp(p.y, 0, state.cityWorld.h);
}

export function drawPlayer(ctx, p, cam) {
  if (!p.onFoot || p.dead) return;
  const sx = p.x - cam.x, sy = p.y - cam.y;
  if (p.hurtTimer > 0 && Math.floor(p.hurtTimer * 12) % 2 === 0) return; // hurt flash
  ctx.save();
  ctx.translate(sx, sy);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(2, 4, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
  // body
  ctx.rotate(p.angle);
  ctx.fillStyle = "#f2c14e"; // Rico's yellow jacket
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#222831";
  ctx.fillRect(8, -4, 10, 8); // gun / arm toward aim
  ctx.fillStyle = "#f2c14e";
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#8a5a2a";
  ctx.beginPath(); ctx.arc(-2, 0, 5, 0, Math.PI * 2); ctx.fill(); // head
  ctx.restore();
}
