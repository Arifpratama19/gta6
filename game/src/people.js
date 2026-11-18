// people.js — pedestrians: they stroll the sidewalks and flee from trouble.
import { PALETTE } from "./config.js";
import { onSidewalk, nearestNode } from "./city.js";
import { dist, pick, rand } from "./util.js";

export function createPed(x, y, rng) {
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 42 + rng() * 36,
    color: pick(rng, PALETTE.pedColors),
    state: "walk", // walk | flee | down
    target: null,
    downTimer: 0,
    fleeTimer: 0,
    bob: rng() * Math.PI * 2,
  };
}

export function spawnPeds(state, n, rng) {
  let placed = 0, tries = 0;
  while (placed < n && tries < n * 6) {
    tries++;
    const pt = { x: rand(rng, 80, 2100), y: rand(rng, 80, 1900) };
    if (!onSidewalk(state.city, pt.x, pt.y)) continue;
    state.peds.push(createPed(pt.x, pt.y, rng));
    placed++;
  }
}

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.state === "down") {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        // get up and run away
        ped.state = "flee";
        ped.fleeTimer = 3;
      }
      continue;
    }
    // danger nearby? flee!
    let danger = null;
    for (const e of state.events) {
      if (e.type === "shot" || e.type === "crash" || e.type === "explode") {
        if (dist(ped.x, ped.y, e.x, e.y) < 320) { danger = e; break; }
      }
    }
    // a speeding car right next to a ped scares them too
    if (!danger) {
      for (const c of state.cars) {
        if (c.destroyed) continue;
        if (c.speed > 240 && dist(ped.x, ped.y, c.x, c.y) < 110) { danger = { x: c.x, y: c.y }; break; }
      }
    }
    if (danger) { ped.state = "flee"; ped.fleeTimer = 2.5; }

    if (ped.state === "flee") {
      ped.fleeTimer -= dt;
      const away = Math.atan2(ped.y - (danger ? danger.y : p.y), ped.x - (danger ? danger.x : p.x));
      ped.angle = away;
      const sp = ped.speed * 2.6;
      ped.x += Math.cos(away) * sp * dt;
      ped.y += Math.sin(away) * sp * dt;
      if (ped.fleeTimer <= 0) ped.state = "walk";
    } else {
      // stroll: keep walking, turn at random, prefer sidewalks
      if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 30 || Math.random() < dt * 0.05) {
        const n = nearestNode(state.city, ped.x, ped.y);
        const opts = state.city.nodes.filter(m =>
          (Math.abs(m.x - n.x) < 1 && Math.abs(m.y - n.y) > 200 && Math.abs(m.y - n.y) < 420) ||
          (Math.abs(m.y - n.y) < 1 && Math.abs(m.x - n.x) > 200 && Math.abs(m.x - n.x) < 420));
        ped.target = opts.length ? pick(Math.random, opts) : n;
      }
      const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      ped.angle = want;
      ped.x += Math.cos(want) * ped.speed * dt;
      ped.y += Math.sin(want) * ped.speed * dt;
    }
    ped.bob += dt * 8;
    // stay in the world
    ped.x = Math.max(10, Math.min(2370, ped.x));
    ped.y = Math.max(10, Math.min(1990, ped.y));
  }
  // top the crowd back up near the player
  if (state.peds.length < 22 && Math.random() < dt * 0.8) {
    const pt = { x: p.x + (Math.random() - 0.5) * 900, y: p.y + (Math.random() - 0.5) * 700 };
    if (pt.x > 60 && pt.x < 2150 && pt.y > 60 && pt.y < 1940 && onSidewalk(state.city, pt.x, pt.y)) {
      state.peds.push(createPed(pt.x, pt.y, Math.random));
    }
  }
  state.peds = state.peds.filter(pd => dist(pd.x, pd.y, p.x, p.y) < 1300);
}

export function drawPeds(ctx, state, cam) {
  for (const ped of state.peds) {
    const sx = ped.x - cam.x, sy = ped.y - cam.y;
    if (sx < -30 || sx > cam.w + 30 || sy < -30 || sy > cam.h + 30) continue;
    ctx.save();
    ctx.translate(sx, sy);
    if (ped.state === "down") {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    const bob = Math.sin(ped.bob) * 1.5;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath(); ctx.ellipse(1, 3, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a2118";
    ctx.beginPath(); ctx.arc(3, 0, 4, 0, Math.PI * 2); ctx.fill();
    // little walking feet
    ctx.fillStyle = "#222";
    ctx.fillRect(-6, -6 + bob, 4, 3);
    ctx.fillRect(-6, 3 - bob, 4, 3);
    ctx.restore();
  }
}
