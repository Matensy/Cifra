// Registro de todos os algoritmos de hash do jogo, com a "ficha técnica"
// de cada um (usada no Códex e no Laboratório).

import { concat, utf8 } from '../bytes';
import { adler32, crc32 } from './checksums';
import { md4, md5 } from './md';
import { ripemd160 } from './ripemd';
import { sha1, sha224, sha256, sha384, sha512 } from './sha';
import { sha3_256, sha3_512 } from './sha3';

export type HashFn = (data: Uint8Array) => Uint8Array;
export type Safety = 'checksum' | 'quebrado' | 'fraco' | 'seguro';

export interface HashAlgo {
  id: string;
  name: string;
  bits: number;
  blockSize: number;
  year: number;
  author: string;
  safety: Safety;
  fn: HashFn;
  note: string;
}

export const HASHES: HashAlgo[] = [
  { id: 'crc32', name: 'CRC-32', bits: 32, blockSize: 1, year: 1975, author: 'W. Wesley Peterson (1961) / IEEE', safety: 'checksum', fn: crc32,
    note: 'Detecta erros acidentais em ZIP, PNG e Ethernet. Linear: forjar colisões é trivial.' },
  { id: 'adler32', name: 'Adler-32', bits: 32, blockSize: 1, year: 1995, author: 'Mark Adler', safety: 'checksum', fn: adler32,
    note: 'Usado no zlib. Mais rápido que o CRC, e ainda mais fraco em mensagens curtas.' },
  { id: 'md4', name: 'MD4', bits: 128, blockSize: 64, year: 1990, author: 'Ron Rivest', safety: 'quebrado', fn: md4,
    note: 'Base do NTLM (senhas do Windows). Colisões são encontradas à mão, literalmente.' },
  { id: 'md5', name: 'MD5', bits: 128, blockSize: 64, year: 1992, author: 'Ron Rivest', safety: 'quebrado', fn: md5,
    note: 'Colisões em segundos desde 2004. O malware Flame forjou um certificado da Microsoft com ele.' },
  { id: 'sha1', name: 'SHA-1', bits: 160, blockSize: 64, year: 1995, author: 'NSA / NIST', safety: 'quebrado', fn: sha1,
    note: 'Em 2017 o Google publicou dois PDFs diferentes com o mesmo SHA-1 (ataque SHAttered).' },
  { id: 'ripemd160', name: 'RIPEMD-160', bits: 160, blockSize: 64, year: 1996, author: 'Dobbertin, Bosselaers, Preneel', safety: 'fraco', fn: ripemd160,
    note: 'Sem ataques práticos, mas 160 bits já é pouco. Usado nos endereços do Bitcoin.' },
  { id: 'sha224', name: 'SHA-224', bits: 224, blockSize: 64, year: 2004, author: 'NSA / NIST', safety: 'seguro', fn: sha224,
    note: 'SHA-256 com outros valores iniciais e saída truncada.' },
  { id: 'sha256', name: 'SHA-256', bits: 256, blockSize: 64, year: 2001, author: 'NSA / NIST', safety: 'seguro', fn: sha256,
    note: 'O padrão atual: TLS, assinaturas, Git (novo formato) e a mineração do Bitcoin.' },
  { id: 'sha384', name: 'SHA-384', bits: 384, blockSize: 128, year: 2001, author: 'NSA / NIST', safety: 'seguro', fn: sha384,
    note: 'SHA-512 truncado. Resiste ao ataque de extensão de comprimento.' },
  { id: 'sha512', name: 'SHA-512', bits: 512, blockSize: 128, year: 2001, author: 'NSA / NIST', safety: 'seguro', fn: sha512,
    note: 'Palavras de 64 bits: costuma ser MAIS rápido que o SHA-256 em CPUs de 64 bits.' },
  { id: 'sha3_256', name: 'SHA3-256', bits: 256, blockSize: 136, year: 2015, author: 'Bertoni, Daemen, Peeters, Van Assche', safety: 'seguro', fn: sha3_256,
    note: 'Keccak: uma "esponja" criptográfica, projeto completamente diferente do SHA-2.' },
  { id: 'sha3_512', name: 'SHA3-512', bits: 512, blockSize: 72, year: 2015, author: 'Bertoni, Daemen, Peeters, Van Assche', safety: 'seguro', fn: sha3_512,
    note: 'A versão de 512 bits da esponja Keccak.' },
];

export const hashById = (id: string): HashAlgo => {
  const h = HASHES.find((x) => x.id === id);
  if (!h) throw new Error('hash desconhecido: ' + id);
  return h;
};

/** Hash de texto em hex. Atalho usado pelo jogo. */
export function hashText(id: string, text: string): string {
  return [...hashById(id).fn(utf8(text))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** HMAC (RFC 2104): hash com chave, à prova do ataque de extensão de comprimento. */
export function hmac(algo: HashAlgo, key: Uint8Array, msg: Uint8Array): Uint8Array {
  const bs = algo.blockSize;
  let k = key.length > bs ? algo.fn(key) : key;
  const padded = new Uint8Array(bs);
  padded.set(k);
  k = padded;
  const ipad = k.map((b) => b ^ 0x36);
  const opad = k.map((b) => b ^ 0x5c);
  return algo.fn(concat(opad, algo.fn(concat(ipad, msg))));
}

/**
 * PBKDF2 (RFC 8018): repete o HMAC milhares de vezes de propósito.
 * Para quem guarda senhas, cada login fica um pouco mais lento;
 * para quem ataca, cada tentativa fica milhares de vezes mais cara.
 */
export function pbkdf2(algo: HashAlgo, password: Uint8Array, salt: Uint8Array, iterations: number, dkLen: number): Uint8Array {
  const hLen = algo.bits / 8;
  const out = new Uint8Array(dkLen);
  for (let block = 1, pos = 0; pos < dkLen; block++) {
    const idx = Uint8Array.of(block >>> 24, (block >>> 16) & 0xff, (block >>> 8) & 0xff, block & 0xff);
    let u = hmac(algo, password, concat(salt, idx));
    const t = u.slice();
    for (let i = 1; i < iterations; i++) {
      u = hmac(algo, password, u);
      for (let j = 0; j < hLen; j++) t[j] ^= u[j];
    }
    out.set(t.slice(0, Math.min(hLen, dkLen - pos)), pos);
    pos += hLen;
  }
  return out;
}

/** NTLM = MD4 da senha em UTF-16LE. Sem sal: duas pessoas com a mesma senha têm o mesmo hash. */
export function ntlm(password: string): Uint8Array {
  const out = new Uint8Array(password.length * 2);
  for (let i = 0; i < password.length; i++) {
    const c = password.charCodeAt(i);
    out[i * 2] = c & 0xff;
    out[i * 2 + 1] = c >> 8;
  }
  return md4(out);
}
