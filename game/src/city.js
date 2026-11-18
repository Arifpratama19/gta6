// city.js — the procedural city of Solmar Bay: road grid, blocks of buildings,
// a beach and ocean on the east edge, a marina with a pier, and the landmarks
// the missions use. The layout is seeded, so it is identical on every load.
import { WORLD, ROAD_STEP, ROAD_W, BEACH_X, OCEAN_X, CITY_SEED, PALETTE } from './config.js';
import { mulberry32, rand, randInt, pick, clamp } from './util.js';

export function buildCity() {
  const rng = mulberry32(CITY_SEED);
  const roadsV = [];
  const roadsH = [];
  for (let x = ROAD_STEP / 2; x < BEACH_X; x += ROAD_STEP) roadsV.push(x);
  for (let y = ROAD_STEP / 2; y < WORLD.h; y += ROAD_STEP) roadsH.push(y);

  // Buildings fill the blocks between roads. Each block gets 1-3 buildings.
  const buildings = [];
  for (let bx = 0; bx < roadsV.length - 1; bx++) {
    for (let by = 0; by < roadsH.length - 1; by++) {
      const x0 = roadsV[bx] + ROAD_W / 2 + 14;
      const x1 = roadsV[bx + 1] - ROAD_W / 2 - 14;
      const y0 = roadsH[by] + ROAD_W / 2 + 14;
      const y1 = roadsH[by + 1] - ROAD_W / 2 - 14;
      const count = randInt(rng, 1, 3);
      for (let i = 0; i < count; i++) {
        const w = rand(rng, 46, Math.max(50, (x1 - x0) / count - 8));
        const h = rand(rng, 40, Math.max(44, y1 - y0 - 8));
        const x = rand(rng, x0, Math.max(x0 + 1, x1 - w));
        const y = rand(rng, y0, Math.max(y0 + 1, y1 - h));
        buildings.push({
          x, y, w, h,
          roof: pick(rng, PALETTE.buildingRoof),
          wall: pick(rng, PALETTE.buildingWall),
          floors: randInt(rng, 1, 4),
        });
      }
    }
  }

  // Palm trees along the beach.
  const palms = [];
  for (let i = 0; i < 46; i++) {
    palms.push({
      x: rand(rng, BEACH_X + 12, OCEAN_X - 14),
      y: rand(rng, 60, WORLD.h - 60),
      r: rand(rng, 7, 11),
    });
  }
  // A few palms in the park blocks too.
  for (let i = 0; i < 26; i++) {
    palms.push({
      x: rand(rng, 140, BEACH_X - 60),
      y: rand(rng, 140, WORLD.h - 140),
      r: rand(rng, 6, 9),
    });
  }

  const city = {
    roadsV,
    roadsH,
    buildings,
    palms,
    // Landmarks the story uses.
    motel: { x: 300, y: 300, label: 'Motel Coral' },
    chopShop: { x: 120, y: 1210, label: 'Chop Shop' },
    casino: { x: 1200, y: 360, label: 'Casino Aurora' },
    marina: { x: 2050, y: 1500, label: 'Marina' },
    pier: { x: 2160, y: 1500, label: 'Pier' },
    boat: { x: 2260, y: 1560, label: 'Speedboat' },
    hospital: { x: 600, y: 1560, label: 'Hospital' },
  };
  return city;
}

export function isOnRoad(city, x, y) {
  if (x >= BEACH_X) return false;
  for (const rx of city.roadsV) {
    if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  }
  for (const ry of city.roadsH) {
    if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  }
  return false;
}

// A point on a road, anywhere in the city.
export function randomRoadPoint(city, rng) {
  const vertical = rng() < 0.5;
  if (vertical) {
    return { x: pick(rng, city.roadsV), y: rand(rng, 80, WORLD.h - 80) };
  }
  return { x: rand(rng, 80, BEACH_X - 80), y: pick(rng, city.roadsH) };
}

// A road point at a distance between minD and maxD from (x, y).
// Retries until one is found and never returns null: the fallback widens
// the band, then takes any road point, so callers never get a dead spawn.
export function roadPointNear(city, rng, x, y, minD, maxD) {
  let lo = minD;
  let hi = maxD;
  for (let tries = 0; tries < 80; tries++) {
    const p = randomRoadPoint(city, rng);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d >= lo && d <= hi) return p;
    if (tries === 39) {
      lo = 0;
      hi = Math.max(hi, 1200);
    }
  }
  return randomRoadPoint(city, rng);
}

// Push a circle out of every building rect it overlaps. Returns true if moved.
export function resolveBuildingCollision(city, obj, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = clamp(obj.x, b.x, b.x + b.w);
    const ny = clamp(obj.y, b.y, b.y + b.h);
    const dx = obj.x - nx;
    const dy = obj.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        obj.x = nx + (dx / d) * radius;
        obj.y = ny + (dy / d) * radius;
      } else {
        obj.y = b.y - radius;
      }
    }
  }
  return hit;
}

export function insideBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}
