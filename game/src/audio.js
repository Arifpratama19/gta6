// Synthesized sound: no audio files, everything is WebAudio oscillators.
// The context is created lazily on the first user gesture so headless runs
// and autoplay policies never throw.
let ctx = null;
let master = null;
let sirenNodes = null;
let engineNodes = null;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function blip(freq, dur, type, vol, slideTo) {
  const c = ensure();
  if (!c || c.state !== 'running') return;
  try {
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (e) {}
}

export function shot() {
  blip(190, 0.12, 'sawtooth', 0.3, 60);
  blip(1200, 0.05, 'square', 0.12, 300);
}

export function enemyShot() {
  blip(140, 0.1, 'sawtooth', 0.14, 70);
}

export function pickup() {
  blip(660, 0.09, 'sine', 0.22);
  setTimeout(() => blip(990, 0.12, 'sine', 0.22), 80);
}

export function missionDone() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.25), i * 110));
}

export function click() {
  blip(800, 0.05, 'square', 0.12);
}

export function bust() {
  blip(220, 0.4, 'sawtooth', 0.2, 110);
}

export function setSiren(on) {
  const c = ensure();
  if (!c) return;
  if (on && !sirenNodes) {
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      const lfo = c.createOscillator();
      const lg = c.createGain();
      o.type = 'triangle';
      o.frequency.value = 750;
      lfo.type = 'sine';
      lfo.frequency.value = 0.9;
      lg.gain.value = 220;
      lfo.connect(lg);
      lg.connect(o.frequency);
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(master);
      o.start();
      lfo.start();
      sirenNodes = { o, lfo, g };
    } catch (e) {}
  } else if (!on && sirenNodes) {
    try {
      sirenNodes.o.stop();
      sirenNodes.lfo.stop();
      sirenNodes.g.disconnect();
    } catch (e) {}
    sirenNodes = null;
  }
}

export function setEngine(speedNorm) {
  const c = ensure();
  if (!c) return;
  if (speedNorm > 0.03) {
    if (!engineNodes) {
      try {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.value = 60;
        g.gain.value = 0.03;
        o.connect(g);
        g.connect(master);
        o.start();
        engineNodes = { o, g };
      } catch (e) {}
    }
    if (engineNodes) {
      try {
        engineNodes.o.frequency.setValueAtTime(55 + speedNorm * 140, c.currentTime);
        engineNodes.g.gain.setValueAtTime(0.02 + speedNorm * 0.05, c.currentTime);
      } catch (e) {}
    }
  } else if (engineNodes) {
    try {
      engineNodes.o.stop();
      engineNodes.g.disconnect();
    } catch (e) {}
    engineNodes = null;
  }
}
