// audio.js — all sound is synthesized with WebAudio. No external audio files.
let ctx = null;
let master = null;
let muted = false;
let engineOsc = null, engineGain = null, engineFilter = null;

export function ensureAudio() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  // engine hum: two detuned sawtooths through a lowpass, pitch follows speed
  engineOsc = ctx.createOscillator();
  engineOsc.type = "sawtooth";
  engineOsc.frequency.value = 55;
  const osc2 = ctx.createOscillator();
  osc2.type = "sawtooth";
  osc2.frequency.value = 58;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 320;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(engineFilter);
  osc2.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();
  osc2.start();
  engineOsc._osc2 = osc2;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
export function isMuted() { return muted; }

// speed 0..1 — engine pitch/volume follow the car
export function setEngine(speedNorm, driving) {
  if (!ctx || !engineGain) return;
  const target = driving ? 0.05 + speedNorm * 0.09 : 0;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
  const f = 55 + speedNorm * 130;
  engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
  engineOsc._osc2.frequency.setTargetAtTime(f * 1.01, ctx.currentTime, 0.08);
  engineFilter.frequency.setTargetAtTime(280 + speedNorm * 900, ctx.currentTime, 0.1);
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || "sine";
  o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), ctx.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(ctx.currentTime + dur + 0.02);
}

function noise(dur, vol, filterFreq) {
  if (!ctx || muted) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = filterFreq || 1200;
  const g = ctx.createGain();
  g.gain.value = vol || 0.3;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}

export function sfxShoot() { noise(0.12, 0.5, 2800); tone(180, 0.08, "square", 0.12, 60); }
export function sfxHit() { tone(140, 0.12, "square", 0.2, 70); }
export function sfxPickup() { tone(660, 0.1, "sine", 0.25); setTimeout(() => tone(880, 0.14, "sine", 0.25), 90); }
export function sfxMission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, "triangle", 0.28), i * 110)); }
export function sfxFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, "sawtooth", 0.15), i * 140)); }
export function sfxClick() { tone(900, 0.05, "sine", 0.15); }
export function sfxCrash() { noise(0.25, 0.5, 500); }
export function sfxSirenStart() { tone(700, 0.4, "sine", 0.08, 950); }

// police siren: alternating two-tone, called on a timer by the police system
let sirenHigh = false;
export function sfxSirenTick() {
  if (!ctx || muted) return;
  tone(sirenHigh ? 950 : 700, 0.32, "sine", 0.05);
  sirenHigh = !sirenHigh;
}
