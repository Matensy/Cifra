// Estado da partida: mapa procedural, recompensas, loja e salvamento.

import { ALL_CARDS, CARDS, REWARD_POOL, STARTER_DECK, type CardDef } from '../content/cards';
import { enemiesFor } from '../content/enemies';
import { RELIC_POOL, RELICS } from '../content/relics';
import { Rng } from './rng';
import type { CardInst, GameMap, MapNode, NodeType, RunState, Tag } from './types';

export const START_HP = 70;
export const ROWS = 9;
const COLS = 5;

export function newRun(seed: string): RunState {
  const rng = Rng.fromSeed(seed);
  const run: RunState = {
    version: 1, seed, rngState: 0, act: 1, hp: START_HP, maxHp: START_HP, credits: 99,
    deck: [], relics: ['terminal'], map: { act: 1, nodes: [] }, path: [],
    stats: { combats: 0, manualBreaks: 0, damageDealt: 0, cardsPlayed: 0, bestHit: 0 },
    nextUid: 1, startedAt: Date.now(), seen: [],
  };
  for (const id of STARTER_DECK) addCard(run, id);
  run.map = generateMap(1, rng);
  run.rngState = rng.state;
  return run;
}

/** Usa o RNG da partida e guarda o estado de volta (para salvar/continuar). */
export function withRng<T>(run: RunState, fn: (rng: Rng) => T): T {
  const rng = new Rng(run.rngState);
  const out = fn(rng);
  run.rngState = rng.state;
  return out;
}

export function addCard(run: RunState, id: string, up = false): CardInst {
  const c = { uid: `c${run.nextUid++}`, id, up };
  run.deck.push(c);
  return c;
}

export function addRelic(run: RunState, id: string): void {
  if (run.relics.includes(id)) return;
  run.relics.push(id);
  if (id === 'hd') {
    run.maxHp += 10;
    run.hp += 10;
  }
}

// ---------------- mapa ----------------

export function generateMap(act: 1 | 2 | 3, rng: Rng): GameMap {
  const nodes: MapNode[] = [];
  const rows: MapNode[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const count = r === 0 ? 3 : rng.int(2, 4);
    const cols = rng.shuffle([0, 1, 2, 3, 4]).slice(0, count).sort((a, b) => a - b);
    const row = cols.map((col) => ({ id: `${act}-${r}-${col}`, row: r, col, type: nodeType(r, rng), next: [] as string[] }));
    rows.push(row);
    nodes.push(...row);
  }
  for (let r = 0; r < ROWS - 1; r++) {
    const nextRow = rows[r + 1];
    for (const n of rows[r]) {
      const sorted = [...nextRow].sort((a, b) => Math.abs(a.col - n.col) - Math.abs(b.col - n.col));
      n.next.push(sorted[0].id);
      if (sorted[1] && Math.abs(sorted[1].col - n.col) <= 1 && rng.chance(0.45)) n.next.push(sorted[1].id);
    }
    for (const m of nextRow) {
      if (rows[r].some((n) => n.next.includes(m.id))) continue;
      const from = [...rows[r]].sort((a, b) => Math.abs(a.col - m.col) - Math.abs(b.col - m.col))[0];
      from.next.push(m.id);
    }
  }
  const boss: MapNode = { id: `${act}-boss`, row: ROWS, col: Math.floor(COLS / 2), type: 'chefe', next: [] };
  for (const n of rows[ROWS - 1]) n.next.push(boss.id);
  nodes.push(boss);
  return { act, nodes };
}

function nodeType(row: number, rng: Rng): NodeType {
  if (row === 0) return 'combate';
  if (row === 4) return 'tesouro';
  if (row === ROWS - 1) return 'descanso';
  const options: [NodeType, number][] = [
    ['combate', 46],
    ['evento', 22],
    ['elite', row >= 3 ? 11 : 0],
    ['loja', row >= 2 ? 9 : 0],
    ['descanso', row >= 3 ? 9 : 0],
  ];
  return rng.weighted(options, (o) => o[1])[0];
}

export const nodeById = (map: GameMap, id: string) => map.nodes.find((n) => n.id === id)!;

/** Nós que o jogador pode escolher agora. */
export function availableNodes(run: RunState): MapNode[] {
  if (!run.path.length) return run.map.nodes.filter((n) => n.row === 0);
  const cur = nodeById(run.map, run.path[run.path.length - 1]);
  return cur.next.map((id) => nodeById(run.map, id));
}

/** Escolhe o inimigo de um nó (determinístico pela semente). */
export function enemyFor(run: RunState, type: NodeType): string {
  return withRng(run, (rng) => {
    const tier = type === 'elite' ? 'elite' : type === 'chefe' ? 'chefe' : 'normal';
    let pool = enemiesFor(run.act, tier);
    // A primeira luta do jogo é sempre leve, para aprender os controles.
    if (run.act === 1 && run.stats.combats === 0) pool = pool.filter((e) => e.id === 'legionario' || e.id === 'rot13');
    return rng.pick(pool).id;
  });
}

export function advanceAct(run: RunState): void {
  run.act = (run.act + 1) as 1 | 2 | 3;
  run.path = [];
  run.hp = run.maxHp; // descanso entre atos
  run.map = withRng(run, (rng) => generateMap(run.act, rng));
}

// ---------------- recompensas ----------------

const ACT_TAGS: Record<number, Tag[]> = {
  1: ['bruta', 'frequencia', 'kasiski', 'crib'],
  2: ['decodificar', 'kasiski', 'crib', 'bruta'],
  3: ['dicionario', 'rainbow', 'colisao', 'bruta', 'social', 'canal'],
};

const RARITY_W: Record<string, Record<string, number>> = {
  normal: { comum: 62, incomum: 32, rara: 6 },
  elite: { comum: 40, incomum: 44, rara: 16 },
  chefe: { comum: 0, incomum: 30, rara: 70 },
  loja: { comum: 50, incomum: 38, rara: 12 },
};

/** Sorteia cartas, favorecendo técnicas úteis no ato atual (e nos próximos). */
export function rollCards(run: RunState, n: number, tier: keyof typeof RARITY_W): string[] {
  return withRng(run, (rng) => {
    const chosen: string[] = [];
    const tags = new Set([...ACT_TAGS[run.act], ...(ACT_TAGS[run.act + 1] ?? [])]);
    while (chosen.length < n) {
      const pool = REWARD_POOL.filter((c) => !chosen.includes(c.id));
      const c = rng.weighted(pool, (card: CardDef) => (RARITY_W[tier][card.rarity] ?? 0) * (card.tag && tags.has(card.tag) ? 2 : 1) + 0.01);
      chosen.push(c.id);
    }
    return chosen;
  });
}

export function rollRelic(run: RunState): string | null {
  return withRng(run, (rng) => {
    const pool = RELIC_POOL.filter((r) => !run.relics.includes(r.id));
    if (!pool.length) return null;
    return rng.weighted(pool, (r) => (r.rarity === 'rara' ? 1 : 3)).id;
  });
}

export function combatCredits(run: RunState, tier: 'normal' | 'elite' | 'chefe'): number {
  return withRng(run, (rng) => (tier === 'chefe' ? 75 : tier === 'elite' ? rng.int(25, 35) : rng.int(10, 18)));
}

// ---------------- loja ----------------

export interface ShopOffer {
  cards: { id: string; price: number; sold?: boolean }[];
  relics: { id: string; price: number; sold?: boolean }[];
  removePrice: number;
  removed?: boolean;
}

export function makeShop(run: RunState): ShopOffer {
  const cards = rollCards(run, 5, 'loja');
  return withRng(run, (rng) => ({
    cards: cards.map((id) => {
      const r = CARDS[id].rarity;
      const price = r === 'rara' ? rng.int(140, 160) : r === 'incomum' ? rng.int(70, 85) : rng.int(45, 55);
      return { id, price };
    }),
    relics: rng
      .shuffle(RELIC_POOL.filter((x) => !run.relics.includes(x.id)))
      .slice(0, 2)
      .map((x) => ({ id: x.id, price: x.rarity === 'rara' ? rng.int(170, 200) : rng.int(130, 155) })),
    removePrice: 75,
  }));
}

// ---------------- melhorias ----------------

export function canUpgrade(c: CardInst): boolean {
  const d = CARDS[c.id];
  return !c.up && d.type !== 'status';
}

/** Descreve o que muda ao melhorar uma carta. */
export function upgradeDiff(id: string): string {
  const d = CARDS[id];
  const parts: string[] = [];
  if (d.cost[0] !== d.cost[1]) parts.push(`custo ${d.cost[0]} → ${d.cost[1]}`);
  if (d.dmg && d.dmg[0] !== d.dmg[1]) parts.push(`dano ${d.dmg[0]} → ${d.dmg[1]}`);
  if (d.hits && d.hits[0] !== d.hits[1]) parts.push(`golpes ${d.hits[0]} → ${d.hits[1]}`);
  if (d.blk && d.blk[0] !== d.blk[1]) parts.push(`proxy ${d.blk[0]} → ${d.blk[1]}`);
  if (d.mag && d.mag[0] !== d.mag[1]) parts.push(`efeito ${d.mag[0]} → ${d.mag[1]}`);
  return parts.join(', ') || 'melhor';
}

// ---------------- salvamento ----------------

const SAVE_KEY = 'cifra.run.v1';
const META_KEY = 'cifra.meta.v1';

export function saveRun(run: RunState | null): void {
  try {
    if (run) localStorage.setItem(SAVE_KEY, JSON.stringify(run));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* modo privado: segue sem salvar */
  }
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunState;
    if (run.version !== 1 || !run.deck.every((c) => CARDS[c.id]) || !run.relics.every((r) => RELICS[r])) return null;
    return run;
  } catch {
    return null;
  }
}

export interface Meta {
  /** Entradas do Códex desbloqueadas (tipos de cifra, técnicas, inimigos). */
  codex: string[];
  /** Cifras quebradas à mão (troféus). */
  manual: string[];
  runs: number;
  wins: number;
  bestAct: number;
  settings: { sound: boolean; crt: boolean; motion: boolean };
}

export function loadMeta(): Meta {
  const base: Meta = { codex: [], manual: [], runs: 0, wins: 0, bestAct: 0, settings: { sound: true, crt: true, motion: true } };
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return base;
    const m = JSON.parse(raw);
    return { ...base, ...m, settings: { ...base.settings, ...(m.settings ?? {}) } };
  } catch {
    return base;
  }
}

export function saveMeta(m: Meta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* sem armazenamento */
  }
}

export function unlock(meta: Meta, ...ids: string[]): string[] {
  const fresh = ids.filter((id) => !meta.codex.includes(id));
  meta.codex.push(...fresh);
  if (fresh.length) saveMeta(meta);
  return fresh;
}

export const allCardIds = () => ALL_CARDS.map((c) => c.id);
