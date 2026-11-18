// vehicles.js — cars: the player's ride, traffic that follows the roads,
// and police interceptors. One job: make cars move and collide believably.
import { CAR, WORLD, BEACH_X, PALETTE } from './config.js';
import { clamp, dist, angleDiff, rand, pick } from './util.js';
import { resolveBuildingCollision, randomRoadPoint, isOnRoad } from './city.js';

let nextCarId = 1;

export function makeCar(opts) {
  const car = {
    id: nextCarId++,
    name: opts.name || 'Sedan',
    x: opts.x,
    y: opts.y,
    angle: opts.angle || 0,
    speed: 0,
    color: opts.color || pick(Math.random, PALETTE.carColors),
    owned: !!opts.owned,
    isCop: !!opts.isCop,
    traffic: !!opts.traffic,
    driver: opts.driver || null,
    hp: opts.hp || 120,
    maxHp: 120,
    wrecked: false,
    // Traffic cars drive along one road in one direction.
    roadAxis: opts.roadAxis || 'v',
    roadCoord: opts.roadCoord || 0,
    roadDir: opts.roadDir || 1,
    targetSpeed: opts.targetSpeed || CAR.trafficSpeed,
    honkCooldown: 0,
  };
  return car;
}

export function spawnTraffic(city, rng, count) {
  const cars = [];
  const names = ['Sedan', 'Hatch', 'Coupe', 'Van', 'Pickup', 'Taxi'];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    let x;
    let y;
    let angle;
    if (vertical) {
      x = pick(rng, city.roadsV) + (rng() < 0.5 ? -16 : 16);
      y = rand(rng, 100, WORLD.h - 100);
      angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = rand(rng, 100, BEACH_X - 100);
      y = pick(rng, city.roadsH) + (rng() < 0.5 ? -16 : 16);
      angle = rng() < 0.5 ? 0 : Math.PI;
    }
    cars.push(makeCar({
      name: pick(rng, names),
      x, y, angle,
      color: pick(rng, PALETTE.carColors),
      traffic: true,
      roadAxis: vertical ? 'v' : 'h',
      roadCoord: vertical ? x : y,
      roadDir: angle === 0 || angle === Math.PI / 2 ? 1 : -1,
      targetSpeed: rand(rng, 110, 175),
    }));
  }
  return cars;
}

// Traffic: cruise along its road; wrap around the world edge; nudge around
// a stopped car ahead by slowing down.
export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (!car.traffic || car.wrecked) continue;
    if (car.honkCooldown > 0) car.honkCooldown -= dt;
    let blocked = false;
    for (const other of state.cars) {
      if (other === car || other.wrecked) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 64) {
        const ahead = Math.cos(car.angle) * (other.x - car.x) + Math.sin(car.angle) * (other.y - car.y);
        if (ahead > 0 && ahead < 70) {
          blocked = true;
          break;
        }
      }
    }
    const want = blocked ? 0 : car.targetSpeed;
    car.speed += clamp(want - car.speed, -260 * dt, 200 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.roadAxis === 'v') {
      if (car.y < 40) car.y = WORLD.h - 40;
      if (car.y > WORLD.h - 40) car.y = 40;
      car.x = car.roadCoord;
    } else {
      if (car.x < 40) car.x = BEACH_X - 40;
      if (car.x > BEACH_X - 40) car.x = 40;
      car.y = car.roadCoord;
    }
  }
}

// The car the player drives: arcade physics with steering that tightens
// with speed and a handbrake feel on reverse.
export function updatePlayerCar(state, dt) {
  const p = state.player;
  const car = p.inCar;
  if (!car || car.wrecked) return;
  const input = state.input;
  const fwd = input.any(['KeyW', 'ArrowUp']) ? 1 : 0;
  const rev = input.any(['KeyS', 'ArrowDown']) ? 1 : 0;
  const steer = (input.any(['KeyA', 'ArrowLeft']) ? -1 : 0) + (input.any(['KeyD', 'ArrowRight']) ? 1 : 0);
  if (fwd) car.speed += CAR.accel * dt;
  if (rev) {
    if (car.speed > 20) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.55 * dt;
  }
  if (!fwd && !rev) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  }
  car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
  const speedRatio = clamp(Math.abs(car.speed) / CAR.maxSpeed, 0, 1);
  const turn = steer * CAR.turnRate * (0.35 + 0.65 * speedRatio) * dt * Math.sign(car.speed || 1);
  car.angle += turn;
  const ox = car.x;
  const oy = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 24, 2360);
  car.y = clamp(car.y, 24, WORLD.h - 24);
  // Buildings stop the car hard; a fast hit costs health.
  const hitWall = resolveBuildingCollision(state.city, car, CAR.radius);
  if (hitWall) {
    const impact = Math.abs(car.speed);
    if (impact > 260) {
      damageCar(state, car, (impact - 260) / 14);
      state.audio.hit();
    }
    car.speed *= 0.25;
  }
  // Bump traffic cars out of the way.
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < CAR.radius * 2 && d > 0.01) {
      const push = (CAR.radius * 2 - d) / 2;
      const nx = (other.x - car.x) / d;
      const ny = (other.y - car.y) / d;
      other.x += nx * push;
      other.y += ny * push;
      if (Math.abs(car.speed) > 200) {
        damageCar(state, other, 12);
        state.audio.hit();
      }
    }
  }
  // Running over a pedestrian is a crime, and it slows the car.
  for (const ped of state.peds) {
    if (ped.dead) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < CAR.radius + 10) {
      ped.dead = true;
      state.particles.push({ x: ped.x, y: ped.y, life: 0.5, max: 0.5, color: '#e8e8e8', size: 14 });
      car.speed *= 0.7;
      if (state.wanted < 2) state.addWanted(1, 'You ran over a pedestrian!');
    }
  }
  // Keep the player glued to the car.
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  void ox;
  void oy;
}

export function damageCar(state, car, amount) {
  if (car.wrecked) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.hp = 0;
    car.wrecked = true;
    car.speed = 0;
    state.particles.push({ x: car.x, y: car.y, life: 0.9, max: 0.9, color: '#555', size: 26 });
    state.particles.push({ x: car.x, y: car.y, life: 0.6, max: 0.6, color: '#ff9a3d', size: 18 });
    if (car.driver === 'player') {
      state.audio.busted();
    }
  }
}
