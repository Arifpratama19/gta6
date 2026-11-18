// SOLMAR BAY — small shared helpers: a seeded random stream so the city is
// the same every load, maths helpers, and procedural canvas textures (no
// image files, so the game loads with zero network requests).

// mulberry32: a tiny deterministic PRNG.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
// Shortest signed angle difference, in radians.
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function angleLerp(a, b, t) { return a + angleDiff(a, b) * clamp(t, 0, 1); }
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const randRange = (rng, lo, hi) => lo + rng() * (hi - lo);

// Make a canvas texture from a painter callback. Used for building windows,
// road markings, sand and the ocean — all drawn in code, no files.
export function canvasTexture(THREE, w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// A building facade: lit and dark windows on a tinted wall.
export function buildingTexture(THREE, rng, base) {
  return canvasTexture(THREE, 128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
    const cols = 6, rows = 12;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = rng() < 0.42;
        g.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : 'rgba(20,28,44,0.85)';
        g.fillRect(8 + x * 20, 16 + y * 20, 13, 12);
      }
    }
  });
}

// Asphalt with a dashed centre line running along the road's length
// (the texture's U axis), tiled along the road.
export function roadTexture(THREE) {
  return canvasTexture(THREE, 128, 128, (g, w, h) => {
    g.fillStyle = '#2b2f36'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 2);
    // Centre dashes along the length.
    g.fillStyle = '#e8c33c';
    g.fillRect(8, h / 2 - 2, 44, 4); g.fillRect(76, h / 2 - 2, 44, 4);
    // Edge lines along the length.
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(0, 4, w, 3); g.fillRect(0, h - 7, w, 3);
  });
}

// Sand with speckles, and a soft blue-green ocean with a wave sheen.
export function sandTexture(THREE) {
  return canvasTexture(THREE, 128, 128, (g, w, h) => {
    g.fillStyle = '#e8d29a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(190,160,110,0.5)' : 'rgba(255,244,210,0.5)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

export function waterTexture(THREE) {
  return canvasTexture(THREE, 128, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2fa8c9'); grad.addColorStop(1, '#1668a0');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
    for (let y = 10; y < h; y += 22) {
      g.beginPath();
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.2 + y) * 3);
      g.stroke();
    }
  });
}
