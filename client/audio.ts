export class GameAudio {
  context?: AudioContext;
  enabled = localStorage.getItem('echo-sound') !== 'off';
  volume = Number(localStorage.getItem('echo-volume') ?? 0.3);
  unlock(): void { this.context ??= new AudioContext(); void this.context.resume().catch(() => {}); }
  play(kind: 'shot' | 'hit' | 'echo' | 'wave' | 'dash' | 'win'): void {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const ctx = this.context, o = ctx.createOscillator(), g = ctx.createGain(), at = ctx.currentTime;
    const data = { shot: [480, 95, 0.11], hit: [840, 1400, 0.10], echo: [280, 140, 0.16], wave: [500, 850, 0.09], dash: [180, 540, 0.15], win: [440, 880, 0.45] }[kind];
    o.type = kind === 'shot' ? 'triangle' : 'sine'; o.frequency.setValueAtTime(data[0], at); o.frequency.exponentialRampToValueAtTime(data[1], at + data[2]);
    g.gain.setValueAtTime(Math.max(0.0001, this.volume * 0.12), at); g.gain.exponentialRampToValueAtTime(0.0001, at + data[2]);
    o.connect(g); g.connect(ctx.destination); o.start(at); o.stop(at + data[2]); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
}
