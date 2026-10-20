// Gera o segredo REAL de cada combate: uma mensagem cifrada ou um hash de
// verdade, com chave aleatória a cada partida. A "quebra manual" confere a
// resposta do jogador recalculando a cifra/hash — nada é decorável.

import { fromUtf8, toHex, utf8 } from '../crypto/bytes';
import {
  atbash, caesar, encodeBase64, encodeHex, normalize, railFence, rot13, substitute, vigenere, xorBytes, ALPHA,
} from '../crypto/ciphers';
import { crc32 } from '../crypto/hash/checksums';
import { hashById, ntlm, pbkdf2 } from '../crypto/hash';
import {
  BYTE_MESSAGES, CLASSIC_MESSAGES, LONG_MESSAGES, OTP_PAIRS, TARGET_PASSWORDS, VIGENERE_KEYS, XOR_KEYS,
} from '../content/texts';
import type { Rng } from './rng';
import type { CipherKind, Puzzle } from './types';

/** Iterações reais do PBKDF2 no jogo (o texto fala em 100.000 para dar a ideia de escala). */
export const PBKDF2_GAME_ITERATIONS = 2000;

const lettersOf = (s: string) => normalize(s).replace(/[^A-Z]/g, '');

function order(rng: Rng, secret: string): number[] {
  const idx = [...secret].map((_, i) => i).filter((i) => secret[i] !== ' ');
  return rng.shuffle(idx);
}

export function makePuzzle(kind: CipherKind, rng: Rng): Puzzle {
  const mk = (cipher: string, secret: string, data: Record<string, unknown>, hint: string, cipher2?: string): Puzzle => ({
    kind, cipher, cipher2, secret, order: order(rng, secret), data, hint,
  });

  switch (kind) {
    case 'caesar': {
      const pt = rng.pick(CLASSIC_MESSAGES);
      const k = rng.int(1, 25);
      return mk(caesar(pt, k), pt, { shift: k }, 'Gire o disco até o texto virar português. São só 25 tentativas.');
    }
    case 'rot13': {
      const pt = rng.pick(CLASSIC_MESSAGES);
      return mk(rot13(pt), pt, { shift: 13 }, 'O nome já entrega a chave.');
    }
    case 'atbash': {
      const pt = rng.pick(CLASSIC_MESSAGES);
      return mk(atbash(pt), pt, {}, 'Troque cada letra pela sua "espelhada": A↔Z, B↔Y, C↔X...');
    }
    case 'railfence': {
      const pt = rng.pick(CLASSIC_MESSAGES);
      const rails = rng.int(2, 4);
      return mk(railFence(pt, rails), pt, { rails }, 'Teste quantos trilhos a cerca tem: de 2 a 5.');
    }
    case 'substitution': {
      const pt = rng.pick(CLASSIC_MESSAGES);
      const key = rng.shuffle([...ALPHA]).join('');
      return mk(substitute(pt, key), pt, { key }, 'Compare as letras mais comuns do cifrado com A, E, O, S, R do português.');
    }
    case 'vigenere': {
      const pt = rng.pick(LONG_MESSAGES);
      const key = rng.pick(VIGENERE_KEYS);
      return mk(vigenere(pt, key), pt, { key }, 'Ache o tamanho da chave pelos trechos repetidos e depois a palavra-chave.');
    }
    case 'base64': {
      const pt = rng.pick(BYTE_MESSAGES);
      return mk(encodeBase64(pt), pt, {}, 'Não há chave. É só decodificar.');
    }
    case 'hex': {
      const pt = rng.pick(BYTE_MESSAGES);
      return mk(encodeHex(pt).replace(/(..)/g, '$1 ').trim(), pt, {}, 'Cada par de símbolos é um byte. 61 = a, 62 = b, 20 = espaço...');
    }
    case 'xor1': {
      const pt = rng.pick(BYTE_MESSAGES);
      const k = rng.int(1, 255);
      return mk(toHex(xorBytes(utf8(pt), Uint8Array.of(k))).replace(/(..)/g, '$1 ').trim(), pt, { key: k },
        'Teste as 256 chaves e procure a que vira texto legível.');
    }
    case 'xorN': {
      const pt = rng.pick(BYTE_MESSAGES);
      const key = rng.pick(XOR_KEYS);
      return mk(toHex(xorBytes(utf8(pt), utf8(key))).replace(/(..)/g, '$1 ').trim(), pt, { key },
        'A chave é uma palavra curta em MAIÚSCULAS, repetida ao longo da mensagem.');
    }
    case 'otp': {
      const [p1, p2] = rng.pick(OTP_PAIRS);
      const n = Math.max(p1.length, p2.length);
      const pad = Uint8Array.from({ length: n }, () => rng.int(0, 255));
      const c1 = xorBytes(utf8(p1), pad);
      const c2 = xorBytes(utf8(p2.padEnd(p1.length, ' ')), pad);
      return mk(toHex(c1).replace(/(..)/g, '$1 ').trim(), p1, { p2, c1: toHex(c1), c2: toHex(c2) },
        'As duas mensagens usam a MESMA chave. c₁ ⊕ c₂ = p₁ ⊕ p₂: chute uma palavra comum e arraste.',
        toHex(c2).replace(/(..)/g, '$1 ').trim());
    }
    case 'crc32': {
      const pw = rng.pick(TARGET_PASSWORDS);
      return mk(toHex(crc32(utf8(pw))), pw, { algo: 'crc32' },
        'Qualquer texto com o MESMO CRC-32 abre a porta: checksums não foram feitos para isso.');
    }
    case 'ntlm': {
      const pw = rng.pick(TARGET_PASSWORDS);
      return mk(toHex(ntlm(pw)), pw, { algo: 'ntlm' }, 'NTLM = MD4 da senha. Sem sal: procure a senha na wordlist.');
    }
    case 'md5':
    case 'sha1': {
      const pw = rng.pick(TARGET_PASSWORDS);
      return mk(toHex(hashById(kind).fn(utf8(pw))), pw, { algo: kind }, 'Hash rápido e sem sal. Senhas comuns caem num dicionário.');
    }
    case 'pin': {
      const pin = String(rng.int(0, 9999)).padStart(4, '0');
      return mk(toHex(hashById('sha256').fn(utf8(pin))), pin, { algo: 'sha256' },
        'São só 10.000 PINs possíveis, de 0000 a 9999.');
    }
    case 'salted': {
      const pw = rng.pick(TARGET_PASSWORDS);
      const salt = toHex(Uint8Array.from({ length: 4 }, () => rng.int(0, 255)));
      return mk(toHex(hashById('sha256').fn(utf8(salt + pw))), pw, { algo: 'sha256', salt },
        'hash = SHA-256(sal + senha). O sal é público! Ele só impede tabelas pré-calculadas.');
    }
    case 'pbkdf2': {
      const pw = rng.pick(TARGET_PASSWORDS);
      const salt = toHex(Uint8Array.from({ length: 4 }, () => rng.int(0, 255)));
      const dk = pbkdf2(hashById('sha256'), utf8(pw), utf8(salt), PBKDF2_GAME_ITERATIONS, 32);
      return mk(toHex(dk), pw, { algo: 'pbkdf2', salt, iterations: PBKDF2_GAME_ITERATIONS },
        'Mesmo com dicionário, cada palpite custa milhares de hashes. Escolha bem as palavras.');
    }
  }
}

/** Calcula o "hash" de um palpite com os mesmos parâmetros do puzzle. */
export function hashGuess(p: Puzzle, guess: string): string {
  const d = p.data;
  switch (p.kind) {
    case 'crc32': return toHex(crc32(utf8(guess)));
    case 'ntlm': return toHex(ntlm(guess));
    case 'md5':
    case 'sha1': return toHex(hashById(p.kind).fn(utf8(guess)));
    case 'pin': return toHex(hashById('sha256').fn(utf8(guess)));
    case 'salted': return toHex(hashById('sha256').fn(utf8(String(d.salt) + guess)));
    case 'pbkdf2':
      return toHex(pbkdf2(hashById('sha256'), utf8(guess), utf8(String(d.salt)), Number(d.iterations), 32));
    default: return '';
  }
}

export const isHashPuzzle = (k: CipherKind) =>
  k === 'crc32' || k === 'ntlm' || k === 'md5' || k === 'sha1' || k === 'pin' || k === 'salted' || k === 'pbkdf2';

/** Confere uma resposta da quebra manual. */
export function checkAnswer(p: Puzzle, answer: string): boolean {
  if (isHashPuzzle(p.kind)) {
    // Num hash, qualquer entrada com o mesmo resultado vale (é o que uma colisão significa!).
    return hashGuess(p, answer) === p.cipher;
  }
  if (p.kind === 'base64' || p.kind === 'hex' || p.kind === 'xor1' || p.kind === 'xorN' || p.kind === 'otp') {
    return answer.trim().toLowerCase() === p.secret.toLowerCase();
  }
  return lettersOf(answer) === lettersOf(p.secret);
}

/** O segredo com apenas uma fração dos caracteres revelada (o resto vira ·). */
export function revealed(p: Puzzle, fraction: number): { text: string; shown: Set<number> } {
  const n = Math.round(Math.max(0, Math.min(1, fraction)) * p.order.length);
  const shown = new Set(p.order.slice(0, n));
  const text = [...p.secret].map((c, i) => (c === ' ' || shown.has(i) ? c : '·')).join('');
  return { text, shown };
}

export const bytesToText = (hex: string) => fromUtf8(Uint8Array.from(hex.split(' ').map((h) => parseInt(h, 16))));
