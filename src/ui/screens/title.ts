import { CODEX_BY_ID } from '../../content/codex';
import { dailySeed, randomSeed } from '../../game/rng';
import { loadRun } from '../../game/run';
import { app, settingsModal } from '../app';
import { sfx } from '../audio';
import { h, modal, mount } from '../dom';
import { setBackground } from '../fx';

export function showTitle() {
  setBackground('rain');
  const saved = loadRun();
  app.run = saved;
  const codexPct = Math.round((app.meta.codex.length / Object.keys(CODEX_BY_ID).length) * 100);
  const typed = h('div', { class: 'tagline typed' });
  const phrase = 'um roguelike de criptografia';
  [...phrase].forEach((ch, i) => setTimeout(() => (typed.textContent += ch), 400 + i * 45));

  const btn = (k: string, label: string, onclick: () => void, cls = '') =>
    h('button', { class: `btn ${cls}`, onclick: () => { sfx.click(); onclick(); }, onmouseenter: () => sfx.hover() }, h('span', { class: 'k' }, k), label);

  mount(h('div', { class: 'title-screen' }, h('div', { class: 'title-wrap' },
    h('div', { class: 'logo glitch', 'data-text': 'CIFRA' }, 'CIFRA'),
    typed,
    h('p', { class: 'muted', style: 'max-width:520px;margin:10px auto 0;line-height:1.6' },
      'Invada um servidor andar por andar. Cada inimigo é uma cifra ou um hash DE VERDADE: quebre com as técnicas certas, ou na mão.'),
    h('div', { class: 'menu' },
      saved && btn('>', `continuar (ato ${saved.act}, andar ${saved.path.length})`, async () => {
        const m = await import('./flow');
        m.goMap();
      }),
      btn('>', 'nova_partida', async () => {
        if (saved && !confirm('Começar uma partida nova vai apagar a partida salva. Continuar?')) return;
        const m = await import('./flow');
        m.startNewRun(randomSeed());
      }, saved ? 'ghost' : ''),
      btn('>', `semente_do_dia (${dailySeed().slice(4)})`, async () => {
        if (saved && !confirm('Começar uma partida nova vai apagar a partida salva. Continuar?')) return;
        const m = await import('./flow');
        m.startNewRun(dailySeed());
      }, 'cyan'),
      btn('>', 'laboratorio', () => import('./lab').then((m) => m.showLab(showTitle)), 'amber'),
      btn('>', `codex (${codexPct}%)`, () => import('./codex').then((m) => m.showCodex(showTitle)), 'amber'),
      btn('?', 'como_jogar', () => howToPlay(), 'ghost'),
      btn('⚙', 'configuracoes', () => settingsModal(), 'ghost'),
    ),
    h('div', { class: 'meta-row' },
      h('span', null, h('b', null, String(app.meta.runs)), 'partidas'),
      h('span', null, h('b', null, String(app.meta.wins)), 'vitórias'),
      h('span', null, h('b', null, String(app.meta.manual.length)), 'cifras quebradas à mão'),
      h('span', null, h('b', null, `${codexPct}%`), 'do Códex')),
    h('div', { class: 'footer-note' }, 'Todos os hashes e cifras foram implementados do zero e testados contra os vetores oficiais.'),
  )));
}

export function howToPlay() {
  modal(h('div', { class: 'help' },
    h('h2', null, 'Como jogar'),
    h('p', null, 'Você é um invasor descendo por 3 atos de um servidor: ', h('b', { class: 'amber' }, 'Antiguidade'), ' (cifras clássicas), ', h('b', { class: 'amber' }, 'Bits'), ' (XOR e codificações) e ', h('b', { class: 'amber' }, 'Cofre de Senhas'), ' (hashes).'),
    h('ul', null,
      h('li', null, '👁 ', h('b', null, 'Furtividade'), ' é sua vida. Se zerar, você é rastreado e a partida acaba.'),
      h('li', null, '⚡ Você tem ', h('b', null, '3 de CPU'), ' por turno para jogar cartas. O número no canto da carta é o custo.'),
      h('li', null, '🧮 Cada inimigo protege um segredo. Suas cartas de ataque reduzem a ', h('b', null, 'Entropia'), ' dele e revelam o texto aos poucos.'),
      h('li', null, '🎯 Cada carta usa uma ', h('b', null, 'técnica'), ' (força bruta, frequência, dicionário...). Contra cada cifra, a técnica pode ser ', h('span', { class: 'green' }, 'SUPER EFETIVA'), ' ou ', h('span', { class: 'red' }, 'INÚTIL'), ', e o jogo explica o porquê.'),
      h('li', null, '🔍 Passe o mouse no inimigo para ver a ficha de fraquezas, e nas cartas para ler a história de cada técnica.'),
      h('li', null, '🛡 Cartas de defesa dão ', h('b', null, 'Proxy'), ', que absorve o dano até o seu próximo turno.'),
      h('li', null, '🔓 ', h('b', null, 'Quebra manual'), ': use ferramentas reais (disco de César, gráfico de frequência, Kasiski, wordlist...) e mate o inimigo na hora. Errar custa 3 de Furtividade. Acertar dá bônus.'),
      h('li', null, '🗺️ No mapa, escolha seu caminho: elites dão implantes, ❄️ recupera vida ou melhora cartas, 🛒 vende técnicas, ❓ são eventos que ensinam algo.'),
      h('li', null, '📖 Tudo que você encontra vai para o ', h('b', null, 'Códex'), '. O ', h('b', null, 'Laboratório'), ' deixa você brincar livremente com todos os hashes e cifras.'),
    ),
    h('p', null, 'Atalhos no combate: ', h('span', { class: 'kbd' }, '1'), '–', h('span', { class: 'kbd' }, '9'), ' jogam cartas, ', h('span', { class: 'kbd' }, 'E'), ' encerra o turno, ', h('span', { class: 'kbd' }, 'Q'), ' abre a quebra manual.'),
  ), { wide: true });
}
