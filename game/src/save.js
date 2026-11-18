// save.js — persist Rico's progress in localStorage: money, mission,
// health and position. Nothing leaves the browser.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const p = state.player;
    const data = {
      version: 1,
      money: state.money,
      mission: state.mission,
      hp: Math.round(p.hp),
      x: Math.round(p.x),
      y: Math.round(p.y),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // Storage may be unavailable; the game still plays.
  }
}

export function hasSave() {
  return loadGame() !== null;
}
