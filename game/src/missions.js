// missions.js — the five-mission story chain of Rico Vega. Each mission is
// a list of stages; a stage completes by arriving, stealing a named car,
// clearing gunmen, passing checkpoints, or grabbing the vault.
import { MISSION_REWARDS } from './config.js';
import { dist } from './util.js';
import { makeCar } from './vehicles.js';
import { spawnGunmen } from './people.js';

const GT_SPOT = { x: 840, y: 360 };
const PIER_GUNMEN = [
  { x: 2130, y: 1440 },
  { x: 2170, y: 1470 },
  { x: 2140, y: 1560 },
  { x: 2180, y: 1530 },
];
const CHECKPOINTS = [
  { x: 360, y: 840 },
  { x: 1200, y: 1320 },
  { x: 1800, y: 600 },
];

export const MISSIONS = [
  {
    name: 'Welcome to Solmar',
    briefing: 'Dex is waiting at the Marina with your first job. Pick up the package, then drop it at the Motel Coral.',
    stages: [
      { type: 'goto', label: 'Meet Dex at the Marina', target: { x: 2050, y: 1500, r: 90 } },
      { type: 'goto', label: 'Deliver the package to the Motel Coral', target: { x: 300, y: 300, r: 90 } },
    ],
  },
  {
    name: 'Grand Theft Comet',
    briefing: 'A gold Comet GT is parked uptown. Steal it and bring it to the Chop Shop. The cops will not like it.',
    stages: [
      { type: 'goto', label: 'Find the gold Comet GT uptown', target: { x: GT_SPOT.x, y: GT_SPOT.y, r: 110 } },
      { type: 'steal', label: 'Steal the Comet GT', target: { x: GT_SPOT.x, y: GT_SPOT.y, r: 110 } },
      { type: 'drive', label: 'Deliver the Comet GT to the Chop Shop', target: { x: 120, y: 1210, r: 90 } },
    ],
  },
  {
    name: 'Pier Pressure',
    briefing: 'Rival gunmen hold the Pier. Clear them out — your pistol is in your jacket. Stay on foot and aim true. The cops stay clear of the Pier; settle this yourselves.',
    stages: [
      { type: 'goto', label: 'Get to the Pier', target: { x: 2160, y: 1500, r: 110 } },
      { type: 'kill', label: 'Clear the gunmen on the Pier (0/4)', target: { x: 2160, y: 1500, r: 160 } },
    ],
  },
  {
    name: 'Getaway Driver',
    briefing: 'The heat is on. Get in a car and burn through all three checkpoints before the cops box you in.',
    stages: [
      { type: 'car', label: 'Get in a car', target: null },
      { type: 'checkpoints', label: 'Hit checkpoint 1 of 3', target: { x: 360, y: 840, r: 95 } },
    ],
  },
  {
    name: 'The Vault',
    briefing: 'The Casino Aurora vault is full tonight. Grab the cash, then run for the speedboat at the Marina.',
    stages: [
      { type: 'goto', label: 'Get to the Casino Aurora', target: { x: 1200, y: 360, r: 110 } },
      { type: 'grab', label: 'Grab the vault cash (press E)', target: { x: 1200, y: 360, r: 90 } },
      { type: 'escape', label: 'Escape to the speedboat at the Marina', target: { x: 2260, y: 1560, r: 90 } },
    ],
  },
];

export function currentMission(state) {
  return MISSIONS[state.mission] || null;
}
export function currentStage(state) {
  const m = currentMission(state);
  if (!m) return null;
  return m.stages[state.missionStage] || null;
}

export function missionObjective(state) {
  const m = currentMission(state);
  if (!m) return 'All missions complete — Solmar is yours.';
  const s = currentStage(state);
  if (!s) return m.name;
  if (s.type === 'kill') {
    return `Clear the gunmen on the Pier (${state.missionKills || 0}/4)`;
  }
  if (s.type === 'checkpoints') {
    const done = state.checkpointIndex || 0;
    return `Hit checkpoint ${done + 1} of ${CHECKPOINTS.length}`;
  }
  return s.label;
}

export function missionTarget(state) {
  const m = currentMission(state);
  if (!m) return null;
  const s = currentStage(state);
  if (!s) return null;
  if (s.type === 'car') return null;
  if (s.type === 'checkpoints') {
    const cp = CHECKPOINTS[state.checkpointIndex || 0];
    return cp ? { x: cp.x, y: cp.y, label: 'Checkpoint' } : null;
  }
  return s.target ? { x: s.target.x, y: s.target.y, label: s.label } : null;
}

// (Re)start a mission from its first stage, cleaning up the previous try.
export function startMission(state, index) {
  state.mission = index;
  state.missionStage = 0;
  state.missionKills = 0;
  state.checkpointIndex = 0;
  state.missionData = {};
  // Remove any leftover Comet GT so a re-entered stage can never strand
  // the player with two of them.
  state.cars = state.cars.filter((c) => c.name !== 'Comet GT');
  const m = MISSIONS[index];
  if (!m) return;
  state.hud.toast('Mission: ' + m.name);
  state.hud.setBriefing(m.briefing);
  if (index === 1) {
    const gt = makeCar({
      name: 'Comet GT',
      x: GT_SPOT.x,
      y: GT_SPOT.y,
      angle: 0,
      color: '#e8c53d',
      hp: 120,
    });
    state.cars.push(gt);
    state.missionData.gt = gt;
  }
  if (index === 2) {
    // Gunmen spawn when the player reaches the pier (stage 1), not before.
    state.missionData.gunmenSpawned = false;
  }
}

export function restartMission(state) {
  startMission(state, state.mission);
}

function advanceStage(state) {
  state.missionStage += 1;
  const m = currentMission(state);
  if (!m) return;
  if (state.missionStage >= m.stages.length) {
    completeMission(state);
    return;
  }
  const s = currentStage(state);
  if (!s) return;
  // Entering the kill stage spawns the pier gunmen.
  if (s.type === 'kill' && !state.missionData.gunmenSpawned) {
    state.missionData.gunmenSpawned = true;
    spawnGunmen(state, PIER_GUNMEN);
    state.hud.toast('Gunmen on the Pier — take them down!');
  }
  if (s.type === 'checkpoints') {
    state.checkpointIndex = 0;
    state.addWanted(3, 'The whole force is after you!');
  }
}

function completeMission(state) {
  const idx = state.mission;
  const reward = MISSION_REWARDS[idx] || 0;
  state.money += reward;
  state.audio.missionDone();
  state.audio.pickup();
  state.hud.toast(`Mission complete: ${MISSIONS[idx].name}  +$${reward}`);
  state.save();
  if (idx + 1 >= MISSIONS.length) {
    state.mission = MISSIONS.length;
    state.mode = 'complete';
    state.hud.showComplete(state.money);
    return;
  }
  startMission(state, idx + 1);
}

export function updateMission(state, dt) {
  void dt;
  const m = currentMission(state);
  if (!m || state.mode !== 'play') return;
  const s = currentStage(state);
  if (!s) return;
  const p = state.player;

  if (s.type === 'goto' || s.type === 'escape') {
    if (dist(p.x, p.y, s.target.x, s.target.y) < s.target.r) {
      if (state.mission === 0 && state.missionStage === 0) {
        state.hud.toast('Package picked up. Take it to the Motel Coral.');
        state.audio.pickup();
      }
      advanceStage(state);
    }
    return;
  }
  if (s.type === 'steal') {
    // Accept the GT by name as well as by identity, so a re-spawned GT
    // still counts if the reference was replaced.
    if (p.inCar && p.inCar.name === 'Comet GT') {
      advanceStage(state);
    }
    return;
  }
  if (s.type === 'drive') {
    if (p.inCar && p.inCar.name === 'Comet GT' && dist(p.x, p.y, s.target.x, s.target.y) < s.target.r) {
      advanceStage(state);
    }
    return;
  }
  if (s.type === 'kill') {
    if ((state.missionKills || 0) >= 4) {
      advanceStage(state);
    }
    return;
  }
  if (s.type === 'car') {
    if (p.inCar) advanceStage(state);
    return;
  }
  if (s.type === 'checkpoints') {
    const cp = CHECKPOINTS[state.checkpointIndex || 0];
    if (!cp) {
      advanceStage(state);
      return;
    }
    if (p.inCar && dist(p.x, p.y, cp.x, cp.y) < 95) {
      state.checkpointIndex += 1;
      state.audio.pickup();
      state.hud.toast(`Checkpoint ${state.checkpointIndex} of ${CHECKPOINTS.length} — keep going!`);
      if (state.checkpointIndex >= CHECKPOINTS.length) advanceStage(state);
    }
    return;
  }
  if (s.type === 'grab') {
    if (dist(p.x, p.y, s.target.x, s.target.y) < s.target.r && state.interactQueued) {
      state.interactQueued = false;
      state.money += 0;
      state.addWanted(4, 'The vault alarm is screaming!');
      state.audio.pickup();
      state.hud.toast('Vault cash grabbed! Run for the speedboat!');
      advanceStage(state);
    }
    return;
  }
}
