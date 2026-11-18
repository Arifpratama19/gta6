// SOLMAR BAY — Vice Coast Stories: tuning constants and mission data.
// All numbers are in world units (1 unit = 1 px at zoom 1) unless noted.
export const WORLD = { w: 2400, h: 1800 };

export const ROADS_X = [300, 700, 1100, 1500, 1900];
export const ROADS_Y = [240, 600, 960, 1320];
export const ROAD_W = 96;

export const BEACH_X = 2100; // sand starts here
export const WATER_X = 2250; // ocean starts here

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  runSpeed: 300,
  hp: 100,
  enterRadius: 52,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 700,
  reverseAccel: 240,
  maxSpeed: 520,
  maxReverse: 180,
  steer: 3.6,
  drag: 1.6,
};

export const PISTOL = {
  damage: 34,
  bulletSpeed: 950,
  range: 560,
  fireDelay: 0.22,
  spread: 0.02,
};

export const GUNMAN = { hp: 100, radius: 15, shootDelay: 1.4, damage: 8, range: 420 };

export const COP = { speed: 430, ramDamage: 0, bustRadius: 42, maxCount: 5 };

export const WANTED = {
  decayIdleSec: 20, // seconds without a crime before stars start falling
  decayStepSec: 9, // seconds per star lost while idle
  stealCar: 1,
  killPed: 1,
  killCop: 2,
  killGunman: 0, // gunmen are fair game during the pier mission
};

export const SITES = {
  motel: { x: 700, y: 600, name: 'Motel Solana' },
  casino: { x: 1100, y: 240, name: 'Casino Marbella' },
  chopShop: { x: 1900, y: 1320, name: 'Chop Shop' },
  hospital: { x: 300, y: 1320, name: 'Hospital' },
  marina: { x: 2050, y: 1500, name: 'Marina' },
  pier: { x: 2290, y: 900, name: 'Pier' },
};

// Mission chain. Targets are all on roads or the pier so nothing can be
// blocked by a building. reward is added to the player's money.
export const MISSIONS = [
  {
    id: 0,
    name: 'First Wheels',
    brief: 'Rico needs wheels. Steal a car and drive to the Motel Solana.',
    target: { x: 700, y: 600 },
    targetName: 'Motel Solana',
    reward: 200,
    kind: 'reach',
    needsCar: true,
  },
  {
    id: 1,
    name: 'The Comet GT',
    brief: 'A Comet GT is parked on the casino strip. Steal it and deliver it to the Chop Shop.',
    target: { x: 1100, y: 240 },
    targetName: 'Comet GT (casino strip)',
    reward: 350,
    kind: 'steal-deliver',
    carModel: 'Comet GT',
    deliver: { x: 1900, y: 1320 },
    deliverName: 'Chop Shop',
  },
  {
    id: 2,
    name: 'Pier Shootout',
    brief: 'Rival crew on the pier. Take out all four gunmen.',
    target: { x: 2290, y: 900 },
    targetName: 'Pier',
    reward: 500,
    kind: 'kill',
    gunmen: 4,
  },
  {
    id: 3,
    name: 'Hot Pursuit',
    brief: 'The heat is on. Hit all three checkpoints while the cops chase you.',
    target: { x: 300, y: 240 },
    targetName: 'Checkpoint 1',
    reward: 700,
    kind: 'checkpoints',
    checkpoints: [
      { x: 300, y: 240 },
      { x: 1900, y: 600 },
      { x: 1100, y: 1320 },
    ],
  },
  {
    id: 4,
    name: 'The Vault',
    brief: 'Hit the casino vault, then get to the boat at the marina. Do not get caught.',
    target: { x: 1100, y: 240 },
    targetName: 'Casino vault',
    reward: 1000,
    kind: 'grab-escape',
    escape: { x: 2050, y: 1500 },
    escapeName: 'Marina boat',
  },
];

export const SAVE_KEY = 'solmar-bay-save-v1';
export const START_MONEY = 500;
