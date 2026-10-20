// SHA-3 (Keccak, 2015). Construção totalmente diferente do SHA-2: em vez de
// Merkle–Damgård, usa uma "esponja" — absorve a mensagem num estado de
// 1600 bits, embaralha com a permutação Keccak-f e depois espreme a saída.
// Por isso o SHA-3 é imune ao ataque de extensão de comprimento.

const M64 = (1n << 64n) - 1n;
const rotl64 = (x: bigint, n: number) => (n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M64);

// Deslocamentos de rotação (ρ), gerados pelo passeio (x,y) → (y, 2x+3y).
const RHO = (() => {
  const r = new Array<number>(25).fill(0);
  let x = 1;
  let y = 0;
  for (let t = 0; t < 24; t++) {
    r[x + 5 * y] = (((t + 1) * (t + 2)) / 2) % 64;
    [x, y] = [y, (2 * x + 3 * y) % 5];
  }
  return r;
})();

// Constantes de rodada (ι), geradas por um LFSR de 8 bits.
const RC = (() => {
  const out: bigint[] = [];
  let lfsr = 0x01;
  for (let round = 0; round < 24; round++) {
    let rc = 0n;
    for (let j = 0; j < 7; j++) {
      const bit = lfsr & 1;
      lfsr = lfsr & 0x80 ? ((lfsr << 1) ^ 0x71) & 0xff : (lfsr << 1) & 0xff;
      if (bit) rc |= 1n << BigInt((1 << j) - 1);
    }
    out.push(rc);
  }
  return out;
})();

function keccakF(A: bigint[]): void {
  const C = new Array<bigint>(5);
  const B = new Array<bigint>(25);
  for (let round = 0; round < 24; round++) {
    // θ: cada coluna é misturada com as vizinhas
    for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
    for (let x = 0; x < 5; x++) {
      const D = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1);
      for (let y = 0; y < 25; y += 5) A[x + y] ^= D;
    }
    // ρ e π: rotaciona cada "pista" e muda sua posição
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(A[x + 5 * y], RHO[x + 5 * y]);
    // χ: o único passo não linear
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        A[x + 5 * y] = B[x + 5 * y] ^ (~B[((x + 1) % 5) + 5 * y] & M64 & B[((x + 2) % 5) + 5 * y]);
    // ι: quebra a simetria entre as rodadas
    A[0] ^= RC[round];
  }
}

function sha3(msg: Uint8Array, outBytes: number): Uint8Array {
  const rate = 200 - 2 * outBytes;
  const padded = new Uint8Array(Math.ceil((msg.length + 1) / rate) * rate);
  padded.set(msg);
  padded[msg.length] ^= 0x06; // sufixo de domínio do SHA-3
  padded[padded.length - 1] ^= 0x80;
  const A = new Array<bigint>(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let j = 7; j >= 0; j--) lane = (lane << 8n) | BigInt(padded[off + i * 8 + j]);
      A[i] ^= lane;
    }
    keccakF(A);
  }
  const out = new Uint8Array(outBytes);
  for (let i = 0; i < outBytes; i++) out[i] = Number((A[i >> 3] >> BigInt(8 * (i & 7))) & 0xffn);
  return out;
}

export const sha3_256 = (m: Uint8Array) => sha3(m, 32);
export const sha3_512 = (m: Uint8Array) => sha3(m, 64);
