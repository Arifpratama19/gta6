// SOLMAR BAY — every sound is synthesized live with WebAudio: engine hum,
// sirens, gunshots, pickups and a laid-back coastal bassline. No audio files.

let ctx = null;
let master = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let engineFilter = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = 0;
let musicTimer = null;
let musicStep = 0;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    startEngineLoop();
    startMusic();
  } catch (err) {
    ctx = null; // Audio is a garnish: the game plays on without it.
  }
}

export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}
export function isMuted() { return muted; }

function noiseBuffer(seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, filterFreq) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.05);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq || 3000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.05);
}

export function playGunshot() { noiseBurst(0.16, 0.5, 2200); blip(140, 0.1, 'square', 0.25, 50); }
export function playPunch() { noiseBurst(0.09, 0.35, 900); }
export function playPickup() { blip(660, 0.12, 'sine', 0.3); setTimeout(() => blip(990, 0.16, 'sine', 0.3), 90); }
export function playCash() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.28), i * 80));
}
export function playMissionComplete() {
  [392, 523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'triangle', 0.3), i * 110));
}
export function playFail() {
  [330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.4, 'sawtooth', 0.2), i * 160));
}
export function playCrash() { noiseBurst(0.3, 0.45, 700); blip(90, 0.25, 'sine', 0.4, 40); }
export function playSirenWhoop() { blip(700, 0.35, 'sine', 0.16, 1200); }
export function playClick() { blip(1200, 0.05, 'square', 0.12); }
export function playHorn() { blip(370, 0.35, 'sawtooth', 0.14); blip(466, 0.35, 'sawtooth', 0.1); }
export function playSplash() { noiseBurst(0.5, 0.3, 1200); }

// --- continuous engine hum, pitch follows the car's speed ---
function startEngineLoop() {
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
  engineGain = ctx.createGain(); engineGain.gain.value = 0;
  engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
  engineOsc.start();
}

export function setEngine(speedRatio, on) {
  if (!ctx || !engineOsc) return;
  const target = on ? 0.05 + speedRatio * 0.1 : 0;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
  engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, ctx.currentTime, 0.08);
  engineFilter.frequency.setTargetAtTime(300 + speedRatio * 900, ctx.currentTime, 0.1);
}

// --- police siren: a slow two-tone wail while any wanted stars are up ---
export function setSiren(on, dt) {
  if (!ctx) return;
  if (on && !sirenOsc) {
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 750;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0.045;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start();
    sirenTimer = 0;
  } else if (!on && sirenOsc) {
    sirenOsc.stop(); sirenOsc = null; sirenGain = null;
  }
  if (sirenOsc) {
    sirenTimer += dt;
    const phase = (sirenTimer % 1.1) / 1.1;
    sirenOsc.frequency.setTargetAtTime(phase < 0.5 ? 980 : 720, ctx.currentTime, 0.05);
  }
}

// --- the music: a lazy 8-step coastal groove, bass + pad + hat ---
const BASS = [55, 0, 55, 0, 65.4, 0, 49, 0];       // A1 C2 G1, one bar
const PAD = [220, 261.6, 329.6];                    // A minor triad
let hatBuffer = null;

function startMusic() {
  hatBuffer = noiseBuffer(0.05);
  musicTimer = setInterval(() => {
    if (!ctx || muted) return;
    const step = musicStep % 8;
    const bass = BASS[step];
    if (bass) blip(bass, 0.42, 'triangle', 0.22);
    if (step === 0) PAD.forEach((f) => blip(f, 3.4, 'sine', 0.045));
    if (step % 2 === 0) {
      const t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = hatBuffer;
      const g = ctx.createGain(); g.gain.value = 0.05;
      src.connect(g); g.connect(master); src.start(t);
    }
    musicStep++;
  }, 260);
}
