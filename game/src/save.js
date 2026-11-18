// SOLMAR BAY — saving: the player's cash, health, mission progress, position
// and wanted level live in localStorage, so CONTINUE picks up where the last
// session left off.

const KEY = 'solmar-bay-save-v1';

export function hasSave() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch (err) {
    return false;
  }
}

export function saveGame(state) {
  try {
    const data = {
      cash: Math.round(state.player.cash),
      health: Math.round(state.player.health),
      armor: Math.round(state.player.armor),
      missionIndex: state.missions.index,
      missionStep: state.missions.stepIndex,
      storyDone: state.missions.done,
      x: state.player.pos.x,
      z: state.player.pos.z,
      heading: state.player.heading,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (err) { /* private mode */ }
}
