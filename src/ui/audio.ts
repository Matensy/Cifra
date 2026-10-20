// Efeitos sonoros sintetizados na hora com a Web Audio API (zero arquivos).

let ctx: AudioContext | null = null;
let enabled = true;
let lastClick = 0;

export function setSound(on: boolean) {
  enabled = on;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, slide = 0, delay = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.08, delay = 0, hp = 800) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  click: () => { const t = performance.now(); if (t - lastClick < 60) return; lastClick = t; tone(880, 0.04, 'square', 0.03); },
  hover: () => tone(1320, 0.02, 'sine', 0.015),
  card: () => { tone(520, 0.06, 'triangle', 0.05, 300); noise(0.05, 0.03, 0, 3000); },
  hit: () => { noise(0.12, 0.12, 0, 400); tone(160, 0.12, 'square', 0.05, -80); },
  crit: () => { noise(0.2, 0.16, 0, 300); tone(90, 0.25, 'sawtooth', 0.07, -40); tone(1200, 0.15, 'square', 0.03, 600, 0.03); },
  weak: () => tone(220, 0.15, 'triangle', 0.04, -100),
  block: () => { tone(300, 0.08, 'sine', 0.06, 200); tone(600, 0.08, 'sine', 0.03, 0, 0.04); },
  hurt: () => { noise(0.18, 0.14, 0, 200); tone(110, 0.2, 'sawtooth', 0.06, -60); },
  coin: () => { tone(988, 0.07, 'square', 0.04); tone(1319, 0.12, 'square', 0.04, 0, 0.07); },
  error: () => { tone(200, 0.12, 'square', 0.05); tone(150, 0.18, 'square', 0.05, 0, 0.1); },
  reveal: () => tone(1500 + Math.random() * 800, 0.03, 'sine', 0.02),
  turn: () => { tone(440, 0.06, 'triangle', 0.04); tone(660, 0.08, 'triangle', 0.04, 0, 0.06); },
  enemy: () => tone(140, 0.2, 'sawtooth', 0.04, 60),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.045, 0, i * 0.09)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.045, 0, i * 0.16)),
  unlock: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.05, 0, i * 0.06)); noise(0.3, 0.04, 0.2, 5000); },
  glitch: () => { for (let i = 0; i < 6; i++) tone(100 + Math.random() * 1800, 0.03, 'square', 0.03, 0, i * 0.025); },
};
