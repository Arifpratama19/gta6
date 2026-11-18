// input.js — keyboard + mouse state, polled once per frame.
export const keys = Object.create(null);
export const mouse = { x: 0, y: 0, down: false, clicked: false, wx: 0, wy: 0 };

const KEYMAP = {
  KeyW: "up", ArrowUp: "up",
  KeyS: "down", ArrowDown: "down",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
  ShiftLeft: "run", ShiftRight: "run",
  KeyE: "enter",
  KeyM: "mute",
  KeyP: "pause", Escape: "pause",
  Space: "brake",
};

export function initInput(canvas) {
  window.addEventListener("keydown", (e) => {
    const a = KEYMAP[e.code];
    if (a) { keys[a] = true; if (a === "up" || a === "down" || a === "left" || a === "right" || a === "brake") e.preventDefault(); }
    if (e.code === "KeyE") keys._enterPressed = true;
    if (e.code === "KeyM") keys._mutePressed = true;
    if (e.code === "KeyP" || e.code === "Escape") keys._pausePressed = true;
  });
  window.addEventListener("keyup", (e) => {
    const a = KEYMAP[e.code];
    if (a) keys[a] = false;
  });
  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) mouse.down = false;
  });
  window.addEventListener("blur", () => {
    for (const k in keys) keys[k] = false;
    mouse.down = false;
  });
}

// edge-triggered helpers: call once per frame, then clear at frame end
export function consumeEnter() { const v = !!keys._enterPressed; keys._enterPressed = false; return v; }
export function consumeMute() { const v = !!keys._mutePressed; keys._mutePressed = false; return v; }
export function consumePause() { const v = !!keys._pausePressed; keys._pausePressed = false; return v; }
export function consumeClick() { const v = mouse.clicked; mouse.clicked = false; return v; }
