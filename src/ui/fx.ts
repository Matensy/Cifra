// Efeitos visuais: partículas num canvas por cima de tudo, números de dano
// flutuantes, tremor de tela e a "chuva digital" do fundo.

import { h } from './dom';

let motion = true;
export function setMotion(on: boolean) {
  motion = on;
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; char?: string; grav: number;
}

const particles: Particle[] = [];
let fxCanvas: HTMLCanvasElement;
let fxCtx: CanvasRenderingContext2D;
let running = false;

export function initFx() {
  fxCanvas = document.getElementById('fx') as HTMLCanvasElement;
  fxCtx = fxCanvas.getContext('2d')!;
  const resize = () => {
    fxCanvas.width = innerWidth * devicePixelRatio;
    fxCanvas.height = innerHeight * devicePixelRatio;
    fxCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  addEventListener('resize', resize);
  resize();
  initBackground();
}

function loop() {
  fxCtx.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life--;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.grav;
    p.vx *= 0.97;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    const a = p.life / p.max;
    fxCtx.globalAlpha = a;
    fxCtx.fillStyle = p.color;
    if (p.char) {
      fxCtx.font = `${p.size}px "VT323", monospace`;
      fxCtx.fillText(p.char, p.x, p.y);
    } else {
      fxCtx.fillRect(p.x, p.y, p.size * a + 1, p.size * a + 1);
    }
  }
  fxCtx.globalAlpha = 1;
  if (particles.length) requestAnimationFrame(loop);
  else running = false;
}

function kick() {
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
}

/** Explosão de partículas (e de caracteres hex) num ponto da tela. */
export function burst(x: number, y: number, color: string, n = 24, opts: { chars?: boolean; speed?: number; grav?: number } = {}) {
  if (!motion) n = Math.min(n, 6);
  const sp = opts.speed ?? 6;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = Math.random() * sp + 1;
    particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 30 + Math.random() * 30, max: 60,
      size: opts.chars ? 14 + Math.random() * 10 : 2 + Math.random() * 4, color, grav: opts.grav ?? 0.12,
      char: opts.chars ? '0123456789ABCDEF'[Math.floor(Math.random() * 16)] : undefined,
    });
  }
  kick();
}

export function centerOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Número flutuante (dano, cura, bloqueio...). */
export function floatText(x: number, y: number, text: string, cls = '') {
  const el = h('div', { class: `float-text ${cls}`, style: `left:${x}px;top:${y}px` }, text);
  document.body.append(el);
  setTimeout(() => el.remove(), 1400);
}

export function shake(el: Element = document.getElementById('app')!, strength: 'leve' | 'forte' = 'leve') {
  if (!motion) return;
  el.classList.remove('shake', 'shake-hard');
  void (el as HTMLElement).offsetWidth;
  el.classList.add(strength === 'forte' ? 'shake-hard' : 'shake');
}

export function flash(kind: 'red' | 'green' | 'white' = 'red') {
  const el = h('div', { class: `screen-flash ${kind}` });
  document.body.append(el);
  setTimeout(() => el.remove(), 500);
}

// ---------------- fundo: chuva digital ----------------

let bgMode: 'rain' | 'calm' = 'calm';
export function setBackground(mode: 'rain' | 'calm') {
  bgMode = mode;
}

function initBackground() {
  const c = document.getElementById('bg') as HTMLCanvasElement;
  const g = c.getContext('2d')!;
  const chars = '0123456789ABCDEF⊕#$%&@ΣΩλ';
  let cols: number[] = [];
  const size = 16;
  const resize = () => {
    c.width = innerWidth;
    c.height = innerHeight;
    cols = Array.from({ length: Math.ceil(innerWidth / size) }, () => Math.random() * -50);
  };
  addEventListener('resize', resize);
  resize();
  let last = 0;
  const draw = (t: number) => {
    requestAnimationFrame(draw);
    const interval = bgMode === 'rain' ? 50 : 110;
    if (t - last < interval || !motion) return;
    last = t;
    g.fillStyle = bgMode === 'rain' ? 'rgba(5,6,11,0.12)' : 'rgba(5,6,11,0.2)';
    g.fillRect(0, 0, c.width, c.height);
    g.font = `${size}px "VT323", monospace`;
    for (let i = 0; i < cols.length; i++) {
      if (bgMode === 'calm' && i % 3) continue;
      const y = cols[i] * size;
      g.fillStyle = Math.random() < 0.05 ? '#d9fff0' : bgMode === 'rain' ? '#1fd17f' : '#0f5c3c';
      g.fillText(chars[Math.floor(Math.random() * chars.length)], i * size, y);
      if (y > c.height && Math.random() > 0.975) cols[i] = 0;
      cols[i]++;
    }
  };
  requestAnimationFrame(draw);
}
