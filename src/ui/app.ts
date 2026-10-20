// Estado global da interface + HUD + janelas compartilhadas.

import { CARDS } from '../content/cards';
import { CODEX_BY_ID } from '../content/codex';
import { RELICS } from '../content/relics';
import { canUpgrade, loadMeta, saveMeta, saveRun, unlock, upgradeDiff, type Meta } from '../game/run';
import type { CardInst, RunState } from '../game/types';
import { setSound, sfx } from './audio';
import { cardEl } from './cardview';
import { h, modal, tip, toast } from './dom';
import { setMotion } from './fx';

export const app: { run: RunState | null; meta: Meta } = { run: null, meta: loadMeta() };

export function persist() {
  saveRun(app.run);
}

export function applySettings() {
  const s = app.meta.settings;
  setSound(s.sound);
  setMotion(s.motion);
  document.body.classList.toggle('crt', s.crt);
  document.body.classList.toggle('reduce-motion', !s.motion);
}

/** Desbloqueia entradas no Códex e avisa o jogador. */
export function discover(...ids: string[]) {
  const fresh = unlock(app.meta, ...ids.filter((id) => CODEX_BY_ID[id]));
  for (const id of fresh) {
    const e = CODEX_BY_ID[id];
    toast(`📖 Novo no Códex: ${e.icon} ${e.title}`, 'learn');
  }
}

export const ACT_NAMES: Record<number, [string, string]> = {
  1: ['ATO I — ANTIGUIDADE', 'César, espelhos, cercas e o "indecifrável" Vigenère'],
  2: ['ATO II — BITS E BYTES', 'Codificações, XOR e o one-time pad'],
  3: ['ATO III — O COFRE DE SENHAS', 'Hashes, sal, rainbow tables e PBKDF2'],
};

let hudEl: HTMLElement | null = null;
let hudOpts: { onMenu?: () => void } = {};

export function hud(opts: { onMenu?: () => void } = {}): HTMLElement {
  hudOpts = opts;
  hudEl = h('header', { class: 'hud' });
  refreshHud();
  return hudEl;
}

export function refreshHud(hpOverride?: number) {
  const run = app.run;
  if (!hudEl || !run) return;
  const hp = hpOverride ?? run.hp;
  hudEl.replaceChildren(
    h('div', { class: 'stat', title: 'Furtividade: sua vida. Se zerar, você é rastreado.' }, '👁', h('span', { id: 'hud-hp' }, `${hp}/${run.maxHp}`),
      h('div', { class: 'hp-bar' }, h('i', { style: `width:${(hp / run.maxHp) * 100}%` }))),
    h('div', { class: 'stat amber', title: 'Créditos para a loja do mercado negro' }, '◈', h('span', { id: 'hud-credits' }, String(run.credits)), h('small', null, 'créditos')),
    h('div', { class: 'floor-label' }, `ATO ${['I', 'II', 'III'][run.act - 1]} · ANDAR ${run.path.length}`),
    h('div', { class: 'relics' }, ...run.relics.map((id) => {
      const r = RELICS[id];
      const el = h('div', { class: 'relic', dataset: { relic: id } }, r.icon);
      tip(el, () => h('div', null, h('div', { class: 't-title' }, r.icon + ' ' + r.name), r.text, h('div', { class: 't-lore' }, r.lore)));
      return el;
    })),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn sm ghost', onclick: () => showDeck(run.deck, `Seu baralho (${run.deck.length} cartas)`) }, `🂠 Baralho ${run.deck.length}`),
    h('button', { class: 'icon-btn', title: 'Configurações', onclick: () => settingsModal() }, '⚙️'),
    hudOpts.onMenu ? h('button', { class: 'icon-btn', title: 'Menu', onclick: hudOpts.onMenu }, '☰') : '',
  );
}

export function showDeck(cards: CardInst[], title: string, pick?: { label: string; filter?: (c: CardInst) => boolean; onPick: (c: CardInst) => void }) {
  const sorted = [...cards].sort((a, b) => a.id.localeCompare(b.id));
  let close = () => {};
  const grid = h('div', { class: 'deck-grid' }, ...sorted.map((c) => {
    const ok = !pick || !pick.filter || pick.filter(c);
    const el = cardEl(c, {
      onClick: pick && ok ? () => { sfx.click(); close(); pick.onPick(c); } : undefined,
    });
    if (pick && !ok) el.style.opacity = '0.3';
    return el;
  }));
  close = modal(h('div', null,
    h('div', { class: 'modal-head' }, h('h2', null, title), h('div', { class: 'spacer' }), pick && h('span', { class: 'muted' }, pick.label)),
    cards.length ? grid : h('p', { class: 'muted' }, 'Nenhuma carta aqui.'),
  ), { wide: true });
}

/** Escolher uma carta para melhorar, mostrando o que muda. */
export function pickUpgrade(run: RunState, onDone: () => void) {
  showDeck(run.deck, 'Melhorar uma carta', {
    label: 'Clique numa carta para melhorá-la',
    filter: canUpgrade,
    onPick: (c) => {
      c.up = true;
      sfx.unlock();
      toast(`⬆ ${CARDS[c.id].name} melhorada: ${upgradeDiff(c.id)}`, 'good');
      persist();
      onDone();
    },
  });
}

export function settingsModal() {
  const s = app.meta.settings;
  const row = (label: string, key: keyof Meta['settings'], desc: string) =>
    h('label', { style: 'display:flex;gap:12px;align-items:center;margin:12px 0;cursor:pointer' },
      h('input', { type: 'checkbox', checked: s[key], onchange: (e: Event) => {
        s[key] = (e.target as HTMLInputElement).checked;
        saveMeta(app.meta);
        applySettings();
        sfx.click();
      } }),
      h('div', null, h('b', null, label), h('div', { class: 'muted', style: 'font-size:12px' }, desc)));
  modal(h('div', null,
    h('h2', null, 'Configurações'),
    row('Som', 'sound', 'Efeitos sonoros sintetizados (Web Audio).'),
    row('Efeito CRT', 'crt', 'Linhas de varredura de monitor antigo.'),
    row('Animações', 'motion', 'Desligue para reduzir movimento na tela.'),
  ));
}
