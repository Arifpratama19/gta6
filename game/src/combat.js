// combat.js — pistol fire, bullets, enemy gunmen, health and death.
import { COMBAT, PLAYER } from "./config.js";
import { mouse, consumeClick } from "./input.js";
import { dist, circleOBB } from "./util.js";
import { sfxShoot, sfxHit } from "./audio.js";

export function createEnemy(x, y) {
  return {
    x, y, angle: 0,
    health: COMBAT.enemyHealth,
    shootTimer: 0.5 + Math.random(),
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: 0,
    dead: false,
  };
}

function losClear(city, ax, ay, bx, by) {
  // sample the segment; blocked if any sample lands inside a building
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    for (const b of city.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return false;
    }
  }
  return true;
}

function fireBullet(state, x, y, angle, fromPlayer) {
  state.bullets.push({
    x: x + Math.cos(angle) * 20,
    y: y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * COMBAT.bulletSpeed,
    vy: Math.sin(angle) * COMBAT.bulletSpeed,
    life: 0.6,
    fromPlayer,
    damage: fromPlayer ? COMBAT.pistolDamage : COMBAT.enemyDamage,
  });
}

export function updateCombat(state, dt) {
  const p = state.player;
  // --- player shooting (mouse aim, click or hold) ---
  if (!p.onFoot || p.dead) { /* can't shoot from a car */ }
  else {
    state._shootT = (state._shootT || 0) - dt;
    if ((mouse.down || consumeClick()) && state._shootT <= 0 && state.mode === "play") {
      state._shootT = COMBAT.pistolRate;
      const ang = Math.atan2(mouse.wy - p.y, mouse.wx - p.x);
      p.angle = ang;
      fireBullet(state, p.x, p.y, ang, true);
      sfxShoot();
      state.events.push({ type: "shot", x: p.x, y: p.y });
    }
  }
  // --- enemies shoot at the player ---
  for (const e of state.enemies) {
    if (e.dead) continue;
    e.shootTimer -= dt;
    const d = dist(e.x, e.y, p.x, p.y);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    if (!p.onFoot) { /* enemies only engage on foot */ }
    else if (d < COMBAT.enemyRange && !p.dead && losClear(state.city, e.x, e.y, p.x, p.y)) {
      if (e.shootTimer <= 0) {
        e.shootTimer = COMBAT.enemyRate;
        fireBullet(state, e.x, e.y, e.angle + (Math.random() - 0.5) * 0.14, false);
        sfxShoot();
      }
    }
    // strafe a little so they don't stand perfectly still
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) { e.strafeTimer = 1 + Math.random() * 1.5; e.strafeDir *= -1; }
    e.x += Math.cos(e.angle + Math.PI / 2) * e.strafeDir * 26 * dt;
    e.y += Math.sin(e.angle + Math.PI / 2) * e.strafeDir * 26 * dt;
  }
  // --- bullets fly and hit things ---
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    // buildings stop bullets
    let blocked = false;
    for (const bd of state.city.buildings) {
      if (b.x >= bd.x && b.x <= bd.x + bd.w && b.y >= bd.y && b.y <= bd.y + bd.h) { blocked = true; break; }
    }
    if (blocked) { b.life = 0; continue; }
    if (b.fromPlayer) {
      // hit an enemy?
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist(b.x, b.y, e.x, e.y) < 16) {
          e.health -= b.damage;
          b.life = 0;
          sfxHit();
          state.events.push({ type: "hit", x: e.x, y: e.y });
          if (e.health <= 0) { e.dead = true; state.events.push({ type: "enemyDown", x: e.x, y: e.y }); }
          break;
        }
      }
      if (b.life <= 0) continue;
      // hit a car?
      for (const c of state.cars) {
        if (c.destroyed) continue;
        if (circleOBB(b.x, b.y, 3, c.x, c.y, c.angle, 23, 11)) {
          c.health -= b.damage;
          b.life = 0;
          sfxHit();
          break;
        }
      }
      if (b.life <= 0) continue;
      // hit a pedestrian (counts as a crime)
      for (const ped of state.peds) {
        if (ped.state === "down") continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 12) {
          ped.state = "down";
          ped.downTimer = 6;
          b.life = 0;
          state.events.push({ type: "pedDown", x: ped.x, y: ped.y });
          break;
        }
      }
    } else {
      // enemy bullet vs the player (on foot only)
      if (p.onFoot && !p.dead && dist(b.x, b.y, p.x, p.y) < 14) {
        damagePlayer(state, b.damage);
        b.life = 0;
      }
      // enemy bullet vs the player's car
      if (!p.onFoot && p.car && circleOBB(b.x, b.y, 3, p.car.x, p.car.y, p.car.angle, 23, 11)) {
        p.car.health -= b.damage;
        b.life = 0;
      }
    }
  }
  state.bullets = state.bullets.filter(b => b.life > 0);
  state.enemies = state.enemies.filter(e => !e.dead || e.deadTimer !== undefined);
  // clean dead enemies after a short linger is handled by missions (they count kills)
  // --- slow health regen out of combat ---
  state._regenT = (state._regenT || 0) + dt;
  if (state._regenT > 1 && p.health > 0 && p.health < PLAYER.health) {
    state._regenT = 0;
    p.health = Math.min(PLAYER.health, p.health + 2);
  }
}

export function damagePlayer(state, n) {
  const p = state.player;
  if (p.dead || p.hurtTimer > 0) return;
  p.health -= n;
  p.hurtTimer = 0.35;
  sfxHit();
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    state.events.push({ type: "playerDead" });
  }
}

export function drawCombat(ctx, state, cam) {
  for (const b of state.bullets) {
    ctx.strokeStyle = "#ffd94a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012 - cam.x, b.y - b.vy * 0.012 - cam.y);
    ctx.lineTo(b.x - cam.x, b.y - cam.y);
    ctx.stroke();
  }
  for (const e of state.enemies) {
    if (e.dead) continue;
    const sx = e.x - cam.x, sy = e.y - cam.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(2, 4, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(e.angle);
    ctx.fillStyle = "#7a1f1f"; // rival gang red
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#222";
    ctx.fillRect(8, -4, 11, 8);
    ctx.fillStyle = "#e8b25d";
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // health bar
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(sx - 16, sy - 26, 32, 5);
    ctx.fillStyle = "#e33";
    ctx.fillRect(sx - 16, sy - 26, 32 * Math.max(0, e.health / COMBAT.enemyHealth), 5);
  }
}
