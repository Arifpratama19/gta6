// Save / load through localStorage. Progress is cash, completed jobs and the
// next mission — the world itself is rebuilt fresh on every load.

const KEY = 'solmarbay.save.v1';

export function saveGameData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGameData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function clearGameData() {
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    /* storage unavailable */
  }
}
