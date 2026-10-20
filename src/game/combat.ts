// Motor de combate. Não sabe nada de tela: muda o estado e emite eventos
// que a interface anima na ordem certa.

import { effectiveness } from '../content/affinity';
import { CARDS, type CardCtx, type CardDef } from '../content/cards';
import { ENEMIES } from '../content/enemies';
import { relicTagBonus } from '../content/relics';
import { checkAnswer, makePuzzle } from './puzzles';
import type { Rng } from './rng';
import type { CardInst, EnemyDef, EnemyState, MoveDef, Puzzle, RunState, Statuses, Tag } from './types';

export type Ev =
  | { t: 'draw'; uid: string }
  | { t: 'shuffle' }
  | { t: 'play'; uid: string; cardId: string }
  | { t: 'discardHand' }
  | { t: 'exhaust'; uid: string }
  | { t: 'hit'; amount: number; blocked: number; mult: number; why: string; tag?: Tag; big?: boolean }
  | { t: 'playerHit'; amount: number; blocked: number; source: string }
  | { t: 'negated'; source: string }
  | { t: 'block'; who: 'player' | 'enemy'; amount: number }
  | { t: 'status'; who: 'player' | 'enemy'; key: string; n: number }
  | { t: 'cpu'; n: number }
  | { t: 'heal'; n: number }
  | { t: 'selfDamage'; n: number; reason: string }
  | { t: 'enemyMove'; move: MoveDef }
  | { t: 'addCard'; cardId: string; n: number }
  | { t: 'phase'; name: string }
  | { t: 'manual'; ok: boolean }
  | { t: 'turn'; n: number }
  | { t: 'msg'; text: string }
  | { t: 'win' }
  | { t: 'lose' };

export interface CardPreview {
  cost: number;
  D: number; // dano por golpe já com bônus e multiplicador
  H: number;
  B: number;
  M: number;
  mult: number;
  why: string;
  playable: boolean;
}

export const HAND_SIZE = 5;
export const BASE_CPU = 3;

export class Combat {
  def: EnemyDef;
  enemy: EnemyState;
  puzzle: Puzzle;
  hp: number;
  maxHp: number;
  block = 0;
  cpu = 0;
  maxCpu = BASE_CPU;
  statuses: Statuses = {};
  drawPile: CardInst[];
  hand: CardInst[] = [];
  discard: CardInst[] = [];
  exhausted: CardInst[] = [];
  turn = 0;
  over: null | 'win' | 'lose' = null;
  manualSolved = false;
  damageDealt = 0;
  bestHit = 0;
  cardsPlayed = 0;
  private events: Ev[] = [];
  private yubikeyReady: boolean;
  private tempUid = 0;

  constructor(private run: RunState, enemyId: string, private rng: Rng) {
    this.def = ENEMIES[enemyId];
    const hp = rng.int(this.def.hp[0], this.def.hp[1]);
    this.enemy = {
      defId: this.def.id, name: this.def.name, kind: this.def.kind, hp, maxHp: hp, block: 0,
      statuses: { ...(this.def.start ?? {}) }, step: 0, intent: this.def.moves[this.def.pattern[0]], phase: 0,
    };
    this.puzzle = makePuzzle(this.def.kind, rng);
    this.hp = run.hp;
    this.maxHp = run.maxHp;
    this.drawPile = rng.shuffle(run.deck.map((c) => ({ ...c })));
    this.yubikeyReady = run.relics.includes('yubikey');
  }

  takeEvents(): Ev[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private emit(e: Ev) {
    this.events.push(e);
  }

  // ---------------- ciclo de turnos ----------------

  start(): void {
    if (this.run.relics.includes('enigma')) this.applyEnemy('exposto', 2);
    this.startTurn();
  }

  private startTurn(): void {
    this.turn++;
    this.emit({ t: 'turn', n: this.turn });
    this.block = 0;
    this.cpu = this.maxCpu + (this.turn === 1 && this.run.relics.includes('cafeteira') ? 1 : 0);
    if (this.turn === 1 && this.run.relics.includes('firewall')) this.gainBlock(6);
    let n = HAND_SIZE;
    if (this.turn === 1 && this.run.relics.includes('terminal')) n++;
    if (this.run.relics.includes('nonce')) n++;
    this.drawCards(n);
  }

  endTurn(): void {
    if (this.over) return;
    const ids = this.hand.filter((c) => c.id === 'ids').length;
    if (ids) this.loseHp(3 * ids, 'Alerta do IDS');
    if (this.over) return;
    delete this.statuses.turing;
    this.discard.push(...this.hand);
    this.hand = [];
    this.emit({ t: 'discardHand' });
    this.enemyTurn();
    if (!this.over) this.startTurn();
  }

  private enemyTurn(): void {
    const e = this.enemy;
    const move = e.intent;
    e.block = 0;
    this.emit({ t: 'enemyMove', move });
    const st = e.statuses;
    if (move.damage) {
      const hits = move.hits ?? 1;
      for (let i = 0; i < hits && !this.over; i++) this.enemyAttack(move.damage + (st.forca ?? 0), move.name);
    }
    if (this.over) return;
    if (move.block) {
      e.block += move.block;
      this.emit({ t: 'block', who: 'enemy', amount: move.block });
    }
    const n = move.amount ?? 1;
    switch (move.effect) {
      case 'ruido':
      case 'ids':
        for (let i = 0; i < n; i++) this.discard.push({ uid: `t${this.tempUid++}`, id: move.effect, up: false, temp: true });
        this.emit({ t: 'addCard', cardId: move.effect, n });
        break;
      case 'forca':
        this.applyEnemy('forca', n);
        break;
      case 'rastreado':
        this.statuses.rastreado = (this.statuses.rastreado ?? 0) + n;
        this.emit({ t: 'status', who: 'player', key: 'rastreado', n });
        break;
      case 'trocarChave':
        if (st.periodo) {
          delete st.periodo;
          this.emit({ t: 'msg', text: 'A chave mudou! O período descoberto não vale mais.' });
          this.emit({ t: 'status', who: 'enemy', key: 'periodo', n: 0 });
        }
        break;
      case 'reuso':
        delete st.imune;
        st.reuso = 1;
        this.emit({ t: 'msg', text: 'O operador reutilizou o bloco de chave! O sigilo perfeito acabou.' });
        this.emit({ t: 'status', who: 'enemy', key: 'reuso', n: 1 });
        break;
      case 'cura':
        e.hp = Math.min(e.maxHp, e.hp + n);
        break;
    }
    // durações
    for (const k of ['exposto']) if (st[k]) st[k]--;
    if (this.statuses.rastreado) this.statuses.rastreado--;
    delete this.statuses.honeypot;
    // próxima jogada
    e.step++;
    e.intent = this.def.moves[this.def.pattern[e.step % this.def.pattern.length]];
  }

  private enemyAttack(raw: number, source: string): void {
    let dmg = raw;
    if (this.statuses.rastreado) dmg = Math.floor(dmg * 1.5);
    if (this.yubikeyReady) {
      this.yubikeyReady = false;
      this.emit({ t: 'negated', source: 'YubiKey' });
      return;
    }
    const blocked = Math.min(this.block, dmg);
    this.block -= blocked;
    const taken = dmg - blocked;
    this.hp -= taken;
    this.emit({ t: 'playerHit', amount: taken, blocked, source });
    if (this.statuses.honeypot) this.dealRaw(this.statuses.honeypot, 'Honeypot');
    if (this.hp <= 0) {
      this.hp = 0;
      this.over = 'lose';
      this.emit({ t: 'lose' });
    }
  }

  // ---------------- cartas ----------------

  cardDef(c: CardInst): CardDef {
    return CARDS[c.id];
  }

  /** Números da carta já com todos os bônus (para mostrar na mão). */
  preview(c: CardInst): CardPreview {
    const d = this.cardDef(c);
    const i = c.up ? 1 : 0;
    const cost = d.cost[i];
    const base = d.dmg ? d.dmg[i] : 0;
    const { mult, why } = this.eff(d.tag);
    const D = d.dmg ? this.attackValue(base, d.tag, false) : 0;
    return {
      cost,
      D,
      H: d.hits ? d.hits[i] : 1,
      B: d.blk ? d.blk[i] : 0,
      M: d.mag ? d.mag[i] : 0,
      mult: d.dmg ? mult : 1,
      why: d.dmg ? why : '',
      playable: !d.unplayable && cost <= this.cpu && !this.over,
    };
  }

  /** Multiplicador de uma técnica contra o inimigo atual. */
  eff(tag: Tag | undefined) {
    if (this.enemy.kind === 'otp' && !this.enemy.statuses.reuso && !tag)
      return { mult: 0, why: 'Sigilo perfeito: nem um zero-day ajuda contra matemática pura.' };
    return effectiveness(this.enemy.kind, tag, this.enemy.statuses);
  }

  private attackValue(base: number, tag: Tag | undefined, consume: boolean): number {
    let v = base + (this.statuses.foco ?? 0) + (tag ? this.statuses['bonus_' + tag] ?? 0 : 0) + relicTagBonus(this.run.relics, tag);
    if (this.statuses.turing) {
      v *= 2;
      if (consume) delete this.statuses.turing;
    }
    v *= this.eff(tag).mult;
    if (this.enemy.statuses.exposto) v *= 1.5;
    return Math.max(0, Math.floor(v));
  }

  play(uid: string): boolean {
    if (this.over) return false;
    const card = this.hand.find((c) => c.uid === uid);
    if (!card) return false;
    const p = this.preview(card);
    if (!p.playable) return false;
    const def = this.cardDef(card);
    this.cpu -= p.cost;
    this.hand = this.hand.filter((c) => c !== card);
    this.cardsPlayed++;
    this.emit({ t: 'play', uid, cardId: card.id });

    const i = card.up ? 1 : 0;
    const raw = { D: def.dmg ? def.dmg[i] : 0, H: def.hits ? def.hits[i] : 1, B: def.blk ? def.blk[i] : 0, M: def.mag ? def.mag[i] : 0 };
    const ctx: CardCtx = {
      up: card.up,
      ...raw,
      attack: (dmg = raw.D, hits = raw.H, opts = {}) => {
        const tag = opts.tag ?? def.tag;
        const per = this.attackValue(dmg, tag, true);
        const { mult, why } = this.eff(tag);
        for (let h = 0; h < hits && !this.over; h++) this.dealToEnemy(per, mult, why, tag, !!opts.ignoreBlock);
      },
      block: (n = raw.B) => this.gainBlock(n),
      draw: (n) => this.drawCards(n),
      cpu: (n) => {
        this.cpu += n;
        this.emit({ t: 'cpu', n });
      },
      enemyStatus: (k, n) => this.applyEnemy(k, n),
      selfStatus: (k, n) => {
        this.statuses[k] = (this.statuses[k] ?? 0) + n;
        this.emit({ t: 'status', who: 'player', key: k, n });
      },
      loseHp: (n) => this.loseHp(n, def.name),
      heal: (n) => this.heal(n),
      enemyHas: (k) => !!this.enemy.statuses[k],
      cleanse: () => {
        delete this.statuses.rastreado;
        this.emit({ t: 'status', who: 'player', key: 'rastreado', n: 0 });
      },
    };
    if (def.play) def.play(ctx);
    else {
      if (def.dmg) ctx.attack();
      if (def.blk) ctx.block();
    }
    if (def.exhaust) {
      this.exhausted.push(card);
      this.emit({ t: 'exhaust', uid });
    } else this.discard.push(card);
    return true;
  }

  private dealToEnemy(amount: number, mult: number, why: string, tag: Tag | undefined, ignoreBlock: boolean): void {
    const e = this.enemy;
    let blocked = 0;
    if (!ignoreBlock) {
      blocked = Math.min(e.block, amount);
      e.block -= blocked;
    }
    const dmg = amount - blocked;
    e.hp = Math.max(0, e.hp - dmg);
    this.damageDealt += dmg;
    this.bestHit = Math.max(this.bestHit, dmg);
    this.emit({ t: 'hit', amount: dmg, blocked, mult, why, tag });
    this.afterEnemyDamage();
  }

  private dealRaw(amount: number, why: string): void {
    const e = this.enemy;
    const blocked = Math.min(e.block, amount);
    e.block -= blocked;
    e.hp = Math.max(0, e.hp - (amount - blocked));
    this.emit({ t: 'hit', amount: amount - blocked, blocked, mult: 1, why });
    this.afterEnemyDamage();
  }

  private afterEnemyDamage(): void {
    const e = this.enemy;
    if (e.hp <= 0) {
      this.over = 'win';
      this.emit({ t: 'win' });
      return;
    }
    const phases = this.def.phases ?? [];
    while (e.phase < phases.length && e.hp <= phases[e.phase].at * e.maxHp) {
      const ph = phases[e.phase++];
      e.kind = ph.kind;
      e.block = 0;
      this.puzzle = makePuzzle(ph.kind, this.rng);
      this.emit({ t: 'phase', name: ph.name });
    }
  }

  private gainBlock(n: number): void {
    this.block += n;
    this.emit({ t: 'block', who: 'player', amount: n });
  }

  private applyEnemy(k: string, n: number): void {
    const st = this.enemy.statuses;
    if (k === 'periodo') {
      if (this.enemy.kind !== 'vigenere' && this.enemy.kind !== 'xorN') return;
      st.periodo = 1;
    } else st[k] = (st[k] ?? 0) + n;
    this.emit({ t: 'status', who: 'enemy', key: k, n });
  }

  private loseHp(n: number, reason: string): void {
    this.hp = Math.max(0, this.hp - n);
    this.emit({ t: 'selfDamage', n, reason });
    if (this.hp <= 0) {
      this.over = 'lose';
      this.emit({ t: 'lose' });
    }
  }

  private heal(n: number): void {
    const v = Math.min(n, this.maxHp - this.hp);
    this.hp += v;
    this.emit({ t: 'heal', n: v });
  }

  private drawCards(n: number): void {
    for (let i = 0; i < n; i++) {
      if (this.hand.length >= 10) return;
      if (!this.drawPile.length) {
        if (!this.discard.length) return;
        this.drawPile = this.rng.shuffle(this.discard);
        this.discard = [];
        this.emit({ t: 'shuffle' });
      }
      const c = this.drawPile.pop()!;
      this.hand.push(c);
      this.emit({ t: 'draw', uid: c.uid });
    }
  }

  // ---------------- quebra manual ----------------

  /** Fração da mensagem já recuperada (para revelar o segredo aos poucos). */
  revealFraction(): number {
    const e = this.enemy;
    const phases = this.def.phases ?? [];
    if (!phases.length) return 1 - e.hp / e.maxHp;
    // Em chefes com fases, cada fase tem seu próprio segredo.
    const top = e.phase === 0 ? 1 : phases[e.phase - 1].at;
    const bottom = e.phase < phases.length ? phases[e.phase].at : 0;
    return Math.max(0, Math.min(1, (top - e.hp / e.maxHp) / (top - bottom)));
  }

  /** Custo em CPU de rodar uma ferramenta automática dentro da quebra manual. */
  spendCpu(n: number): boolean {
    if (this.cpu < n || this.over) return false;
    this.cpu -= n;
    this.emit({ t: 'cpu', n: -n });
    return true;
  }

  manual(answer: string): boolean {
    if (this.over) return false;
    const ok = checkAnswer(this.puzzle, answer);
    this.emit({ t: 'manual', ok });
    if (!ok) {
      this.loseHp(3, 'Alarme: senha errada');
      return false;
    }
    this.manualSolved = true;
    const e = this.enemy;
    const phases = this.def.phases ?? [];
    let target = e.phase < phases.length ? Math.floor(phases[e.phase].at * e.maxHp) : 0;
    // Chefes sem fases não caem de uma vez: perdem 40% e trocam a chave.
    const bossSwap = this.def.tier === 'chefe' && !phases.length && e.hp > Math.ceil(e.maxHp * 0.4);
    if (bossSwap) target = e.hp - Math.ceil(e.maxHp * 0.4);
    const dmg = e.hp - target;
    e.block = 0;
    e.hp = target;
    this.damageDealt += dmg;
    this.bestHit = Math.max(this.bestHit, dmg);
    this.emit({ t: 'hit', amount: dmg, blocked: 0, mult: 1, why: 'Quebra manual: você achou a chave!', big: true });
    this.afterEnemyDamage();
    if (bossSwap && !this.over) {
      this.puzzle = makePuzzle(e.kind, this.rng);
      this.emit({ t: 'msg', text: `${e.name} perdeu 40% da entropia e trocou a chave! A mensagem nova precisa ser quebrada de novo.` });
      this.emit({ t: 'phase', name: 'NOVA CHAVE!' });
    }
    return true;
  }

  pileCounts() {
    return { draw: this.drawPile.length, discard: this.discard.length, exhausted: this.exhausted.length };
  }
}
