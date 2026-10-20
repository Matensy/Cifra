import { createHash, createHmac, getHashes, pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fromBase64, fromHex, toBase64, toHex, utf8 } from '../src/crypto/bytes';
import { HASHES, hashById, hmac, ntlm, pbkdf2 } from '../src/crypto/hash';
import {
  atbash, caesar, railFence, railFenceDecrypt, rot13, substitute, unsubstitute, vigenere, xorBytes,
} from '../src/crypto/ciphers';
import { indexOfCoincidence, likelyKeyLengths, rankCaesar, xorKeySizeScores } from '../src/crypto/analysis';

const hex = (id: string, s: string) => toHex(hashById(id).fn(utf8(s)));

// Vetores oficiais (RFCs, FIPS e artigos originais).
const VECTORS: Record<string, [string, string][]> = {
  crc32: [['123456789', 'cbf43926'], ['', '00000000']],
  adler32: [['Wikipedia', '11e60398']],
  md4: [['', '31d6cfe0d16ae931b73c59d7e0c089c0'], ['abc', 'a448017aaf21d8525fc10ae87aa6729d'],
    ['message digest', 'd9130a8164549fe818874806e1c7014b']],
  md5: [['', 'd41d8cd98f00b204e9800998ecf8427e'], ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['The quick brown fox jumps over the lazy dog', '9e107d9d372bb6826bd81d3542a419d6']],
  sha1: [['abc', 'a9993e364706816aba3e25717850c26c9cd0d89d'], ['', 'da39a3ee5e6b4b0d3255bfef95601890afd80709']],
  ripemd160: [['', '9c1185a5c5e9fc54612808977ee8f548b2258d31'], ['abc', '8eb208f7e05d987a9b044a8e98c6b087f15a0bfc']],
  sha224: [['abc', '23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7']],
  sha256: [['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855']],
  sha384: [['abc', 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7']],
  sha512: [['abc', 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f']],
  sha3_256: [['', 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a'],
    ['abc', '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532']],
  sha3_512: [['abc', 'b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0']],
};

describe('hashes: vetores oficiais', () => {
  for (const [id, cases] of Object.entries(VECTORS)) {
    it(id, () => {
      for (const [input, expected] of cases) expect(hex(id, input)).toBe(expected);
    });
  }
});

describe('hashes: conferidos contra o OpenSSL do Node em entradas aleatórias', () => {
  const node: Record<string, string> = {
    md5: 'md5', sha1: 'sha1', sha224: 'sha224', sha256: 'sha256', sha384: 'sha384', sha512: 'sha512',
    sha3_256: 'sha3-256', sha3_512: 'sha3-512', ripemd160: 'ripemd160', md4: 'md4',
  };
  const available = new Set(getHashes());
  // Tamanhos escolhidos para cair nas bordas do padding (55, 56, 64, 111, 112, 135, 136…).
  const sizes = [0, 1, 3, 55, 56, 57, 63, 64, 65, 71, 72, 111, 112, 127, 128, 135, 136, 137, 200, 1000];
  for (const algo of HASHES) {
    const name = node[algo.id];
    if (!name || !available.has(name)) continue;
    it(algo.name, () => {
      for (const n of sizes) {
        const data = Uint8Array.from({ length: n }, (_, i) => (i * 131 + n * 7) & 0xff);
        expect(toHex(algo.fn(data))).toBe(createHash(name).update(data).digest('hex'));
      }
    });
  }
});

describe('HMAC, PBKDF2 e NTLM', () => {
  it('HMAC-SHA256 e HMAC-SHA512 batem com o Node', () => {
    for (const [id, name] of [['sha256', 'sha256'], ['sha512', 'sha512'], ['md5', 'md5']]) {
      for (const key of ['k', 'chave-secreta', 'x'.repeat(200)]) {
        const ours = toHex(hmac(hashById(id), utf8(key), utf8('mensagem importante')));
        expect(ours).toBe(createHmac(name, key).update('mensagem importante').digest('hex'));
      }
    }
  });
  it('PBKDF2-HMAC-SHA256 bate com o Node', () => {
    const ours = toHex(pbkdf2(hashById('sha256'), utf8('senha'), utf8('sal'), 1000, 40));
    expect(ours).toBe(pbkdf2Sync('senha', 'sal', 1000, 40, 'sha256').toString('hex'));
  });
  it('NTLM de "password"', () => {
    expect(toHex(ntlm('password'))).toBe('8846f7eaee8fb117ad06bdd830b7586c');
  });
});

describe('codificações', () => {
  it('Base64 e hex vão e voltam', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'Olá, criptografia!']) {
      const b = utf8(s);
      expect(toBase64(b)).toBe(Buffer.from(b).toString('base64'));
      expect([...fromBase64(toBase64(b))]).toEqual([...b]);
      expect([...fromHex(toHex(b))]).toEqual([...b]);
    }
  });
});

describe('cifras clássicas', () => {
  const msg = 'ATACAR AO AMANHECER';
  it('César, ROT13 e Atbash', () => {
    expect(caesar('ABC XYZ', 3)).toBe('DEF ABC');
    expect(caesar(caesar(msg, 7), -7)).toBe(msg);
    expect(rot13(rot13(msg))).toBe(msg);
    expect(atbash('ABC')).toBe('ZYX');
    expect(atbash(atbash(msg))).toBe(msg);
  });
  it('acentos são removidos', () => {
    expect(caesar('ação', 0)).toBe('ACAO');
  });
  it('Vigenère (exemplo clássico LEMON)', () => {
    expect(vigenere('ATTACK AT DAWN', 'LEMON')).toBe('LXFOPV EF RNHR');
    expect(vigenere('LXFOPV EF RNHR', 'LEMON', true)).toBe('ATTACK AT DAWN');
  });
  it('substituição', () => {
    const key = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    expect(unsubstitute(substitute(msg, key), key)).toBe(msg);
  });
  it('cerca ferroviária (exemplo da Wikipédia)', () => {
    expect(railFence('WEAREDISCOVEREDFLEEATONCE', 3)).toBe('WECRLTEERDSOEEFEAOCAIVDEN');
    expect(railFenceDecrypt('WECRLTEERDSOEEFEAOCAIVDEN', 3)).toBe('WEAREDISCOVEREDFLEEATONCE');
  });
  it('XOR é a própria inversa', () => {
    const data = utf8('segredo');
    const key = utf8('K');
    expect([...xorBytes(xorBytes(data, key), key)]).toEqual([...data]);
  });
});

describe('criptoanálise', () => {
  const texto =
    'A CRIPTOGRAFIA ESTUDA OS METODOS PARA ESCONDER MENSAGENS E A CRIPTOANALISE ESTUDA COMO QUEBRAR ESSES METODOS SEM CONHECER A CHAVE';
  it('análise de frequência acha o deslocamento de César', () => {
    expect(rankCaesar(caesar(texto, 11))[0].shift).toBe(11);
  });
  it('índice de coincidência: português alto, Vigenère baixo', () => {
    expect(indexOfCoincidence(texto)).toBeGreaterThan(0.06);
    expect(indexOfCoincidence(vigenere(texto, 'SEGREDOS'))).toBeLessThan(indexOfCoincidence(texto));
  });
  it('Kasiski sugere o tamanho da chave', () => {
    const longo = (texto + ' ').repeat(3);
    const top = likelyKeyLengths(vigenere(longo, 'CHAVE')).slice(0, 3).map((x) => x.len);
    expect(top).toContain(5);
  });
  it('Hamming encontra o tamanho da chave de XOR', () => {
    const data = xorBytes(utf8(texto.toLowerCase().repeat(2)), utf8('ABCD'));
    const top = xorKeySizeScores(data).slice(0, 3).map((x) => x.size);
    expect(top.some((s) => s % 4 === 0)).toBe(true);
  });
});
