// 程序化音效与生成式配乐（WebAudio）
const SCALE = [0, 2, 4, 7, 9]; // 宫调五声
const noteHz = (deg, base = 146.83) => base * Math.pow(2, (Math.floor(deg / 5) * 12 + SCALE[((deg % 5) + 5) % 5]) / 12);

export class GameAudio {
  constructor() { this.ctx = null; this.vol = 0.7; this.musicOn = true; this.deg = 7; this.nextNote = 0; this.nextBird = 0; this.stepT = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.vol;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.5;
    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    this.musicBus.connect(this.master); this.musicBus.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(this.master);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const loop = (type, freq, q) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.master); s.start();
      return { f, g };
    };
    this.wind = loop('bandpass', 420, 0.6);
    this.waterL = loop('bandpass', 1300, 0.4);
    this.rainL = loop('highpass', 2400, 0.3);
    this.nextNote = ctx.currentTime + 1.5;
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  _tone(type, f0, f1, dur, vol, when = 0, bus) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  _noise(dur, vol, type, f0, f1, q = 1, when = 0) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  sfx(name) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'slash': this._noise(0.16, 0.32, 'bandpass', 2600, 700, 1.2); break;
      case 'hit': this._tone('square', 190, 60, 0.12, 0.22); this._noise(0.08, 0.3, 'lowpass', 1800, 300); break;
      case 'hurt': this._tone('sawtooth', 140, 55, 0.22, 0.25); this._noise(0.12, 0.25, 'lowpass', 900, 200); break;
      case 'qi': this._tone('sawtooth', 520, 1500, 0.2, 0.1); this._noise(0.3, 0.2, 'bandpass', 900, 4200, 2); break;
      case 'jump': this._tone('sine', 240, 420, 0.12, 0.12); break;
      case 'step': this._noise(0.06, 0.07, 'lowpass', 700 + Math.random() * 300, 200); break;
      case 'splash': this._noise(0.4, 0.22, 'bandpass', 1500, 500, 0.7); break;
      case 'pick': [0, 2, 4].forEach((d, i) => this._tone('triangle', noteHz(10 + d), noteHz(10 + d), 0.22, 0.14, i * 0.06)); break;
      case 'ui': this._tone('square', 660, 660, 0.05, 0.06); break;
      case 'talk': this._tone('triangle', 330 + Math.random() * 120, 300, 0.05, 0.06); break;
      case 'coin': this._tone('square', 1318, 1318, 0.07, 0.07); this._tone('square', 1760, 1760, 0.14, 0.07, 0.07); break;
      case 'quest': [5, 7, 9, 12].forEach((d, i) => this._tone('triangle', noteHz(d + 5), noteHz(d + 5), 0.5, 0.16, i * 0.11)); break;
      case 'craft': this._noise(0.7, 0.2, 'bandpass', 300, 2400, 1.5); this._tone('sine', 220, 880, 0.7, 0.12); break;
      case 'chest': [0, 2, 4, 5, 7].forEach((d, i) => this._tone('square', noteHz(d + 10), noteHz(d + 10), 0.3, 0.07, i * 0.08)); break;
      case 'fly': this._noise(0.6, 0.22, 'bandpass', 500, 3000, 1.2); this._tone('sine', 300, 900, 0.5, 0.1); break;
      case 'die': this._tone('square', 300, 50, 0.35, 0.16); break;
      case 'death': [9, 7, 5, 2, 0].forEach((d, i) => this._tone('triangle', noteHz(d), noteHz(d), 0.7, 0.2, i * 0.22)); break;
      case 'boss': this._tone('sawtooth', 70, 45, 0.9, 0.3); this._noise(0.8, 0.3, 'lowpass', 400, 80); break;
      case 'jump2': this._tone('sine', 300, 700, 0.18, 0.12); this._noise(0.25, 0.12, 'bandpass', 800, 3000, 1); break;
      case 'land': this._noise(0.22, 0.28, 'lowpass', 500, 60); this._tone('sine', 90, 40, 0.2, 0.2); break;
      case 'slam': this._noise(0.35, 0.3, 'lowpass', 900, 80); this._tone('sine', 110, 40, 0.3, 0.25); break;
      case 'dash': this._noise(0.28, 0.3, 'bandpass', 4000, 600, 1.4); this._tone('sine', 900, 200, 0.2, 0.07); break;
      case 'parry': this._tone('square', 1760, 1500, 0.18, 0.12); this._tone('triangle', 2640, 2400, 0.5, 0.1, 0.02); this._noise(0.15, 0.3, 'highpass', 5000, 2500); break;
      case 'perfect': this._tone('sine', 1200, 300, 0.9, 0.14); this._noise(0.9, 0.18, 'bandpass', 3000, 300, 2); [0, 4, 7].forEach((d, i) => this._tone('triangle', noteHz(d + 12), noteHz(d + 12), 0.6, 0.06, 0.1 + i * 0.06)); break;
      case 'exec': this._noise(0.25, 0.4, 'bandpass', 5000, 900, 1.5); this._tone('sawtooth', 220, 50, 0.5, 0.25, 0.05); this._noise(0.6, 0.35, 'lowpass', 900, 60, 1, 0.05); break;
      case 'block': this._tone('triangle', 880, 820, 0.25, 0.14); this._tone('sine', 1320, 1300, 0.35, 0.08); break;
      case 'shield': [0, 4, 7].forEach((d, i) => this._tone('triangle', noteHz(d + 10), noteHz(d + 10), 0.9, 0.11, i * 0.05)); this._noise(0.8, 0.12, 'bandpass', 600, 2400, 2); break;
      case 'wanjian': this._noise(1.4, 0.26, 'bandpass', 600, 5000, 1.2); [0, 2, 4, 7, 9].forEach((d, i) => this._tone('sawtooth', noteHz(d + 8), noteHz(d + 10), 0.25, 0.05, i * 0.06)); break;
      case 'swordhit': this._noise(0.12, 0.16, 'highpass', 3000, 1200); this._tone('square', 1500, 600, 0.08, 0.04); break;
      case 'impact': this._noise(0.7, 0.42, 'lowpass', 700, 40); this._tone('sine', 70, 28, 0.6, 0.35); break;
      case 'thunder': this._noise(0.12, 0.5, 'highpass', 5000, 1500); this._noise(2.4, 0.55, 'lowpass', 1200, 40, 0.7, 0.05); this._tone('sine', 55, 30, 1.6, 0.35, 0.05); break;
      case 'thunderFar': this._noise(2.8, 0.22, 'lowpass', 300, 40, 0.7); break;
      case 'howl': this._tone('sawtooth', 220, 520, 0.6, 0.12); this._tone('sawtooth', 520, 300, 1.2, 0.12, 0.6); this._noise(1.6, 0.1, 'bandpass', 600, 300, 2); break;
      case 'portal': this._noise(1.2, 0.2, 'bandpass', 300, 4000, 2); [0, 3, 5, 7, 10].forEach((d, i) => this._tone('sine', noteHz(d + 8), noteHz(d + 8), 0.8, 0.08, i * 0.07)); break;
      case 'chapter': this._tone('sine', 73.4, 73.4, 3, 0.3); [0, 4, 7].forEach((d, i) => this._pluck(noteHz(d + 3), 0.12, 0.3 + i * 0.45)); break;
      case 'break': {
        [0, 2, 4, 5, 7, 9, 10].forEach((d, i) => this._tone('triangle', noteHz(d + 5), noteHz(d + 5), 1.2, 0.16, i * 0.09));
        this._noise(1.6, 0.25, 'bandpass', 300, 5000, 0.8); this._tone('sine', 73.4, 73.4, 2.2, 0.3);
        break;
      }
    }
  }
  _pluck(freq, vol, when) {
    const b = this.musicBus;
    this._tone('triangle', freq, freq * 0.997, 2.4, vol, when, b);
    this._tone('sine', freq * 2, freq * 2, 0.9, vol * 0.35, when, b);
    this._tone('sine', freq * 3.01, freq * 3, 0.25, vol * 0.18, when, b);
  }
  // env: { night, water(0..1), wind(0..1), calm }
  update(dt, env) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    this.wind.g.gain.setTargetAtTime(0.025 + env.wind * 0.16 + Math.sin(t * 0.31) * 0.012, t, 0.4);
    this.wind.f.frequency.setTargetAtTime(380 + env.wind * 500 + Math.sin(t * 0.17) * 90, t, 0.5);
    this.waterL.g.gain.setTargetAtTime(env.water * 0.07, t, 0.5);
    this.rainL.g.gain.setTargetAtTime((env.rain || 0) * 0.09, t, 0.8);
    // 首领战：低沉鼓点
    if (env.boss && t >= (this.nextDrum || 0)) { this.nextDrum = t + 0.48; this._tone('sine', 62, 38, 0.32, 0.26, 0, this.musicBus); if (Math.random() < 0.35) this._tone('sine', 62, 38, 0.22, 0.16, 0.24, this.musicBus); }
    if (this.musicOn && t >= this.nextNote) {
      const beat = env.night > 0.5 ? 0.78 : 0.62;
      if (Math.random() < (env.night > 0.5 ? 0.5 : 0.68)) {
        this.deg += [-2, -1, -1, 1, 1, 2, 3, -3][(Math.random() * 8) | 0];
        if (this.deg < 3) this.deg += 4; if (this.deg > 14) this.deg -= 5;
        this._pluck(noteHz(this.deg), 0.11, 0.05);
        if (Math.random() < 0.22) this._pluck(noteHz(this.deg + 2), 0.07, 0.05 + beat * 0.5);
      }
      if (Math.random() < 0.16) this._pluck(noteHz([0, 3, 0, 4][(Math.random() * 4) | 0] - 5), 0.13, 0.05);
      this.nextNote = t + beat * (Math.random() < 0.2 ? 2 : 1);
    }
    if (t >= this.nextBird) {
      if (env.night < 0.4 && env.calm) {
        const f = 2400 + Math.random() * 1600, n = 2 + ((Math.random() * 3) | 0);
        for (let i = 0; i < n; i++) this._tone('sine', f, f * (1.15 + Math.random() * 0.3), 0.09, 0.028, i * 0.13);
        this.nextBird = t + 2.5 + Math.random() * 7;
      } else if (env.night > 0.6) {
        for (let i = 0; i < 5; i++) this._tone('sine', 4300, 4300, 0.035, 0.014, i * 0.07);
        this.nextBird = t + 0.7 + Math.random() * 1.6;
      } else this.nextBird = t + 2;
    }
  }
}
