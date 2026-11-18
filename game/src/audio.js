// audio.js — every sound is synthesized with WebAudio. No audio files.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.muted = false;
  }
  // Must be called from a user gesture at least once (browser autoplay rule).
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
      // Engine hum: a low sawtooth whose pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Police siren: a triangle that wails between two notes.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 660;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) {
      this.ctx = null;
    }
  }
  setEngine(speed01) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
  }
  setSiren(on, time) {
    if (!this.ctx || !this.sirenOsc) return;
    this.sirenOn = on;
    const t = this.ctx.currentTime;
    if (on) {
      const phase = (time % 1.2) < 0.6 ? 660 : 880;
      this.sirenOsc.frequency.setTargetAtTime(phase, t, 0.05);
      this.sirenGain.gain.setTargetAtTime(0.045, t, 0.1);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, t, 0.1);
    }
  }
  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  // Short burst of filtered noise: gunshots and impacts.
  noiseBurst(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass || 2400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }
  shot() {
    this.noiseBurst(0.14, 0.35, 3000);
    this.blip(160, 0.08, 'square', 0.12);
  }
  enemyShot() {
    this.noiseBurst(0.1, 0.14, 1800);
  }
  hit() {
    this.blip(220, 0.06, 'square', 0.1);
  }
  pickup() {
    this.blip(660, 0.09, 'sine', 0.2);
    setTimeout(() => this.blip(880, 0.12, 'sine', 0.2), 90);
  }
  missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.16, 'triangle', 0.22), i * 110));
  }
  busted() {
    this.blip(330, 0.3, 'sawtooth', 0.18);
    setTimeout(() => this.blip(220, 0.4, 'sawtooth', 0.18), 200);
  }
  honk() {
    this.blip(370, 0.12, 'square', 0.1);
    setTimeout(() => this.blip(370, 0.12, 'square', 0.1), 150);
  }
}
