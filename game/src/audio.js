// All sound is synthesized live with WebAudio — no audio files, no network.
// Engine hum, police siren, gunshots, pickups and a small bass-driven music
// loop are built from oscillators and filtered noise.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = true;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.noiseBuf = null;
  }

  // Must be called from a user gesture at least once.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.startEngine();
      this.startSiren();
    } catch (err) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  startEngine() {
    const c = this.ctx;
    this.engineFilter = c.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = c.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc = c.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = c.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 28;
    const g2 = c.createGain();
    g2.gain.value = 0.4;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(g2);
    g2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineOsc2.start();
  }

  setEngine(speed01, driving) {
    if (!this.ctx || !this.engineGain) return;
    const target = driving ? 0.05 + speed01 * 0.11 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    const f = 48 + speed01 * 130;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(f * 0.5, this.ctx.currentTime, 0.06);
    this.engineFilter.frequency.setTargetAtTime(320 + speed01 * 900, this.ctx.currentTime, 0.1);
  }

  startSiren() {
    const c = this.ctx;
    this.sirenOsc = c.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = c.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  setSiren(on) {
    if (!this.ctx || !this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.15);
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  noiseBurst(dur, filterFreq, vol) {
    if (!this.ctx) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    src.stop(c.currentTime + dur + 0.02);
  }

  shot() {
    this.noiseBurst(0.14, 2600, 0.5);
    this.blip(160, 0.09, 'square', 0.22);
  }

  enemyShot() {
    this.noiseBurst(0.12, 1800, 0.22);
  }

  hit() {
    this.blip(220, 0.08, 'square', 0.16);
  }

  pickup() {
    this.blip(660, 0.12, 'sine', 0.22);
    setTimeout(() => this.blip(990, 0.16, 'sine', 0.22), 90);
  }

  cash() {
    this.blip(880, 0.1, 'triangle', 0.22);
    setTimeout(() => this.blip(1174, 0.12, 'triangle', 0.22), 80);
    setTimeout(() => this.blip(1568, 0.2, 'triangle', 0.22), 160);
  }

  crash() {
    this.noiseBurst(0.3, 500, 0.5);
    this.blip(70, 0.25, 'sine', 0.3);
  }

  busted() {
    this.blip(392, 0.25, 'square', 0.18);
    setTimeout(() => this.blip(311, 0.4, 'square', 0.18), 220);
  }

  horn() {
    this.blip(370, 0.18, 'sawtooth', 0.12);
    this.blip(466, 0.18, 'sawtooth', 0.12);
  }

  // A tiny 8-step bass + hat loop, scheduled from the game loop.
  updateMusic(dt, playing) {
    if (!this.ctx || !this.musicOn) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.21; // ~142 BPM eighth notes
    if (!playing) return;
    const bass = [55, 0, 55, 65.4, 55, 0, 82.4, 73.4];
    const note = bass[this.musicStep % 8];
    if (note) this.blip(note, 0.2, 'triangle', 0.11);
    if (this.musicStep % 2 === 0) this.noiseBurst(0.03, 8000, 0.05);
    this.musicStep++;
  }

  update(dt, wanted) {
    if (!this.ctx) return;
    if (this.sirenGain && wanted > 0) {
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) {
        this.sirenTimer = 0.42;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setTargetAtTime(
          this.sirenHigh ? 920 : 660, this.ctx.currentTime, 0.05);
      }
    }
  }
}
