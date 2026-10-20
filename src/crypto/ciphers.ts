// Cifras clássicas e de bits. Todas operam sobre o alfabeto A–Z
// (acentos removidos); espaços e pontuação passam intactos.

import { fromUtf8, toBase64, toHex, utf8 } from './bytes';

export const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Maiúsculas sem acento: "Ação" → "ACAO". */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

const isLetter = (c: string) => c >= 'A' && c <= 'Z';
const shiftChar = (c: string, k: number) => ALPHA[(((c.charCodeAt(0) - 65 + k) % 26) + 26) % 26];

// ---------- Monoalfabéticas ----------

/** César: desloca cada letra k posições. Só existem 25 chaves úteis. */
export function caesar(text: string, k: number): string {
  return [...normalize(text)].map((c) => (isLetter(c) ? shiftChar(c, k) : c)).join('');
}

/** ROT13: César com k = 13. Aplicar duas vezes devolve o original. */
export const rot13 = (text: string) => caesar(text, 13);

/** Atbash (hebraico antigo): A↔Z, B↔Y, ... Não tem chave nenhuma. */
export function atbash(text: string): string {
  return [...normalize(text)].map((c) => (isLetter(c) ? ALPHA[25 - (c.charCodeAt(0) - 65)] : c)).join('');
}

/** Substituição simples: `key` é uma permutação do alfabeto (A→key[0], ...). 26! chaves. */
export function substitute(text: string, key: string): string {
  return [...normalize(text)].map((c) => (isLetter(c) ? key[c.charCodeAt(0) - 65] : c)).join('');
}
export function unsubstitute(text: string, key: string): string {
  return [...normalize(text)].map((c) => (isLetter(c) ? ALPHA[key.indexOf(c)] : c)).join('');
}

// ---------- Polialfabética ----------

/** Vigenère (1553/1586): um César diferente para cada letra, conforme a palavra-chave. */
export function vigenere(text: string, key: string, decrypt = false): string {
  const k = normalize(key).replace(/[^A-Z]/g, '');
  if (!k) return normalize(text);
  let i = 0;
  return [...normalize(text)]
    .map((c) => {
      if (!isLetter(c)) return c;
      const s = k.charCodeAt(i++ % k.length) - 65;
      return shiftChar(c, decrypt ? -s : s);
    })
    .join('');
}

// ---------- Transposição ----------

/** Cerca ferroviária: escreve em zigue-zague em N trilhos e lê trilho a trilho. Só usa letras. */
export function railFence(text: string, rails: number): string {
  const letters = normalize(text).replace(/[^A-Z]/g, '');
  if (rails < 2) return letters;
  const rows: string[] = Array.from({ length: rails }, () => '');
  railPattern(letters.length, rails).forEach((r, i) => (rows[r] += letters[i]));
  return rows.join('');
}

export function railFenceDecrypt(cipher: string, rails: number): string {
  const pattern = railPattern(cipher.length, rails);
  const counts = Array.from({ length: rails }, (_, r) => pattern.filter((x) => x === r).length);
  const rows: string[] = [];
  let pos = 0;
  for (const n of counts) {
    rows.push(cipher.slice(pos, pos + n));
    pos += n;
  }
  const idx = new Array(rails).fill(0);
  return pattern.map((r) => rows[r][idx[r]++]).join('');
}

function railPattern(n: number, rails: number): number[] {
  const out: number[] = [];
  let r = 0;
  let dir = 1;
  for (let i = 0; i < n; i++) {
    out.push(r);
    if (rails > 1) {
      if (r === 0) dir = 1;
      else if (r === rails - 1) dir = -1;
      r += dir;
    }
  }
  return out;
}

// ---------- XOR (bits) ----------

/** XOR com chave repetida. Com um byte de chave só existem 256 possibilidades. */
export function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  return data.map((b, i) => b ^ key[i % key.length]);
}

export const xorText = (text: string, key: Uint8Array) => xorBytes(utf8(text), key);
export const xorToText = (data: Uint8Array, key: Uint8Array) => fromUtf8(xorBytes(data, key));

// ---------- Codificações (NÃO são criptografia) ----------

export const encodeBase64 = (text: string) => toBase64(utf8(text));
export const encodeHex = (text: string) => toHex(utf8(text));
