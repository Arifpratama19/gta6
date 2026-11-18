// util.js — small math + RNG helpers used by every system.
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
export function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
// shortest signed turn from angle a toward angle b, in (-PI, PI]
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
// Seeded RNG (mulberry32) so the city is the same every run.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function rand(rng, a, b) { return a + rng() * (b - a); }
// circle vs axis-aligned rect overlap (for building collision)
export function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  return dist2(cx, cy, nx, ny) < r * r;
}
// push a circle out of a rect; returns true if it overlapped
export function resolveCircleRect(p, r, rx, ry, rw, rh) {
  const nx = clamp(p.x, rx, rx + rw), ny = clamp(p.y, ry, ry + rh);
  const dx = p.x - nx, dy = p.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    p.x = nx + (dx / d) * r;
    p.y = ny + (dy / d) * r;
  } else {
    // centre inside the rect: push out along the smallest penetration axis
    const left = p.x - rx, right = rx + rw - p.x, top = p.y - ry, bot = ry + rh - p.y;
    const m = Math.min(left, right, top, bot);
    if (m === left) p.x = rx - r;
    else if (m === right) p.x = rx + rw + r;
    else if (m === top) p.y = ry - r;
    else p.y = ry + rh + r;
  }
  return true;
}
// oriented box (car) vs circle test, for car-vs-pedestrian / car-vs-player hits
export function circleOBB(cx, cy, r, bx, by, ang, hw, hh) {
  const dx = cx - bx, dy = cy - by;
  const c = Math.cos(-ang), s = Math.sin(-ang);
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  const qx = clamp(lx, -hw, hw), qy = clamp(ly, -hh, hh);
  return dist2(lx, ly, qx, qy) < r * r;
}
