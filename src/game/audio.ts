/**
 * Efeitos sonoros e musica sintetizados com Web Audio — nenhum arquivo de som.
 * O AudioContext so pode nascer depois de um gesto do usuario (regra do navegador).
 */

const A2 = 110;
const freq = (semitones: number) => A2 * Math.pow(2, semitones / 12);

// trilha de "detetive" em La menor, 16 passos por compasso
const BASS = [0, -1, 0, -1, 3, -1, 0, -1, -2, -1, -2, -1, -5, -1, -2, -1];
const LEAD = [
  12, -1, 15, -1, 19, -1, 17, 15, 12, -1, -1, -1, 10, -1, 12, -1,
  12, -1, 15, -1, 19, -1, 22, 20, 19, -1, 17, -1, 15, -1, 14, -1,
];

class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private musicTimer: number | null = null;
  private step = 0;
  private nextTime = 0;
  muted = false;

  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  }

  private tone(f: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, at?: number, out?: AudioNode): void {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out ?? this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, from: number, to: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
  }

  throw(): void {
    this.noise(0.25, 0.5, 600, 2400);
  }

  hit(): void {
    this.noise(0.15, 0.8, 400, 120);
    this.tone(320, 0.25, 'square', 0.18, 90);
  }

  miss(): void {
    this.noise(0.12, 0.45, 300, 100);
  }

  beep(high = false): void {
    this.tone(high ? 880 : 440, high ? 0.35 : 0.15, 'square', 0.12);
  }

  click(): void {
    this.tone(660, 0.06, 'square', 0.08);
  }

  fanfare(happy: boolean): void {
    if (!this.ctx) return;
    const notes = happy ? [0, 4, 7, 12, 16] : [12, 11, 8, 7, 3];
    notes.forEach((n, i) => this.tone(freq(n + 24), 0.22, 'square', 0.12, undefined, this.ctx!.currentTime + i * 0.12));
  }

  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private schedule(): void {
    if (!this.ctx) return;
    const stepDur = 60 / 128 / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const b = BASS[this.step % BASS.length];
      const l = LEAD[this.step % LEAD.length];
      if (b >= -12 && b !== -1) this.tone(freq(b), stepDur * 1.6, 'triangle', 0.5, undefined, this.nextTime, this.musicGain);
      if (l !== -1) this.tone(freq(l + 12), stepDur * 0.9, 'square', 0.12, undefined, this.nextTime, this.musicGain);
      if (this.step % 4 === 2) this.tone(5000, 0.03, 'square', 0.03, undefined, this.nextTime, this.musicGain);
      this.nextTime += stepDur;
      this.step++;
    }
  }
}

export const audio = new Audio();
