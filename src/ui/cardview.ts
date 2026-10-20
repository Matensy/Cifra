import { effectLabel, TAGS } from '../content/affinity';
import { CARDS } from '../content/cards';
import type { CardPreview } from '../game/combat';
import { h, tip } from './dom';

const TYPE_LABEL = { ataque: 'Ataque', defesa: 'Defesa', ferramenta: 'Ferramenta', status: 'Status' };

/** Monta o texto da carta trocando {D}, {H}, {B}, {M} pelos números. */
function cardText(id: string, up: boolean, p?: CardPreview): Node[] {
  const d = CARDS[id];
  const i = up ? 1 : 0;
  const base: Record<string, number> = {
    D: d.dmg ? d.dmg[i] : 0, H: d.hits ? d.hits[i] : 1, B: d.blk ? d.blk[i] : 0, M: d.mag ? d.mag[i] : 0,
  };
  const val: Record<string, number> = p ? { D: p.D, H: p.H, B: p.B, M: p.M } : base;
  const parts = d.text.split(/(\{[DHBM]\})/);
  return parts.map((part) => {
    const m = part.match(/^\{([DHBM])\}$/);
    if (!m) return document.createTextNode(part);
    const k = m[1];
    const v = val[k];
    const cls = k === 'D' && p ? (v > base.D ? 'up' : v < base.D ? 'down' : '') : up && base[k] !== (k === 'D' ? d.dmg?.[0] : k === 'B' ? d.blk?.[0] : k === 'M' ? d.mag?.[0] : d.hits?.[0]) ? 'up' : '';
    return h('span', { class: `num ${cls}` }, String(v));
  });
}

export function cardTooltip(id: string, up: boolean, p?: CardPreview): HTMLElement {
  const d = CARDS[id];
  const tag = d.tag ? TAGS[d.tag] : null;
  return h('div', null,
    h('div', { class: 't-title' }, d.icon + ' ' + d.name + (up ? '+' : '')),
    tag && h('div', { style: `color:${tag.color}` }, `${tag.icon} Técnica: ${tag.name}`),
    tag && h('div', { class: 'muted', style: 'font-size:11.5px' }, tag.desc),
    p && d.dmg && p.why && h('div', { style: 'margin-top:8px' }, h('b', null, `×${p.mult} `), p.why),
    h('div', { class: 't-lore' }, d.lore),
  );
}

export function cardEl(inst: { id: string; up: boolean }, opts: { preview?: CardPreview; onClick?: () => void; noTip?: boolean } = {}): HTMLElement {
  const d = CARDS[inst.id];
  const p = opts.preview;
  const i = inst.up ? 1 : 0;
  const cost = p ? p.cost : d.cost[i];
  const tag = d.tag ? TAGS[d.tag] : null;
  const el = h('div', { class: `card ${d.type} ${d.rarity} ${inst.up ? 'up' : ''} ${d.unplayable ? 'unplayable' : ''}` },
    !d.unplayable && h('div', { class: 'cost' + (p && !p.playable && !d.unplayable ? ' dim' : '') }, String(cost)),
    h('div', { class: 'name' }, d.name + (inst.up ? '+' : '')),
    h('div', { class: 'art' }, d.icon),
    h('div', { class: 'type' }, TYPE_LABEL[d.type] + (d.rarity === 'rara' ? ' · rara' : '')),
    tag && h('div', { class: 'tagline-c', style: `color:${tag.color}` }, `${tag.icon} ${tag.name}`),
    h('div', { class: 'text' }, ...cardText(inst.id, inst.up, p)),
  );
  if (p && d.dmg && p.mult !== 1) {
    const lab = effectLabel(p.mult);
    el.append(h('div', { class: `eff ${lab.cls}` }, `×${p.mult} ${lab.text}`));
  }
  if (opts.onClick) el.addEventListener('click', opts.onClick);
  if (!opts.noTip) tip(el, () => cardTooltip(inst.id, inst.up, p));
  return el;
}
