// Laboratório: área livre para brincar com todos os hashes e cifras do jogo.

import { indexOfCoincidence, letterFreq, likelyKeyLengths, PT_FREQ, rankCaesar } from '../../crypto/analysis';
import { fromBase64, fromHex, fromUtf8, hammingBits, toBase64, toHex, utf8 } from '../../crypto/bytes';
import { ALPHA, atbash, caesar, normalize, railFence, railFenceDecrypt, substitute, unsubstitute, vigenere, xorBytes } from '../../crypto/ciphers';
import { HASHES, hashById, hmac, pbkdf2 } from '../../crypto/hash';
import { WORDLIST } from '../../content/texts';
import { sfx } from '../audio';
import { h, mount } from '../dom';
import { setBackground } from '../fx';

type Tab = 'hashes' | 'cifras' | 'senhas';

export function showLab(back: () => void, focus?: string) {
  setBackground('calm');
  let tab: Tab = focus === 'pbkdf2' ? 'senhas' : focus && focus !== 'hash' ? 'cifras' : 'hashes';
  const body = h('div');
  const tabs = h('div', { class: 'tabs' });
  const render = () => {
    tabs.replaceChildren(...([['hashes', '#️⃣ Hashes'], ['cifras', '🔤 Cifras'], ['senhas', '🔐 Senhas']] as [Tab, string][]).map(([t, l]) =>
      h('button', { class: 'tab' + (t === tab ? ' on' : ''), onclick: () => { tab = t; sfx.click(); render(); } }, l)));
    body.replaceChildren(tab === 'hashes' ? hashLab() : tab === 'cifras' ? cipherLab(focus) : passwordLab());
  };
  render();
  mount(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h2', null, '🧪 Laboratório'), h('button', { class: 'btn ghost', onclick: back }, '← Voltar')),
    h('p', { class: 'muted', style: 'max-width:860px;line-height:1.6' }, 'Tudo aqui roda no seu navegador, com as MESMAS implementações do jogo, escritas do zero. Digite, mude um caractere e veja o que acontece.'),
    tabs, body));
}

// ---------------- hashes ----------------

function hashLab(): HTMLElement {
  const input = h('textarea', { class: 'input', placeholder: 'digite qualquer coisa...' }, 'CIFRA') as HTMLTextAreaElement;
  const table = h('table', { class: 'hash-table' });
  const update = () => {
    const data = utf8(input.value);
    table.replaceChildren(...HASHES.map((a) => {
      const out = toHex(a.fn(data));
      // Navegadores arredondam o relógio (proteção contra ataques de canal lateral como o Spectre!),
      // então medimos a média de várias execuções.
      let reps = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < 4 && reps < 400) {
        a.fn(data);
        reps++;
      }
      const ms = (performance.now() - t0) / reps;
      return h('tr', null, h('td', { class: 'n' }, a.name, h('div', null, h('span', { class: `badge ${a.safety}` }, a.safety))),
        h('td', { class: 'muted' }, `${a.bits} bits`, h('br'), `${ms < 1 ? (ms * 1000).toFixed(0) + ' µs' : ms.toFixed(1) + ' ms'}`),
        h('td', { class: 'h' }, out));
    }));
  };
  input.oninput = update;
  update();

  // efeito avalanche
  const a = h('input', { class: 'input', value: 'senha123', style: 'flex:1' }) as HTMLInputElement;
  const b = h('input', { class: 'input', value: 'senha124', style: 'flex:1' }) as HTMLInputElement;
  const algo = h('select', { class: 'input' }, ...HASHES.filter((x) => x.bits >= 128).map((x) => h('option', { value: x.id, selected: x.id === 'sha256' }, x.name))) as HTMLSelectElement;
  const bitsBox = h('div', { class: 'bits' });
  const info = h('div', { class: 'cracking' });
  const updAv = () => {
    const al = hashById(algo.value);
    const ha = al.fn(utf8(a.value));
    const hb = al.fn(utf8(b.value));
    const n = Math.min(256, ha.length * 8);
    bitsBox.replaceChildren(...Array.from({ length: n }, (_, i) => h('i', { class: ((ha[i >> 3] >> (7 - (i & 7))) & 1) !== ((hb[i >> 3] >> (7 - (i & 7))) & 1) ? 'diff' : '' })));
    const d = hammingBits(ha, hb);
    info.textContent = `${d} de ${ha.length * 8} bits diferentes (${Math.round((d / (ha.length * 8)) * 100)}%)` + (n < ha.length * 8 ? ` — mostrando os primeiros ${n}` : '');
  };
  a.oninput = b.oninput = algo.onchange = updAv;
  updAv();

  // HMAC
  const key = h('input', { class: 'input', value: 'chave-secreta', style: 'flex:1' }) as HTMLInputElement;
  const msg = h('input', { class: 'input', value: 'transferir R$ 100 para Bob', style: 'flex:1' }) as HTMLInputElement;
  const hAlgo = h('select', { class: 'input' }, ...HASHES.filter((x) => x.blockSize > 1).map((x) => h('option', { value: x.id, selected: x.id === 'sha256' }, x.name))) as HTMLSelectElement;
  const hOut = h('div', { class: 'out-box mono', style: 'word-break:break-all' });
  const updH = () => (hOut.textContent = toHex(hmac(hashById(hAlgo.value), utf8(key.value), utf8(msg.value))));
  key.oninput = msg.oninput = hAlgo.onchange = updH;
  updH();

  return h('div', { class: 'lab-grid' },
    h('div', { class: 'lab-card panel', style: 'grid-column:1/-1' }, h('h3', null, 'Todos os hashes ao mesmo tempo'),
      h('p', null, 'Mesma entrada, 12 algoritmos. Repare: tamanhos fixos, saídas sem relação aparente com a entrada, e o mesmo texto sempre gera o mesmo hash.'),
      input, table),
    h('div', { class: 'lab-card panel' }, h('h3', null, '🏔️ Efeito avalanche'),
      h('p', null, 'Mude UM caractere: cerca de metade dos bits do hash muda. Cada quadrado é um bit; rosa = mudou.'),
      h('div', { class: 'row', style: 'display:flex;gap:8px;margin-bottom:8px' }, a, b, algo), bitsBox, info),
    h('div', { class: 'lab-card panel' }, h('h3', null, '🔏 HMAC'),
      h('p', null, 'Hash COM chave: prova que a mensagem não foi alterada E que veio de quem conhece a chave. Imune ao ataque de extensão de comprimento.'),
      h('div', { style: 'display:grid;gap:8px' }, h('div', { style: 'display:flex;gap:8px' }, key, hAlgo), msg, hOut)));
}

// ---------------- cifras ----------------

const CIPHERS = {
  caesar: 'César', atbash: 'Atbash', railfence: 'Cerca ferroviária', substitution: 'Substituição', vigenere: 'Vigenère',
  xor: 'XOR (texto ↔ hex)', base64: 'Base64', hex: 'Hexadecimal',
} as const;
type CipherId = keyof typeof CIPHERS;

function cipherLab(focus?: string): HTMLElement {
  let cid: CipherId = (focus && focus in CIPHERS ? focus : focus === 'otp' ? 'xor' : 'caesar') as CipherId;
  const sel = h('select', { class: 'input' }, ...Object.entries(CIPHERS).map(([k, v]) => h('option', { value: k, selected: k === cid }, v))) as HTMLSelectElement;
  const key = h('input', { class: 'input', style: 'flex:1' }) as HTMLInputElement;
  const mode = h('select', { class: 'input' }, h('option', { value: 'enc' }, 'cifrar / codificar'), h('option', { value: 'dec' }, 'decifrar / decodificar')) as HTMLSelectElement;
  const input = h('textarea', { class: 'input' }, 'O SEGREDO DEVE ESTAR NA CHAVE E NAO NO METODO') as HTMLTextAreaElement;
  const out = h('div', { class: 'out-box' });
  const chart = h('div');
  const analysis = h('div', { class: 'kasiski-list', style: 'max-height:none' });
  const keyHint: Record<CipherId, string> = {
    caesar: 'deslocamento (0–25)', atbash: 'sem chave', railfence: 'número de trilhos (2–8)', substitution: 'alfabeto embaralhado (26 letras) — vazio = gerar',
    vigenere: 'palavra-chave', xor: 'chave (texto)', base64: 'sem chave', hex: 'sem chave',
  };
  const defaults: Record<CipherId, string> = { caesar: '3', atbash: '', railfence: '3', substitution: '', vigenere: 'CHAVE', xor: 'KEY', base64: '', hex: '' };
  key.value = defaults[cid];

  const run = () => {
    cid = sel.value as CipherId;
    key.placeholder = keyHint[cid];
    key.disabled = cid === 'atbash' || cid === 'base64' || cid === 'hex';
    const dec = mode.value === 'dec';
    const t = input.value;
    let r = '';
    try {
      switch (cid) {
        case 'caesar': r = caesar(t, (dec ? -1 : 1) * (parseInt(key.value) || 0)); break;
        case 'atbash': r = atbash(t); break;
        case 'railfence': {
          const n = Math.max(2, Math.min(8, parseInt(key.value) || 3));
          r = dec ? railFenceDecrypt(normalize(t).replace(/[^A-Z]/g, ''), n) : railFence(t, n);
          break;
        }
        case 'substitution': {
          if (normalize(key.value).replace(/[^A-Z]/g, '').length !== 26 || new Set(normalize(key.value)).size < 26) {
            key.value = [...ALPHA].sort(() => Math.random() - 0.5).join('');
          }
          const k = normalize(key.value);
          r = dec ? unsubstitute(t, k) : substitute(t, k);
          break;
        }
        case 'vigenere': r = vigenere(t, key.value, dec); break;
        case 'xor': r = dec ? fromUtf8(xorBytes(fromHex(t), utf8(key.value || 'K'))) : toHex(xorBytes(utf8(t), utf8(key.value || 'K'))); break;
        case 'base64': r = dec ? fromUtf8(fromBase64(t)) : toBase64(utf8(t)); break;
        case 'hex': r = dec ? fromUtf8(fromHex(t)) : toHex(utf8(t)); break;
      }
    } catch {
      r = '⚠ entrada inválida para este modo';
    }
    out.textContent = r;
    const target = /[A-Z]/i.test(r) ? r : t;
    const f = letterFreq(target);
    const max = Math.max(15, ...f);
    chart.replaceChildren(h('div', { class: 'freq-chart' }, ...[...ALPHA].map((L, i) => h('div', { class: 'freq-col', title: `${L}: ${f[i].toFixed(1)}%` },
      h('i', { class: 'c', style: `height:${(f[i] / max) * 80}%` }), h('i', { class: 'p', style: `height:${(PT_FREQ[L] / max) * 80}%` }), h('span', null, L)))));
    const ic = indexOfCoincidence(target);
    const best = rankCaesar(target)[0];
    const lens = likelyKeyLengths(target).slice(0, 3);
    analysis.replaceChildren(
      h('div', null, h('b', null, 'Índice de coincidência: '), ic.toFixed(4), ic > 0.06 ? ' (parece monoalfabético/português)' : ic > 0 ? ' (achatado: polialfabético ou aleatório)' : ''),
      h('div', null, h('b', null, 'Melhor César: '), `deslocamento ${best.shift} → "${best.text.slice(0, 48)}${best.text.length > 48 ? '…' : ''}"`),
      lens.length && lens[0].votes ? h('div', null, h('b', null, 'Kasiski sugere chave de: '), lens.map((l) => `${l.len} (${l.votes})`).join(', ')) : h('div', null, 'Kasiski: poucas repetições para estimar o período.'),
    );
  };
  sel.onchange = () => { key.value = defaults[sel.value as CipherId]; run(); };
  key.oninput = mode.onchange = input.oninput = run;
  run();

  return h('div', { class: 'lab-grid' },
    h('div', { class: 'lab-card panel' }, h('h3', null, 'Oficina de cifras'),
      h('div', { style: 'display:grid;gap:8px' }, h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, sel, mode), key, input, h('label', { class: 'muted' }, 'Resultado:'), out)),
    h('div', { class: 'lab-card panel' }, h('h3', null, 'Criptoanálise ao vivo'),
      h('p', null, 'Frequência das letras (rosa) contra o português (verde). Cifre com César e veja o gráfico só deslocar; cifre com Vigenère e veja ele achatar.'),
      chart, h('div', { style: 'margin-top:12px' }, analysis)));
}

// ---------------- senhas ----------------

function passwordLab(): HTMLElement {
  const pw = h('input', { class: 'input', value: 'flamengo2026', style: 'width:100%' }) as HTMLInputElement;
  const report = h('div', { class: 'out-box', style: 'white-space:normal;line-height:1.8' });
  const fmtTime = (s: number) => {
    if (s < 1) return 'instantâneo';
    const u: [number, string][] = [[31557600 * 1e6, 'milhões de anos'], [31557600 * 1e3, 'mil anos'], [31557600, 'anos'], [86400, 'dias'], [3600, 'horas'], [60, 'minutos'], [1, 'segundos']];
    for (const [v, n] of u) if (s >= v) return `${(s / v).toFixed(s / v < 10 ? 1 : 0)} ${n}`;
    return `${s.toFixed(0)} s`;
  };
  const upd = () => {
    const p = pw.value;
    let charset = 0;
    if (/[a-z]/.test(p)) charset += 26;
    if (/[A-Z]/.test(p)) charset += 26;
    if (/[0-9]/.test(p)) charset += 10;
    if (/[^a-zA-Z0-9]/.test(p)) charset += 33;
    const bits = p.length * Math.log2(Math.max(charset, 1));
    const inList = WORDLIST.includes(p) || WORDLIST.some((w) => p.toLowerCase().startsWith(w) && /^\d*$/.test(p.slice(w.length)));
    const guesses = 2 ** bits / 2;
    report.replaceChildren(
      h('div', null, h('b', null, 'Entropia ingênua: '), `${bits.toFixed(1)} bits (${p.length} caracteres × log₂(${charset}))`),
      inList ? h('div', { class: 'red' }, '⚠ Está (ou começa com algo que está) na wordlist: um ataque de dicionário com regras a quebra em segundos, não importa o cálculo acima.') : '',
      h('div', null, h('b', null, 'MD5 numa GPU (~60 bilhões/s): '), fmtTime(guesses / 6e10)),
      h('div', null, h('b', null, 'SHA-256 numa GPU (~10 bilhões/s): '), fmtTime(guesses / 1e10)),
      h('div', null, h('b', null, 'PBKDF2 com 600.000 iterações (~15 mil/s): '), fmtTime(guesses / 1.5e4)),
      h('div', { class: 'muted', style: 'font-size:12px' }, 'Estimativa para força bruta pura. Atacantes de verdade começam por dicionários e padrões ("Nome+ano!"), por isso senhas previsíveis caem muito antes.'),
    );
  };
  pw.oninput = upd;
  upd();

  const iters = h('input', { type: 'range', min: 0, max: 5, step: 1, value: 2, style: 'flex:1' }) as HTMLInputElement;
  const VALUES = [1, 100, 1000, 10000, 100000, 600000];
  const itLabel = h('div', { class: 'big-num', style: 'min-width:120px;font-size:30px' });
  const result = h('div', { class: 'out-box mono', style: 'word-break:break-all' }, 'clique em "Derivar" →');
  const updIt = () => (itLabel.textContent = VALUES[Number(iters.value)].toLocaleString('pt-BR'));
  iters.oninput = updIt;
  updIt();
  const derive = h('button', { class: 'btn amber', onclick: async () => {
    const n = VALUES[Number(iters.value)];
    result.textContent = `calculando ${n.toLocaleString('pt-BR')} iterações... (o navegador pode travar um pouco: é exatamente o ponto!)`;
    await new Promise((r) => setTimeout(r, 30));
    const t0 = performance.now();
    const dk = pbkdf2(hashById('sha256'), utf8(pw.value), utf8('sal-aleatorio'), n, 32);
    const ms = performance.now() - t0;
    result.textContent = `${toHex(dk)}\n\n⏱ ${ms.toFixed(0)} ms para UMA tentativa. Um atacante testando 1 milhão de senhas levaria ~${fmtTime((ms / 1000) * 1e6)} neste navegador.`;
    sfx.unlock();
  } }, '⚙ Derivar');

  return h('div', { class: 'lab-grid' },
    h('div', { class: 'lab-card panel' }, h('h3', null, 'Quão forte é uma senha?'),
      h('p', null, 'Digite uma senha (nada sai do seu navegador) e veja quanto tempo uma força bruta levaria, dependendo de como o site a guarda.'),
      pw, h('div', { style: 'margin-top:10px' }, report)),
    h('div', { class: 'lab-card panel' }, h('h3', null, 'PBKDF2: lentidão de propósito'),
      h('p', null, 'O "alongamento de chave" repete o HMAC milhares de vezes. Para você, um login leva milissegundos; para quem testa bilhões de senhas, vira uma eternidade.'),
      h('div', { style: 'display:flex;gap:10px;align-items:center' }, h('label', { class: 'muted' }, 'iterações'), iters, itLabel),
      h('div', { style: 'margin:10px 0' }, derive), result));
}
