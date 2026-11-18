// SOLMAR BAY — shared tuning, palette and story data.
// A sun-soaked coastal city on the fictional Vice Coast. Everything here is
// original: the city, its districts, its people and its story.

export const CONFIG = {
  title: 'SOLMAR BAY',
  subtitle: 'Vice Coast Stories',
  world: {
    half: 450,            // playable half-extent in metres
    roadStep: 90,         // distance between parallel roads
    roadWidth: 15,
    beachX: 380,          // east of this the sand starts
    waterX: 430,          // east of this the ocean starts
  },
  player: {
    walkSpeed: 6.5,
    runSpeed: 11,
    health: 100,
    startCash: 500,
  },
  car: {
    accel: 26,
    brake: 42,
    reverseAccel: 14,
    maxSpeed: 46,
    maxReverse: 12,
    steer: 1.9,
    grip: 6.5,
  },
  wanted: {
    max: 5,
    decayQuietSeconds: 18,
    decayStepSeconds: 7,
  },
  traffic: { count: 16, minSpeed: 7, maxSpeed: 13 },
  peds: { count: 26 },
  palette: {
    skyTop: 0x2f7fd0,
    skyBottom: 0xffd9a0,
    sun: 0xfff1c4,
    ocean: 0x1b7fa8,
    sand: 0xe8d29a,
    asphalt: 0x2e2f36,
    sidewalk: 0x9a938a,
    grass: 0x4f9e4d,
  },
  districts: [
    { name: 'Downtown', cx: -40, cz: -120, r: 170, tall: true },
    { name: 'Neon Plaza', cx: -180, cz: 140, r: 130, tall: false },
    { name: 'Marina', cx: 300, cz: -180, r: 120, tall: false },
    { name: 'Little Havana Row', cx: -260, cz: -260, r: 120, tall: false },
    { name: 'The Docks', cx: 300, cz: 240, r: 120, tall: false },
  ],
};

// The story: Rico Vega, a getaway driver back in Solmar Bay, takes jobs from
// Mara Solis to pay off his brother's debt to the Coral Kings crew.
export const STORY = {
  hero: 'Rico Vega',
  fixer: 'Mara Solis',
  crew: 'Coral Kings',
  intro:
    'Rico Vega is back in Solmar Bay. His brother owes the Coral Kings $50,000. ' +
    'Mara Solis has five jobs that pay it off — if Rico survives them.',
};

export const MISSIONS = [
  {
    id: 'borrowed-wheels',
    title: '1 — Borrowed Wheels',
    brief: 'Mara needs wheels. Take any car on the street and bring it to the Marina.',
    reward: 300,
    steps: [
      { type: 'enterCar', text: 'Steal a car — walk up to one and press E' },
      { type: 'reach', x: 300, z: -180, radius: 14, text: 'Drive to the Marina marker' },
    ],
  },
  {
    id: 'the-drop',
    title: '2 — The Drop',
    brief: 'A package is waiting on the pier. Grab it on foot, then deliver it to Neon Plaza.',
    reward: 600,
    steps: [
      { type: 'reach', x: 330, z: 60, radius: 10, text: 'Go to the pier pickup' },
      { type: 'pickup', x: 330, z: 60, radius: 6, text: 'Pick up the package (walk into the marker)' },
      { type: 'reach', x: -180, z: 140, radius: 14, text: 'Deliver the package to Neon Plaza' },
    ],
  },
  {
    id: 'hot-pursuit',
    title: '3 — Hot Pursuit',
    brief: 'The drop was watched. The Solmar Bay PD is on you — lose them and reach the safehouse.',
    reward: 800,
    heat: 2,
    steps: [
      { type: 'reach', x: -260, z: -260, radius: 14, text: 'Reach the safehouse in Little Havana Row' },
    ],
  },
  {
    id: 'pier-showdown',
    title: '4 — Pier Showdown',
    brief: 'The Coral Kings sent shooters to the pier. Clear them out.',
    reward: 1200,
    steps: [
      { type: 'reach', x: 330, z: 60, radius: 26, text: 'Get to the pier' },
      { type: 'eliminate', count: 5, x: 330, z: 60, text: 'Defeat the Coral Kings shooters (0/5)' },
    ],
  },
  {
    id: 'the-big-score',
    title: '5 — The Big Score',
    brief: 'Last job. Grab the getaway car and run the docks blockade to the east pier.',
    reward: 2500,
    heat: 3,
    steps: [
      { type: 'enterCar', text: 'Take the getaway car at the Marina' },
      { type: 'reach', x: 330, z: 240, radius: 16, text: 'Break through to the Docks pier' },
    ],
  },
];

export const CAR_COLORS = [
  0xd7263d, 0x1b9aaa, 0xf4d35e, 0x3a86ff, 0x8338ec, 0xff6d00,
  0x06d6a0, 0xef476f, 0x118ab2, 0x8ac926, 0xe0e0e0, 0x222222,
];

export const PED_SHIRTS = [
  0xe63946, 0xf4a261, 0x2a9d8f, 0xe9c46a, 0x6d28d9, 0xef476f,
  0x118ab2, 0xffffff, 0x43aa8b, 0xf3722c, 0x577590, 0x90be6d,
];

export const CONTROLS = [
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Look around (click to lock)'],
  ['Shift', 'Sprint'],
  ['E', 'Enter / exit car'],
  ['Left click', 'Shoot'],
  ['Space', 'Handbrake / jump'],
  ['R', 'Radio on / off'],
  ['M', 'Mute sound'],
  ['Esc / P', 'Pause'],
];
