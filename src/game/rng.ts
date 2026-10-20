// Gerador pseudoaleatório com semente (mulberry32). Mesma semente = mesma
// partida: é o que permite a "semente diária" igual para todo mundo.
// (Não use isto para criptografia! Para chaves de verdade: crypto.getRandomValues.)

export class Rng {
  constructor(public state: number) {}

  static fromSeed(seed: string): Rng {
    let h = 2166136261 >>> 0; // FNV-1a
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
    return new Rng(h);
  }

  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    const total = items.reduce((s, t) => s + weight(t), 0);
    let r = this.next() * total;
    for (const t of items) {
      r -= weight(t);
      if (r <= 0) return t;
    }
    return items[items.length - 1];
  }

  /** Uma sub-semente independente (para não desalinhar a partida inteira). */
  fork(): Rng {
    return new Rng((this.next() * 4294967296) >>> 0);
  }
}

export function dailySeed(d = new Date()): string {
  return `DIA-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function randomSeed(): string {
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}
