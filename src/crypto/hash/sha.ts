// Família SHA: SHA-1 (1995, quebrado em 2017 pelo ataque "SHAttered"),
// SHA-2 (2001: SHA-224/256/384/512, seguros até hoje).
//
// As constantes do SHA-2 NÃO estão copiadas de uma tabela: são calculadas
// aqui a partir das raízes quadradas e cúbicas dos números primos, como diz
// a especificação (FIPS 180-4).

import { fracRoot, mdPad, primes, readU32BE, rotl32, rotr32, wordsToBytesBE } from '../bytes';

export function sha1(msg: Uint8Array): Uint8Array {
  const m = mdPad(msg, 64, 8, false);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Array<number>(80);
  for (let off = 0; off < m.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = readU32BE(m, off + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl32((w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]) >>> 0, 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = (rotl32(a, 5) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotl32(b, 30);
      b = a;
      a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  return wordsToBytesBE([h0, h1, h2, h3, h4]);
}

// ---------- SHA-256 / SHA-224 (palavras de 32 bits) ----------

const P = primes(80);
/** 32 bits da parte fracionária da raiz cúbica dos 64 primeiros primos. */
export const K256 = P.slice(0, 64).map((p) => Number(fracRoot(p, 3, 32)));
/** Raiz quadrada dos 8 primeiros primos. */
const IV256 = P.slice(0, 8).map((p) => Number(fracRoot(p, 2, 32)));
/** SHA-224: os 32 bits "de baixo" da raiz quadrada do 9º ao 16º primo. */
const IV224 = P.slice(8, 16).map((p) => Number(fracRoot(p, 2, 64) & 0xffffffffn));

function sha256core(msg: Uint8Array, iv: number[], outWords: number): Uint8Array {
  const m = mdPad(msg, 64, 8, false);
  const H = iv.slice();
  const w = new Array<number>(64);
  for (let off = 0; off < m.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = readU32BE(m, off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) >>> 0));
  }
  return wordsToBytesBE(H.slice(0, outWords));
}

export const sha256 = (m: Uint8Array) => sha256core(m, IV256, 8);
export const sha224 = (m: Uint8Array) => sha256core(m, IV224, 7);

// ---------- SHA-512 / SHA-384 (palavras de 64 bits, com BigInt) ----------

const M64 = (1n << 64n) - 1n;
const K512 = P.slice(0, 80).map((p) => fracRoot(p, 3, 64));
const IV512 = P.slice(0, 8).map((p) => fracRoot(p, 2, 64));
const IV384 = P.slice(8, 16).map((p) => fracRoot(p, 2, 64));
const rotr64 = (x: bigint, n: bigint) => ((x >> n) | (x << (64n - n))) & M64;

function sha512core(msg: Uint8Array, iv: bigint[], outWords: number): Uint8Array {
  const m = mdPad(msg, 128, 16, false);
  const H = iv.slice();
  const w = new Array<bigint>(80);
  for (let off = 0; off < m.length; off += 128) {
    for (let i = 0; i < 16; i++) {
      let v = 0n;
      for (let j = 0; j < 8; j++) v = (v << 8n) | BigInt(m[off + i * 8 + j]);
      w[i] = v;
    }
    for (let i = 16; i < 80; i++) {
      const s0 = rotr64(w[i - 15], 1n) ^ rotr64(w[i - 15], 8n) ^ (w[i - 15] >> 7n);
      const s1 = rotr64(w[i - 2], 19n) ^ rotr64(w[i - 2], 61n) ^ (w[i - 2] >> 6n);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & M64;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 80; i++) {
      const S1 = rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n);
      const ch = (e & f) ^ (~e & M64 & g);
      const t1 = (h + S1 + ch + K512[i] + w[i]) & M64;
      const S0 = rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) & M64;
      h = g;
      g = f;
      f = e;
      e = (d + t1) & M64;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) & M64;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) & M64));
  }
  const out = new Uint8Array(outWords * 8);
  H.slice(0, outWords).forEach((v, i) => {
    for (let j = 0; j < 8; j++) out[i * 8 + j] = Number((v >> BigInt(56 - 8 * j)) & 0xffn);
  });
  return out;
}

export const sha512 = (m: Uint8Array) => sha512core(m, IV512, 8);
export const sha384 = (m: Uint8Array) => sha512core(m, IV384, 6);
