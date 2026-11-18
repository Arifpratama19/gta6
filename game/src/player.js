// player.js — Rico Vega on foot: movement, entering and leaving cars.
import { PLAYER, WORLD, BEACH_X, OCEAN_X } from './config.js';
import { clamp, dist } from './util.js';
import { resolveBuildingCollision } from './city.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    hp: PLAYER.hp,
    maxHp: PLAYER.hp,
    inCar: null,
    speed: 0,
    moving: false,
    shootCooldown: 0,
    invulnerable: 0,
  };
}

// Move on foot. Returns the distance actually travelled.
export function updatePlayerOnFoot(state, dt) {
  const p = state.player;
  const mv = state.input.moveVector();
  const sprint = state.input.down('ShiftLeft') || state.input.down('ShiftRight');
  const speed = sprint ? PLAYER.sprint : PLAYER.walk;
  p.moving = mv.x !== 0 || mv.y !== 0;
  if (p.moving) {
    p.angle = Math.atan2(mv.y, mv.x);
    p.x += mv.x * speed * dt;
    p.y += mv.y * speed * dt;
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  p.x = clamp(p.x, 24, OCEAN_X - 24);
  p.y = clamp(p.y, 24, WORLD.h - 24);
  // The ocean is waist-deep: wading is slow, never blocked.
  if (p.x > BEACH_X) {
    p.x = clamp(p.x, 24, OCEAN_X + 60);
  }
  resolveBuildingCollision(state.city, p, PLAYER.radius);
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.invulnerable > 0) p.invulnerable -= dt;
  return p.moving ? speed * dt : 0;
}

// Nearest car the player can enter (within range and roughly beside them).
export function nearestCar(state, maxDist) {
  const p = state.player;
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(state, car) {
  const p = state.player;
  p.inCar = car;
  car.driver = 'player';
  p.x = car.x;
  p.y = car.y;
}

export function exitCar(state) {
  const p = state.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = null;
  p.inCar = null;
  // Step out to the side of the car, clear of buildings.
  const sx = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  const sy = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.x = clamp(sx, 24, OCEAN_X - 24);
  p.y = clamp(sy, 24, WORLD.h - 24);
  resolveBuildingCollision(state.city, p, PLAYER.radius);
  p.angle = car.angle;
}
