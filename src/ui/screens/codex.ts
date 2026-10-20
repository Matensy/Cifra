import { CODEX, CODEX_BY_ID, type CodexEntry } from '../../content/codex';
import { HASHES } from '../../crypto/hash';
import { app } from '../app';
import { sfx } from '../audio';
import { h, modal, mount } from '../dom';
import { setBackground } from '../fx';

const GROUPS: CodexEntry['group'][] = ['Cifras clássicas', 'Bits e codificações', 'Hashes e senhas', 'Técnicas de ataque', 'Conceitos'];

export function showCodex(back: () => void) {
  setBackground('calm');
  const known = new Set(app.meta.codex);
  const total = CODEX.length;
  mount(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h2', null, '📖 Códex'),
      h('span', { class: 'muted' }, `${known.size}/${total} entradas descobertas`),
      h('button', { class: 'btn ghost', onclick: back }, '← Voltar')),
    h('p', { class: 'muted', style: 'line-height:1.6;max-width:820px' },
      'A enciclopédia da criptografia. Cada cifra, técnica e conceito que você encontra nas partidas aparece aqui com a história, como funciona e como se quebra.'),
    ...GROUPS.map((g) => h('div', { class: 'codex-group' },
      h('h3', null, g),
      h('div', { class: 'codex-grid' }, ...CODEX.filter((e) => e.group === g).map((e) => {
        const open = known.has(e.id);
        const manual = app.meta.manual.includes(e.id);
        return h('div', { class: 'codex-item panel' + (open ? '' : ' locked'), onclick: () => { if (open) { sfx.click(); codexDetail(e.id); } } },
          h('div', { class: 'ico' }, open ? e.icon : '🔒'),
          h('div', null, h('b', null, open ? e.title : '???'), h('small', null, open ? `${e.era}${manual ? ' · 🔓 quebrada à mão' : ''}` : 'encontre numa partida')));
      })))),
    h('div', { class: 'codex-group' }, h('h3', null, 'Ficha técnica dos hashes'),
      h('table', { class: 'hash-table panel', style: 'padding:6px' },
        ...HASHES.map((x) => h('tr', null,
          h('td', { class: 'n' }, x.name), h('td', null, `${x.bits} bits`), h('td', null, String(x.year)),
          h('td', null, h('span', { class: `badge ${x.safety}` }, x.safety === 'checksum' ? 'checksum' : x.safety)),
          h('td', { class: 'muted' }, x.note))))),
  ));
}

export function codexDetail(id: string) {
  const e = CODEX_BY_ID[id];
  if (!e) return;
  modal(h('div', { class: 'codex-detail' },
    h('div', { class: 'modal-head' }, h('div', { style: 'font-size:46px' }, e.icon),
      h('div', null, h('h2', null, e.title), h('div', { class: 'muted' }, e.era)),
      h('div', { class: 'spacer' }), h('span', { class: `badge ${e.status}` }, e.status)),
    h('section', null, h('h4', null, 'Como funciona'), h('p', null, e.how)),
    h('section', null, h('h4', null, 'Como se quebra'), h('p', null, e.attack)),
    h('section', null, h('h4', null, 'Hoje em dia'), h('p', null, e.today)),
    e.lab && !document.querySelector('.combat') && h('div', { style: 'text-align:right' }, h('button', { class: 'btn amber', onclick: () => {
      document.querySelectorAll('.overlay').forEach((o) => o.remove());
      const back = () => (app.run ? import('./flow').then((f) => f.goMap()) : import('./title').then((t) => t.showTitle()));
      import('./lab').then((m) => m.showLab(back, e.lab));
    } }, '🧪 Experimentar no Laboratório')),
  ), { wide: false });
}
