// Save / load via localStorage. A completed save restores free-roam
// `complete` mode instead of restarting the final mission.
import { SAVE_KEY } from './config.js';
import { startMission } from './missions.js';

export function saveGame(st) {
  try {
    const data = {
      v: 1,
      money: st.money,
      hp: st.hp,
      missionIndex: st.missionIndex,
      mode: st.mode,
      x: st.player.x,
      y: st.player.y,
      wanted: st.wanted,
      time: st.time,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

// Apply a loaded save to a fresh state. Returns the mode to enter.
export function applySave(st, d) {
  st.money = d.money;
  st.hp = d.hp;
  st.player.x = d.x;
  st.player.y = d.y;
  st.player.inCar = null;
  st.wanted = 0;
  st.crimeTimer = 0;
  st.camera.x = d.x;
  st.camera.y = d.y;
  if (d.mode === 'complete' || d.missionIndex >= 5) {
    st.missionIndex = 4;
    st.missionStage = 0;
    st.missionData = { checkpoint: 0, gotVault: false };
    st.mode = 'complete';
    st.objective = 'Story complete. Free roam — Solmar Bay is yours.';
  } else {
    startMission(st, d.missionIndex);
    st.mode = 'playing';
  }
  return st.mode;
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {}
}
