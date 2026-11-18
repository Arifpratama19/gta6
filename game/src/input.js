// SOLMAR BAY — keyboard and mouse state. One place reads the devices; the
// rest of the game asks this module what the player is doing right now.

const keys = new Set();
// Edge-triggered presses: set on keydown, cleared when the game consumes
// them, so a short press is never lost between slow frames.
const edgePressed = new Set();
let mouseDown = false;
let mouseClicked = false;
let dragDX = 0;
let dragDY = 0;
let dragging = false;
let lastX = 0;
let lastY = 0;
let anyKeyPressed = false;

const GAME_KEYS = [
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight',
  'KeyE', 'KeyF', 'KeyR', 'KeyM', 'KeyH', 'Escape', 'ArrowUp', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
];

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!e.repeat) { anyKeyPressed = true; edgePressed.add(e.code); }
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouseDown = true; mouseClicked = true;
      dragging = true; lastX = e.clientX; lastY = e.clientY;
    }
  });
  window.addEventListener('mouseup', () => { mouseDown = false; dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    dragDX += e.clientX - lastX;
    dragDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });
  // Losing the pointer mid-drag must not leave a stale delta behind.
  canvas.addEventListener('mouseleave', () => { dragging = false; });
}

export function isDown(code) { return keys.has(code); }
export function moveForward() { return keys.has('KeyW') || keys.has('ArrowUp'); }
export function moveBack() { return keys.has('KeyS') || keys.has('ArrowDown'); }
export function moveLeft() { return keys.has('KeyA') || keys.has('ArrowLeft'); }
export function moveRight() { return keys.has('KeyD') || keys.has('ArrowRight'); }
export function sprinting() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); }
export function jumping() { return keys.has('Space'); }

// Edge-triggered actions: true once per press, then consumed by the caller.
export function wasPressed(code) {
  if (edgePressed.has(code)) { edgePressed.delete(code); return true; }
  return false;
}
export function consumeClick() {
  const c = mouseClicked; mouseClicked = false; return c;
}
export function isMouseDown() { return mouseDown; }
export function consumeDrag() {
  const d = { x: dragDX, y: dragDY };
  dragDX = 0; dragDY = 0;
  return d;
}
export function consumeAnyKey() {
  const k = anyKeyPressed; anyKeyPressed = false; return k;
}
