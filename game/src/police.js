// police.js — the wanted system: stars rise with crime, fall with time,
// and interceptors spawn, chase, ram and bust the player.
import { POLICE, WANTED, WORLD } from './config.js';
import { dist, clamp, angleDiff } from './util.js';
import { makeCar, damageCar } from './vehicles.js';
import { roadPointNear } from './city.js';

export function addWanted(state, stars, reason) {
  if (state.wanted >= 5) return;
  state.wanted = clamp(state.wanted + stars, 0, 5);
  state.wantedTimer = WANTED.decaySeconds;
  if (reason) state.hud.toast(reason + '  Wanted level ' + state.wanted + '!');
  if (state.wanted >= 1) state.audio.setSiren(true, state.time);
}

export function clearWanted(state) {
  state.wanted = 0;
  state.wantedTimer = 0;
  state.audio.setSiren(false, state.time);
}

// Rebuild the live cop list from the cars every tick, so the spawn cap is
// always measured against the cops that actually exist.
export function syncCops(state) {
  state.cops = state.cars.filter((c) => c.isCop && !c.wrecked);
}

export function updatePolice(state, dt) {
  // Defensive: spawnCooldown must always be a number (newGame sets it).
  if (typeof state.spawnCooldown !== 'number' || Number.isNaN(state.spawnCooldown)) {
    state.spawnCooldown = 0;
  }
  syncCops(state);
  const p = state.player;

  // No heat, no pursuit: once the wanted level hits zero the interceptors
  // stand down and leave, so a cleared player is never busted by a
  // leftover cop still circling.
  if (state.wanted === 0 && state.cops.length > 0) {
    state.cars = state.cars.filter((c) => !c.isCop);
    state.cops = [];
  }

  // Wanted decays one star at a time when the player stays clean.
  if (state.wanted > 0) {
    state.wantedTimer -= dt;
    if (state.wantedTimer <= 0) {
      state.wanted -= 1;
      state.wantedTimer = WANTED.decaySeconds;
      state.hud.toast('Heat cooling off… wanted level ' + state.wanted);
      if (state.wanted === 0) state.audio.setSiren(false, state.time);
    }
  }

  // Spawn interceptors until the street holds one per star (max 3 at once).
  const desired = Math.min(state.wanted, POLICE.maxActive);
  state.spawnCooldown -= dt;
  if (state.cops.length < desired && state.spawnCooldown <= 0) {
    state.spawnCooldown = POLICE.spawnGap;
    const spot = roadPointNear(state.city, Math.random, p.x, p.y, POLICE.spawnMin, POLICE.spawnMax);
    const cop = makeCar({
      name: 'Interceptor',
      x: spot.x,
      y: spot.y,
      angle: Math.atan2(p.y - spot.y, p.x - spot.x),
      color: '#2b4fd9',
      isCop: true,
      hp: 160,
    });
    state.cars.push(cop);
    syncCops(state);
  }

  // Pursuit: steer toward the player, close in, ram to stop them.
  let copTouching = false;
  for (const cop of state.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    const wantAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
    const turn = clamp(angleDiff(cop.angle, wantAngle), -2.4 * dt, 2.4 * dt);
    cop.angle += turn;
    const target = d > 130 ? POLICE.chaseSpeed : POLICE.chaseSpeed * 0.7;
    cop.speed += clamp(target - cop.speed, -500 * dt, 380 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = clamp(cop.x, 24, WORLD.w - 24);
    cop.y = clamp(cop.y, 24, WORLD.h - 24);

    if (d < 52) {
      if (p.inCar) {
        // Ram the player's car. Gentle enough that a chase is survivable
        // while the player escapes; the car only wrecks after long contact.
        damageCar(state, p.inCar, POLICE.ramDamage * dt);
        p.inCar.speed *= 0.96;
        if (p.inCar.wrecked) {
          state.bust('Your car was wrecked by the police.');
        }
      } else if (p.invulnerable <= 0) {
        // A cop on foot does not bust instantly: Rico has a moment to
        // break free or fight back before the cuffs close.
        copTouching = true;
      }
    }
  }
  // On foot, the bust only lands after a cop holds Rico for ~1.2 seconds.
  if (copTouching && state.mode === 'play') {
    state.bustTimer = (state.bustTimer || 0) + dt;
    if (state.bustTimer > 1.2) {
      state.bustTimer = 0;
      state.bust('The police caught you on foot.');
    }
  } else {
    state.bustTimer = 0;
  }

  // Siren wails while any star is lit.
  state.audio.setSiren(state.wanted > 0, state.time);
}
