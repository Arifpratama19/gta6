// combat.js — the pistol: bullets fly as segments, and hits are tested
// against the whole segment, so a fast bullet can never tunnel through
// a target between frames.
import { COMBAT } from './config.js';
import { segmentHitsCircle, dist } from './util.js';
import { damageCar } from './vehicles.js';

export function createCombat() {
  return {
    fireCooldown: 0,
    shotsFired: 0,
    shotsHit: 0,
    kills: 0,
  };
}

export function firePistol(state, tx, ty) {
  const p = state.player;
  const c = state.combat;
  if (c.fireCooldown > 0 || p.inCar) return false;
  c.fireCooldown = COMBAT.pistolRate;
  c.shotsFired += 1;
  const angle = Math.atan2(ty - p.y, tx - p.x);
  p.angle = angle;
  const mx = p.x + Math.cos(angle) * 20;
  const my = p.y + Math.sin(angle) * 20;
  state.bullets.push({
    x: mx,
    y: my,
    vx: Math.cos(angle) * COMBAT.bulletSpeed,
    vy: Math.sin(angle) * COMBAT.bulletSpeed,
    life: COMBAT.bulletLife,
    from: 'player',
    px: mx,
    py: my,
  });
  state.audio.shot();
  state.particles.push({ x: mx, y: my, life: 0.08, max: 0.08, color: '#ffe9a0', size: 10 });
  state.addWanted(0, null);
  return true;
}

export function enemyShoot(state, gunman) {
  const p = state.player;
  const angle = Math.atan2(p.y - gunman.y, p.x - gunman.x);
  const mx = gunman.x + Math.cos(angle) * 18;
  const my = gunman.y + Math.sin(angle) * 18;
  state.bullets.push({
    x: mx, y: my,
    vx: Math.cos(angle) * 820,
    vy: Math.sin(angle) * 820,
    life: 0.9, from: 'enemy', px: mx, py: my,
  });
  state.audio.enemyShot();
}

export function enemyShootAtCar(state, gunman) {
  // Gunmen shoot at the car itself when Rico is driving.
  const p = state.player;
  const car = p.inCar;
  if (!car) return;
  const angle = Math.atan2(car.y - gunman.y, car.x - gunman.x);
  const mx = gunman.x + Math.cos(angle) * 18;
  const my = gunman.y + Math.sin(angle) * 18;
  state.bullets.push({
    x: mx, y: my,
    vx: Math.cos(angle) * 820,
    vy: Math.sin(angle) * 820,
    life: 0.9, from: 'enemy', px: mx, py: my,
    targetCar: car,
  });
  state.audio.enemyShot();
}

export function updateBullets(state, dt) {
  const c = state.combat;
  if (c.fireCooldown > 0) c.fireCooldown -= dt;
  const p = state.player;
  const alive = [];
  for (const b of state.bullets) {
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    let consumed = false;
    if (b.from === 'player') {
      // Gunmen first.
      for (const ped of state.peds) {
        if (ped.dead || !ped.gunman) continue;
        if (segmentHitsCircle(b.px, b.py, b.x, b.y, ped.x, ped.y, 16)) {
          ped.hp -= COMBAT.pistolDamage;
          c.shotsHit += 1;
          state.audio.hit();
          state.particles.push({ x: ped.x, y: ped.y, life: 0.25, max: 0.25, color: '#ff5a4d', size: 10 });
          if (ped.hp <= 0) {
            ped.dead = true;
            c.kills += 1;
            state.missionKills = (state.missionKills || 0) + 1;
          }
          consumed = true;
          break;
        }
      }
      // Then cop cars.
      if (!consumed) {
        for (const car of state.cars) {
          if (!car.isCop || car.wrecked) continue;
          if (segmentHitsCircle(b.px, b.py, b.x, b.y, car.x, car.y, 24)) {
            damageCar(state, car, COMBAT.pistolDamage);
            c.shotsHit += 1;
            state.audio.hit();
            consumed = true;
            break;
          }
        }
      }
    } else {
      // Enemy bullets: the player on foot, or the player's car.
      if (b.targetCar) {
        if (segmentHitsCircle(b.px, b.py, b.x, b.y, b.targetCar.x, b.targetCar.y, 24)) {
          damageCar(state, b.targetCar, COMBAT.gunmanDamage);
          if (b.targetCar.wrecked && b.targetCar.driver === 'player') {
            state.bust('Your car was shot to pieces.');
          }
          consumed = true;
        }
      } else if (!p.inCar && p.invulnerable <= 0) {
        if (segmentHitsCircle(b.px, b.py, b.x, b.y, p.x, p.y, 14)) {
          p.hp -= COMBAT.gunmanDamage;
          p.invulnerable = 0.4;
          state.audio.hit();
          if (p.hp <= 0) {
            p.hp = 0;
            state.wasted('You were gunned down.');
          }
          consumed = true;
        }
      }
    }
    if (!consumed && b.life > 0) alive.push(b);
  }
  state.bullets = alive;
}
