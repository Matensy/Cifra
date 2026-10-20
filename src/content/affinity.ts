// A tabela que ensina criptoanálise: qual técnica funciona contra qual
// proteção, e POR QUÊ. O jogador vê o multiplicador e o motivo em cada carta.

import type { CipherKind, Statuses, Tag } from '../game/types';

export const TAGS: Record<Tag, { name: string; icon: string; color: string; desc: string }> = {
  bruta: { name: 'Força bruta', icon: '🔨', color: '#ff5d73', desc: 'Testa todas as chaves possíveis. Ótima quando o espaço de chaves é pequeno.' },
  frequencia: { name: 'Frequência', icon: '📊', color: '#4ade80', desc: 'Compara a frequência das letras com o idioma. Mata cifras de substituição.' },
  kasiski: { name: 'Período', icon: '📏', color: '#38bdf8', desc: 'Descobre o tamanho da chave (Kasiski, Friedman, Hamming).' },
  crib: { name: 'Texto conhecido', icon: '🧩', color: '#c084fc', desc: 'Usa um trecho que você sabe (ou chuta) que está na mensagem.' },
  dicionario: { name: 'Dicionário', icon: '📖', color: '#fbbf24', desc: 'Testa senhas comuns em vez de todas as combinações.' },
  rainbow: { name: 'Tabela pré-calculada', icon: '🌈', color: '#f472b6', desc: 'Hashes calculados antes do ataque. Inútil contra sal.' },
  colisao: { name: 'Colisão', icon: '🎂', color: '#fb923c', desc: 'Acha duas entradas com o mesmo hash. Fácil em hashes curtos ou quebrados.' },
  decodificar: { name: 'Decodificar', icon: '🔓', color: '#2dd4bf', desc: 'Desfaz uma codificação. Só funciona no que não tem chave.' },
  social: { name: 'Engenharia social', icon: '🎭', color: '#a3e635', desc: 'Ataca a pessoa, não a matemática. Funciona contra qualquer coisa.' },
  canal: { name: 'Canal lateral', icon: '⏱️', color: '#94a3b8', desc: 'Mede tempo, energia ou erros do sistema. Ignora o Firewall.' },
};

type Aff = Partial<Record<Tag, [number, string]>>;

const NOT_HASH: Aff = {
  rainbow: [0, 'Tabelas pré-calculadas servem para hashes, e isto não é um hash.'],
  colisao: [0, 'Colisão é um ataque contra hashes. Aqui não há hash nenhum.'],
};
const NOT_ENCODING: [number, string] = [0, 'Isto é uma CIFRA (tem chave), não uma codificação. Decodificar não adianta.'];
const HASH_BASE: Aff = {
  frequencia: [0, 'O hash destrói qualquer padrão: a saída parece aleatória, sem frequência de letras.'],
  kasiski: [0, 'Não existe "chave" nem período num hash.'],
  crib: [0.5, 'Saber parte da senha ajuda pouco: um bit diferente muda metade do hash (efeito avalanche).'],
  decodificar: [0, 'Hash é uma função de mão única: não existe "decodificar" um hash.'],
};

export const AFFINITY: Record<CipherKind, Aff> = {
  caesar: {
    ...NOT_HASH,
    bruta: [2, 'César só tem 25 chaves possíveis. Testar todas leva segundos, até à mão.'],
    frequencia: [1.5, 'O deslocamento preserva a distribuição: o "E" cifrado continua sendo a letra mais comum.'],
    dicionario: [0.5, 'Não é uma senha; testar palavras comuns não ajuda muito.'],
    decodificar: NOT_ENCODING,
  },
  rot13: {
    ...NOT_HASH,
    bruta: [2, 'ROT13 é um César com chave fixa 13. Só existe uma chave.'],
    frequencia: [1.5, 'Continua sendo um deslocamento: as frequências apenas mudam de lugar.'],
    decodificar: [1.5, 'Com a chave fixa e pública, ROT13 é quase uma codificação: aplicar de novo desfaz.'],
  },
  atbash: {
    ...NOT_HASH,
    bruta: [2, 'Atbash não tem chave: é sempre o alfabeto invertido (A↔Z).'],
    frequencia: [1.5, 'É uma substituição monoalfabética: a letra mais comum continua se destacando.'],
    decodificar: [1.25, 'Sem chave, o "segredo" é só o método, que já é conhecido.'],
  },
  railfence: {
    ...NOT_HASH,
    bruta: [1.5, 'Poucos trilhos possíveis (2 a 5): dá para testar todos.'],
    frequencia: [0.25, 'Transposição só EMBARALHA a ordem: as letras são as mesmas, então a frequência não revela nada.'],
    crib: [1.5, 'Palavras conhecidas aparecem espalhadas em posições regulares.'],
    kasiski: [0.5, 'Não há chave repetida para medir, só o número de trilhos.'],
    decodificar: NOT_ENCODING,
  },
  substitution: {
    ...NOT_HASH,
    bruta: [0.1, 'São 26! ≈ 4×10²⁶ chaves. Nem todos os computadores do mundo testariam todas.'],
    frequencia: [2, 'Cada letra vira sempre a mesma letra: o padrão do idioma entrega tudo (Al-Kindi, século IX).'],
    crib: [1.5, 'Uma palavra conhecida revela várias letras de uma vez.'],
    decodificar: NOT_ENCODING,
  },
  vigenere: {
    ...NOT_HASH,
    bruta: [0.25, 'Com chave de 6 letras são 26⁶ ≈ 300 milhões de chaves. Lento demais à mão.'],
    frequencia: [0.25, 'Polialfabética: cada letra usa um César diferente, o que ACHATA as frequências. Descubra o período primeiro!'],
    kasiski: [1.5, 'Trechos repetidos revelam o tamanho da chave (Kasiski, 1863).'],
    crib: [1.25, 'Uma palavra conhecida revela pedaços da chave.'],
    decodificar: NOT_ENCODING,
  },
  base64: {
    ...NOT_HASH,
    decodificar: [3, 'Base64 é uma CODIFICAÇÃO, não criptografia: não tem chave, qualquer um desfaz.'],
    bruta: [0.5, 'Não há chave para adivinhar! Força bruta aqui é desperdício.'],
    frequencia: [0.5, 'Os símbolos Base64 misturam bits de letras vizinhas, então a frequência fica confusa.'],
  },
  hex: {
    ...NOT_HASH,
    decodificar: [3, 'Hexadecimal é só outra forma de escrever bytes: 2 símbolos por byte. Zero segurança.'],
    bruta: [0.5, 'Não existe chave. Força bruta não faz sentido.'],
    frequencia: [0.75, 'Cada letra vira o mesmo par hex, mas é mais fácil simplesmente decodificar.'],
  },
  xor1: {
    ...NOT_HASH,
    bruta: [2, 'Uma chave de 1 byte tem só 256 possibilidades. Teste todas e veja qual vira texto.'],
    frequencia: [1.5, 'Pontue cada tentativa pela "cara de texto" (espaços e letras comuns).'],
    crib: [1.25, 'Se você sabe um caractere, sabe a chave: c ⊕ p = k.'],
    decodificar: NOT_ENCODING,
  },
  xorN: {
    ...NOT_HASH,
    bruta: [0.25, 'Chave de vários bytes: 256ⁿ possibilidades. Descubra o tamanho dela primeiro.'],
    frequencia: [0.25, 'Sem o tamanho da chave, os bytes se misturam. Use Kasiski/Hamming antes!'],
    kasiski: [1.5, 'A distância de Hamming entre blocos revela o tamanho da chave.'],
    crib: [1.5, 'Um trecho conhecido revela bytes da chave diretamente.'],
    decodificar: NOT_ENCODING,
  },
  otp: {
    ...NOT_HASH,
    bruta: [0, 'Sigilo perfeito (Shannon, 1949): com chave aleatória do tamanho da mensagem, TODA mensagem é possível.'],
    frequencia: [0, 'O one-time pad deixa a saída uniformemente aleatória. Não sobra padrão nenhum.'],
    kasiski: [0, 'A chave nunca se repete dentro da mensagem.'],
    crib: [0, 'Sem reuso de chave, saber parte do texto não diz nada sobre o resto.'],
    decodificar: NOT_ENCODING,
    social: [0.5, 'Nem a pessoa sabe a mensagem sem a chave... mas talvez ela erre.'],
  },
  crc32: {
    ...HASH_BASE,
    colisao: [3, 'CRC é LINEAR: dá para calcular 4 bytes que forçam qualquer CRC desejado. Colisão instantânea.'],
    bruta: [1.5, 'Só 32 bits: cerca de 4 bilhões de valores, poucos segundos numa GPU.'],
    rainbow: [1.5, 'Hash curto e sem sal: cabe numa tabela.'],
    dicionario: [1.25, 'Senhas comuns costumam estar na lista.'],
  },
  ntlm: {
    ...HASH_BASE,
    rainbow: [2.5, 'NTLM não usa sal: a mesma senha gera o mesmo hash em qualquer Windows do mundo.'],
    dicionario: [1.75, 'MD4 é rapidíssimo: bilhões de tentativas por segundo numa GPU.'],
    bruta: [1.5, 'MD4 é tão rápido que senhas curtas caem por força bruta.'],
    colisao: [1.5, 'MD4 está completamente quebrado: colisões saem à mão.'],
  },
  md5: {
    ...HASH_BASE,
    rainbow: [2.5, 'MD5 sem sal: existem tabelas prontas com bilhões de senhas. A busca é instantânea.'],
    dicionario: [1.75, 'Rápido demais para guardar senhas: ~60 bilhões de MD5 por segundo numa GPU moderna.'],
    bruta: [1.5, 'Senhas curtas em MD5 caem por força bruta em minutos.'],
    colisao: [2, 'Colisões de MD5 saem em segundos desde 2004 (Wang et al.).'],
  },
  sha1: {
    ...HASH_BASE,
    rainbow: [2, 'Sem sal, SHA-1 também cabe em tabelas pré-calculadas.'],
    dicionario: [1.5, 'Ainda é um hash rápido: péssimo para senhas.'],
    bruta: [1.25, 'Rápido, mas um pouco mais lento que MD5.'],
    colisao: [1.5, 'Quebrado na prática em 2017: o ataque SHAttered do Google.'],
  },
  pin: {
    ...HASH_BASE,
    bruta: [3, 'Um PIN de 4 dígitos tem só 10.000 combinações. SHA-256 não salva um segredo pequeno.'],
    dicionario: [1.25, '1234, 0000 e datas de nascimento são os primeiros a testar.'],
    rainbow: [1.5, 'Só 10.000 hashes possíveis: a tabela inteira cabe numa planilha.'],
    colisao: [0.1, 'Achar colisão em SHA-256 exigiria 2¹²⁸ operações. Impossível. Ataque o PIN, não o hash.'],
  },
  salted: {
    ...HASH_BASE,
    rainbow: [0, 'O SAL é aleatório por usuário: as tabelas pré-calculadas viram lixo.'],
    dicionario: [1.5, 'O sal não protege senha fraca: basta calcular hash(sal + palavra) para cada palavra.'],
    bruta: [0.75, 'SHA-256 ainda é rápido, mas o espaço de senhas fortes é enorme.'],
    colisao: [0.1, 'SHA-256 resiste a colisões. E colisão nem ajudaria a achar a senha.'],
  },
  pbkdf2: {
    ...HASH_BASE,
    rainbow: [0, 'Com sal, tabelas pré-calculadas não servem.'],
    dicionario: [0.6, '100.000 iterações: cada palpite custa 100.000 hashes. A lista anda devagar.'],
    bruta: [0.25, 'Alongamento de chave torna a força bruta proibitivamente cara.'],
    colisao: [0.1, 'Colisões não ajudam contra derivação de chave.'],
    social: [2, 'Quando a matemática é forte, o elo fraco é a pessoa. Phishing não precisa de GPU.'],
    canal: [1.5, 'Implementações que comparam byte a byte vazam informação pelo tempo.'],
  },
};

export interface Effect {
  mult: number;
  why: string;
}

/** Multiplicador final de uma técnica contra um inimigo, considerando os status dele. */
export function effectiveness(kind: CipherKind, tag: Tag | undefined, st: Statuses): Effect {
  if (!tag) return { mult: 1, why: '' };
  if (kind === 'otp' && st.reuso) {
    if (tag === 'crib') return { mult: 2, why: 'Chave REUTILIZADA: c₁ ⊕ c₂ = p₁ ⊕ p₂. Arraste um trecho conhecido e as duas mensagens aparecem (Projeto Venona).' };
    if (tag === 'frequencia') return { mult: 1, why: 'Com reuso, as duas mensagens se entregam pela estatística do idioma.' };
    if (tag === 'kasiski') return { mult: 0.5, why: 'O período não importa; o que importa é o reuso.' };
  }
  if ((kind === 'vigenere' || kind === 'xorN') && st.periodo) {
    if (tag === 'frequencia') return { mult: 1.75, why: 'Período descoberto! Agora são vários Césares simples, e a frequência quebra cada um.' };
    if (tag === 'bruta') return { mult: 1, why: 'Sabendo o tamanho da chave, dá para atacar cada posição separadamente.' };
  }
  const e = AFFINITY[kind][tag];
  if (!e) return { mult: 1, why: '' };
  return { mult: e[0], why: e[1] };
}

export function effectLabel(mult: number): { text: string; cls: string } {
  if (mult === 0) return { text: 'INÚTIL', cls: 'eff-zero' };
  if (mult < 0.6) return { text: 'MUITO FRACO', cls: 'eff-bad' };
  if (mult < 1) return { text: 'FRACO', cls: 'eff-low' };
  if (mult === 1) return { text: '', cls: '' };
  if (mult < 2) return { text: 'EFETIVO', cls: 'eff-good' };
  return { text: 'SUPER EFETIVO', cls: 'eff-great' };
}
