// SOLMAR BAY — all sound is synthesized live with WebAudio: no audio files.
// One job: engine hum, sirens, gunshots, pickups and a sunset synth loop.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenNodes = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Must be called from a user gesture (the Start button).
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.startEngineLoop();
    this.startMusicLoop();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  // A short blip: a sine/triangle tone sliding between two frequencies.
  blip(freqA, freqB, seconds, type = 'sine', volume = 0.3, when = 0) {
    if (!this.ctx) return;
    const t = this.now() + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t); osc.stop(t + seconds + 0.05);
  }

  // Filtered noise burst: gunshots, crashes, splashes.
  noise(seconds, volume = 0.4, filterFreq = 1200, when = 0) {
    if (!this.ctx) return;
    const t = this.now() + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start(t);
  }

  gunshot() { this.noise(0.14, 0.5, 2600); this.blip(180, 60, 0.09, 'square', 0.18); }
  crash() { this.noise(0.35, 0.5, 500); this.blip(90, 35, 0.3, 'sawtooth', 0.25); }
  pickup() { this.blip(660, 660, 0.09, 'sine', 0.25); this.blip(990, 990, 0.14, 'sine', 0.25, 0.09); }
  cashRegister() { this.blip(880, 880, 0.08, 'triangle', 0.28); this.blip(1174, 1174, 0.08, 'triangle', 0.28, 0.08); this.blip(1568, 1568, 0.2, 'triangle', 0.28, 0.16); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => this.blip(f, f, 0.22, 'triangle', 0.3, i * 0.11)); }
  missionFail() { [392, 330, 262].forEach((f, i) => this.blip(f, f * 0.94, 0.3, 'sawtooth', 0.2, i * 0.16)); }
  busted() { this.blip(220, 110, 0.7, 'sawtooth', 0.3); this.blip(165, 82, 0.9, 'sawtooth', 0.25, 0.4); }
  doorSlam() { this.noise(0.1, 0.35, 700); }
  horn() { this.blip(370, 370, 0.22, 'square', 0.16); this.blip(466, 466, 0.22, 'square', 0.12); }

  // A low two-oscillator engine drone whose pitch follows speed.
  startEngineLoop() {
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth'; osc.frequency.value = 55;
    osc2.type = 'square'; osc2.frequency.value = 28;
    filter.type = 'lowpass'; filter.frequency.value = 420;
    gain.gain.value = 0.0;
    osc.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(this.master);
    osc.start(); osc2.start();
    this.engineOsc = osc; this.engineOsc2 = osc2; this.engineGain = gain;
  }

  setEngine(speed01, driving) {
    if (!this.engineGain) return;
    const target = driving ? 0.05 + speed01 * 0.11 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.now(), 0.1);
    const f = 50 + speed01 * 130;
    this.engineOsc.frequency.setTargetAtTime(f, this.now(), 0.08);
    this.engineOsc2.frequency.setTargetAtTime(f / 2, this.now(), 0.08);
  }

  // Wailing two-tone police siren while any police car is active.
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenNodes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = 750;
      lfo.type = 'sine'; lfo.frequency.value = 0.55;
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
      gain.gain.value = 0.05;
      osc.connect(gain); gain.connect(this.master);
      osc.start(); lfo.start();
      this.sirenNodes = { osc, lfo, gain };
    } else if (!on && this.sirenNodes) {
      const { osc, lfo, gain } = this.sirenNodes;
      gain.gain.setTargetAtTime(0, this.now(), 0.2);
      setTimeout(() => { try { osc.stop(); lfo.stop(); } catch (_) { /* already stopped */ } }, 600);
      this.sirenNodes = null;
    }
  }

  // A lazy sunset groove: Am – F – C – G bass with a soft pluck on top.
  startMusicLoop() {
    const bassNotes = [110, 87.31, 130.81, 98];
    const pluckNotes = [440, 523.25, 659.25, 783.99, 880, 659.25, 523.25, 392];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const bar = Math.floor(this.musicStep / 8) % 4;
      const step = this.musicStep % 8;
      if (step === 0 || step === 4) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = bassNotes[bar];
        gain.gain.setValueAtTime(0.5, this.now());
        gain.gain.exponentialRampToValueAtTime(0.001, this.now() + 0.9);
        osc.connect(gain); gain.connect(this.musicGain);
        osc.start(); osc.stop(this.now() + 1);
      }
      if (step % 2 === 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = pluckNotes[(this.musicStep * 3 + bar) % pluckNotes.length];
        gain.gain.setValueAtTime(0.22, this.now());
        gain.gain.exponentialRampToValueAtTime(0.001, this.now() + 0.5);
        osc.connect(gain); gain.connect(this.musicGain);
        osc.start(); osc.stop(this.now() + 0.55);
      }
      this.musicStep++;
    }, 240);
  }
}
