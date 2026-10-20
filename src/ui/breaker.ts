// Quebra manual: ferramentas REAIS de criptoanálise para cada tipo de cifra.
// O jogador manipula a chave, vê o resultado ao vivo e confirma a resposta.

import { bigramModel, chiSquaredPT, kasiski, letterFreq, likelyKeyLengths, PT_FREQ, rankCaesar, solveRepeatingXor, textScore, xorKeySizeScores } from '../crypto/analysis';
import { fromBase64, fromHex, fromUtf8, hammingBits, utf8 } from '../crypto/bytes';
import { ALPHA, atbash, caesar, railFenceDecrypt, vigenere, xorBytes } from '../crypto/ciphers';
import { CODEX, CODEX_BY_ID } from '../content/codex';
import { WORDLIST } from '../content/texts';
import type { Combat } from '../game/combat';
import { hashGuess, isHashPuzzle, revealed } from '../game/puzzles';
import type { Puzzle } from '../game/types';
import { sfx } from './audio';
import { h, modal, sleep, toast } from './dom';

/** Estado das ferramentas por puzzle, para não perder o progresso ao fechar. */
const memory = new WeakMap<Puzzle, Record<string, unknown>>();

let model: ReturnType<typeof bigramModel> | null = null;
/** Modelo de bigramas do português treinado nos próprios textos do Códex. */
const portugueseModel = () => (model ??= bigramModel(CODEX.map((e) => `${e.how} ${e.attack} ${e.today}`).join(' ')));

const printable = (b: Uint8Array) => [...b].map((x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : '·')).join('');

export function openBreaker(c: Combat, onSubmitted: () => void) {
  const p = c.puzzle;
  const mem = memory.get(p) ?? {};
  memory.set(p, mem);
  const entry = CODEX_BY_ID[p.kind];
  const out = h('div', { class: 'out-box' });
  const answerRef = { value: '' };
  const cpuInfo = h('span', { class: 'muted', style: 'font-size:12px' });
  const refreshCpu = () => (cpuInfo.textContent = `CPU disponível: ${c.cpu}`);
  refreshCpu();

  const setAnswer = (v: string, ok = false) => {
    answerRef.value = v;
    out.textContent = v || '—';
    out.classList.toggle('ok', ok);
  };

  /** Botão de ferramenta automática que gasta CPU. */
  const autoBtn = (label: string, cost: number, run: () => Promise<void> | void) =>
    h('button', { class: 'btn sm cyan', onclick: async (e: Event) => {
      const b = e.currentTarget as HTMLButtonElement;
      if (!c.spendCpu(cost)) {
        sfx.error();
        toast(`Precisa de ${cost} CPU (você tem ${c.cpu}).`, 'bad');
        return;
      }
      refreshCpu();
      b.disabled = true;
      sfx.click();
      await run();
      b.disabled = false;
    } }, `⚙ ${label} (${cost} CPU)`);

  const tool = buildTool(p, c, mem, setAnswer, autoBtn);
  let close = () => {};
  const submit = () => {
    const ans = answerRef.value.trim();
    if (!ans) {
      toast('Monte uma resposta primeiro.', 'bad');
      return;
    }
    close();
    c.manual(ans);
    onSubmitted();
  };

  close = modal(h('div', { class: 'breaker' },
    h('div', { class: 'modal-head' }, h('h2', null, `🔓 Quebra manual`), h('div', { class: 'spacer' }), h('span', { class: 'badge conceito' }, `${entry?.icon} ${entry?.title}`)),
    h('p', { class: 'muted', style: 'margin:0;line-height:1.6' },
      c.def.tier === 'chefe' && !c.def.phases ? 'Use a ferramenta e confirme. Contra um CHEFE, acertar tira 40% da entropia (e ele troca a chave). ' : 'Use a ferramenta para chegar à resposta e confirme. Acertou: o inimigo cai na hora. ',
      h('span', { class: 'red' }, 'Errou: o alarme dispara (−3 de Furtividade).'),
      ' Ferramentas automáticas gastam CPU do turno.'),
    tool,
    h('div', null, h('label', null, isHashPuzzle(p.kind) ? 'Sua resposta (a senha):' : 'Sua resposta (texto decifrado):'), out),
    h('div', { class: 'row' }, cpuInfo, h('div', { style: 'flex:1' }),
      h('button', { class: 'btn ghost', onclick: () => close() }, 'Voltar'),
      h('button', { class: 'btn big', onclick: submit }, '✔ Confirmar resposta')),
  ), { wide: true });
}

type AutoBtn = (label: string, cost: number, run: () => Promise<void> | void) => HTMLElement;

function freqChart(text: string): HTMLElement {
  const f = letterFreq(text);
  const max = Math.max(15, ...f);
  return h('div', null,
    h('div', { class: 'freq-chart' }, ...[...ALPHA].map((L, i) =>
      h('div', { class: 'freq-col', title: `${L}: cifrado ${f[i].toFixed(1)}% · português ${PT_FREQ[L]}%` },
        h('i', { class: 'c', style: `height:${(f[i] / max) * 80}%` }),
        h('i', { class: 'p', style: `height:${(PT_FREQ[L] / max) * 80}%` }),
        h('span', null, L)))),
    h('div', { class: 'legend-inline', style: 'margin-top:6px' },
      h('span', null, h('i', { style: 'background:var(--magenta)' }), 'letras do cifrado'),
      h('span', null, h('i', { style: 'background:var(--green);opacity:.5' }), 'frequência no português')));
}

function buildTool(p: Puzzle, c: Combat, mem: Record<string, unknown>, setAnswer: (v: string, ok?: boolean) => void, autoBtn: AutoBtn): HTMLElement {
  const cipherBox = h('div', { class: 'cipher-text' }, p.cipher);

  switch (p.kind) {
    // ---------------- César / ROT13 ----------------
    case 'caesar':
    case 'rot13': {
      const num = h('div', { class: 'big-num' });
      const slider = h('input', { type: 'range', min: 0, max: 25, value: Number(mem.k ?? 0) }) as HTMLInputElement;
      const update = () => {
        const k = Number(slider.value);
        mem.k = k;
        num.textContent = String(k);
        const out = caesar(p.cipher, -k);
        setAnswer(out, chiSquaredPT(out) < 60);
      };
      slider.oninput = () => { sfx.hover(); update(); };
      update();
      return h('div', { class: 'breaker' }, cipherBox,
        h('p', { class: 'muted', style: 'margin:0' }, 'Gire o deslocamento. O gráfico mostra a frequência das letras do cifrado contra o português: num César o desenho é o mesmo, só deslocado.'),
        h('div', { class: 'row' }, h('label', null, 'Deslocamento'), slider, num),
        freqChart(p.cipher),
        h('div', { class: 'row' }, autoBtn('Testar as 25 chaves', 2, async () => {
          const best = rankCaesar(p.cipher)[0].shift;
          for (let k = 0; k <= best; k++) {
            slider.value = String(k);
            update();
            sfx.reveal();
            await sleep(40);
          }
        })));
    }

    // ---------------- Atbash ----------------
    case 'atbash': {
      const mirror = h('div', { class: 'mono', style: 'font-size:13px;line-height:1.8;letter-spacing:.2em' },
        h('div', { class: 'magenta' }, ALPHA), h('div', { class: 'green' }, [...ALPHA].reverse().join('')));
      setAnswer(String(mem.out ?? ''));
      return h('div', { class: 'breaker' }, cipherBox, mirror,
        h('div', { class: 'row' }, h('button', { class: 'btn cyan', onclick: () => {
          const out = atbash(p.cipher);
          mem.out = out;
          setAnswer(out, true);
          sfx.reveal();
        } }, '🪞 Espelhar o alfabeto')),
        h('p', { class: 'muted', style: 'margin:0' }, 'Sem chave: quem conhece o método lê a mensagem. É por isso que a segurança deve estar na CHAVE (Princípio de Kerckhoffs).'));
    }

    // ---------------- Cerca ferroviária ----------------
    case 'railfence': {
      const num = h('div', { class: 'big-num' });
      const slider = h('input', { type: 'range', min: 2, max: 6, value: Number(mem.r ?? 2) }) as HTMLInputElement;
      const update = () => {
        const r = Number(slider.value);
        mem.r = r;
        num.textContent = String(r);
        const out = railFenceDecrypt(p.cipher, r);
        setAnswer(out, chiSquaredPT(out) < 60);
      };
      slider.oninput = () => { sfx.hover(); update(); };
      update();
      return h('div', { class: 'breaker' }, cipherBox,
        h('p', { class: 'muted', style: 'margin:0' }, 'Transposição: as letras são as mesmas da mensagem (veja como a frequência bate com o português!), só a ORDEM mudou. Teste o número de trilhos.'),
        h('div', { class: 'row' }, h('label', null, 'Trilhos'), slider, num),
        freqChart(p.cipher),
        h('p', { class: 'muted', style: 'margin:0;font-size:12px' }, 'Dica: a resposta sai sem espaços. Pode confirmar assim mesmo.'));
    }

    // ---------------- Substituição ----------------
    case 'substitution': {
      const map = (mem.map as Record<string, string>) ?? {};
      mem.map = map;
      // Letras já reveladas pelo dano entram no mapa automaticamente.
      const { shown } = revealed(p, c.revealFraction());
      for (const i of shown) map[p.cipher[i]] = p.secret[i];
      const counts = new Map<string, number>();
      for (const ch of p.cipher) if (ch >= 'A' && ch <= 'Z') counts.set(ch, (counts.get(ch) ?? 0) + 1);
      const letters = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const update = () => {
        const out = [...p.cipher].map((ch) => (ch >= 'A' && ch <= 'Z' ? map[ch] || '_' : ch)).join('');
        setAnswer(out, !out.includes('_'));
      };
      const grid = h('div', { class: 'subst-grid' }, ...letters.map(([L, n]) => {
        const inp = h('input', { maxlength: 1, value: map[L] ?? '' }) as HTMLInputElement;
        inp.oninput = () => {
          const v = inp.value.toUpperCase().replace(/[^A-Z]/g, '');
          inp.value = v;
          if (v) map[L] = v;
          else delete map[L];
          update();
          sfx.hover();
        };
        return h('div', { class: 'subst-cell' }, h('b', null, L), h('small', null, `${n}×`), inp);
      }));
      update();
      return h('div', { class: 'breaker' }, cipherBox,
        h('p', { class: 'muted', style: 'margin:0' }, 'Cada letra do cifrado (rosa) corresponde sempre à mesma letra real. Ordenei pela frequência: compare com A, E, O, S, R do português. Letras recuperadas pelos seus ataques já vêm preenchidas.'),
        grid, freqChart(p.cipher),
        h('div', { class: 'row' }, autoBtn('Sugerir pela frequência', 1, () => {
          const ptOrder = Object.entries(PT_FREQ).sort((a, b) => b[1] - a[1]).map(([l]) => l).filter((l) => !Object.values(map).includes(l));
          let k = 0;
          for (const [L] of letters) if (!map[L]) map[L] = ptOrder[k++] ?? '';
          toast('Chute inicial pela frequência: agora ajuste à mão as palavras que não fazem sentido.', 'learn', 5000);
          grid.querySelectorAll('input').forEach((inp, i) => ((inp as HTMLInputElement).value = map[letters[i][0]] ?? ''));
          update();
        })));
    }

    // ---------------- Vigenère ----------------
    case 'vigenere': {
      const inp = h('input', { class: 'input', placeholder: 'palavra-chave', value: String(mem.key ?? ''), style: 'text-transform:uppercase;flex:1' }) as HTMLInputElement;
      const update = () => {
        mem.key = inp.value;
        const out = vigenere(p.cipher, inp.value, true);
        setAnswer(inp.value ? out : '', chiSquaredPT(out) < 80);
      };
      inp.oninput = update;
      update();
      const reps = kasiski(p.cipher).slice(0, 8);
      const lens = likelyKeyLengths(p.cipher).slice(0, 4);
      return h('div', { class: 'breaker' }, cipherBox,
        h('div', { class: 'lab-grid' },
          h('div', null, h('label', null, 'Trechos repetidos (Kasiski):'),
            h('div', { class: 'kasiski-list' }, ...reps.map((r) => h('div', null, h('b', null, r.seq), ` aparece de novo após ${r.distances.join(', ')} letras`)))),
          h('div', null, h('label', null, 'Tamanhos de chave mais votados:'),
            h('div', { class: 'kasiski-list' }, ...lens.map((l) => h('div', null, h('b', null, `${l.len} letras`), ` — ${l.votes} votos`))))),
        h('p', { class: 'muted', style: 'margin:0' }, 'As distâncias entre repetições são múltiplas do tamanho da chave. Sabendo o tamanho, cada coluna é um César. Digite a palavra-chave:'),
        h('div', { class: 'row' }, inp,
          autoBtn('Kasiski + frequência', 3, () => {
            const L = lens[0]?.len ?? 3;
            const letters = p.cipher.replace(/[^A-Z]/g, '');
            let key = '';
            for (let col = 0; col < L; col++) {
              let s = '';
              for (let i = col; i < letters.length; i += L) s += letters[i];
              key += ALPHA[rankCaesar(s)[0].shift];
            }
            inp.value = key;
            update();
            toast(`Chave provável de ${L} letras: ${key}. Cada coluna foi resolvida como um César pela frequência.`, 'learn', 6000);
          })));
    }

    // ---------------- Base64 / hex ----------------
    case 'base64':
    case 'hex': {
      setAnswer(String(mem.out ?? ''));
      return h('div', { class: 'breaker' }, cipherBox,
        h('p', { class: 'muted', style: 'margin:0' }, p.kind === 'base64'
          ? 'Base64: cada 4 símbolos guardam 3 bytes. O "=" no final é preenchimento. Não há chave nenhuma.'
          : 'Hexadecimal: cada par é um byte. 61 = "a", 20 = espaço, 3a = ":". Não há chave nenhuma.'),
        h('div', { class: 'row' }, h('button', { class: 'btn cyan', onclick: () => {
          const out = fromUtf8(p.kind === 'base64' ? fromBase64(p.cipher) : fromHex(p.cipher));
          mem.out = out;
          setAnswer(out, true);
          sfx.reveal();
          toast('Viu? Decodificar não exige chave nenhuma. Codificação ≠ criptografia.', 'learn', 5000);
        } }, '🔓 Decodificar')));
    }

    // ---------------- XOR de 1 byte ----------------
    case 'xor1': {
      const data = fromHex(p.cipher);
      const num = h('div', { class: 'big-num', style: 'min-width:150px' });
      const slider = h('input', { type: 'range', min: 0, max: 255, value: Number(mem.k ?? 0) }) as HTMLInputElement;
      const update = () => {
        const k = Number(slider.value);
        mem.k = k;
        num.textContent = `0x${k.toString(16).padStart(2, '0')} '${k >= 32 && k < 127 ? String.fromCharCode(k) : '·'}'`;
        const outB = xorBytes(data, Uint8Array.of(k));
        setAnswer(printable(outB), textScore(outB) > outB.length * 1.4);
      };
      slider.oninput = () => { sfx.hover(); update(); };
      update();
      return h('div', { class: 'breaker' }, cipherBox,
        h('p', { class: 'muted', style: 'margin:0' }, 'XOR de 1 byte: só existem 256 chaves. Arraste até o resultado virar texto legível (· = byte não imprimível).'),
        h('div', { class: 'row' }, h('label', null, 'Chave'), slider, num),
        h('div', { class: 'row' }, autoBtn('Força bruta + pontuação de texto', 2, async () => {
          let best = 0;
          let bestS = -Infinity;
          for (let k = 0; k < 256; k++) {
            const s = textScore(xorBytes(data, Uint8Array.of(k)));
            if (s > bestS) [best, bestS] = [k, s];
          }
          for (let k = Number(slider.value); k !== best; k = (k + 7) % 256) {
            slider.value = String(k);
            update();
            if (Math.abs(k - best) < 7) break;
            await sleep(12);
          }
          slider.value = String(best);
          update();
          sfx.reveal();
        })));
    }

    // ---------------- XOR repetido ----------------
    case 'xorN': {
      const data = fromHex(p.cipher);
      const inp = h('input', { class: 'input', placeholder: 'chave (ex.: ABC)', value: String(mem.key ?? ''), style: 'flex:1' }) as HTMLInputElement;
      const update = () => {
        mem.key = inp.value;
        if (!inp.value) return setAnswer('');
        const outB = xorBytes(data, utf8(inp.value));
        setAnswer(printable(outB), textScore(outB) > outB.length * 1.4);
      };
      inp.oninput = update;
      update();
      const scores = xorKeySizeScores(data, 8).sort((a, b) => a.size - b.size);
      const maxS = Math.max(...scores.map((s) => s.score));
      return h('div', { class: 'breaker' }, cipherBox,
        h('label', null, 'Distância de Hamming normalizada por tamanho de chave (menor = mais provável):'),
        h('div', { style: 'display:flex;gap:6px;align-items:flex-end;height:90px' }, ...scores.map((s) =>
          h('div', { style: 'flex:1;text-align:center', title: s.score.toFixed(2) },
            h('div', { style: `height:${(s.score / maxS) * 64}px;background:var(--cyan);opacity:.7;border-radius:3px 3px 0 0` }),
            h('small', { class: 'muted' }, String(s.size))))),
        h('p', { class: 'muted', style: 'margin:0;font-size:12px' }, 'Com mensagens curtas a estimativa é ruidosa: os melhores tamanhos costumam ser o certo ou um múltiplo dele.'),
        h('div', { class: 'row' }, inp, autoBtn('Hamming + XOR por coluna', 3, () => {
          const upper = Array.from({ length: 26 }, (_, i) => 65 + i);
          const key = fromUtf8(solveRepeatingXor(data, 8, upper, portugueseModel()));
          inp.value = key;
          update();
          toast(`Chave provável: "${key}". Testei cada tamanho de chave e quebrei cada coluna como um XOR de 1 byte.`, 'learn', 5000);
        })));
    }

    // ---------------- One-time pad reutilizado ----------------
    case 'otp': {
      const c1 = fromHex(String(p.data.c1));
      const c2 = fromHex(String(p.data.c2));
      const x = xorBytes(c1.slice(0, Math.min(c1.length, c2.length)), c2);
      const crib = h('input', { class: 'input', placeholder: 'palavra provável (crib)', value: String(mem.crib ?? ' o '), style: 'flex:1' }) as HTMLInputElement;
      const pos = h('input', { type: 'range', min: 0, max: x.length - 1, value: Number(mem.pos ?? 0) }) as HTMLInputElement;
      const result = h('div', { class: 'out-box' });
      const answer = h('input', { class: 'input', placeholder: 'digite a mensagem 1 inteira (minúsculas)', value: String(mem.ans ?? ''), style: 'width:100%' }) as HTMLInputElement;
      const update = () => {
        mem.crib = crib.value;
        mem.pos = Number(pos.value);
        const cb = utf8(crib.value);
        const at = Math.min(Number(pos.value), Math.max(0, x.length - cb.length));
        const frag = x.slice(at, at + cb.length).map((b, i) => b ^ cb[i]);
        const s = textScore(frag);
        result.textContent = `posição ${at}: "${printable(frag)}"  ${s > frag.length * 1.5 ? '← parece texto!' : ''}`;
        result.classList.toggle('ok', s > frag.length * 1.5);
      };
      crib.oninput = update;
      pos.oninput = () => { sfx.hover(); update(); };
      answer.oninput = () => { mem.ans = answer.value; setAnswer(answer.value); };
      update();
      setAnswer(answer.value);
      const words = [' o ', ' a ', ' de ', 'ataque', 'amanha', 'codigo', 'cofre', 'espiao', 'agente', 'reuniao', 'dinheiro', 'conta', 'hotel', 'norte'];
      return h('div', { class: 'breaker' },
        h('div', { class: 'cipher-text' }, 'c₁ = ' + p.cipher), h('div', { class: 'cipher-text c2' }, 'c₂ = ' + p.cipher2),
        h('p', { class: 'muted', style: 'margin:0;line-height:1.6' }, 'Mesma chave nas duas mensagens: c₁ ⊕ c₂ = p₁ ⊕ p₂ (a chave se cancela!). Se você chutar uma palavra que está numa mensagem, o XOR na posição certa revela o trecho da OUTRA mensagem. Arraste o crib e procure texto legível.'),
        h('div', { class: 'row' }, ...words.map((w) => h('span', { class: 'word', onclick: () => { crib.value = w; update(); } }, JSON.stringify(w)))),
        h('div', { class: 'row' }, crib, h('label', null, 'posição'), pos),
        result,
        h('label', null, 'Monte a mensagem 1 aqui:'), answer);
    }
  }

  // ---------------- Hashes ----------------
  return hashTool(p, mem, setAnswer, autoBtn);
}

function hashTool(p: Puzzle, mem: Record<string, unknown>, setAnswer: (v: string, ok?: boolean) => void, autoBtn: AutoBtn): HTMLElement {
  const slow = p.kind === 'pbkdf2';
  const tried = (mem.tried as Set<string>) ?? new Set<string>();
  mem.tried = tried;
  const inp = h('input', { class: 'input', placeholder: p.kind === 'pin' ? 'PIN de 4 dígitos' : 'senha', value: String(mem.guess ?? ''), style: 'flex:1' }) as HTMLInputElement;
  const compare = h('div', { class: 'hash-compare' });
  const bits = h('div', { class: 'bits' });
  const status = h('div', { class: 'cracking' });
  const list = h('div', { class: 'wordlist' });

  const test = (guess: string) => {
    const hx = hashGuess(p, guess);
    const ok = hx === p.cipher;
    compare.replaceChildren(
      h('div', null, h('span', { class: 'muted' }, 'alvo:   '), p.cipher),
      h('div', null, h('span', { class: 'muted' }, 'palpite:'), ' ', ...[...hx].map((ch, i) => h('span', { class: ch === p.cipher[i] ? 'eq' : 'ne' }, ch))),
    );
    const a = fromHex(p.cipher);
    const b = fromHex(hx);
    const nBits = Math.min(256, a.length * 8);
    const diff = hammingBits(a, b);
    bits.replaceChildren(...Array.from({ length: nBits }, (_, i) => {
      const byte = i >> 3;
      const bit = 7 - (i & 7);
      return h('i', { class: ((a[byte] >> bit) & 1) !== ((b[byte] >> bit) & 1) ? 'diff' : '' });
    }));
    status.textContent = ok ? '✔ HASH IGUAL! Senha encontrada.' : `${diff} de ${a.length * 8} bits diferentes (~${Math.round((diff / (a.length * 8)) * 100)}%). Efeito avalanche: "quase certo" não existe em hash.`;
    tried.add(guess);
    markWord(guess, ok);
    setAnswer(guess, ok);
    return ok;
  };

  const markWord = (w: string, ok: boolean) => {
    const el = list.querySelector(`[data-w="${CSS.escape(w)}"]`);
    if (el) el.classList.add(ok ? 'found' : 'tried');
  };

  list.append(...WORDLIST.map((w) => h('span', { class: 'word' + (tried.has(w) ? ' tried' : ''), dataset: { w }, onclick: () => {
    inp.value = w;
    mem.guess = w;
    test(w);
    sfx.hover();
  } }, w)));

  let timer = 0;
  inp.oninput = () => {
    mem.guess = inp.value;
    clearTimeout(timer);
    if (slow) {
      setAnswer(inp.value);
      return;
    }
    timer = window.setTimeout(() => test(inp.value), 80);
  };
  if (inp.value && !slow) test(inp.value);
  else setAnswer(inp.value);

  const desc: Record<string, string> = {
    crc32: 'CRC-32 tem só 32 bits e é linear. QUALQUER texto com o mesmo CRC é aceito: isso é uma colisão.',
    ntlm: 'NTLM = MD4(senha em UTF-16). Sem sal: compare com a lista de senhas comuns.',
    md5: 'MD5 sem sal: rápido demais. Um dicionário de senhas comuns resolve.',
    sha1: 'SHA-1 sem sal: também rápido demais para guardar senhas.',
    pin: 'SHA-256 é forte, mas o PIN tem só 10.000 possibilidades. Força bruta resolve em milissegundos.',
    salted: `hash = SHA-256(sal + senha), sal = "${p.data.salt}". O sal é público: impede tabelas prontas, não impede o dicionário.`,
    pbkdf2: `PBKDF2 com ${p.data.iterations} iterações (sites reais usam 600.000). Cada palpite é LENTO: veja o tempo.`,
  };

  const dictCost = p.kind === 'pbkdf2' ? 3 : 2;
  const runDict = async () => {
    const t0 = performance.now();
    let n = 0;
    for (const w of WORDLIST) {
      n++;
      const ok = test(w);
      inp.value = w;
      if (n % (slow ? 1 : 6) === 0) {
        status.textContent = `testando "${w}" — ${n} palpites, ${((performance.now() - t0) / n).toFixed(2)} ms por palpite`;
        await sleep(slow ? 0 : 16);
      }
      if (ok) {
        sfx.unlock();
        toast(`Encontrada em ${n} palpites (${(performance.now() - t0).toFixed(0)} ms). Uma GPU real faria bilhões por segundo${slow ? ', menos contra PBKDF2' : ''}.`, 'learn', 6000);
        return;
      }
    }
  };
  const runPin = async () => {
    const t0 = performance.now();
    for (let i = 0; i < 10000; i++) {
      const g = String(i).padStart(4, '0');
      if (hashGuess(p, g) === p.cipher) {
        inp.value = g;
        test(g);
        sfx.unlock();
        toast(`PIN ${g} encontrado após ${i + 1} tentativas em ${(performance.now() - t0).toFixed(0)} ms. SHA-256 não salva um segredo de 4 dígitos.`, 'learn', 6000);
        return;
      }
      if (i % 250 === 0) {
        status.textContent = `testando ${g}... (${i}/10000)`;
        await sleep(0);
      }
    }
  };

  return h('div', { class: 'breaker' },
    h('p', { class: 'muted', style: 'margin:0;line-height:1.6' }, desc[p.kind] ?? ''),
    h('div', { class: 'row' }, inp, slow && h('button', { class: 'btn sm', onclick: () => test(inp.value) }, 'Calcular hash')),
    compare, bits, status,
    p.kind !== 'pin' && h('div', null, h('label', null, 'Wordlist (clique para testar):'), list),
    h('div', { class: 'row' },
      p.kind === 'pin' ? autoBtn('Força bruta 0000–9999', 2, runPin) : autoBtn('Ataque de dicionário', dictCost, runDict)));
}
