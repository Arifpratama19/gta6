// save.js — localStorage save / load for SOLMAR BAY.
import { SAVE_KEY } from "./config.js";

export function saveGame(state) {
  try {
    const p = state.player;
    const data = {
      v: 1,
      money: Math.floor(p.money),
      health: p.health,
      x: Math.round(p.x),
      y: Math.round(p.y),
      missionIndex: state.mission.index,
      wanted: 0,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
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
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
