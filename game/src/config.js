// SOLMAR BAY — shared tuning, city layout and palette.
// One job: every number the rest of the game agrees on.

export const WORLD = {
  // City grid: BLOCKS x BLOCKS blocks, each BLOCK metres wide, roads between them.
  blocks: 9,
  block: 34,
  road: 14,
  // Full span of the drivable grid, centred on (0,0).
  get span() { return this.blocks * (this.block + this.road) + this.road; },
  get half() { return this.span / 2; },
  // The beach and ocean sit south of the grid (negative z is north).
  beachDepth: 46,
  oceanDepth: 220,
};

export const PLAYER = {
  walkSpeed: 7,
  sprintSpeed: 11,
  accel: 26,
  maxHealth: 100,
  startCash: 250,
};

export const CAR = {
  accel: 26,
  brake: 42,
  reverse: 14,
  maxSpeed: 46,      // ~103 mph at the speedometer's scale
  maxReverse: 12,
  steer: 1.9,
  grip: 6.5,
  handbrakeGrip: 2.2,
};

export const WANTED = {
  // Heat decays when the player stays out of sight of police.
  decayPerSecond: 0.055,
  maxStars: 5,
  // How many police cars hunt the player at each star level.
  policeForStars: [0, 1, 2, 3, 4, 6],
  // How far a crime is "seen" (metres).
  witnessRadius: 55,
};

export const TRAFFIC = { cars: 14, pedestrians: 26 };

export const DISTRICTS = [
  { name: 'Marina District', x0: -220, z0: -220, x1: -40, z1: -40 },
  { name: 'Old Town', x0: -40, z0: -220, x1: 140, z1: -40 },
  { name: 'Neon Row', x0: 140, z0: -220, x1: 260, z1: -40 },
  { name: 'Palm Heights', x0: -220, z0: -40, x1: -40, z1: 140 },
  { name: 'Downtown Solmar', x0: -40, z0: -40, x1: 140, z1: 140 },
  { name: 'Casino Strip', x0: 140, z0: -40, x1: 260, z1: 140 },
  { name: 'Harbor Point', x0: -220, z0: 140, x1: -40, z1: 260 },
  { name: 'South Beach', x0: -40, z0: 140, x1: 260, z1: 260 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return z > WORLD.half ? 'South Beach' : 'Solmar Bay';
}

// Sun-soaked sunset palette: warm asphalt, sand, teal sea, neon signs.
export const PALETTE = {
  skyTop: 0x2b1055,
  skyHorizon: 0xff7e2d,
  fog: 0xe88a4a,
  sun: 0xffd9a0,
  asphalt: 0x40404e,
  sidewalk: 0x9a938a,
  sand: 0xe8c98f,
  sea: 0x0e6f8e,
  building: [0xf2d8a7, 0xe8a87c, 0xd9c1e8, 0xa8d8e8, 0xf7ede2, 0xc9b8a3, 0xffd6d6, 0xb8e6b8],
  neon: [0xff2e88, 0x00e5ff, 0xffe66d, 0x7dff5e, 0xff9f1c],
  carPaint: [0xd7263d, 0x1b9aaa, 0xffc300, 0x3a86ff, 0x8338ec, 0xf8f9fa, 0x22223b, 0x06d6a0, 0xef476f, 0x118ab2],
};

export const SAVE_KEY = 'solmar-bay-save-v1';
export const GAME_TITLE = 'SOLMAR BAY';
