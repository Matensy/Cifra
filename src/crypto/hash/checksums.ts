// CRC-32 e Adler-32: CHECKSUMS, não hashes criptográficos.
// Detectam erros acidentais (um bit trocado no cabo de rede), mas qualquer
// um consegue forjar uma colisão de propósito — são lineares e reversíveis.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): Uint8Array {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  c = (c ^ 0xffffffff) >>> 0;
  return Uint8Array.of(c >>> 24, (c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff);
}

export function adler32(data: Uint8Array): Uint8Array {
  const MOD = 65521; // maior primo menor que 2^16
  let a = 1;
  let b = 0;
  for (const x of data) {
    a = (a + x) % MOD;
    b = (b + a) % MOD;
  }
  const v = ((b << 16) | a) >>> 0;
  return Uint8Array.of(v >>> 24, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
}
