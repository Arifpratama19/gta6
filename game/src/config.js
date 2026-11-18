// SOLMAR BAY — Vice Coast Stories
// config.js — world constants, palette, tuning. All values in world units (px) / seconds.
export const WORLD = {
  w: 2600,          // world width
  h: 2000,          // world height
  roadGap: 320,     // distance between road centerlines
  roadW: 64,        // road width
  sidewalkW: 14,    // sidewalk width beside roads
  beachX: 2180,     // x where sand starts (east edge)
  waterX: 2380,     // x where ocean starts
};

export const PALETTE = {
  ocean: "#1b7fb8",
  oceanDeep: "#14639a",
  sand: "#e8d39a",
  sandWet: "#dcc27e",
  grass: "#7fae5a",
  grassDry: "#a8b06a",
  road: "#3a3d46",
  roadLine: "#e8e4c8",
  sidewalk: "#9aa0a8",
  buildingRoof: ["#c96f4a", "#b85c5c", "#d9a05b", "#7fa8a0", "#8a7fb8", "#c98a5b", "#6a9a7a", "#b8b0a0"],
  buildingWall: ["#a85a3a", "#96484a", "#b8864a", "#6a8a84", "#6f6596", "#a87048", "#557a62", "#968e80"],
  carColors: ["#d43d2a", "#2a6fd4", "#e8c832", "#3aa84f", "#e8e8e8", "#222831", "#d47a2a", "#7a3ad4", "#2ad4c8"],
  policeCar: "#1a2a4a",
  player: "#f2c14e",
  pedColors: ["#e87a5d", "#5d8ae8", "#7ae85d", "#e85db8", "#8a5de8", "#e8b25d"],
};

export const PLAYER = {
  walkSpeed: 200,
  runSpeed: 300,
  radius: 13,
  health: 100,
  startMoney: 500,
};

export const CAR = {
  accel: 420,        // forward accel px/s^2
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 520,     // px/s
  maxReverse: 180,
  turnRate: 2.6,     // rad/s at full steer (scaled by speed)
  grip: 6.0,         // lateral velocity damping
  length: 46,
  width: 22,
  health: 100,
};

export const WANTED = {
  decayTime: 14,     // seconds without crime/sight before stars drop by 1
  maxStars: 5,
  policePerStar: [0, 1, 2, 3, 4, 6],
  copSpeed: 540,
};

export const COMBAT = {
  pistolDamage: 34,
  pistolRange: 420,
  pistolRate: 0.22,  // seconds between shots
  bulletSpeed: 900,
  enemyHealth: 70,
  enemyDamage: 9,
  enemyRange: 340,
  enemyRate: 0.9,
};

export const MISSIONS = [
  { id: 1, title: "Welcome to Solmar", pay: 200,
    brief: "Rico Vega is back in town. Drive to the yellow marker at the Marina to meet your contact." },
  { id: 2, title: "Wheels", pay: 400,
    brief: "The crew needs wheels. Steal the red coupe parked near the Pier and deliver it to the garage." },
  { id: 3, title: "Beach Party", pay: 600,
    brief: "Rivals are muscling in on the beach. Go to the sand and take out the 4 gang members." },
  { id: 4, title: "Hot Pursuit", pay: 800,
    brief: "The heat is on. Lose the 3-star wanted level, then reach the safehouse on the north side." },
  { id: 5, title: "The Big Score", pay: 1500,
    brief: "One last job: hit the Solmar Bank, grab the cash, and escape the 4-star dragnet to the marina." },
];

export const SAVE_KEY = "solmarbay.save.v1";
