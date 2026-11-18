// Cars: traffic AI, player driving, entering/exiting, and theft.
// All angles are radians; 0 = east, -PI/2 = north.
import { WORLD, CAR, PLAYER, WANTED, BEACH_X } from './config.js';
import { clamp, wrapAngle, dist } from './util.js';
import { isOnRoad, pointInBuilding, randomRoadPoint as roadPoint } from './city.js';
import { addBanner } from './state.js';

export function nearestCar(st, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of st.cars) {
    const d = dist(x, y, c.x, c.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function enterCar(st, car) {
  st.player.inCar = car.id;
  car.traffic = false;
  st.player.x = car.x;
  st.player.y = car.y;
  st.player.angle = car.angle;
  st.player.speed = 0;
}

export function exitCar(st) {
  const car = st.cars.find((c) => c.id === st.player.inCar);
  if (!car) return;
  st.player.inCar = null;
  st.player.x = car.x - Math.sin(car.angle) * 34;
  st.player.y = car.y + Math.cos(car.angle) * 34;
  st.player.angle = car.angle;
  st.player.speed = 0;
  car.speed = 0;
  // Grace period: the cops cannot bust Rico the instant he steps out.
  st.bustGrace = 2.5;
}

export function stealCar(st, car) {
  enterCar(st, car);
  st.stats.carsStolen += 1;
  addWanted(st, WANTED.stealCar);
  addBanner(st, 'Car stolen!', 'The cops are onto you.');
}

export function addWanted(st, stars) {
  if (stars <= 0) return;
  st.wanted = clamp(st.wanted + stars, 0, 5);
  st.crimeTimer = 0;
  st.decayTimer = 0;
}

export function updateCar(st, car, dt, input) {
  // Traffic cars cruise their road and wrap around the world.
  if (car.traffic) {
    const ahead = st.cars.find(
      (o) =>
        o !== car &&
        Math.abs(wrapAngle(Math.atan2(o.y - car.y, o.x - car.x) - car.angle)) < 0.4 &&
        dist(car.x, car.y, o.x, o.y) < 90,
    );
    const targetSpeed = ahead ? 0 : 120;
    car.speed += (targetSpeed - car.speed) * dt * 0.8;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.x < -80) car.x = WORLD.w + 70;
    if (car.x > WORLD.w + 80) car.x = -70;
    if (car.y < -80) car.y = WORLD.h + 70;
    if (car.y > WORLD.h + 80) car.y = -70;
    // Keep traffic on roads: if it drifted off (edge wrap), snap back.
    if (!isOnRoad(car.x, car.y) && car.x < BEACH_X) {
      const p = roadPoint(st.rng);
      car.x = p.x;
      car.y = p.y;
    }
    return;
  }
  // Player-driven car.
  if (st.player.inCar !== car.id) return;
  const ax = input.x; // -1 left, +1 right (steer)
  const ay = input.y; // -1 forward (W), +1 back (S)
  const forward = -ay;
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
  else car.speed *= Math.max(0, 1 - CAR.drag * dt);
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const steerDir = car.speed >= 0 ? 1 : -1;
  car.angle += ax * CAR.steer * steerDir * dt * clamp(Math.abs(car.speed) / 80, 0, 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Buildings block cars: slide along them instead of passing through.
  if (!pointInBuilding(st.city, nx, car.y, 4)) car.x = nx;
  else car.speed *= 0.4;
  if (!pointInBuilding(st.city, car.x, ny, 4)) car.y = ny;
  else car.speed *= 0.4;
  car.x = clamp(car.x, 10, WORLD.w - 10);
  car.y = clamp(car.y, 10, WORLD.h - 10);
  st.player.x = car.x;
  st.player.y = car.y;
  st.player.angle = car.angle;
  st.player.speed = car.speed;
}

export function carCorners(car) {
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  const hl = CAR.length / 2;
  const hw = CAR.width / 2;
  return [
    { x: car.x + c * hl - s * hw, y: car.y + s * hl + c * hw },
    { x: car.x + c * hl + s * hw, y: car.y + s * hl - c * hw },
    { x: car.x - c * hl + s * hw, y: car.y - s * hl - c * hw },
    { x: car.x - c * hl - s * hw, y: car.y - s * hl + c * hw },
  ];
}
