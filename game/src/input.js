// Keyboard + mouse input. Held keys are read live each frame; discrete
// actions (E, Esc, P, R, Enter, C, Space) are queued on keydown and consumed
// exactly once per frame, so a quick tap between two frames is never lost.
const held = Object.create(null);
const queue = [];
const ACTION_KEYS = new Set(['KeyE', 'Escape', 'KeyP', 'KeyR', 'Enter', 'KeyC', 'Space']);

export const mouse = { x: 0, y: 0, down: false, clicked: false };

export function initInput(canvas, onFirstGesture) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) {
      held[e.code] = true;
      if (ACTION_KEYS.has(e.code)) queue.push(e.code);
    }
    if (onFirstGesture) onFirstGesture();
  });
  window.addEventListener('keyup', (e) => {
    held[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(held)) held[k] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
    if (onFirstGesture) onFirstGesture();
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
}

export function isDown(code) {
  return !!held[code];
}

// Returns true once for each queued press of `code` since the last frame.
export function consumeAction(code) {
  const i = queue.indexOf(code);
  if (i === -1) return false;
  queue.splice(i, 1);
  return true;
}

export function consumeClick() {
  const c = mouse.clicked;
  mouse.clicked = false;
  return c;
}

// Movement axes, -1..1. WASD + arrows.
export function moveAxis() {
  let x = 0;
  let y = 0;
  if (held.KeyA || held.ArrowLeft) x -= 1;
  if (held.KeyD || held.ArrowRight) x += 1;
  if (held.KeyW || held.ArrowUp) y -= 1;
  if (held.KeyS || held.ArrowDown) y += 1;
  return { x, y };
}

export function endFrame() {
  // Keep at most the freshest few queued actions so a stuck key cannot
  // flood the next frame.
  if (queue.length > 8) queue.splice(0, queue.length - 8);
}
