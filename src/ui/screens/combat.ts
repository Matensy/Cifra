// Tela de combate: anima os eventos do motor e ensina o porquê de cada golpe.

import { effectLabel, TAGS } from '../../content/affinity';
import { CARDS } from '../../content/cards';
import { CODEX_BY_ID } from '../../content/codex';
import { Combat, type Ev } from '../../game/combat';
import { isHashPuzzle, revealed } from '../../game/puzzles';
import { withRng } from '../../game/run';
import type { MoveDef, Tag } from '../../game/types';
import { app, discover, hud, refreshHud } from '../app';
import { sfx } from '../audio';
import { openBreaker } from '../breaker';
import { cardEl } from '../cardview';
import { $, add, clear, h, hideTip, mount, sleep, tip, toast } from '../dom';
import { burst, centerOf, flash, floatText, setBackground, shake } from '../fx';

const INTENT_ICON: Record<MoveDef['intent'], string> = { ataque: '⚔️', defesa: '🛡️', buff: '⬆️', debuff: '☠️', especial: '✨' };

const STATUS_INFO: Record<string, (n: number) => [string, 'good' | 'bad' | 'info', string]> = {
  foco: (n) => [`🧠 Foco +${n}`, 'good', `Seus ataques causam +${n}.`],
  turing: () => ['🍎 Dobro', 'good', 'Seu próximo ataque neste turno causa o dobro.'],
  honeypot: (n) => [`🍯 Honeypot ${n}`, 'good', `Cada ataque recebido neste turno devolve ${n} de análise.`],
  rastreado: (n) => [`📍 Rastreado ${n}`, 'bad', `Você recebe 50% a mais de dano por ${n} turno(s).`],
  exposto: (n) => [`🔍 Exposto ${n}`, 'good', `Recebe 50% a mais de análise por ${n} turno(s).`],
  periodo: () => ['📏 Período descoberto', 'good', 'O tamanho da chave foi descoberto: a análise de frequência agora funciona!'],
  reuso: () => ['♻️ Chave reutilizada', 'good', 'O one-time pad usou a mesma chave duas vezes. O sigilo perfeito acabou: use Texto Conhecido!'],
  imune: () => ['🛡️ Sigilo perfeito', 'info', 'One-time pad intacto: NENHUMA análise funciona. Defenda-se e espere um erro do operador.'],
  forca: (n) => [`💪 Força ${n}`, 'bad', `Ataques do inimigo causam +${n}.`],
};

function statusChip(key: string, n: number, who: 'player' | 'enemy'): HTMLElement | null {
  let info = STATUS_INFO[key]?.(n);
  if (!info && key.startsWith('bonus_')) {
    const t = TAGS[key.slice(6) as Tag];
    info = [`${t.icon} +${n}`, 'good', `Cartas de ${t.name} causam +${n}.`];
  }
  if (!info || !n) return null;
  const [label, kind, desc] = info;
  const el = h('span', { class: `chip ${who === 'enemy' && kind === 'good' ? 'good' : kind}`, dataset: { key } }, label);
  tip(el, () => desc);
  return el;
}

export function showCombat(enemyId: string, onWin: (c: Combat) => void, onLose: (c: Combat) => void) {
  const run = app.run!;
  const rng = withRng(run, (r) => r.fork());
  const c = new Combat(run, enemyId, rng);
  const def = c.def;
  discover(def.kind);
  setBackground('calm');
  let busy = true;
  let lastInsight: HTMLElement | null = null;
  let shownChars = new Set<number>();

  // ---------- layout ----------
  const playerAv = h('div', { class: 'avatar' }, '🧑‍💻');
  const playerBar = h('div', { class: 'bar' });
  const playerStatuses = h('div', { class: 'statuses' });
  const player = h('div', { class: 'fighter player' }, playerAv, h('div', { class: 'label' }, h('h3', { class: 'cyan' }, 'VOCÊ'), h('small', null, 'Furtividade')), playerBar, playerStatuses);

  const intent = h('div', { class: 'intent' });
  const enemyAv = h('div', { class: 'avatar', style: `--ec:${def.color}` }, h('span', null, def.glyph));
  const enemyBar = h('div', { class: 'bar entropy' });
  const enemyStatuses = h('div', { class: 'statuses' });
  const enemy = h('div', { class: 'fighter enemy', style: `--ec:${def.color}` }, intent, enemyAv,
    h('div', { class: 'label' }, h('h3', { style: `color:${def.color}` }, def.name), h('small', { id: 'enemy-sub' }, def.subtitle)), enemyBar, enemyStatuses);
  tip(enemyAv, () => vulnTable(c));
  tip(intent, () => h('div', null, h('div', { class: 't-title' }, 'Próxima jogada: ' + c.enemy.intent.name), c.enemy.intent.desc));

  const cipherBox = h('div', { class: 'cipher-panel panel' });
  const hand = h('div', { class: 'hand' });
  const cpuOrb = h('div', { class: 'cpu-orb' });
  const piles = h('div', { class: 'piles' });
  const endBtn = h('button', { class: 'btn', onclick: () => endTurn() }, 'Encerrar turno');

  const root = h('div', { class: 'combat' },
    hud(),
    h('div', { class: 'arena' }, player, cipherBox, enemy),
    h('div', { class: 'bottom' },
      h('div', null, cpuOrb, piles),
      hand,
      h('div', { class: 'end-turn' }, h('span', { class: 'muted', style: 'font-size:11px' }, 'Atalhos: 1–9 jogar · E encerrar · Q quebrar'), endBtn)),
  );
  mount(root);
  for (const e of [playerBar, enemyBar]) e.append(h('i', { class: 'ghost' }), h('i'), h('span'));

  // ---------- renderização ----------
  function setBar(bar: HTMLElement, v: number, max: number, label: string) {
    const [ghost, fill, text] = [...bar.children] as HTMLElement[];
    const pct = `${Math.max(0, (v / max) * 100)}%`;
    fill.style.width = pct;
    ghost.style.width = pct;
    text.textContent = label;
  }

  function renderFighters() {
    setBar(playerBar, c.hp, c.maxHp, `${c.hp}/${c.maxHp}`);
    setBar(enemyBar, c.enemy.hp, c.enemy.maxHp, `Entropia ${c.enemy.hp}/${c.enemy.maxHp}`);
    $('.shield', player)?.remove();
    if (c.block > 0) player.append(h('div', { class: 'shield', title: 'Proxy: absorve dano neste turno' }, `🛡${c.block}`));
    $('.shield', enemy)?.remove();
    if (c.enemy.block > 0) enemy.append(h('div', { class: 'shield enemy-shield', title: 'Firewall do inimigo: absorve sua análise' }, `🧱${c.enemy.block}`));
    playerStatuses.replaceChildren(...Object.entries(c.statuses).map(([k, n]) => statusChip(k, n, 'player')).filter(Boolean) as HTMLElement[]);
    enemyStatuses.replaceChildren(...Object.entries(c.enemy.statuses).map(([k, n]) => statusChip(k, n, 'enemy')).filter(Boolean) as HTMLElement[]);
    const m = c.enemy.intent;
    let dmg = m.damage ? m.damage + (c.enemy.statuses.forca ?? 0) : 0;
    if (c.statuses.rastreado) dmg = Math.floor(dmg * 1.5);
    intent.className = `intent ${m.intent}`;
    intent.replaceChildren(INTENT_ICON[m.intent], m.damage ? `${dmg}${m.hits && m.hits > 1 ? '×' + m.hits : ''}` : '', m.block && !m.damage ? String(m.block) : '');
    cpuOrb.className = 'cpu-orb' + (c.cpu === 0 ? ' empty' : '');
    cpuOrb.replaceChildren(`${c.cpu}/${c.maxCpu}`, h('small', null, 'CPU'));
    const pc = c.pileCounts();
    piles.replaceChildren(
      h('span', { class: 'pile', onclick: () => import('../app').then((m) => m.showDeck(c.drawPile, 'Pilha de compra (ordem aleatória)')) }, h('b', null, String(pc.draw)), 'compra'),
      h('span', { class: 'pile', onclick: () => import('../app').then((m) => m.showDeck(c.discard, 'Descarte')) }, h('b', null, String(pc.discard)), 'descarte'),
      pc.exhausted ? h('span', { class: 'pile', onclick: () => import('../app').then((m) => m.showDeck(c.exhausted, 'Esgotadas')) }, h('b', null, String(pc.exhausted)), 'esgot.') : '',
    );
    refreshHud(c.hp);
  }

  function renderCipher(full = false) {
    const p = c.puzzle;
    const hash = isHashPuzzle(p.kind);
    const entry = CODEX_BY_ID[p.kind];
    const frac = full ? 1 : c.revealFraction();
    const { shown } = revealed(p, frac);
    const recovered = h('div', { class: 'recovered' }, ...[...p.secret].map((ch, i) => {
      if (ch === ' ') return ' ';
      if (shown.has(i)) return h('span', { class: 'r' + (shownChars.has(i) ? '' : ' fresh') }, ch);
      return '·';
    }));
    shownChars = new Set(shown);
    const algo = p.data.algo ? String(p.data.algo).toUpperCase().replace('SHA256', 'SHA-256').replace('SHA1', 'SHA-1') : '';
    clear(cipherBox);
    add(cipherBox,
      h('div', { class: 'cp-head' }, h('h3', null, hash ? '🔐 HASH CAPTURADO' : '📡 MENSAGEM INTERCEPTADA'),
        h('span', { class: 'cp-tag' }, `${entry?.icon ?? ''} ${entry?.title ?? p.kind}`)),
      hash && h('div', { class: 'muted', style: 'font-size:11.5px' },
        `Algoritmo: ${p.kind === 'ntlm' ? 'NTLM (MD4)' : p.kind === 'pin' ? 'SHA-256 de um PIN' : p.kind === 'pbkdf2' ? `PBKDF2-SHA256 (${p.data.iterations} iterações)` : algo}`,
        p.data.salt ? ` · sal: ${p.data.salt}` : ''),
      h('div', { class: 'cipher-text' }, p.cipher),
      p.cipher2 && h('div', { class: 'cipher-text c2' }, p.cipher2),
      h('div', { class: 'progress-line' }, h('span', null, hash ? 'SENHA RECUPERADA' : 'TEXTO RECUPERADO'), h('span', null, `${Math.round(frac * 100)}%`)),
      recovered,
      h('div', { class: 'cp-actions' },
        h('button', { class: 'btn sm amber', onclick: () => manualBreak() }, '🔓 Quebra manual (Q)'),
        h('button', { class: 'btn sm ghost', onclick: () => toast('💡 ' + p.hint, 'learn', 6000) }, '💡 Dica'),
        entry && h('button', { class: 'btn sm ghost', onclick: () => import('./codex').then((m) => m.codexDetail(entry.id)) }, '📖 Códex')),
      lastInsight ?? h('div', { class: 'insight' },
        h('b', null, 'Como vencer: '), 'reduza a ENTROPIA com cartas de análise para recuperar o segredo, ou quebre na mão. ',
        'Passe o mouse no inimigo para ver contra quais técnicas ele é fraco.'),
    );
  }

  function renderHand(fresh: Set<string> = new Set()) {
    hideTip();
    const n = c.hand.length;
    hand.replaceChildren(...c.hand.map((card, i) => {
      const p = c.preview(card);
      const el = cardEl(card, { preview: p, onClick: () => playCard(card.uid, el) });
      const off = i - (n - 1) / 2;
      el.style.transform = `translateY(${Math.abs(off) ** 2 * 4}px) rotate(${off * 4}deg)`;
      if (p.playable) el.classList.add('playable');
      if (fresh.has(card.uid)) {
        el.classList.add('drawn');
        el.style.animationDelay = `${[...fresh].indexOf(card.uid) * 70}ms`;
      }
      el.dataset.uid = card.uid;
      return el;
    }));
    const any = c.hand.some((x) => c.preview(x).playable);
    endBtn.classList.toggle('glow', !any && !busy);
  }

  function renderAll(fresh?: Set<string>) {
    renderFighters();
    renderCipher();
    renderHand(fresh);
  }

  function setInsight(tag: Tag | undefined, mult: number, why: string) {
    if (!why) return;
    const t = tag ? TAGS[tag] : null;
    const lab = effectLabel(mult);
    lastInsight = h('div', { class: 'insight' }, h('b', null, `${t ? t.icon + ' ' + t.name : '💡'} ×${mult} ${lab.text}: `), why);
    if (tag) discover('tag:' + tag);
  }

  // ---------- reprodução dos eventos ----------
  async function play(evs: Ev[]) {
    const fresh = new Set<string>();
    for (const e of evs) {
      switch (e.t) {
        case 'draw': fresh.add(e.uid); break;
        case 'turn':
          if (e.n > 1) banner('SEU TURNO');
          sfx.turn();
          break;
        case 'hit': {
          const pt = centerOf(enemyAv);
          const crit = e.big || e.mult >= 2;
          const weak = e.mult < 1;
          floatText(pt.x + (Math.random() * 60 - 30), pt.y - 20, e.amount ? `-${e.amount}` : e.blocked ? 'BLOQUEADO' : '0', crit ? 'crit' : weak ? 'weak' : '');
          if (e.blocked && e.amount) floatText(pt.x + 60, pt.y + 30, `🧱-${e.blocked}`, 'block');
          if (e.mult !== 1 && !e.big) floatText(pt.x, pt.y - 110, `×${e.mult} ${effectLabel(e.mult).text}`, 'label');
          enemy.classList.remove('hit');
          void enemy.offsetWidth;
          if (e.amount) enemy.classList.add('hit');
          burst(pt.x, pt.y, crit ? '#39ff9f' : weak ? '#7b88a6' : def.color, crit ? 40 : weak ? 8 : 22, { chars: crit });
          (crit ? sfx.crit : weak ? sfx.weak : sfx.hit)();
          if (crit) shake(undefined, 'leve');
          setInsight(e.tag, e.mult, e.why);
          renderFighters();
          renderCipher();
          if (shownChars.size) for (let i = 0; i < 3; i++) setTimeout(() => sfx.reveal(), i * 60);
          await sleep(e.big ? 600 : 300);
          break;
        }
        case 'block': {
          const pt = centerOf(e.who === 'player' ? playerAv : enemyAv);
          floatText(pt.x, pt.y - 30, `+${e.amount} ${e.who === 'player' ? '🛡' : '🧱'}`, 'block');
          sfx.block();
          renderFighters();
          await sleep(180);
          break;
        }
        case 'status': {
          renderFighters();
          if (e.n && (e.key === 'periodo' || e.key === 'reuso')) {
            const pt = centerOf(enemyAv);
            floatText(pt.x, pt.y - 140, e.key === 'periodo' ? 'PERÍODO DESCOBERTO!' : 'CHAVE REUTILIZADA!', 'label');
            sfx.unlock();
            await sleep(400);
          }
          $(`[data-key="${e.key}"]`, e.who === 'player' ? playerStatuses : enemyStatuses)?.classList.add('pop');
          break;
        }
        case 'cpu':
          cpuOrb.classList.remove('pulse');
          void cpuOrb.offsetWidth;
          cpuOrb.classList.add('pulse');
          renderFighters();
          break;
        case 'heal': {
          const pt = centerOf(playerAv);
          floatText(pt.x, pt.y - 30, `+${e.n}`, 'heal');
          burst(pt.x, pt.y, '#39ff9f', 14);
          renderFighters();
          break;
        }
        case 'selfDamage': {
          const pt = centerOf(playerAv);
          floatText(pt.x, pt.y - 20, `-${e.n}`, 'hurt');
          floatText(pt.x, pt.y - 90, e.reason, 'label');
          flash('red');
          sfx.hurt();
          renderFighters();
          await sleep(350);
          break;
        }
        case 'enemyMove': {
          const pt = centerOf(enemyAv);
          floatText(pt.x, pt.y - 130, e.move.name, 'label');
          sfx.enemy();
          if (e.move.damage) {
            enemy.classList.remove('lunge');
            void enemy.offsetWidth;
            enemy.classList.add('lunge');
          }
          await sleep(380);
          break;
        }
        case 'playerHit': {
          const pt = centerOf(playerAv);
          player.classList.remove('hurt');
          void player.offsetWidth;
          player.classList.add('hurt');
          if (e.amount) {
            floatText(pt.x + (Math.random() * 40 - 20), pt.y - 20, `-${e.amount}`, 'hurt');
            flash('red');
            shake(undefined, e.amount >= 12 ? 'forte' : 'leve');
            burst(pt.x, pt.y, '#ff4d5e', 18);
            sfx.hurt();
          }
          if (e.blocked) {
            floatText(pt.x + 70, pt.y + 20, `🛡-${e.blocked}`, 'block');
            if (!e.amount) sfx.block();
          }
          renderFighters();
          await sleep(320);
          break;
        }
        case 'negated': {
          const pt = centerOf(playerAv);
          floatText(pt.x, pt.y - 40, `ANULADO (${e.source})`, 'label');
          sfx.block();
          await sleep(300);
          break;
        }
        case 'addCard':
          toast(`${CARDS[e.cardId].icon} ${e.n}× ${CARDS[e.cardId].name} foi colocado no seu descarte.`, 'bad');
          renderFighters();
          break;
        case 'phase':
          sfx.glitch();
          flash('white');
          shake(undefined, 'forte');
          banner(e.name, true);
          toast(`🔁 ${e.name} Novo segredo, novas fraquezas: confira o inimigo de novo.`, 'learn', 6000);
          discover(c.enemy.kind);
          shownChars = new Set();
          lastInsight = null;
          $('#enemy-sub')!.textContent = CODEX_BY_ID[c.enemy.kind]?.title ?? def.subtitle;
          renderAll();
          await sleep(900);
          break;
        case 'discardHand':
          for (const el of [...hand.children] as HTMLElement[]) {
            el.style.transition = 'transform .3s, opacity .3s';
            el.style.transform += ' translateY(200px)';
            el.style.opacity = '0';
          }
          await sleep(250);
          break;
        case 'shuffle':
          toast('🔀 Descarte embaralhado de volta na pilha de compra.', 'info', 1800);
          break;
        case 'msg':
          toast('⚠️ ' + e.text, 'learn', 5000);
          break;
        case 'win':
          await victory();
          return;
        case 'lose':
          await defeat();
          return;
        default:
          break;
      }
    }
    renderAll(fresh);
  }

  function banner(text: string, enemyTurn = false) {
    const b = h('div', { class: 'turn-banner' + (enemyTurn ? ' enemy-turn' : '') }, text);
    document.body.append(b);
    setTimeout(() => b.remove(), 1200);
  }

  // ---------- ações ----------
  async function playCard(uid: string, el: HTMLElement) {
    if (busy || c.over) return;
    const card = c.hand.find((x) => x.uid === uid);
    if (!card) return;
    const p = c.preview(card);
    if (!p.playable) {
      sfx.error();
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
      toast(CARDS[card.id].unplayable ? 'Esta carta não pode ser jogada.' : `CPU insuficiente: custa ${p.cost}, você tem ${c.cpu}.`, 'bad', 2200);
      return;
    }
    busy = true;
    hideTip();
    sfx.card();
    const d = CARDS[card.id];
    const target = d.dmg ? enemyAv : playerAv;
    const r = el.getBoundingClientRect();
    const fly = el.cloneNode(true) as HTMLElement;
    fly.classList.add('flying');
    fly.style.left = `${r.left}px`;
    fly.style.top = `${r.top}px`;
    fly.style.transform = 'none';
    document.body.append(fly);
    el.style.visibility = 'hidden';
    const t = centerOf(target);
    requestAnimationFrame(() => {
      fly.style.transform = `translate(${t.x - r.left - r.width / 2}px, ${t.y - r.top - r.height / 2}px) scale(.35) rotate(${d.dmg ? 12 : -8}deg)`;
      fly.style.opacity = '0.2';
    });
    await sleep(330);
    fly.remove();
    c.play(uid);
    await play(c.takeEvents());
    if (!c.over) {
      busy = false;
      renderHand();
    }
  }

  async function endTurn() {
    if (busy || c.over) return;
    busy = true;
    sfx.click();
    banner('TURNO INIMIGO', true);
    await sleep(500);
    c.endTurn();
    await play(c.takeEvents());
    if (!c.over) {
      busy = false;
      renderHand();
    }
  }

  function manualBreak() {
    if (busy || c.over) return;
    openBreaker(c, async () => {
      busy = true;
      const evs = c.takeEvents();
      const ok = evs.some((e) => e.t === 'manual' && e.ok);
      if (ok) {
        app.meta.manual.includes(c.enemy.kind) || app.meta.manual.push(c.enemy.kind);
        const k = h('div', { class: 'key-found' }, h('div', null, '🔑 CHAVE ENCONTRADA'));
        document.body.append(k);
        sfx.unlock();
        flash('green');
        setTimeout(() => k.remove(), 1700);
        await sleep(700);
      }
      await play(evs);
      if (!c.over) {
        busy = false;
        renderHand();
      }
    });
  }

  async function victory() {
    busy = true;
    enemy.classList.add('dying');
    const pt = centerOf(enemyAv);
    burst(pt.x, pt.y, def.color, 80, { chars: true, speed: 9 });
    burst(pt.x, pt.y, '#39ff9f', 40, { speed: 7 });
    shake(undefined, 'forte');
    sfx.win();
    renderCipher(true);
    banner('ACESSO CONCEDIDO');
    await sleep(1500);
    document.removeEventListener('keydown', onKey);
    finish();
    onWin(c);
  }

  async function defeat() {
    busy = true;
    sfx.lose();
    flash('red');
    shake(undefined, 'forte');
    banner('RASTREADO', true);
    await sleep(1500);
    document.removeEventListener('keydown', onKey);
    finish();
    onLose(c);
  }

  function finish() {
    run.hp = c.hp;
    run.stats.combats++;
    run.stats.damageDealt += c.damageDealt;
    run.stats.cardsPlayed += c.cardsPlayed;
    run.stats.bestHit = Math.max(run.stats.bestHit, c.bestHit);
    if (c.manualSolved) run.stats.manualBreaks++;
    if (!run.seen.includes(def.id)) run.seen.push(def.id);
  }

  const onKey = (e: KeyboardEvent) => {
    if (document.querySelector('.overlay')) return;
    if (!document.body.contains(root)) {
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (e.key === 'e' || e.key === 'E') endTurn();
    else if (e.key === 'q' || e.key === 'Q') manualBreak();
    else if (/^[1-9]$/.test(e.key)) {
      const card = c.hand[Number(e.key) - 1];
      const el = card && (hand.querySelector(`[data-uid="${card.uid}"]`) as HTMLElement);
      if (el) playCard(card.uid, el);
    }
  };
  document.addEventListener('keydown', onKey);

  // ---------- início ----------
  renderFighters();
  renderCipher();
  (async () => {
    banner(def.tier === 'chefe' ? '⚠ CHEFE ⚠' : def.tier === 'elite' ? 'ELITE' : 'COMBATE', def.tier !== 'normal');
    const speech = h('div', { class: 'speech' }, `"${def.quote}"`);
    enemy.append(speech);
    setTimeout(() => speech.remove(), 6200);
    await sleep(700);
    c.start();
    await play(c.takeEvents());
    busy = false;
    renderHand();
  })();
}

/** Ficha de vulnerabilidades do inimigo (o "pokédex" das cifras). */
function vulnTable(c: Combat): HTMLElement {
  const kind = c.enemy.kind;
  const rows = (Object.keys(TAGS) as Tag[]).map((tag) => {
    const { mult, why } = c.eff(tag);
    const lab = effectLabel(mult);
    const t = TAGS[tag];
    return [
      h('span', null, t.icon),
      h('span', { title: why }, t.name),
      h('span', { class: `m ${lab.cls}`, style: 'border:0;box-shadow:none' }, `×${mult}`),
    ];
  });
  const e = CODEX_BY_ID[kind];
  return h('div', null,
    h('div', { class: 't-title' }, `${c.def.glyph} ${c.enemy.name}`),
    h('div', { class: 'muted' }, e ? `${e.title} · ${e.era}` : ''),
    h('div', { style: 'margin-top:8px' }, h('b', null, 'Fraquezas por técnica:')),
    h('div', { class: 'aff-table' }, ...rows.flat()),
    h('div', { class: 't-lore' }, `"${c.def.quote}"`),
  );
}
