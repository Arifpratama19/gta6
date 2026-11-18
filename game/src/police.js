// police.js — the wanted system: stars, heat, police pursuit and busts.
import { WANTED, CAR } from "./config.js";
import { createCar } from "./vehicles.js";
import { collideCircle, nearestNode, randomRoadPoint } from "./city.js";
import { dist, angleDiff, clamp } from "./util.js";
import { sfxSirenTick } from "./audio.js";

export function addWanted(state, n, x, y) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + n, 0, WANTED.maxStars);
  state.wantedTimer = 0;
  if (state.wanted > before) {
    state.events.push({ type: "wanted", x: x ?? state.player.x, y: y ?? state.player.y, stars: state.wanted });
  }
}

// do the cops have eyes on the player right now?
function copsSeePlayer(state) {
  const p = state.player;
  for (const c of state.cars) {
    if (!c.isCop || c.destroyed) continue;
    const d = dist(c.x, c.y, p.x, p.y);
    if (d < 260) return true;
    if (d < 520) {
      const facing = Math.cos(c.angle) * (p.x - c.x) + Math.sin(c.angle) * (p.y - c.y);
      if (facing > 0) return true;
    }
  }
  return false;
}

export function updatePolice(state, dt) {
  if (!state.cops) state.cops = [];
  const p = state.player;
  // wanted decays when the heat is off: no recent crime and no cop watching
  if (state.wanted > 0) {
    state.wantedTimer += dt;
    if (state.wantedTimer > WANTED.decayTime && !copsSeePlayer(state)) {
      state.wanted -= 1;
      state.wantedTimer = 0;
      state.events.push({ type: "wanted", x: p.x, y: p.y, stars: state.wanted });
    }
  }
  // keep the right number of cop cars on the street
  const want = WANTED.policePerStar[state.wanted];
  let cops = 0;
  for (const c of state.cars) if (c.isCop && !c.destroyed) cops++;
  if (cops < want && Math.random() < dt * 0.8) {
    const pt = randomRoadPoint(state.city, Math.random);
    if (dist(pt.x, pt.y, p.x, p.y) > 480 && dist(pt.x, pt.y, p.x, p.y) < 1000) {
      const cop = createCar(pt.x, pt.y, 0, { isCop: true, driver: "cop" });
      cop.cruise = WANTED.copSpeed;
      state.cars.push(cop);
    }
  }
  // drive the cops: chase the player, ram their car, hassle them on foot
  for (const c of state.cars) {
    if (!c.isCop || c.destroyed || c.driver !== "cop") continue;
    const d = dist(c.x, c.y, p.x, p.y);
    const want = Math.atan2(p.y - c.y, p.x - c.x);
    const turn = angleDiff(c.angle, want);
    c.angle += clamp(turn, -2.8 * dt, 2.8 * dt);
    const targetSpeed = d > 90 ? WANTED.copSpeed : WANTED.copSpeed * 0.55;
    c.speed += clamp(targetSpeed - c.speed, -420 * dt, 300 * dt);
    c.vx = Math.cos(c.angle) * c.speed;
    c.vy = Math.sin(c.angle) * c.speed;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    collideCircle(state.city, c, 20);
    // ram the player's car
    if (!p.onFoot && p.car && d < 52) {
      const nx = (p.car.x - c.x) / (d || 1), ny = (p.car.y - c.y) / (d || 1);
      p.car.vx += nx * 160 * dt * 10;
      p.car.vy += ny * 160 * dt * 10;
      p.car.health -= 6 * dt;
      if (Math.random() < dt * 0.5) state.events.push({ type: "crash", x: c.x, y: c.y });
    }
    // on foot and a cop is right on top of you: busted meter
    if (p.onFoot && d < 46) {
      state.busted = (state.busted || 0) + dt;
      if (state.busted > 2.5) {
        state.events.push({ type: "busted" });
        state.busted = 0;
      }
    } else if (state.busted) {
      state.busted = Math.max(0, state.busted - dt * 2);
    }
  }
  // siren ambience while wanted
  state._sirenT = (state._sirenT || 0) + dt;
  if (state.wanted > 0 && state._sirenT > 0.65) {
    state._sirenT = 0;
    sfxSirenTick();
  }
  // clear cops once the heat is fully gone
  if (state.wanted === 0) {
    state.cars = state.cars.filter(c => !c.isCop || dist(c.x, c.y, p.x, p.y) < 900);
  }
}
