// Game state: one plain object, created fresh by newGame(). Everything the
// loop, the renderer and the missions read lives here.
import { WORLD, START_MONEY, PLAYER, MISSIONS } from './config.js';
import { buildCity, randomRoadPoint } from './city.js';
import { mulberry32 } from './util.js';

export function newGame(seed) {
  const rng = mulberry32(seed || 1337);
  const city = buildCity(seed || 1337);
  const st = {
    seed: seed || 1337,
    rng,
    city,
    mode: 'playing', // title | playing | paused | busted | wasted | complete
    time: 0,
    money: START_MONEY,
    hp: PLAYER.hp,
    wanted: 0,
    crimeTimer: 0, // seconds since the last crime
    decayTimer: 0,
    missionIndex: 0,
    missionStage: 0, // per-mission stage; dedupe guards re-entry
    missionDone: false,
    missionData: {},
    player: {
      x: 700,
      y: 700,
      angle: -Math.PI / 2,
      speed: 0,
      inCar: null, // car id or null
      fireTimer: 0,
      walkFrame: 0,
    },
    cars: [],
    peds: [],
    cops: [], // rebuilt every tick from live cop cars
    bullets: [],
    particles: [],
    gunmen: [],
    camera: { x: 700, y: 700 },
    spawnCooldown: 0, // seconds until the next police spawn is allowed
    bustGrace: 0, // seconds after exiting a car during which cops cannot bust
    bustDwell: 0, // seconds a cop has stayed within bust radius
    banner: null, // {text, sub, t}
    objective: MISSIONS[0].brief,
    flash: 0,
    stats: { shots: 0, hits: 0, kills: 0, carsStolen: 0 },
  };
  seedTraffic(st, rng);
  return st;
}

const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2c3e50', '#fd79a8', '#00cec9'];
const CAR_MODELS = ['Solano', 'Bison', 'Comet GT', 'Vortex', 'Mamba', 'Dune', 'Falcon', 'Panto'];

function seedTraffic(st, rng) {
  // Traffic cars cruising the roads.
  for (let i = 0; i < 18; i++) {
    const p = randomRoadPoint(rng);
    const horizontal = rng() < 0.5;
    st.cars.push({
      id: 't' + i,
      model: CAR_MODELS[i % CAR_MODELS.length],
      color: CAR_COLORS[i % CAR_COLORS.length],
      x: p.x,
      y: p.y,
      angle: horizontal ? (rng() < 0.5 ? 0 : Math.PI) : rng() < 0.5 ? -Math.PI / 2 : Math.PI / 2,
      speed: 90 + rng() * 90,
      traffic: true,
      cop: false,
      hp: 100,
    });
  }
  // The player's starter car, parked close by on the same road.
  st.cars.push({
    id: 'starter',
    model: 'Solano',
    color: '#e74c3c',
    x: 738,
    y: 700,
    angle: -Math.PI / 2,
    speed: 0,
    traffic: false,
    cop: false,
    hp: 100,
  });
  // Pedestrians wandering the sidewalks.
  for (let i = 0; i < 24; i++) {
    const p = randomRoadPoint(rng);
    st.peds.push({
      id: 'p' + i,
      x: p.x + (rng() - 0.5) * 40,
      y: p.y + (rng() - 0.5) * 40,
      angle: rng() * Math.PI * 2,
      speed: 30 + rng() * 40,
      color: ['#f5d76e', '#e67e22', '#8e44ad', '#16a085', '#c0392b', '#2c3e50'][i % 6],
      hp: 100,
      wander: rng() * 4,
    });
  }
}

export function addBanner(st, text, sub) {
  st.banner = { text, sub: sub || '', t: 3.2 };
}
