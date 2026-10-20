// Fluxo da partida: mapa → nó → recompensa → mapa... até o chefe final.

import { CARDS } from '../../content/cards';
import { CODEX_BY_ID } from '../../content/codex';
import { ENEMIES } from '../../content/enemies';
import { EVENTS, type Outcome } from '../../content/events';
import { RELICS } from '../../content/relics';
import type { Combat } from '../../game/combat';
import { isHashPuzzle } from '../../game/puzzles';
import {
  addCard, addRelic, advanceAct, availableNodes, canUpgrade, combatCredits, enemyFor, makeShop, newRun, nodeById,
  rollCards, rollRelic, ROWS, saveMeta, withRng,
} from '../../game/run';
import type { MapNode, NodeType } from '../../game/types';
import { ACT_NAMES, app, discover, hud, persist, pickUpgrade, refreshHud, showDeck } from '../app';
import { sfx } from '../audio';
import { cardEl } from '../cardview';
import { add, clear, countTo, h, modal, mount, sleep, toast } from '../dom';
import { burst, centerOf, flash, setBackground } from '../fx';
import { showCombat } from './combat';
import { codexDetail } from './codex';
import { showTitle } from './title';

const NODE_ICON: Record<NodeType, string> = { combate: '⚔️', elite: '👾', descanso: '❄️', loja: '🛒', evento: '❓', tesouro: '📦', chefe: '👑' };
const NODE_NAME: Record<NodeType, string> = {
  combate: 'Combate', elite: 'Elite (difícil, dá implante)', descanso: 'Resfriar (descanso)', loja: 'Mercado negro',
  evento: 'Terminal desconhecido', tesouro: 'Tesouro', chefe: 'Chefe do ato',
};

export function startNewRun(seed: string) {
  app.run = newRun(seed);
  app.meta.runs++;
  saveMeta(app.meta);
  persist();
  actIntro();
}

function runMenu() {
  let close = () => {};
  close = modal(h('div', null,
    h('h2', null, 'Menu'),
    h('p', { class: 'muted' }, `Semente: ${app.run?.seed}`),
    h('div', { class: 'choices' },
      h('button', { class: 'btn cyan', onclick: () => { close(); import('./codex').then((m) => m.showCodex(goMap)); } }, '📖 Códex'),
      h('button', { class: 'btn cyan', onclick: () => { close(); import('./lab').then((m) => m.showLab(goMap)); } }, '🧪 Laboratório'),
      h('button', { class: 'btn ghost', onclick: () => { close(); showTitle(); } }, '💾 Salvar e voltar ao título'),
      h('button', { class: 'btn magenta', onclick: () => {
        if (!confirm('Abandonar esta partida? O progresso dela será perdido (o Códex fica).')) return;
        close();
        app.run = null;
        persist();
        showTitle();
      } }, '🏳 Abandonar partida'),
    )));
}

// ---------------- introdução do ato ----------------

function actIntro() {
  const run = app.run!;
  const [name, desc] = ACT_NAMES[run.act];
  setBackground('rain');
  sfx.glitch();
  mount(h('div', { class: 'center-screen' }, h('div', { class: 'title-wrap' },
    h('div', { class: 'logo glitch', style: 'font-size:clamp(50px,9vw,110px)', 'data-text': name.split(' — ')[0] }, name.split(' — ')[0]),
    h('div', { class: 'tagline' }, name.split(' — ')[1]),
    h('p', { class: 'muted', style: 'font-size:15px' }, desc),
    h('div', { style: 'margin-top:30px' }, h('button', { class: 'btn big', onclick: () => { sfx.click(); goMap(); } }, '▶ Entrar no sistema')))));
}

// ---------------- mapa ----------------

export function goMap() {
  const run = app.run!;
  setBackground('calm');
  persist();
  const avail = new Set(availableNodes(run).map((n) => n.id));
  const cur = run.path[run.path.length - 1];
  const W = 720;
  const rowH = 92;
  const H = (ROWS + 1) * rowH + 60;
  const jitter = (id: string, k: number) => {
    let s = 0;
    for (const ch of id) s = (s * 31 + ch.charCodeAt(0)) % 997;
    return ((s * k) % 37) - 18;
  };
  const pos = (n: MapNode) => ({
    x: n.type === 'chefe' ? W / 2 : 90 + n.col * 135 + jitter(n.id, 7),
    y: 50 + (ROWS - n.row) * rowH + (n.type === 'chefe' ? -10 : jitter(n.id, 11) * 0.6),
  });
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', String(W));
  svg.setAttribute('class', 'map-svg');
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';

  for (const n of run.map.nodes) {
    const a = pos(n);
    for (const id of n.next) {
      const b = pos(nodeById(run.map, id));
      const path = document.createElementNS(ns, 'path');
      const midY = (a.y + b.y) / 2;
      path.setAttribute('d', `M${a.x},${a.y} C${a.x},${midY} ${b.x},${midY} ${b.x},${b.y}`);
      const i = run.path.indexOf(n.id);
      let cls = 'map-edge';
      if (i >= 0 && run.path[i + 1] === id) cls += ' walked';
      else if (n.id === cur && avail.has(id)) cls += ' open';
      path.setAttribute('class', cls);
      svg.append(path);
    }
  }
  let focus: SVGGElement | null = null;
  for (const n of run.map.nodes) {
    const { x, y } = pos(n);
    const g = document.createElementNS(ns, 'g');
    const done = run.path.includes(n.id);
    const open = avail.has(n.id);
    g.setAttribute('class', `map-node ${n.type} ${done ? 'done' : ''} ${open ? 'open' : ''} ${n.id === cur ? 'current' : ''} ${!done && !open ? 'locked' : ''}`);
    const r = n.type === 'chefe' ? 38 : 25;
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    circle.setAttribute('r', String(r));
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', String(x));
    text.setAttribute('y', String(y + 1));
    if (n.type === 'chefe') text.setAttribute('style', 'font-size:34px');
    text.textContent = n.type === 'chefe' ? ENEMIES[bossId(run.act)].glyph : NODE_ICON[n.type];
    const title = document.createElementNS(ns, 'title');
    title.textContent = n.type === 'chefe' ? `Chefe: ${ENEMIES[bossId(run.act)].name}` : NODE_NAME[n.type];
    g.append(circle, text, title);
    if (open) {
      g.addEventListener('click', () => { sfx.click(); enterNode(n); });
      g.addEventListener('mouseenter', () => sfx.hover());
      focus ??= g;
    }
    svg.append(g);
  }

  const [name, desc] = ACT_NAMES[run.act];
  mount(
    hud({ onMenu: runMenu }),
    h('div', { class: 'map-screen' },
      h('div', { class: 'map-scroll' }, h('div', { class: 'act-banner' }, h('h2', null, name), h('p', null, desc)), svg),
      h('aside', { class: 'legend' },
        h('h3', null, 'Legenda'),
        h('ul', null, ...(Object.keys(NODE_ICON) as NodeType[]).map((t) => h('li', null, h('span', { style: 'font-size:20px' }, NODE_ICON[t]), NODE_NAME[t]))),
        h('div', { class: 'tipbox' },
          h('p', null, '🎯 Escolha um caminho pelos nós que pulsam. Passe o mouse nos inimigos durante o combate para ver as fraquezas deles.'),
          h('p', null, `👑 Chefe deste ato: `, h('b', { class: 'amber' }, ENEMIES[bossId(run.act)].name), '.'),
          h('p', null, '📖 Tudo que você encontra entra no Códex, a enciclopédia do jogo.')))),
  );
  setTimeout(() => focus?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
}

const bossId = (act: number) => (act === 1 ? 'vigenere' : act === 2 ? 'otp' : 'cofre');

function enterNode(n: MapNode) {
  const run = app.run!;
  run.path.push(n.id);
  persist();
  switch (n.type) {
    case 'combate':
    case 'elite':
    case 'chefe':
      return fight(n.type);
    case 'descanso': return rest();
    case 'loja': return shop();
    case 'evento': return event();
    case 'tesouro': return treasure();
  }
}

// ---------------- combate ----------------

/** Só em desenvolvimento: ?enemy=<id> pula direto para um combate (para testar cada cifra). */
export function debugFight(enemyId: string) {
  app.run = newRun('DEBUG-' + enemyId);
  app.run.act = ENEMIES[enemyId].act;
  app.run.path = [`${app.run.act}-0-0`];
  showCombat(enemyId, (c) => rewards(c, ENEMIES[enemyId].tier), () => gameOver(false));
}

function fight(type: NodeType) {
  const run = app.run!;
  const enemyId = type === 'chefe' ? bossId(run.act) : enemyFor(run, type);
  const tier = ENEMIES[enemyId].tier;
  showCombat(enemyId, (c) => {
    if (run.relics.includes('cofre_frio')) run.hp = Math.min(run.maxHp, run.hp + 4);
    if (c.manualSolved) {
      run.credits += 15;
      toast('🔓 Bônus de quebra manual: +15 créditos!', 'good');
    }
    persist();
    rewards(c, tier);
  }, () => gameOver(false));
}

function rewards(c: Combat, tier: 'normal' | 'elite' | 'chefe') {
  const run = app.run!;
  setBackground('calm');
  const credits = combatCredits(run, tier);
  const cards = rollCards(run, 3, tier);
  const relic = tier === 'elite' ? rollRelic(run) : null;
  const p = c.puzzle;
  const entry = CODEX_BY_ID[c.enemy.kind];
  let creditsTaken = false;
  let cardTaken = false;
  let relicTaken = !relic;

  const box = h('div', { class: 'reward-box panel' });
  const draw = () => {
    clear(box);
    add(box,
      h('div', { class: 'screen-title' }, h('h2', null, tier === 'chefe' ? 'CHEFE DERROTADO' : 'ACESSO CONCEDIDO'),
        h('p', null, `${c.def.glyph} ${c.def.name} foi quebrado${c.manualSolved ? ' — à mão! 🔓' : '.'}`)),
      h('div', { class: 'muted', style: 'font-size:12px;letter-spacing:.12em' }, isHashPuzzle(p.kind) ? 'SENHA RECUPERADA' : 'MENSAGEM DECIFRADA'),
      h('div', { class: 'plain-reveal typed' }, p.secret),
      entry && h('div', { class: 'row', style: 'display:flex;gap:10px;align-items:center;margin-bottom:18px' },
        h('span', { class: 'muted', style: 'flex:1;font-size:12.5px' }, `Quer entender como "${entry.title}" funciona e por que caiu?`),
        h('button', { class: 'btn sm amber', onclick: () => codexDetail(entry.id) }, '📖 Ler no Códex')),
      h('div', { class: 'reward-item' + (creditsTaken ? ' sold' : ''), style: 'cursor:pointer', onclick: (e: Event) => {
        if (creditsTaken) return;
        creditsTaken = true;
        const from = run.credits;
        run.credits += credits;
        sfx.coin();
        const pt = centerOf(e.currentTarget as Element);
        burst(pt.x, pt.y, '#ffc53d', 24);
        refreshHud();
        const el = document.getElementById('hud-credits');
        if (el) countTo(el, from, run.credits);
        persist();
        draw();
      } }, h('div', { class: 'ico' }, '◈'), h('div', null, h('b', { class: 'amber' }, `${credits} créditos`), h('div', { class: 'muted', style: 'font-size:12px' }, 'clique para coletar'))),
      relic && h('div', { class: 'reward-item' + (relicTaken ? ' sold' : ''), style: 'cursor:pointer', onclick: () => {
        if (relicTaken) return;
        relicTaken = true;
        addRelic(run, relic);
        sfx.unlock();
        refreshHud();
        persist();
        draw();
      } }, h('div', { class: 'ico' }, RELICS[relic].icon), h('div', null, h('b', { class: 'amber' }, RELICS[relic].name), h('div', { class: 'muted', style: 'font-size:12px' }, RELICS[relic].text))),
      h('div', { class: 'reward-item' + (cardTaken ? ' sold' : ''), style: 'cursor:pointer', onclick: () => {
        if (cardTaken) return;
        chooseCard(cards, (id) => {
          cardTaken = true;
          if (id) {
            addCard(run, id);
            const tag = CARDS[id].tag;
            if (tag) discover('tag:' + tag);
            toast(`${CARDS[id].icon} ${CARDS[id].name} entrou no seu baralho.`, 'good');
          }
          refreshHud();
          persist();
          draw();
        });
      } }, h('div', { class: 'ico' }, '🂠'), h('div', null, h('b', { class: 'cyan' }, 'Escolher uma carta'), h('div', { class: 'muted', style: 'font-size:12px' }, 'uma técnica nova para o seu baralho'))),
      h('div', { style: 'text-align:right;margin-top:16px' }, h('button', { class: 'btn big', onclick: () => {
        sfx.click();
        if (tier === 'chefe') {
          if (run.act === 3) return gameOver(true);
          app.meta.bestAct = Math.max(app.meta.bestAct, run.act + 1);
          saveMeta(app.meta);
          advanceAct(run);
          persist();
          return actIntro();
        }
        goMap();
      } }, tier === 'chefe' ? (run.act === 3 ? '🏆 Concluir' : '▶ Próximo ato') : '▶ Continuar')),
    );
  };
  draw();
  mount(hud({ onMenu: runMenu }), h('div', { class: 'center-screen' }, box));
}

function chooseCard(ids: string[], done: (id: string | null) => void) {
  let close = () => {};
  close = modal(h('div', null,
    h('h2', { style: 'text-align:center' }, 'Escolha uma técnica'),
    h('p', { class: 'muted', style: 'text-align:center' }, 'Passe o mouse para ler o porquê de cada técnica funcionar.'),
    h('div', { class: 'choice-row', style: 'margin:30px 0' }, ...ids.map((id) => cardEl({ id, up: false }, { onClick: () => { sfx.unlock(); close(); done(id); } }))),
    h('div', { style: 'text-align:center' }, h('button', { class: 'btn ghost', onclick: () => { close(); done(null); } }, 'Pular (baralho enxuto também é estratégia)'))),
  { wide: true, dismissable: false });
}

// ---------------- descanso ----------------

function rest() {
  const run = app.run!;
  const heal = Math.round(run.maxHp * 0.3);
  const done = () => goMap();
  mount(hud({ onMenu: runMenu }), h('div', { class: 'center-screen' }, h('div', null,
    h('div', { class: 'screen-title' }, h('h2', { class: 'cyan', style: 'color:var(--cyan)' }, '❄️ RESFRIAR'), h('p', null, 'Um servidor ocioso. Hora de baixar a temperatura.')),
    h('div', { class: 'option-cards' },
      h('div', { class: 'option panel', onclick: (e: Event) => {
        run.hp = Math.min(run.maxHp, run.hp + heal);
        sfx.unlock();
        const pt = centerOf(e.currentTarget as Element);
        burst(pt.x, pt.y, '#39ff9f', 40);
        flash('green');
        persist();
        setTimeout(done, 500);
      } }, h('div', { class: 'big-ico' }, '😴'), h('h3', null, 'Descansar'), h('p', null, `Recupera ${heal} de Furtividade (30%).`)),
      h('div', { class: 'option panel', onclick: () => {
        if (!run.deck.some(canUpgrade)) return toast('Todas as cartas já estão melhoradas!', 'bad');
        pickUpgrade(run, done);
      } }, h('div', { class: 'big-ico' }, '⬆️'), h('h3', null, 'Otimizar'), h('p', null, 'Melhore uma carta do baralho permanentemente.')),
    ))));
}

// ---------------- loja ----------------

function shop() {
  const run = app.run!;
  const offer = makeShop(run);
  persist();
  const render = () => {
    const buy = (price: number, then: () => void) => {
      if (run.credits < price) {
        sfx.error();
        toast('Créditos insuficientes.', 'bad');
        return;
      }
      run.credits -= price;
      sfx.coin();
      then();
      refreshHud();
      persist();
      render();
    };
    mount(hud({ onMenu: runMenu }), h('div', { class: 'page' },
      h('div', { class: 'screen-title' }, h('h2', { style: 'color:var(--amber)' }, '🛒 MERCADO NEGRO'), h('p', null, '"Ferramentas de segunda mão, sem nota fiscal."')),
      h('div', { class: 'shop-grid' }, ...offer.cards.map((o) => h('div', { class: 'shop-item' + (o.sold ? ' sold' : '') },
        cardEl({ id: o.id, up: false }, { onClick: () => buy(o.price, () => { o.sold = true; addCard(run, o.id); const t = CARDS[o.id].tag; if (t) discover('tag:' + t); }) }),
        h('div', { class: 'price' + (run.credits < o.price ? ' cant' : '') }, `◈ ${o.price}`)))),
      h('div', { class: 'shop-grid', style: 'margin-top:36px' },
        ...offer.relics.map((o) => {
          const r = RELICS[o.id];
          return h('div', { class: 'shop-item panel' + (o.sold ? ' sold' : ''), style: 'width:220px;padding:18px;cursor:pointer;text-align:center', onclick: () => buy(o.price, () => { o.sold = true; addRelic(run, o.id); }) },
            h('div', { style: 'font-size:46px' }, r.icon), h('b', null, r.name), h('div', { class: 'muted', style: 'font-size:12px' }, r.text), h('div', { class: 'price' + (run.credits < o.price ? ' cant' : '') }, `◈ ${o.price}`));
        }),
        h('div', { class: 'shop-item panel' + (offer.removed ? ' sold' : ''), style: 'width:220px;padding:18px;cursor:pointer;text-align:center', onclick: () => {
          if (run.credits < offer.removePrice) return buy(offer.removePrice, () => {});
          showDeck(run.deck, 'Remover uma carta', { label: 'Clique na carta que sai do baralho', onPick: (c) => buy(offer.removePrice, () => {
            offer.removed = true;
            run.deck = run.deck.filter((x) => x.uid !== c.uid);
            toast(`${CARDS[c.id].name} removida.`, 'good');
          }) });
        } }, h('div', { style: 'font-size:46px' }, '🗑️'), h('b', null, 'Remover carta'), h('div', { class: 'muted', style: 'font-size:12px' }, 'Baralho menor = suas melhores cartas aparecem mais.'), h('div', { class: 'price' + (run.credits < offer.removePrice ? ' cant' : '') }, `◈ ${offer.removePrice}`))),
      h('div', { style: 'text-align:center;margin-top:36px' }, h('button', { class: 'btn big', onclick: () => { sfx.click(); goMap(); } }, '▶ Sair da loja'))));
  };
  render();
}

// ---------------- eventos ----------------

function event() {
  const run = app.run!;
  const ev = withRng(run, (rng) => rng.pick(EVENTS)(run, rng));
  sfx.glitch();
  const box = h('div', { class: 'event-box panel' });
  const continueBtn = () => h('div', { style: 'text-align:right;margin-top:16px' }, h('button', { class: 'btn big', onclick: () => goMap() }, '▶ Continuar'));
  const apply = (o: Outcome) => {
    if (o.credits) run.credits += o.credits;
    if (o.hp) run.hp = Math.max(1, Math.min(run.maxHp, run.hp + o.hp));
    if (o.card) addCard(run, o.card, !!o.cardUp);
    if (o.addStatusCard) addCard(run, o.addStatusCard);
    if (o.upgradeRandom) {
      const pool = run.deck.filter(canUpgrade);
      const c = withRng(run, (rng) => (pool.length ? rng.pick(pool) : null));
      if (c) c.up = true;
    }
    if (o.codex) discover(...o.codex);
    (o.good ? sfx.unlock : sfx.hurt)();
    if (!o.good) flash('red');
    refreshHud();
    persist();
  };
  add(box,
    h('div', { class: 'event-icon' }, ev.icon), h('h2', null, ev.title), h('p', null, ev.text),
    ev.code && h('div', { class: 'code-block' }, ev.code),
    h('div', { class: 'choices' }, ...ev.choices.map((ch) => h('button', { class: 'btn', onclick: () => {
      const o = ch.apply();
      apply(o);
      box.querySelector('.choices')!.remove();
      const summary = [o.credits && `+${o.credits} créditos`, o.hp && `${o.hp > 0 ? '+' : ''}${o.hp} Furtividade`, o.card && `+ carta ${CARDS[o.card].name}${o.cardUp ? '+' : ''}`].filter(Boolean).join(' · ');
      box.append(h('div', { class: `outcome ${o.good ? 'good' : 'bad'}` }, o.text, summary && h('div', { style: 'margin-top:8px' }, h('b', { class: o.good ? 'green' : 'red' }, summary))));
      if (o.pick === 'remove') {
        showDeck(run.deck, 'Remover uma carta', { label: 'Clique na carta que sai', onPick: (c) => { run.deck = run.deck.filter((x) => x.uid !== c.uid); persist(); toast('Carta removida.', 'good'); } });
      } else if (o.pick === 'upgrade') {
        pickUpgrade(run, () => {});
      }
      box.append(continueBtn());
    } }, ch.label, ch.hint && h('small', null, ch.hint)))),
  );
  mount(hud({ onMenu: runMenu }), h('div', { class: 'center-screen' }, box));
}

// ---------------- tesouro ----------------

function treasure() {
  const run = app.run!;
  const relic = rollRelic(run);
  persist();
  const chest = h('div', { class: 'chest' }, '📦');
  const out = h('div', { style: 'min-height:160px;text-align:center' });
  chest.onclick = async () => {
    if (chest.dataset.open) return;
    chest.dataset.open = '1';
    sfx.unlock();
    const pt = centerOf(chest);
    burst(pt.x, pt.y, '#ffc53d', 60, { chars: true });
    flash('white');
    chest.textContent = '🎁';
    await sleep(300);
    if (relic) {
      addRelic(run, relic);
      const r = RELICS[relic];
      out.append(h('div', { style: 'font-size:60px' }, r.icon), h('h3', { style: 'font-size:34px;color:var(--amber)' }, r.name), h('p', null, r.text), h('p', { class: 'muted', style: 'font-style:italic' }, r.lore));
    } else {
      run.credits += 80;
      out.append(h('h3', null, '+80 créditos'));
    }
    refreshHud();
    persist();
    out.append(h('button', { class: 'btn big', style: 'margin-top:10px', onclick: () => goMap() }, '▶ Continuar'));
  };
  mount(hud({ onMenu: runMenu }), h('div', { class: 'center-screen' }, h('div', { style: 'text-align:center' },
    h('div', { class: 'screen-title' }, h('h2', { style: 'color:var(--amber)' }, 'TESOURO'), h('p', null, 'Um cofre esquecido. Clique para abrir.')),
    chest, out)));
}

// ---------------- fim de jogo ----------------

function gameOver(win: boolean) {
  const run = app.run!;
  if (win) {
    app.meta.wins++;
    app.meta.bestAct = 4;
  }
  saveMeta(app.meta);
  app.run = null;
  persist();
  setBackground(win ? 'rain' : 'calm');
  const mins = Math.round((Date.now() - run.startedAt) / 60000);
  const codexPct = Math.round((app.meta.codex.length / Object.keys(CODEX_BY_ID).length) * 100);
  mount(h('div', { class: 'center-screen end-screen' }, h('div', { class: 'panel', style: 'padding:34px;width:min(820px,100%)' },
    h('h1', { class: win ? 'win glitch' : 'lose glitch', 'data-text': win ? 'INVADIDO' : 'RASTREADO' }, win ? 'INVADIDO' : 'RASTREADO'),
    h('p', { style: 'text-align:center;color:var(--muted);font-size:15px' }, win
      ? 'Você quebrou da cifra de César ao PBKDF2. O cofre de senhas está aberto, e você sabe exatamente por quê.'
      : `O sistema te encontrou no Ato ${run.act}, andar ${run.path.length}. Cada derrota deixa entradas novas no Códex.`),
    h('div', { class: 'stats-grid' },
      stat(String(run.stats.combats), 'combates vencidos'),
      stat(String(run.stats.manualBreaks), 'quebras manuais'),
      stat(String(run.stats.damageDealt), 'análise causada'),
      stat(String(run.stats.bestHit), 'maior golpe'),
      stat(String(run.stats.cardsPlayed), 'cartas jogadas'),
      stat(`${codexPct}%`, 'do Códex descoberto'),
      stat(`${mins} min`, 'de partida'),
      stat(String(run.deck.length), 'cartas no baralho')),
    h('p', { class: 'muted', style: 'text-align:center;font-size:12px' }, `Semente: ${run.seed}`),
    h('div', { style: 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap' },
      h('button', { class: 'btn big', onclick: () => startNewRun(run.seed.startsWith('DIA') ? Date.now().toString(36).toUpperCase() : Date.now().toString(36).toUpperCase()) }, '↻ Nova partida'),
      h('button', { class: 'btn big amber', onclick: () => import('./codex').then((m) => m.showCodex(showTitle)) }, '📖 Códex'),
      h('button', { class: 'btn big ghost', onclick: () => showTitle() }, 'Título')))));
  if (win) setTimeout(() => { for (let i = 0; i < 6; i++) setTimeout(() => burst(Math.random() * innerWidth, Math.random() * innerHeight * 0.6, ['#39ff9f', '#33d6ff', '#ffc53d'][i % 3], 50, { chars: true }), i * 250); }, 200);
}

const stat = (v: string, l: string) => h('div', { class: 'stat-box' }, h('b', null, v), h('span', null, l));

/** Só em desenvolvimento: abre uma tela específica com uma partida de demonstração. */
export function debugScreen(name: string) {
  app.run = newRun('DEBUG-' + name);
  const run = app.run;
  run.credits = 320;
  for (const id of ['rainbow', 'kasiski', 'dicionario', 'tor', 'turing']) addCard(run, id);
  run.relics.push('placa_video', 'yubikey', 'enigma');
  run.path = [run.map.nodes[0].id];
  run.stats = { combats: 14, manualBreaks: 5, damageDealt: 1873, cardsPlayed: 212, bestHit: 61 };
  const screens: Record<string, () => void> = {
    map: goMap, rest, shop, event, treasure, act: actIntro,
    victory: () => gameOver(true), defeat: () => gameOver(false),
  };
  (screens[name] ?? goMap)();
}
