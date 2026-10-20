// Utilitários de bytes. Tudo escrito à mão: entender como texto vira bytes
// (e bytes viram hex/Base64) é o primeiro passo para entender criptografia.

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: false });

/** Texto → bytes UTF-8. */
export const utf8 = (s: string): Uint8Array => encoder.encode(s);

/** Bytes → texto UTF-8 (bytes inválidos viram �). */
export const fromUtf8 = (b: Uint8Array): string => decoder.decode(b);

/** Bytes → hexadecimal minúsculo. */
export function toHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}

/** Hexadecimal → bytes. Ignora espaços. */
export function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) throw new Error('hex inválido');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64: agrupa 3 bytes (24 bits) em 4 símbolos de 6 bits. Não tem chave — é só uma codificação. */
export function toBase64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < b.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < b.length ? B64[n & 63] : '=';
  }
  return out;
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[\s=]+/g, '');
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('base64 inválido');
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export const rotl32 = (x: number, n: number): number => ((x << n) | (x >>> (32 - n))) >>> 0;
export const rotr32 = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

/** Quantos bits diferem entre dois vetores de bytes (distância de Hamming). */
export function hammingBits(a: Uint8Array, b: Uint8Array): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    let x = a[i] ^ b[i];
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d + Math.abs(a.length - b.length) * 8;
}

/**
 * Padding no estilo Merkle–Damgård (MD4, MD5, SHA-1, SHA-2, RIPEMD):
 * acrescenta o bit 1, zeros, e o tamanho da mensagem em bits no final.
 */
export function mdPad(msg: Uint8Array, blockSize: number, lengthBytes: number, littleEndian: boolean): Uint8Array {
  const bitLen = BigInt(msg.length) * 8n;
  let total = msg.length + 1 + lengthBytes;
  total += (blockSize - (total % blockSize)) % blockSize;
  const out = new Uint8Array(total);
  out.set(msg);
  out[msg.length] = 0x80;
  for (let i = 0; i < lengthBytes; i++) {
    const byte = Number((bitLen >> BigInt(8 * i)) & 0xffn);
    out[littleEndian ? total - lengthBytes + i : total - 1 - i] = byte;
  }
  return out;
}

export function readU32LE(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}
export function readU32BE(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}
export function wordsToBytesLE(words: number[]): Uint8Array {
  const out = new Uint8Array(words.length * 4);
  words.forEach((w, i) => {
    out[i * 4] = w & 0xff;
    out[i * 4 + 1] = (w >>> 8) & 0xff;
    out[i * 4 + 2] = (w >>> 16) & 0xff;
    out[i * 4 + 3] = (w >>> 24) & 0xff;
  });
  return out;
}
export function wordsToBytesBE(words: number[]): Uint8Array {
  const out = new Uint8Array(words.length * 4);
  words.forEach((w, i) => {
    out[i * 4] = (w >>> 24) & 0xff;
    out[i * 4 + 1] = (w >>> 16) & 0xff;
    out[i * 4 + 2] = (w >>> 8) & 0xff;
    out[i * 4 + 3] = w & 0xff;
  });
  return out;
}

/** Raiz inteira k-ésima (Newton) — usada para gerar as constantes do SHA-2. */
export function iroot(n: bigint, k: bigint): bigint {
  if (n < 2n) return n;
  let x = 1n << (BigInt(n.toString(2).length) / k + 1n);
  for (;;) {
    const y = ((k - 1n) * x + n / x ** (k - 1n)) / k;
    if (y >= x) return x;
    x = y;
  }
}

/** Os n primeiros números primos. */
export function primes(n: number): number[] {
  const out: number[] = [];
  for (let c = 2; out.length < n; c++) if (out.every((p) => c % p !== 0)) out.push(c);
  return out;
}

/**
 * Parte fracionária de p^(1/k), com `bits` bits de precisão.
 * Constantes "nada na manga": qualquer um pode recalcular e conferir
 * que não há porta dos fundos escondida nelas.
 */
export function fracRoot(p: number, k: number, bits: number): bigint {
  const r = iroot(BigInt(p) << BigInt(k * bits), BigInt(k));
  return r & ((1n << BigInt(bits)) - 1n);
}
