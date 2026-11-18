// people.js — pedestrians who stroll the sidewalks, and gunmen who hold
// their ground, face the player and shoot. Gunmen never wander off.
import { WORLD, BEACH_X } from './config.js';
import { rand, pick, dist, clamp } from './util.js';
import { isOnRoad } from './city.js';
import { enemyShoot, enemyShootAtCar } from './combat.js';

const PED_COLORS = ['#e8b04c', '#4c8fd9', '#d94f7f', '#7fd94f', '#c9a0e8', '#e8e8e8', '#8a5a3d'];
const PED_NAMES = ['Marta', 'Dario', 'Lena', 'Tomas', 'Priya', 'Oscar', 'Nina', 'Felix'];

export function makePed(x, y, opts) {
  opts = opts || {};
  return {
    x,
    y,
    angle: rand(Math.random, 0, Math.PI * 2),
    speed: opts.speed || rand(Math.random, 28, 62),
    color: opts.color || pick(Math.random, PED_COLORS),
    name: opts.name || pick(Math.random, PED_NAMES),
    gunman: !!opts.gunman,
    hp: opts.hp || 60,
    dead: false,
    target: null,
    retarget: 0,
    shootTimer: rand(Math.random, 0.4, 1.2),
  };
}

export function spawnPeds(city, rng, count) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard++ < count * 12) {
    const x = rand(rng, 90, BEACH_X - 90);
    const y = rand(rng, 90, WORLD.h - 90);
    if (isOnRoad(city, x, y)) continue;
    peds.push(makePed(x, y));
  }
  return peds;
}

export function spawnGunmen(state, positions) {
  for (const pos of positions) {
    const g = makePed(pos.x, pos.y, { gunman: true, hp: 60, speed: 0 });
    g.home = { x: pos.x, y: pos.y };
    state.peds.push(g);
  }
}

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    if (ped.gunman) {
      // Gunmen hold their ground and face the player, then shoot in range.
      ped.x = ped.home.x;
      ped.y = ped.home.y;
      ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
      ped.shootTimer -= dt;
      const d = dist(ped.x, ped.y, p.x, p.y);
      const playerInCar = !!p.inCar;
      if (ped.shootTimer <= 0 && d < 520 && !playerInCar) {
        ped.shootTimer = 1.35;
        enemyShoot(state, ped);
      } else if (ped.shootTimer <= 0 && d < 520 && playerInCar) {
        ped.shootTimer = 1.35;
        enemyShootAtCar(state, ped);
      }
      continue;
    }
    // Strollers: pick a nearby sidewalk point, walk to it, pick another.
    ped.retarget -= dt;
    if (!ped.target || ped.retarget <= 0 || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 14) {
      ped.retarget = rand(Math.random, 2, 6);
      ped.target = {
        x: clamp(ped.x + rand(Math.random, -160, 160), 60, BEACH_X - 60),
        y: clamp(ped.y + rand(Math.random, -160, 160), 60, WORLD.h - 60),
      };
    }
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      ped.angle = Math.atan2(dy, dx);
      ped.x += (dx / d) * ped.speed * dt;
      ped.y += (dy / d) * ped.speed * dt;
    }
    // Flee from a speeding car nearby.
    if (p.inCar && dist(ped.x, ped.y, p.x, p.y) < 90 && Math.abs(p.inCar.speed) > 240) {
      ped.target = {
        x: clamp(ped.x + (ped.x - p.x), 60, BEACH_X - 60),
        y: clamp(ped.y + (ped.y - p.y), 60, WORLD.h - 60),
      };
      ped.speed = 150;
    }
  }
}
