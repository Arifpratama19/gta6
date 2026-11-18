// Procedural coastal city for SOLMAR BAY. Seeded, so every run builds the
// same city. Roads form a grid; the east edge is beach and ocean; the pier
// reaches into the water; named sites sit on road frontage.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, BEACH_X, WATER_X, SITES } from './config.js';
import { mulberry32, pick } from './util.js';

const PALETTES = [
  ['#e8b48a', '#d99a6c', '#c98a5e'],
  ['#9db8c9', '#7fa3b5', '#b5c9d4'],
  ['#c9a89d', '#b3928a', '#d4b8ac'],
  ['#a8b89a', '#8ba37e', '#c2cba8'],
];

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  // City blocks between roads.
  const xs = [0, ...ROADS_X, WORLD.w];
  const ys = [0, ...ROADS_Y, WORLD.h];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + ROAD_W / 2 + 14;
      const x1 = xs[bi + 1] - ROAD_W / 2 - 14;
      const y0 = ys[bj] + ROAD_W / 2 + 14;
      const y1 = ys[bj + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // Skip the beach strip: no buildings east of the beach line.
      if (x0 > BEACH_X - 60) continue;
      const count = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < count; k++) {
        const w = 60 + rng() * 90;
        const h = 60 + rng() * 90;
        const bx = x0 + rng() * Math.max(1, x1 - x0 - w);
        const by = y0 + rng() * Math.max(1, y1 - y0 - h);
        // Keep named sites clear of buildings.
        let blocked = false;
        for (const s of Object.values(SITES)) {
          if (Math.abs(bx + w / 2 - s.x) < 120 && Math.abs(by + h / 2 - s.y) < 120) blocked = true;
        }
        if (blocked) continue;
        const pal = pick(rng, PALETTES);
        buildings.push({
          x: bx,
          y: by,
          w,
          h,
          color: pal[Math.floor(rng() * pal.length)],
          roof: rng() < 0.5,
          tall: rng() < 0.25,
        });
      }
      // A few palm trees per block.
      const nt = Math.floor(rng() * 4);
      for (let k = 0; k < nt; k++) {
        trees.push({ x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0) });
      }
    }
  }
  return { buildings, trees, seed };
}

export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

export function pointInBuilding(city, x, y, pad) {
  const p = pad || 0;
  for (const b of city.buildings) {
    if (x > b.x - p && x < b.x + b.w + p && y > b.y - p && y < b.y + b.h + p) return b;
  }
  return null;
}

// A random point on a road. Samples directly from road coordinates, so it
// always succeeds; retries with fresh randomness and never returns null.
export function randomRoadPoint(rng) {
  for (let attempt = 0; attempt < 200; attempt++) {
    let x;
    let y;
    if (rng() < 0.5) {
      x = pick(rng, ROADS_X) + (rng() - 0.5) * (ROAD_W - 24);
      y = rng() * WORLD.h;
    } else {
      y = pick(rng, ROADS_Y) + (rng() - 0.5) * (ROAD_W - 24);
      x = rng() * (BEACH_X - 40);
    }
    x = Math.max(20, Math.min(WORLD.w - 20, x));
    y = Math.max(20, Math.min(WORLD.h - 20, y));
    if (isOnRoad(x, y)) return { x, y };
  }
  // Unreachable in practice (the sampler only produces road points), but
  // guarantee a valid point rather than ever returning null.
  return { x: ROADS_X[1], y: ROADS_Y[1] };
}

export function randomSpawnPoint(rng, city, minDistFrom) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const p = randomRoadPoint(rng);
    if (minDistFrom && Math.hypot(p.x - minDistFrom.x, p.y - minDistFrom.y) < 260) continue;
    return p;
  }
  return randomRoadPoint(rng);
}
