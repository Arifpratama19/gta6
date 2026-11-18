// SOLMAR BAY — saving: the whole run fits in one localStorage row.
// One job: write and read the save, nothing else.

import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      cash: state.cash,
      health: state.health,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      playerX: state.playerX,
      playerZ: state.playerZ,
      playerHeading: state.playerHeading,
      totalEarned: state.totalEarned,
      carsStolen: state.carsStolen,
      rivalsWrecked: state.rivalsWrecked,
      playSeconds: state.playSeconds,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (_) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (_) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* storage unavailable */ }
}

export function saveSummary(save) {
  if (!save) return 'No save yet — a fresh start in Solmar Bay.';
  const date = new Date(save.savedAt);
  const when = isNaN(date) ? 'earlier' : date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `Saved ${when} — $${save.cash.toLocaleString('en-US')}, ${save.missionsDone} of 5 jobs done.`;
}
