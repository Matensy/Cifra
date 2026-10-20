import { describe, expect, it } from 'vitest';
import { AFFINITY } from '../src/content/affinity';
import { ALL_CARDS, CARDS } from '../src/content/cards';
import { CODEX, CODEX_BY_ID } from '../src/content/codex';
import { ALL_ENEMIES, ENEMIES } from '../src/content/enemies';
import { EVENTS } from '../src/content/events';
import { RELICS } from '../src/content/relics';
import { BYTE_MESSAGES, TARGET_PASSWORDS, WORDLIST, XOR_KEYS } from '../src/content/texts';
import { bigramModel, solveRepeatingXor } from '../src/crypto/analysis';
import { fromUtf8, utf8 } from '../src/crypto/bytes';
import { xorBytes } from '../src/crypto/ciphers';
import { Combat } from '../src/game/combat';
import { checkAnswer, hashGuess, makePuzzle, revealed } from '../src/game/puzzles';
import { Rng } from '../src/game/rng';
import { availableNodes, generateMap, newRun, ROWS } from '../src/game/run';
import type { CipherKind } from '../src/game/types';

const KINDS = Object.keys(AFFINITY) as CipherKind[];

describe('puzzles', () => {
  for (const kind of KINDS) {
    it(`${kind}: o segredo verdadeiro é aceito e um chute errado não`, () => {
      for (let s = 0; s < 5; s++) {
        const p = makePuzzle(kind, Rng.fromSeed(kind + s));
        expect(checkAnswer(p, p.secret)).toBe(true);
        expect(checkAnswer(p, 'resposta totalmente errada')).toBe(false);
      }
    });
  }
  it('o PIN é encontrável por força bruta (10.000 tentativas)', () => {
    const p = makePuzzle('pin', Rng.fromSeed('pin'));
    let found = '';
    for (let i = 0; i < 10000 && !found; i++) {
      const g = String(i).padStart(4, '0');
      if (hashGuess(p, g) === p.cipher) found = g;
    }
    expect(found).toBe(p.secret);
  });
  it('todas as senhas-alvo estão na wordlist (o dicionário sempre funciona)', () => {
    for (const pw of TARGET_PASSWORDS) expect(WORDLIST).toContain(pw);
  });
  it('a revelação mostra mais conforme a fração cresce', () => {
    const p = makePuzzle('caesar', Rng.fromSeed('x'));
    expect(revealed(p, 0).text.replace(/[ ·]/g, '')).toBe('');
    expect(revealed(p, 1).text).toBe(p.secret);
  });
});

describe('solucionador de XOR repetido', () => {
  it('quebra TODAS as combinações de mensagem e chave do jogo', () => {
    const upper = Array.from({ length: 26 }, (_, i) => 65 + i);
    const model = bigramModel(CODEX.map((e) => `${e.how} ${e.attack} ${e.today}`).join(' '));
    for (const msg of BYTE_MESSAGES)
      for (const key of XOR_KEYS) {
        const data = xorBytes(utf8(msg), utf8(key));
        const found = fromUtf8(xorBytes(data, solveRepeatingXor(data, 8, upper, model)));
        expect(found, `${msg} / ${key}`).toBe(msg);
      }
  });
});

describe('conteúdo consistente', () => {
  it('todo inimigo tem tipo de cifra, padrão válido e entrada no Códex', () => {
    for (const e of ALL_ENEMIES) {
      expect(AFFINITY[e.kind]).toBeDefined();
      for (const i of e.pattern) expect(e.moves[i]).toBeDefined();
      expect(CODEX_BY_ID[e.kind]).toBeDefined();
    }
  });
  it('toda técnica de carta tem entrada no Códex', () => {
    for (const c of ALL_CARDS) if (c.tag) expect(CODEX_BY_ID['tag:' + c.tag]).toBeDefined();
  });
  it('cada ato tem inimigos normais, elite e chefe', () => {
    for (const act of [1, 2, 3])
      for (const tier of ['normal', 'elite', 'chefe']) expect(ALL_ENEMIES.some((e) => e.act === act && e.tier === tier)).toBe(true);
  });
  it('os eventos geram escolhas válidas', () => {
    const run = newRun('eventos');
    for (const build of EVENTS) {
      const ev = build(run, Rng.fromSeed(build.name));
      expect(ev.choices.length).toBeGreaterThan(1);
      for (const ch of ev.choices) expect(ch.apply().text.length).toBeGreaterThan(10);
    }
  });
});

describe('mapa', () => {
  it('é conectado: todo nó é alcançável e leva ao chefe', () => {
    for (let s = 0; s < 30; s++) {
      const map = generateMap(1, Rng.fromSeed('mapa' + s));
      const byId = new Map(map.nodes.map((n) => [n.id, n]));
      const reach = new Set(map.nodes.filter((n) => n.row === 0).map((n) => n.id));
      for (let r = 0; r <= ROWS; r++) for (const n of map.nodes.filter((x) => x.row === r && reach.has(x.id))) n.next.forEach((id) => reach.add(id));
      expect(reach.size).toBe(map.nodes.length);
      for (const n of map.nodes) if (n.type !== 'chefe') expect(n.next.every((id) => byId.get(id)!.row === n.row + 1)).toBe(true);
    }
  });
  it('a mesma semente gera o mesmo mapa', () => {
    expect(JSON.stringify(generateMap(2, Rng.fromSeed('abc')))).toBe(JSON.stringify(generateMap(2, Rng.fromSeed('abc'))));
  });
  it('a partida começa na primeira linha', () => {
    expect(availableNodes(newRun('s')).every((n) => n.row === 0)).toBe(true);
  });
});

function combatWith(enemy: string, hand: string[], seed = 't') {
  const run = newRun(seed);
  run.relics = [];
  run.deck = hand.map((id, i) => ({ uid: 'u' + i, id, up: false }));
  const c = new Combat(run, enemy, Rng.fromSeed(seed));
  c.start();
  c.takeEvents();
  return c;
}

describe('combate', () => {
  it('força bruta é super efetiva contra César (×2) e inútil não é', () => {
    const c = combatWith('legionario', ['forca_bruta', 'forca_bruta', 'forca_bruta', 'forca_bruta', 'forca_bruta']);
    const hp = c.enemy.hp;
    c.play(c.hand[0].uid);
    expect(hp - c.enemy.hp).toBe(12);
  });
  it('rainbow table não faz nada contra hash com sal', () => {
    const c = combatWith('salted', ['rainbow', 'rainbow', 'rainbow', 'rainbow', 'rainbow']);
    expect(c.preview(c.hand[0]).mult).toBe(0);
    expect(c.preview(c.hand[0]).why).toMatch(/SAL/);
  });
  it('Vigenère resiste à frequência até o Kasiski descobrir o período', () => {
    const c = combatWith('vigenere', ['freq', 'kasiski', 'freq', 'proxy', 'proxy']);
    const freq = c.hand.find((x) => x.id === 'freq')!;
    expect(c.preview(freq).mult).toBe(0.25);
    c.play(c.hand.find((x) => x.id === 'kasiski')!.uid);
    expect(c.enemy.statuses.periodo).toBe(1);
    expect(c.preview(freq).mult).toBe(1.75);
  });
  it('o one-time pad é imune até reutilizar a chave', () => {
    const c = combatWith('otp', Array(12).fill('crib'));
    expect(c.preview(c.hand[0]).D).toBe(0);
    c.endTurn(); // turno 1: sigilo perfeito
    c.endTurn(); // turno 2: o operador reutiliza a chave
    expect(c.enemy.statuses.reuso).toBe(1);
    expect(c.preview(c.hand[0]).mult).toBe(2);
  });
  it('a quebra manual com a resposta certa vence o combate', () => {
    const c = combatWith('legionario', ['proxy', 'proxy', 'proxy', 'proxy', 'proxy']);
    expect(c.manual(c.puzzle.secret)).toBe(true);
    expect(c.over).toBe('win');
  });
  it('resposta errada custa Furtividade', () => {
    const c = combatWith('legionario', ['proxy', 'proxy', 'proxy', 'proxy', 'proxy']);
    const hp = c.hp;
    expect(c.manual('NADA A VER')).toBe(false);
    expect(c.hp).toBe(hp - 3);
  });
  it('o Cofre troca de algoritmo nas fases e cada quebra manual derruba uma fase', () => {
    const c = combatWith('cofre', ['proxy', 'proxy', 'proxy', 'proxy', 'proxy']);
    expect(c.enemy.kind).toBe('md5');
    c.manual(c.puzzle.secret);
    expect(c.enemy.kind).toBe('salted');
    expect(c.over).toBeNull();
    c.manual(c.puzzle.secret);
    expect(c.enemy.kind).toBe('pbkdf2');
    c.manual(c.puzzle.secret);
    expect(c.over).toBe('win');
  });
  it('o inimigo ataca, o Proxy absorve e o jogador pode perder', () => {
    const c = combatWith('pin', ['ruido', 'ruido', 'ruido', 'ruido', 'ruido']);
    c.hp = 5;
    c.endTurn();
    expect(c.over).toBe('lose');
  });
  it('todas as cartas jogáveis podem ser jogadas sem erro', () => {
    for (const card of ALL_CARDS.filter((x) => !x.unplayable)) {
      const c = combatWith('md5', [card.id, 'proxy', 'proxy', 'proxy', 'proxy']);
      c.cpu = 10;
      expect(c.play(c.hand.find((x) => x.id === card.id)!.uid)).toBe(true);
    }
  });
  it('referências internas existem', () => {
    expect(CARDS.forca_bruta).toBeDefined();
    expect(ENEMIES.legionario).toBeDefined();
    expect(RELICS.terminal).toBeDefined();
  });
});
