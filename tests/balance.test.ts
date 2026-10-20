// Teste de balanceamento: um bot guloso (joga a carta de maior valor por CPU)
// enfrenta cada inimigo várias vezes. Garante que nenhum combate fique
// impossível ou trivial demais depois de mexer nos números.

import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/content/cards';
import { ALL_ENEMIES } from '../src/content/enemies';
import { Combat } from '../src/game/combat';
import { Rng } from '../src/game/rng';
import { addCard, newRun } from '../src/game/run';

function botFight(enemy: string, extra: string[], ups: number, seed: string) {
  const run = newRun(seed);
  extra.forEach((id) => addCard(run, id));
  run.deck.slice(0, ups).forEach((c) => (c.up = true));
  const c = new Combat(run, enemy, Rng.fromSeed(seed + enemy));
  c.start();
  for (let t = 0; t < 40 && !c.over; t++) {
    for (;;) {
      const opts = c.hand.map((x) => ({ x, p: c.preview(x), d: CARDS[x.id] })).filter((o) => o.p.playable);
      if (!opts.length) break;
      const incoming = (c.enemy.intent.damage ?? 0) * (c.enemy.intent.hits ?? 1);
      const val = (o: (typeof opts)[number]) =>
        o.p.D * o.p.H + (incoming > c.block ? o.p.B * 1.2 : o.p.B * 0.2) + (o.d.type === 'ferramenta' ? 4 : 0);
      opts.sort((a, b) => val(b) / Math.max(1, b.p.cost) - val(a) / Math.max(1, a.p.cost));
      c.play(opts[0].x.uid);
      if (c.over) break;
    }
    if (!c.over) c.endTurn();
  }
  return { win: c.over === 'win', lost: run.hp - c.hp };
}

/** Baralhos típicos de quem chega em cada ato (cartas extras e quantas melhoradas). */
const DECKS: Record<number, [string[], number]> = {
  1: [['kasiski', 'bigramas', 'vpn'], 2],
  2: [['kasiski', 'decodificar', 'crib', 'crib_drag', 'vpn', 'gpu', 'tor', 'bigramas'], 5],
  3: [['kasiski', 'decodificar', 'crib', 'gpu', 'tor', 'dicionario', 'dicionario', 'rainbow', 'social', 'aniversario', 'mutacao', 'vpn'], 8],
};

describe('balanceamento (bot guloso, 40 partidas por inimigo)', () => {
  for (const e of ALL_ENEMIES) {
    it(`${e.name}`, () => {
      const N = 40;
      let wins = 0;
      for (let s = 0; s < N; s++) if (botFight(e.id, ...DECKS[e.act], 'b' + s).win) wins++;
      const rate = wins / N;
      if (e.tier === 'normal') expect(rate, 'inimigos normais devem ser vencíveis').toBeGreaterThanOrEqual(0.9);
      expect(rate, 'nenhum combate pode ser impossível').toBeGreaterThanOrEqual(0.3);
    });
  }
});
