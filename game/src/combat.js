// Bullets: movement plus segment-based hit tests. A bullet moves in steps
// each frame; the hit test measures the distance from a target's centre to
// the segment the bullet travelled this frame, so a fast bullet can never
// tunnel through a target between two frames.
import { PISTOL, GUNMAN, WANTED, PLAYER } from './config.js';
import { distToSegment, dist } from './util.js';
import { addWanted } from './vehicles.js';
import { damagePlayer } from './player.js';
import { spawnBlood, spawnHitSparks } from './people.js';
import { shot, enemyShot } from './audio.js';

export function fireGunmanBullet(st, g) {
  const a = Math.atan2(st.player.y - g.y, st.player.x - g.x) + (st.rng() - 0.5) * 0.12;
  st.bullets.push({
    x: g.x + Math.cos(a) * 22,
    y: g.y + Math.sin(a) * 22,
    px: g.x,
    py: g.y,
    vx: Math.cos(a) * 780,
    vy: Math.sin(a) * 780,
    travelled: 0,
    fromPlayer: false,
  });
  enemyShot();
}

export function updateBullets(st, dt) {
  for (const b of st.bullets) {
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += Math.hypot(b.vx, b.vy) * dt;
    if (b.travelled > PISTOL.range) {
      b.dead = true;
      continue;
    }
    if (b.fromPlayer) {
      // Gunmen.
      for (const g of st.gunmen) {
        if (g.hp <= 0) continue;
        if (distToSegment(g.x, g.y, b.px, b.py, b.x, b.y) < GUNMAN.radius + 4) {
          g.hp -= PISTOL.damage;
          b.dead = true;
          st.stats.hits += 1;
          spawnHitSparks(st, b.x, b.y);
          if (g.hp <= 0) {
            st.stats.kills += 1;
            addWanted(st, WANTED.killGunman);
            spawnBlood(st, g.x, g.y);
          }
          break;
        }
      }
      if (b.dead) continue;
      // Pedestrians (collateral).
      for (const ped of st.peds) {
        if (ped.hp <= 0) continue;
        if (distToSegment(ped.x, ped.y, b.px, b.py, b.x, b.y) < PLAYER.radius + 3) {
          ped.hp = 0;
          b.dead = true;
          st.stats.hits += 1;
          st.stats.kills += 1;
          addWanted(st, WANTED.killPed);
          spawnBlood(st, ped.x, ped.y);
          break;
        }
      }
      if (b.dead) continue;
      // Cop cars.
      for (const cop of st.cops) {
        if (distToSegment(cop.x, cop.y, b.px, b.py, b.x, b.y) < 30) {
          cop.hp -= PISTOL.damage;
          b.dead = true;
          st.stats.hits += 1;
          spawnHitSparks(st, b.x, b.y);
          if (cop.hp <= 0) {
            st.stats.kills += 1;
            addWanted(st, WANTED.killCop);
          }
          break;
        }
      }
      if (b.dead) continue;
      // Traffic cars (damage only).
      for (const car of st.cars) {
        if (car.cop) continue;
        if (distToSegment(car.x, car.y, b.px, b.py, b.x, b.y) < 30) {
          car.hp -= PISTOL.damage;
          b.dead = true;
          st.stats.hits += 1;
          spawnHitSparks(st, b.x, b.y);
          break;
        }
      }
    } else {
      // Enemy bullets hit Rico (on foot or in a car).
      if (distToSegment(st.player.x, st.player.y, b.px, b.py, b.x, b.y) < PLAYER.radius + 4) {
        damagePlayer(st, GUNMAN.damage);
        b.dead = true;
      }
    }
  }
  st.bullets = st.bullets.filter((b) => !b.dead);
  st.peds = st.peds.filter((p) => p.hp > 0);
  st.gunmen = st.gunmen.filter((g) => g.hp > 0);
}

export function updateGunmen(st, dt) {
  for (const g of st.gunmen) {
    // Gunmen hold their ground and face the player; they never chase.
    g.angle = Math.atan2(st.player.y - g.y, st.player.x - g.x);
    g.shootTimer -= dt;
    const d = dist(g.x, g.y, st.player.x, st.player.y);
    if (g.shootTimer <= 0 && d < GUNMAN.range) {
      g.shootTimer = GUNMAN.shootDelay + st.rng() * 0.6;
      fireGunmanBullet(st, g);
    }
  }
}

export function spawnGunmen(st, x, y, count) {
  st.gunmen = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    st.gunmen.push({
      x: x + Math.cos(a) * 70,
      y: y + Math.sin(a) * 55,
      angle: 0,
      hp: GUNMAN.hp,
      shootTimer: 0.8 + i * 0.4,
    });
  }
}

export { shot };
