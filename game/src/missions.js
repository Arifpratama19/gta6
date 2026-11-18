// The 5-mission story chain for Rico Vega. Stages advance monotonically:
// setStage only moves forward, so re-entering a stage (walking in and out
// of a trigger zone, re-running an update) can never strand the player or
// re-fire a stage's setup.
import { MISSIONS } from './config.js';
import { dist } from './util.js';
import { spawnGunmen } from './combat.js';
import { addBanner } from './state.js';
import { missionDone, pickup } from './audio.js';

export function startMission(st, index) {
  const m = MISSIONS[index];
  st.missionIndex = index;
  st.missionStage = 0;
  st.missionDone = false;
  st.missionData = { checkpoint: 0, gotVault: false };
  st.objective = m.brief;
  if (m.kind === 'steal-deliver') {
    // Park the Comet GT on the casino strip road, in front of the casino.
    st.cars = st.cars.filter((c) => c.id !== 'comet');
    st.cars.push({
      id: 'comet',
      model: 'Comet GT',
      color: '#f1c40f',
      x: 1100,
      y: 240,
      angle: 0,
      speed: 0,
      traffic: false,
      cop: false,
      hp: 100,
    });
  }
  if (m.kind === 'checkpoints') {
    // Hot pursuit: the heat is on from the start of this mission.
    st.wanted = 3;
    st.crimeTimer = 0;
    st.decayTimer = 0;
  }
  if (m.kind === 'kill') {
    spawnGunmen(st, m.target.x, m.target.y, m.gunmen);
  }
}

// Advance to `stage` only if it is ahead of the current stage.
export function setStage(st, stage) {
  if (stage > st.missionStage) st.missionStage = stage;
}

export function currentTarget(st) {
  const m = MISSIONS[st.missionIndex];
  if (!m) return null;
  if (m.kind === 'steal-deliver') {
    return st.missionStage === 0
      ? { x: m.target.x, y: m.target.y, name: m.targetName }
      : { x: m.deliver.x, y: m.deliver.y, name: m.deliverName };
  }
  if (m.kind === 'checkpoints') {
    const cp = m.checkpoints[st.missionData.checkpoint] || m.checkpoints[m.checkpoints.length - 1];
    return { x: cp.x, y: cp.y, name: 'Checkpoint ' + (st.missionData.checkpoint + 1) };
  }
  if (m.kind === 'grab-escape') {
    return st.missionStage === 0
      ? { x: m.target.x, y: m.target.y, name: m.targetName }
      : { x: m.escape.x, y: m.escape.y, name: m.escapeName };
  }
  return { x: m.target.x, y: m.target.y, name: m.targetName };
}

function completeMission(st) {
  const m = MISSIONS[st.missionIndex];
  st.money += m.reward;
  st.missionDone = true;
  missionDone();
  pickup();
  addBanner(st, 'Mission complete: ' + m.name, '+$' + m.reward + '  —  Total $' + st.money);
  const next = st.missionIndex + 1;
  if (next >= MISSIONS.length) {
    st.mode = 'complete';
    st.objective = 'Story complete. Free roam — Solmar Bay is yours.';
    addBanner(st, 'SOLMAR BAY — STORY COMPLETE', 'You own the coast now. Free roam.');
  } else {
    startMission(st, next);
  }
}

export function updateMissions(st, dt) {
  if (st.mode !== 'playing') return;
  const m = MISSIONS[st.missionIndex];
  if (!m) return;
  const p = st.player;
  if (m.kind === 'reach') {
    if (p.inCar && dist(p.x, p.y, m.target.x, m.target.y) < 75) completeMission(st);
  } else if (m.kind === 'steal-deliver') {
    if (st.missionStage === 0 && p.inCar === 'comet') {
      setStage(st, 1);
      st.objective = 'Deliver the Comet GT to the Chop Shop.';
    }
    if (st.missionStage === 1 && p.inCar === 'comet' && dist(p.x, p.y, m.deliver.x, m.deliver.y) < 85) {
      completeMission(st);
    }
  } else if (m.kind === 'kill') {
    if (st.gunmen.length === 0) completeMission(st);
  } else if (m.kind === 'checkpoints') {
    const cp = m.checkpoints[st.missionData.checkpoint];
    if (cp && dist(p.x, p.y, cp.x, cp.y) < 75) {
      st.missionData.checkpoint += 1;
      pickup();
      if (st.missionData.checkpoint >= m.checkpoints.length) {
        completeMission(st);
      } else {
        addBanner(st, 'Checkpoint ' + st.missionData.checkpoint + ' cleared', 'Next: checkpoint ' + (st.missionData.checkpoint + 1));
      }
    }
  } else if (m.kind === 'grab-escape') {
    if (st.missionStage === 0 && dist(p.x, p.y, m.target.x, m.target.y) < 65) {
      setStage(st, 1);
      st.missionData.gotVault = true;
      st.objective = 'Vault hit! Get to the boat at the marina.';
      addBanner(st, 'Vault hit!', 'Get to the marina boat — fast.');
    }
    if (st.missionStage === 1 && dist(p.x, p.y, m.escape.x, m.escape.y) < 85) {
      completeMission(st);
    }
  }
}
