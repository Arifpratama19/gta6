// The wanted system: stars, police spawns, pursuit, and busts.
// state.cops is rebuilt every tick from the live cop cars so the HUD,
// the minimap and the missions always see the same list.
import { WORLD, COP, ROADS_X, ROADS_Y } from './config.js';
import { clamp, dist, wrapAngle } from './util.js';
import { randomRoadPoint } from './city.js';
import { damagePlayer } from './player.js';
import { addBanner } from './state.js';

const COP_COLORS = ['#1a1a2e', '#16213e'];

export function updateWanted(st, dt) {
  // Stars decay after a quiet stretch with no new crimes.
  st.crimeTimer += dt;
  if (st.wanted > 0 && st.crimeTimer > 20) {
    st.decayTimer += dt;
    if (st.decayTimer >= 9) {
      st.decayTimer = 0;
      st.wanted = Math.max(0, st.wanted - 1);
      if (st.wanted === 0) addBanner(st, 'You lost the cops.', 'Lay low.');
    }
  } else {
    st.decayTimer = 0;
  }
  // Spawn cops up to the wanted level, throttled by spawnCooldown.
  st.spawnCooldown = Math.max(0, st.spawnCooldown - dt);
  const liveCops = st.cars.filter((c) => c.cop && c.hp > 0);
  if (st.wanted > 0 && liveCops.length < Math.min(st.wanted, COP.maxCount) && st.spawnCooldown <= 0) {
    const spot = findCopSpawn(st);
    st.cars.push({
      id: 'cop' + Math.floor(st.time * 1000) + '-' + liveCops.length,
      model: 'Interceptor',
      color: COP_COLORS[liveCops.length % COP_COLORS.length],
      x: spot.x,
      y: spot.y,
      angle: Math.atan2(st.player.y - spot.y, st.player.x - spot.x),
      speed: 0,
      traffic: false,
      cop: true,
      hp: 100,
    });
    st.spawnCooldown = 2.5;
  }
  // Rebuild the cops list from live cop cars every tick.
  st.cops = st.cars.filter((c) => c.cop && c.hp > 0);
  st.bustGrace = Math.max(0, (st.bustGrace || 0) - dt);
  // Pursuit: each cop steers toward the player and closes in.
  for (const cop of st.cops) {
    const targetAngle = Math.atan2(st.player.y - cop.y, st.player.x - cop.x);
    const diff = wrapAngle(targetAngle - cop.angle);
    cop.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const want = COP.speed * (0.85 + Math.min(st.wanted, 5) * 0.05);
    cop.speed += (want - cop.speed) * dt * 1.4;
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = clamp(cop.x, 10, WORLD.w - 10);
    cop.y = clamp(cop.y, 10, WORLD.h - 10);
    // Bust: a cop catches Rico on foot (not during the post-exit grace).
    // The cop must stay on him for a short dwell — a brush-by does not bust.
    if (!st.player.inCar && st.bustGrace <= 0 && dist(cop.x, cop.y, st.player.x, st.player.y) < COP.bustRadius) {
      st.bustDwell = (st.bustDwell || 0) + dt;
      if (st.bustDwell >= 1.2) {
        bustPlayer(st);
        return;
      }
    } else {
      st.bustDwell = 0;
    }
    // Ramming a player's car slows it and shakes the player.
    if (st.player.inCar && dist(cop.x, cop.y, st.player.x, st.player.y) < 44) {
      const car = st.cars.find((c) => c.id === st.player.inCar);
      if (car) car.speed *= 1 - 0.3 * dt;
    }
  }
  // Clean up wrecked cop cars.
  st.cars = st.cars.filter((c) => !(c.cop && c.hp <= 0));
  st.cops = st.cars.filter((c) => c.cop && c.hp > 0);
}

// Find a road point a good distance from the player for a cop to spawn.
// Retries with fresh randomness until it finds one; never returns null.
export function findCopSpawn(st) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const p = randomRoadPoint(st.rng);
    const d = dist(p.x, p.y, st.player.x, st.player.y);
    if (d > 320 && d < 900) return p;
  }
  // Fallback: the farthest road intersection from the player.
  let best = { x: ROADS_X[0], y: ROADS_Y[0] };
  let bestD = -1;
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      const d = dist(rx, ry, st.player.x, st.player.y);
      if (d > bestD) {
        bestD = d;
        best = { x: rx, y: ry };
      }
    }
  }
  return best;
}

export function bustPlayer(st) {
  st.money = Math.max(0, st.money - 100);
  st.wanted = 0;
  st.crimeTimer = 0;
  // Impound the car, drop Rico at the hospital.
  if (st.player.inCar) {
    const car = st.cars.find((c) => c.id === st.player.inCar);
    if (car) {
      car.traffic = false;
      car.speed = 0;
    }
    st.player.inCar = null;
  }
  st.player.x = 300;
  st.player.y = 1320;
  st.player.hp = 100;
  st.hp = 100;
  st.mode = 'busted';
  addBanner(st, 'BUSTED', 'Hospital bill: $100. The heat is off — for now.');
}

export function wastedRespawn(st) {
  st.money = Math.max(0, st.money - 100);
  st.wanted = 0;
  st.crimeTimer = 0;
  if (st.player.inCar) {
    const car = st.cars.find((c) => c.id === st.player.inCar);
    if (car) car.speed = 0;
    st.player.inCar = null;
  }
  st.player.x = 300;
  st.player.y = 1320;
  st.player.hp = 100;
  st.hp = 100;
  st.gunmen = [];
  st.mode = 'playing';
  addBanner(st, 'WASTED', 'You woke up at the hospital. $100 gone.');
}

export { damagePlayer };
