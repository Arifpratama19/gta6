// input.js — keyboard and mouse state, with edge-triggered presses.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouse.down = true;
      this.mouse.clicked = true;
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
  }
  down(code) {
    return this.keys.has(code);
  }
  // True only on the frame the key went down.
  wasPressed(code) {
    return this.pressed.has(code);
  }
  // True if any of the given codes is held.
  any(codes) {
    return codes.some((c) => this.keys.has(c));
  }
  // Movement vector from WASD/arrows, normalized.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.any(['KeyA', 'ArrowLeft'])) x -= 1;
    if (this.any(['KeyD', 'ArrowRight'])) x += 1;
    if (this.any(['KeyW', 'ArrowUp'])) y -= 1;
    if (this.any(['KeyS', 'ArrowDown'])) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }
  // Call once per frame after the game reads input.
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
