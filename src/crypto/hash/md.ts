// MD4 (1990) e MD5 (1992), de Ron Rivest. Ambos QUEBRADOS:
// colisões de MD5 saem em segundos num notebook desde 2004.
// O MD4 ainda vive no NTLM, o hash de senhas do Windows.

import { mdPad, readU32LE, rotl32, wordsToBytesLE } from '../bytes';

const IV = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

export function md4(msg: Uint8Array): Uint8Array {
  const m = mdPad(msg, 64, 8, true);
  let [h0, h1, h2, h3] = IV;
  const F = (x: number, y: number, z: number) => (x & y) | (~x & z);
  const G = (x: number, y: number, z: number) => (x & y) | (x & z) | (y & z);
  const H = (x: number, y: number, z: number) => x ^ y ^ z;
  for (let off = 0; off < m.length; off += 64) {
    const X = Array.from({ length: 16 }, (_, i) => readU32LE(m, off + i * 4));
    let a = h0, b = h1, c = h2, d = h3;
    for (const i of [0, 4, 8, 12]) {
      a = rotl32((a + F(b, c, d) + X[i]) >>> 0, 3);
      d = rotl32((d + F(a, b, c) + X[i + 1]) >>> 0, 7);
      c = rotl32((c + F(d, a, b) + X[i + 2]) >>> 0, 11);
      b = rotl32((b + F(c, d, a) + X[i + 3]) >>> 0, 19);
    }
    for (const i of [0, 1, 2, 3]) {
      a = rotl32((a + G(b, c, d) + X[i] + 0x5a827999) >>> 0, 3);
      d = rotl32((d + G(a, b, c) + X[i + 4] + 0x5a827999) >>> 0, 5);
      c = rotl32((c + G(d, a, b) + X[i + 8] + 0x5a827999) >>> 0, 9);
      b = rotl32((b + G(c, d, a) + X[i + 12] + 0x5a827999) >>> 0, 13);
    }
    for (const i of [0, 2, 1, 3]) {
      a = rotl32((a + H(b, c, d) + X[i] + 0x6ed9eba1) >>> 0, 3);
      d = rotl32((d + H(a, b, c) + X[i + 8] + 0x6ed9eba1) >>> 0, 9);
      c = rotl32((c + H(d, a, b) + X[i + 4] + 0x6ed9eba1) >>> 0, 11);
      b = rotl32((b + H(c, d, a) + X[i + 12] + 0x6ed9eba1) >>> 0, 15);
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
  }
  return wordsToBytesLE([h0, h1, h2, h3]);
}

// Constantes do MD5: parte inteira de |sen(i)| × 2^32.
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

export function md5(msg: Uint8Array): Uint8Array {
  const m = mdPad(msg, 64, 8, true);
  let [a0, b0, c0, d0] = IV;
  for (let off = 0; off < m.length; off += 64) {
    const M = Array.from({ length: 16 }, (_, i) => readU32LE(m, off + i * 4));
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) { f = (B & C) | (~B & D); g = i; }
      else if (i < 32) { f = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { f = C ^ (B | ~D); g = (7 * i) % 16; }
      f = (f + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl32(f, S[i])) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }
  return wordsToBytesLE([a0, b0, c0, d0]);
}
