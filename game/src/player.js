// Rico on foot: WASD movement, health, and the pistol.
import { WORLD, PLAYER, PISTOL } from './config.js';
import { clamp, angleTo } from './util.js';
import { pointInBuilding } from './city.js';
import { mouse } from './input.js';

export function updatePlayerOnFoot(st, dt, axis, canvas, sprint) {
  const p = st.player;
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  const sp = sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let mx = axis.x;
  let my = axis.y;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const nx = p.x + mx * sp * dt;
  const ny = p.y + my * sp * dt;
  if (!pointInBuilding(st.city, nx, p.y, PLAYER.radius)) p.x = nx;
  if (!pointInBuilding(st.city, p.x, ny, PLAYER.radius)) p.y = ny;
  p.x = clamp(p.x, 10, WORLD.w - 10);
  p.y = clamp(p.y, 10, WORLD.h - 10);
  if (len > 0.1) {
    p.angle = Math.atan2(my, mx);
    p.walkFrame += dt * 10;
  }
  p.speed = len * sp;
}

// Aim angle from the player to the mouse cursor (screen -> world).
export function aimAngle(st, canvas, camera) {
  const wx = camera.x - canvas.width / 2 + mouse.x;
  const wy = camera.y - canvas.height / 2 + mouse.y;
  return angleTo(st.player.x, st.player.y, wx, wy);
}

export function tryShoot(st, angle) {
  const p = st.player;
  if (p.fireTimer > 0) return null;
  p.fireTimer = PISTOL.fireDelay;
  st.stats.shots += 1;
  const a = angle + (Math.random() - 0.5) * PISTOL.spread;
  const bx = p.x + Math.cos(a) * 22;
  const by = p.y + Math.sin(a) * 22;
  const b = {
    x: bx,
    y: by,
    px: bx,
    py: by,
    vx: Math.cos(a) * PISTOL.bulletSpeed,
    vy: Math.sin(a) * PISTOL.bulletSpeed,
    travelled: 0,
    fromPlayer: true,
  };
  st.bullets.push(b);
  return b;
}

export function damagePlayer(st, amount) {
  st.hp = Math.max(0, st.hp - amount);
  st.flash = 0.35;
  if (st.hp <= 0) st.mode = 'wasted';
}
