// Criptoanálise: as ferramentas que quebram as cifras clássicas.

import { ALPHA, caesar, normalize } from './ciphers';
import { hammingBits } from './bytes';

/** Frequência das letras no português (%), segundo a Wikipédia. */
export const PT_FREQ: Record<string, number> = {
  A: 14.63, B: 1.04, C: 3.88, D: 4.99, E: 12.57, F: 1.02, G: 1.3, H: 1.28, I: 6.18, J: 0.4, K: 0.02, L: 2.78, M: 4.74,
  N: 5.05, O: 10.73, P: 2.52, Q: 1.2, R: 6.53, S: 7.81, T: 4.34, U: 4.63, V: 1.67, W: 0.01, X: 0.21, Y: 0.01, Z: 0.47,
};

/** Contagem de cada letra A–Z. */
export function letterCounts(text: string): number[] {
  const counts = new Array(26).fill(0);
  for (const c of normalize(text)) {
    const i = c.charCodeAt(0) - 65;
    if (i >= 0 && i < 26) counts[i]++;
  }
  return counts;
}

/** Frequências relativas (%) de A–Z. */
export function letterFreq(text: string): number[] {
  const c = letterCounts(text);
  const total = c.reduce((a, b) => a + b, 0) || 1;
  return c.map((n) => (n / total) * 100);
}

/** Qui-quadrado contra o português: quanto MENOR, mais o texto "parece" português. */
export function chiSquaredPT(text: string): number {
  const counts = letterCounts(text);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return counts.reduce((acc, n, i) => {
    const expected = (PT_FREQ[ALPHA[i]] / 100) * total;
    return acc + (n - expected) ** 2 / (expected || 0.01);
  }, 0);
}

/** Testa os 26 deslocamentos de César e ordena do mais provável ao menos. */
export function rankCaesar(cipher: string): { shift: number; text: string; score: number }[] {
  return Array.from({ length: 26 }, (_, k) => {
    const text = caesar(cipher, -k);
    return { shift: k, text, score: chiSquaredPT(text) };
  }).sort((a, b) => a.score - b.score);
}

/**
 * Índice de coincidência (Friedman, 1922): probabilidade de duas letras
 * sorteadas serem iguais. Português ≈ 0,072; texto aleatório ≈ 0,038.
 */
export function indexOfCoincidence(text: string): number {
  const c = letterCounts(text);
  const n = c.reduce((a, b) => a + b, 0);
  if (n < 2) return 0;
  return c.reduce((acc, f) => acc + f * (f - 1), 0) / (n * (n - 1));
}

/**
 * Teste de Kasiski (1863): sequências repetidas no texto cifrado aparecem a
 * distâncias que são múltiplas do tamanho da chave de Vigenère.
 */
export function kasiski(cipher: string, minLen = 3): { seq: string; distances: number[] }[] {
  const letters = normalize(cipher).replace(/[^A-Z]/g, '');
  const seen = new Map<string, number[]>();
  for (let i = 0; i + minLen <= letters.length; i++) {
    const s = letters.slice(i, i + minLen);
    const list = seen.get(s) ?? [];
    list.push(i);
    seen.set(s, list);
  }
  return [...seen.entries()]
    .filter(([, pos]) => pos.length > 1)
    .map(([seq, pos]) => ({ seq, distances: pos.slice(1).map((p) => p - pos[0]) }));
}

/** Tamanhos de chave mais prováveis pelos divisores das distâncias de Kasiski. */
export function likelyKeyLengths(cipher: string, max = 10): { len: number; votes: number }[] {
  const votes = new Array(max + 1).fill(0);
  for (const { distances } of kasiski(cipher)) for (const d of distances) for (let k = 2; k <= max; k++) if (d % k === 0) votes[k]++;
  return votes.map((v, len) => ({ len, votes: v })).filter((x) => x.len >= 2).sort((a, b) => b.votes - a.votes);
}

/**
 * Distância de Hamming normalizada entre blocos: o truque para descobrir o
 * tamanho da chave de um XOR repetido (desafio 6 do Cryptopals).
 */
export function xorKeySizeScores(data: Uint8Array, maxSize = 12): { size: number; score: number }[] {
  const out: { size: number; score: number }[] = [];
  for (let size = 1; size <= maxSize; size++) {
    const blocks = Math.floor(data.length / size);
    if (blocks < 2) break;
    let total = 0;
    let pairs = 0;
    for (let b = 0; b + 1 < blocks && pairs < 6; b++, pairs++) {
      total += hammingBits(data.slice(b * size, (b + 1) * size), data.slice((b + 1) * size, (b + 2) * size)) / size;
    }
    out.push({ size, score: total / pairs });
  }
  return out.sort((a, b) => a.score - b.score);
}

/** Pontua bytes como texto: letras e espaços somam, bytes não imprimíveis penalizam. */
export function textScore(data: Uint8Array): number {
  let s = 0;
  for (const b of data) {
    if (b === 32) s += 3;
    else if ((b >= 65 && b <= 90) || (b >= 97 && b <= 122)) s += 2;
    else if (b >= 48 && b <= 57) s += 1;
    else if (b < 32 || b > 126) s -= 6;
  }
  return s;
}

/** Log-probabilidade aproximada de cada byte num texto em português minúsculo. */
const BYTE_LOGP = (() => {
  const p = new Float64Array(256).fill(Math.log(1e-7));
  for (let b = 32; b < 127; b++) p[b] = Math.log(0.0006);
  for (let b = 65; b <= 90; b++) p[b] = Math.log(0.002);
  for (let b = 48; b <= 57; b++) p[b] = Math.log(0.006);
  for (const ch of ':/{}_.,-@') p[ch.charCodeAt(0)] = Math.log(0.004);
  p[32] = Math.log(0.17);
  for (const [L, f] of Object.entries(PT_FREQ)) p[L.toLowerCase().charCodeAt(0)] = Math.log(0.8 * f / 100 + 1e-4);
  return p;
})();

/** Quão "texto" um vetor de bytes parece (soma das log-probabilidades). */
export function textLogLikelihood(bytes: Uint8Array): number {
  let s = 0;
  for (const b of bytes) s += BYTE_LOGP[b];
  return s;
}

export type TextScorer = (bytes: Uint8Array) => number;

/**
 * Modelo de BIGRAMAS (pares de letras) treinado num texto em português.
 * Mais esperto que contar letras isoladas: "qu" é comum, "qz" não existe.
 */
export function bigramModel(corpus: string): TextScorer {
  // Classes: 0–25 letras, 26 espaço, 27 dígito, 28 pontuação comum, 29 símbolo raro.
  const COMMON = new Set([...`.,:;/-_{}()!?'"@`]);
  const N = 30;
  const cls = (b: number): number => {
    if (b >= 97 && b <= 122) return b - 97;
    if (b >= 65 && b <= 90) return b - 65;
    if (b === 32) return 26;
    if (b >= 48 && b <= 57) return 27;
    if (b >= 33 && b < 127) return COMMON.has(String.fromCharCode(b)) ? 28 : 29;
    return -1;
  };
  const counts = Array.from({ length: N }, () => new Float64Array(N).fill(0.5));
  let prev = 26;
  for (const ch of normalize(corpus).toLowerCase()) {
    const c = cls(ch.charCodeAt(0));
    if (c < 0) continue;
    counts[prev][c]++;
    prev = c;
  }
  const logp = counts.map((row) => {
    const total = row.reduce((a, b) => a + b, 0);
    return row.map((n) => Math.log(n / total));
  });
  return (bytes) => {
    let s = 0;
    let p = 26;
    for (const b of bytes) {
      const c = cls(b);
      if (c < 0) {
        s -= 25;
        p = 29;
        continue;
      }
      s += logp[p][c] + (b >= 65 && b <= 90 ? -1.5 : 0);
      p = c;
    }
    return s;
  };
}

/**
 * Quebra um XOR com chave repetida: para cada tamanho de chave possível,
 * resolve cada "coluna" como um XOR de 1 byte e depois refina a chave
 * byte a byte com um modelo de bigramas (subida de encosta). `keyBytes`
 * restringe os bytes da chave (ex.: só maiúsculas).
 */
export function solveRepeatingXor(data: Uint8Array, maxSize = 8, keyBytes: number[] = range(32, 126), scorer: TextScorer = textLogLikelihood): Uint8Array {
  let best = new Uint8Array(1);
  let bestScore = -Infinity;
  const decrypt = (key: Uint8Array) => data.map((b, i) => b ^ key[i % key.length]);
  for (let size = 1; size <= Math.min(maxSize, data.length); size++) {
    const key = new Uint8Array(size);
    for (let col = 0; col < size; col++) {
      const column = data.filter((_, i) => i % size === col);
      let kb = keyBytes[0];
      let ks = -Infinity;
      for (const k of keyBytes) {
        const sc = textLogLikelihood(column.map((b) => b ^ k));
        if (sc > ks) [kb, ks] = [k, sc];
      }
      key[col] = kb;
    }
    let score = scorer(decrypt(key));
    for (let pass = 0; pass < 3; pass++) {
      let improved = false;
      for (let col = 0; col < size; col++) {
        let bestK = key[col];
        for (const k of keyBytes) {
          key[col] = k;
          const sc = scorer(decrypt(key));
          if (sc > score + 1e-9) {
            score = sc;
            bestK = k;
            improved = true;
          }
        }
        key[col] = bestK;
      }
      if (!improved) break;
    }
    // Chaves maiores sempre "encaixam" um pouco melhor: penalize cada byte extra.
    const final = score - size * 3;
    if (final > bestScore + 1e-9) [best, bestScore] = [key.slice(), final];
  }
  return best;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
