// All sound is synthesised: steel clangs, flesh hits, swings, rain, fire and
// a low drone. No audio files.
export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  rainGain!: GainNode;
  fireGain!: GainNode;
  noise!: AudioBuffer;
  enabled = true;

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    try { this.ctx = new AudioContext(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.55; this.master.connect(c.destination);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // rain bed
    this.rainGain = c.createGain(); this.rainGain.gain.value = 0;
    const rs = this.loopNoise(); const rf = c.createBiquadFilter(); rf.type = "highpass"; rf.frequency.value = 900;
    rs.connect(rf).connect(this.rainGain).connect(this.master);
    // fire crackle bed
    this.fireGain = c.createGain(); this.fireGain.gain.value = 0;
    const fs = this.loopNoise(); const ff = c.createBiquadFilter(); ff.type = "bandpass"; ff.frequency.value = 400; ff.Q.value = 0.6;
    fs.connect(ff).connect(this.fireGain).connect(this.master);
    // drone
    const dg = c.createGain(); dg.gain.value = 0.035; dg.connect(this.master);
    for (const f of [55, 82.4, 110.5]) {
      const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.05;
      const lg = c.createGain(); lg.gain.value = 80; lfo.connect(lg).connect(lp.frequency); lfo.start();
      o.connect(lp).connect(dg); o.start();
    }
  }

  private loopNoise() {
    const s = this.ctx!.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(); return s;
  }

  setBeds(rain: number, fire: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(rain * 0.22, t, 0.5);
    this.fireGain.gain.setTargetAtTime(fire * 0.18 * (0.7 + Math.random() * 0.6), t, 0.05);
  }

  private burst(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = "bandpass", vol = 1) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  private ring(freqs: number[], dur: number, gain: number, vol = 1) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    for (const fr of freqs) {
      const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = fr * (0.97 + Math.random() * 0.06);
      const g = c.createGain(); g.gain.setValueAtTime(gain * vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + dur);
    }
  }

  swing(vol = 1) { this.burst(0.28, 700 + Math.random() * 400, 1.2, 0.35, "bandpass", vol); }
  clang(vol = 1) { this.ring([620, 1480, 2310, 3170], 0.6, 0.06, vol); this.burst(0.08, 3000, 0.8, 0.5, "highpass", vol); }
  shieldThud(vol = 1) { this.burst(0.18, 260, 1.5, 0.9, "lowpass", vol); this.ring([180, 240], 0.2, 0.05, vol); }
  hit(blunt: boolean, vol = 1) {
    this.burst(blunt ? 0.22 : 0.16, blunt ? 180 : 520, 1.4, 1.1, "lowpass", vol);
    this.burst(0.12, blunt ? 900 : 1800, 2, 0.3, "bandpass", vol);
  }
  grunt(vol = 1) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = "sawtooth";
    const f0 = 110 + Math.random() * 40; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.3);
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 700; f.Q.value = 3;
    const g = c.createGain(); g.gain.setValueAtTime(0.12 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(f).connect(g).connect(this.master); o.start(t); o.stop(t + 0.4);
  }
  shot(vol = 1) { this.burst(0.9, 140, 0.9, 1.6, "lowpass", vol); this.burst(0.25, 2400, 1.2, 0.9, "highpass", vol); }
  loose(heavy: boolean, vol = 1) { this.burst(heavy ? 0.14 : 0.2, heavy ? 500 : 900, 3, heavy ? 0.6 : 0.35, "bandpass", vol); }
  thunder() { this.burst(2.5, 90, 0.7, 1.4, "lowpass"); }
}
