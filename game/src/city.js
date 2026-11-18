// city.js — procedural coastal city: road grid, blocks, buildings, beach + ocean.
// Also owns collision (buildings/water are solid) and the road graph traffic follows.
import { WORLD, PALETTE } from "./config.js";
import { mulberry32, pick, rand, resolveCircleRect } from "./util.js";

export const LANDMARKS = {
  marina:    { x: 2060, y: 1720, name: "Marina" },
  pier:      { x: 2260, y: 880,  name: "Pier" },
  bank:      { x: 980,  y: 620,  name: "Solmar Bank" },
  garage:    { x: 330,  y: 1620, name: "Garage" },
  safehouse: { x: 1580, y: 150,  name: "Safehouse" },
  hospital:  { x: 620,  y: 1620, name: "Hospital" },
  downtown:  { x: 980,  y: 960,  name: "Downtown" },
};

export function generateCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const vRoads = [], hRoads = [];
  const gap = WORLD.roadGap, half = WORLD.roadW / 2;
  for (let x = gap; x < WORLD.beachX - gap / 2; x += gap) vRoads.push(x);
  for (let y = gap; y < WORLD.h - gap / 2; y += gap) hRoads.push(y);
  // one building (or a small pair) per block, inset from the roads
  for (let i = 0; i < vRoads.length; i++) {
    for (let j = 0; j < hRoads.length; j++) {
      const bx0 = vRoads[i] + half + WORLD.sidewalkW + 8;
      const by0 = hRoads[j] + half + WORLD.sidewalkW + 8;
      const bx1 = (i + 1 < vRoads.length ? vRoads[i + 1] : WORLD.beachX) - half - WORLD.sidewalkW - 8;
      const by1 = (j + 1 < hRoads.length ? hRoads[j + 1] : WORLD.h) - half - WORLD.sidewalkW - 8;
      const bw = bx1 - bx0, bh = by1 - by0;
      if (bw < 60 || bh < 60) continue;
      if (rng() < 0.12) continue; // empty lot / plaza
      const n = rng() < 0.45 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = n === 1 ? bw * rand(rng, 0.55, 0.85) : bw * rand(rng, 0.4, 0.48);
        const h = n === 1 ? bh * rand(rng, 0.55, 0.85) : bh * rand(rng, 0.4, 0.48);
        const x = n === 1 ? bx0 + (bw - w) / 2 : bx0 + (k === 0 ? 0 : bw - w);
        const y = n === 1 ? by0 + (bh - h) / 2 : by0 + (k === 0 ? 0 : bh - h);
        const ci = Math.floor(rng() * PALETTE.buildingRoof.length);
        buildings.push({
          x, y, w, h,
          roof: PALETTE.buildingRoof[ci],
          wall: PALETTE.buildingWall[ci],
          height: 14 + Math.floor(rng() * 26), // fake 3D lift
          windows: Math.floor(rand(rng, 2, 6)),
        });
      }
    }
  }
  // intersections = road graph nodes
  const nodes = [];
  for (const x of vRoads) for (const y of hRoads) nodes.push({ x, y });
  return { buildings, vRoads, hRoads, nodes };
}

// Is the point on a road (within the asphalt)?
export function onRoad(city, x, y) {
  const half = WORLD.roadW / 2;
  for (const rx of city.vRoads) if (Math.abs(x - rx) <= half) return true;
  for (const ry of city.hRoads) if (Math.abs(y - ry) <= half) return true;
  return false;
}
// Is the point on a sidewalk ring around a road?
export function onSidewalk(city, x, y) {
  const half = WORLD.roadW / 2 + WORLD.sidewalkW;
  for (const rx of city.vRoads) if (Math.abs(x - rx) <= half) return true;
  for (const ry of city.hRoads) if (Math.abs(y - ry) <= half) return true;
  return false;
}
export function inWater(x) { return x >= WORLD.waterX; }
export function onBeach(x) { return x >= WORLD.beachX && x < WORLD.waterX; }

// Push a circle out of buildings and water. Returns true if it was blocked.
export function collideCircle(city, p, r) {
  let hit = false;
  for (const b of city.buildings) {
    if (p.x + r < b.x || p.x - r > b.x + b.w || p.y + r < b.y || p.y - r > b.y + b.h) continue;
    if (resolveCircleRect(p, r, b.x, b.y, b.w, b.h)) hit = true;
  }
  if (p.x + r > WORLD.waterX) { p.x = WORLD.waterX - r; hit = true; }
  if (p.x - r < 0) { p.x = r; hit = true; }
  if (p.y - r < 0) { p.y = r; hit = true; }
  if (p.y + r > WORLD.h) { p.y = WORLD.h - r; hit = true; }
  return hit;
}
// Nearest road-graph node (for traffic AI + spawning)
export function nearestNode(city, x, y) {
  let best = city.nodes[0], bd = Infinity;
  for (const n of city.nodes) {
    const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
// Random point on a road (for spawning traffic / pedestrians)
export function randomRoadPoint(city, rng) {
  if (rng() < 0.5) {
    const x = pick(rng, city.vRoads);
    return { x: x + rand(rng, -14, 14), y: rand(rng, 40, WORLD.h - 40) };
  }
  const y = pick(rng, city.hRoads);
  return { x: rand(rng, 40, WORLD.beachX - 40), y: y + rand(rng, -14, 14) };
}
