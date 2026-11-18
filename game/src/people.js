// Pedestrians: they wander the roads and sidewalks, panic and run when
// shots are fired nearby, and can be run over (which raises the wanted level).
import { WORLD, WANTED } from './config.js';
import { clamp, dist } from './util.js';
import { isOnRoad, randomRoadPoint } from './city.js';
import { addWanted } from './vehicles.js';

export function updatePeds(st, dt) {
  for (const ped of st.peds) {
    ped.wander -= dt;
    if (ped.wander <= 0) {
      ped.wander = 2 + st.rng() * 4;
      ped.angle = st.rng() * Math.PI * 2;
    }
    // Panic: run away from the player when shots ring out nearby.
    const d = dist(ped.x, ped.y, st.player.x, st.player.y);
    let sp = ped.speed;
    let ang = ped.angle;
    if (st.bullets.length > 0 && d < 260) {
      ang = Math.atan2(ped.y - st.player.y, ped.x - st.player.x);
      sp = ped.speed * 2.4;
    }
    const nx = ped.x + Math.cos(ang) * sp * dt;
    const ny = ped.y + Math.sin(ang) * sp * dt;
    if (isOnRoad(nx, ny) || isOnRoad(ped.x, ped.y)) {
      ped.x = clamp(nx, 10, WORLD.w - 10);
      ped.y = clamp(ny, 10, WORLD.h - 10);
      ped.angle = ang;
    } else {
      // Steer back onto a road instead of wandering into blocks.
      const rp = randomRoadPoint(st.rng);
      ped.angle = Math.atan2(rp.y - ped.y, rp.x - ped.x);
    }
  }
  // Running over a pedestrian while driving.
  const car = st.player.inCar ? st.cars.find((c) => c.id === st.player.inCar) : null;
  if (car && Math.abs(car.speed) > 60) {
    for (const ped of st.peds) {
      if (ped.hp > 0 && dist(car.x, car.y, ped.x, ped.y) < 34) {
        ped.hp = 0;
        st.stats.kills += 1;
        addWanted(st, WANTED.killPed);
        spawnBlood(st, ped.x, ped.y);
      }
    }
    st.peds = st.peds.filter((p) => p.hp > 0);
  }
}

export function spawnBlood(st, x, y) {
  for (let i = 0; i < 10; i++) {
    st.particles.push({
      x,
      y,
      vx: (st.rng() - 0.5) * 160,
      vy: (st.rng() - 0.5) * 160,
      t: 0.5,
      color: '#c0392b',
      size: 3,
    });
  }
}

export function spawnHitSparks(st, x, y) {
  for (let i = 0; i < 6; i++) {
    st.particles.push({
      x,
      y,
      vx: (st.rng() - 0.5) * 220,
      vy: (st.rng() - 0.5) * 220,
      t: 0.3,
      color: '#f1c40f',
      size: 2,
    });
  }
}
