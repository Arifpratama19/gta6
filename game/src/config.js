// SOLMAR BAY — world constants, vehicle roster and the story mission chain.
// Every number the rest of the game shares lives here so tuning is one place.

export const WORLD = {
  seed: 20261118,
  blockSize: 42,          // one city block, edge to edge
  roadWidth: 13,          // road surface between blocks
  grid: 9,                // 9 x 9 blocks
  beachZ: 236,            // sand starts here (south edge)
  oceanZ: 268,            // water starts here
  pierZ: 300,             // the pier reaches into the sea
  cityHalf: 240,          // playable bounds on x / north z
  gravity: 26,
};

// A block's pitch: block + road.
export const PITCH = WORLD.blockSize + WORLD.roadWidth;

// Road centre lines, in world units, from west to east / north to south.
// The grid stops before the beach: no road runs across the sand.
export function roadLines() {
  const lines = [];
  const half = (WORLD.grid * PITCH) / 2;
  for (let i = 0; i <= WORLD.grid; i++) {
    const v = -half + i * PITCH + WORLD.roadWidth / 2;
    if (v < WORLD.beachZ - WORLD.roadWidth) lines.push(v);
  }
  return lines;
}

// Districts, named by quadrant, for the HUD clock line.
export function districtAt(x, z) {
  if (z > 190) return 'Ocean Drive';
  if (z > 90) return 'Marina District';
  if (x < -60) return 'Westside';
  if (x > 60) return 'East Bay';
  if (z < -90) return 'North Hills';
  return 'Downtown';
}

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 11,
  jumpSpeed: 9.5,
  radius: 0.55,
  height: 1.8,
  maxHealth: 100,
  startCash: 250,
};

export const VEHICLES = [
  { id: 'comet',   name: 'Comet GT',      color: 0xff3b30, top: 46, accel: 26, grip: 2.6, kind: 'sport' },
  { id: 'solmar',  name: 'Solmar Sedan',  color: 0x3b82f6, top: 34, accel: 18, grip: 2.0, kind: 'sedan' },
  { id: 'taxi',    name: 'Bay Taxi',      color: 0xfacc15, top: 32, accel: 16, grip: 1.9, kind: 'taxi' },
  { id: 'van',     name: 'Cargo Van',     color: 0xe5e7eb, top: 28, accel: 13, grip: 1.6, kind: 'van' },
  { id: 'pickup',  name: 'Dune Pickup',   color: 0x22c55e, top: 36, accel: 19, grip: 2.2, kind: 'pickup' },
  { id: 'police',  name: 'SPPD Cruiser',  color: 0x111827, top: 42, accel: 24, grip: 2.5, kind: 'police' },
  { id: 'muscle',  name: 'V8 Muscle',     color: 0xa855f7, top: 44, accel: 25, grip: 2.3, kind: 'muscle' },
];

// The story: six jobs for Lucia Vega. Each mission is a list of steps; a step
// finishes when its condition is met, then the next one starts.
export const MISSIONS = [
  {
    id: 'm1', title: 'WELCOME TO SOLMAR', reward: 400,
    briefing: 'Rico is waiting at the pier bar. Go meet him — on foot or in a car.',
    steps: [
      { type: 'goto', text: 'Meet Rico at the Pier Bar', pos: [14, 258], radius: 6 },
    ],
    complete: 'Rico has a job for you. First, you need wheels.',
  },
  {
    id: 'm2', title: 'HOT WHEELS', reward: 600,
    briefing: 'Steal any car on the street and bring it to Rico\'s garage in Westside.',
    steps: [
      { type: 'enterCar', text: 'Steal a car (walk up and press E)', radius: 0 },
      { type: 'goto', text: 'Deliver the car to Rico\'s Garage', pos: [-176, -40], radius: 8, needCar: true },
    ],
    complete: 'Nice wheels. Rico knows a fence who pays for clean titles.',
  },
  {
    id: 'm3', title: 'THE PACKAGE', reward: 900,
    briefing: 'Pick up the package at the docks, then drop it at the Sunset Motel. Keep it quiet.',
    steps: [
      { type: 'goto', text: 'Pick up the package at the Docks', pos: [196, 120], radius: 6 },
      { type: 'goto', text: 'Deliver it to the Sunset Motel', pos: [-150, 150], radius: 7 },
    ],
    complete: 'Delivered clean. The client is impressed — and the cops are watching.',
  },
  {
    id: 'm4', title: 'LOSE THE HEAT', reward: 800,
    briefing: 'The drop was spotted. The SPPD is on you — lose them before they box you in.',
    steps: [
      { type: 'escape', text: 'Lose the police — get your wanted level to zero', radius: 0 },
    ],
    wanted: 2,
    complete: 'Clean. You drive like you were born here, Lucia.',
  },
  {
    id: 'm5', title: 'BANK RUN', reward: 2500,
    briefing: 'Rico\'s crew is hitting the Solmar National Bank. Grab the cash and get out — the guards are armed.',
    steps: [
      { type: 'goto', text: 'Reach the Solmar National Bank', pos: [30, -30], radius: 7 },
      { type: 'grab', text: 'Grab the cash — hold the bank (stay 20s)', pos: [30, -30], radius: 12, hold: 20 },
      { type: 'escape', text: 'Escape with the money — lose the cops', radius: 0 },
    ],
    wanted: 3,
    complete: '$2,500 richer. One last job and you are free of the debt.',
  },
  {
    id: 'm6', title: 'THE BIG SCORE', reward: 5000,
    briefing: 'The yacht "Golden Hour" leaves at dawn with the city\'s dirty money. Board it and take what is yours.',
    steps: [
      { type: 'goto', text: 'Reach the Marina and board the yacht', pos: [120, 250], radius: 8 },
      { type: 'grab', text: 'Crack the safe — hold the deck (stay 25s)', pos: [120, 250], radius: 12, hold: 25 },
      { type: 'goto', text: 'Escape to the North Hills lookout', pos: [-20, -210], radius: 9 },
    ],
    wanted: 3,
    complete: 'THE BIG SCORE IS YOURS. Solmar Bay is yours now, Lucia.',
  },
];

// Ambient side activities the player can do any time.
export const ACTIVITIES = {
  stuntJumpReward: 150,
  taxiFare: 120,
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 26,        // hidden this long at 1-2 stars to drop a star
  decaySecondsHigh: 40,    // at 3+ stars
  policePerStar: [0, 2, 3, 4, 6, 8],
  bustRadius: 2.4,
  bustHoldSeconds: 1.6,
};

export const COLORS = {
  sky: 0x87c5e8,
  fog: 0x9fc8e8,
  sand: 0xe8d29a,
  water: 0x1e7fa8,
  road: 0x2b2f36,
  sidewalk: 0x9aa0a8,
  grass: 0x6fae5e,
};
