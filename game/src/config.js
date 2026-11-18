// config.js — every tunable number for SOLMAR BAY, in one place.
export const WORLD = { w: 2400, h: 1800 };
export const ROAD_STEP = 240; // roads form a grid every 240 units
export const ROAD_W = 64; // road width
export const BEACH_X = 2080; // sand starts here; ocean east of it
export const OCEAN_X = 2200; // water starts here
export const CITY_SEED = 20261118;

export const PLAYER = {
  radius: 14,
  walk: 235,
  sprint: 345,
  hp: 100,
  enterRange: 78,
};

export const CAR = {
  accel: 460,
  brake: 760,
  maxSpeed: 660,
  reverseMax: 190,
  turnRate: 2.7,
  grip: 3.2,
  radius: 22,
  trafficSpeed: 150,
};

export const POLICE = {
  maxActive: 3,
  spawnGap: 2.4,
  spawnMin: 420,
  spawnMax: 640,
  ramDamage: 5,
  bustRange: 46,
  chaseSpeed: 620,
};

export const COMBAT = {
  pistolDamage: 30,
  pistolRate: 0.24,
  bulletSpeed: 950,
  bulletLife: 0.9,
  gunmanHp: 60,
  gunmanDamage: 9,
  gunmanRange: 520,
  gunmanShotGap: 1.35,
};

export const WANTED = {
  steal: 2,
  shoot: 1,
  hitPed: 1,
  decaySeconds: 26,
  fine: 150,
};

export const MISSION_REWARDS = [200, 350, 500, 700, 1000];
export const START_MONEY = 500;
export const SAVE_KEY = 'solmar-bay-save-v1';

export const PALETTE = {
  grass: '#7fae5a',
  ground: '#9db98a',
  road: '#3d3a38',
  roadLine: '#e8d44d',
  sidewalk: '#b9b3a4',
  sand: '#e8d29a',
  ocean: '#2e7f9e',
  oceanDeep: '#1d5f7d',
  buildingRoof: ['#d96b5f', '#e8a34c', '#7fa8c9', '#c9b458', '#9a7fc9', '#6fb08a'],
  buildingWall: ['#f2e3c8', '#e8d5b0', '#dfe8ee', '#f5d9c2'],
  palm: '#3f8f4f',
  carColors: ['#d94f3d', '#3d7fd9', '#e8c53d', '#7fd94f', '#c9c9c9', '#8a5fd9', '#e87f3d'],
  copBlue: '#2b4fd9',
  copWhite: '#f2f2f2',
};
