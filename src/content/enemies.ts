// Os inimigos: cada um é uma forma real de proteger (mal ou bem) um segredo.
// Ato I: a Antiguidade · Ato II: bits e bytes · Ato III: hashes e senhas.

import type { EnemyDef } from '../game/types';

const E: EnemyDef[] = [
  // ======================= ATO I — ANTIGUIDADE =======================
  {
    id: 'legionario', name: 'Legionário de César', subtitle: 'Cifra de César', act: 1, tier: 'normal', kind: 'caesar',
    hp: [48, 52], glyph: '🏛️', color: '#f59e0b',
    moves: [
      { name: 'Golpe de gládio', intent: 'ataque', damage: 8, desc: 'Ataca causando 8.' },
      { name: 'Formação tartaruga', intent: 'defesa', block: 7, damage: 3, desc: 'Ganha 7 de Firewall e ataca causando 3.' },
      { name: 'Investida', intent: 'ataque', damage: 11, desc: 'Ataca causando 11.' },
    ],
    pattern: [0, 1, 2],
    quote: 'Veni, vidi, cifrei. Três posições bastam para qualquer bárbaro.',
  },
  {
    id: 'rot13', name: 'Sentinela ROT13', subtitle: 'César com chave fixa', act: 1, tier: 'normal', kind: 'rot13',
    hp: [40, 44], glyph: '🔄', color: '#22d3ee',
    moves: [
      { name: 'Girar 13', intent: 'ataque', damage: 5, hits: 2, desc: 'Ataca 2 vezes causando 5.' },
      { name: 'Embaralhar fórum', intent: 'debuff', damage: 3, effect: 'ruido', amount: 1, desc: 'Ataca causando 3 e coloca 1 Ruído no seu descarte.' },
    ],
    pattern: [0, 1],
    quote: 'Eu escondia spoilers na Usenet. Ninguém disse que era segurança.',
  },
  {
    id: 'atbash', name: 'Escriba Atbash', subtitle: 'Alfabeto espelhado', act: 1, tier: 'normal', kind: 'atbash',
    hp: [42, 46], glyph: '🪞', color: '#a78bfa',
    moves: [
      { name: 'Pena afiada', intent: 'ataque', damage: 9, desc: 'Ataca causando 9.' },
      { name: 'Espelhar', intent: 'buff', block: 6, effect: 'forca', amount: 1, desc: 'Ganha 6 de Firewall e +1 de Força.' },
    ],
    pattern: [0, 1, 0],
    quote: 'A vira Z, B vira Y. Simples, elegante... e sem chave nenhuma.',
  },
  {
    id: 'cerca', name: 'Cerca Ferroviária', subtitle: 'Cifra de transposição', act: 1, tier: 'normal', kind: 'railfence',
    hp: [46, 52], glyph: '🚂', color: '#fb7185',
    moves: [
      { name: 'Zigue', intent: 'ataque', damage: 5, desc: 'Ataca causando 5.' },
      { name: 'Zague', intent: 'defesa', damage: 5, block: 4, desc: 'Ataca causando 5 e ganha 4 de Firewall.' },
      { name: 'Descarrilar', intent: 'ataque', damage: 12, desc: 'Ataca causando 12.' },
    ],
    pattern: [0, 1, 2],
    quote: 'As letras são as mesmas. Só a ordem é que mudou de trilho.',
  },
  {
    id: 'substituicao', name: 'Mestre da Substituição', subtitle: 'Alfabeto embaralhado · ELITE', act: 1, tier: 'elite', kind: 'substitution',
    hp: [72, 78], glyph: '🎭', color: '#e879f9',
    moves: [
      { name: 'Embaralhar alfabeto', intent: 'buff', block: 10, effect: 'forca', amount: 2, desc: 'Ganha 10 de Firewall e +2 de Força.' },
      { name: 'Golpe cifrado', intent: 'ataque', damage: 11, desc: 'Ataca causando 11.' },
      { name: 'Chuva de símbolos', intent: 'ataque', damage: 4, hits: 3, desc: 'Ataca 3 vezes causando 4.' },
    ],
    pattern: [0, 1, 2, 1],
    quote: '26 fatorial chaves, criança. Quatrocentos septilhões. Boa sorte testando todas.',
  },
  {
    id: 'vigenere', name: 'Le Chiffre Indéchiffrable', subtitle: 'Cifra de Vigenère · CHEFE', act: 1, tier: 'chefe', kind: 'vigenere',
    hp: [130, 130], glyph: '👑', color: '#fbbf24',
    moves: [
      { name: 'Chave longa', intent: 'defesa', block: 12, desc: 'Ganha 12 de Firewall.' },
      { name: 'Rastreio polialfabético', intent: 'ataque', damage: 6, hits: 2, desc: 'Ataca 2 vezes causando 6.' },
      { name: 'Trocar a chave', intent: 'especial', block: 8, effect: 'trocarChave', desc: 'Troca a chave: o PERÍODO descoberto deixa de valer. Ganha 8 de Firewall.' },
      { name: 'Varredura', intent: 'ataque', damage: 15, desc: 'Ataca causando 15.' },
    ],
    pattern: [1, 0, 3, 1, 2, 3],
    quote: 'Por três séculos me chamaram de indecifrável. Kasiski que o diga...',
  },

  // ======================= ATO II — BITS =======================
  {
    id: 'base64', name: 'Disfarce Base64', subtitle: 'Codificação (não é cifra!)', act: 2, tier: 'normal', kind: 'base64',
    hp: [50, 56], glyph: '📦', color: '#2dd4bf',
    moves: [
      { name: 'Atirar bytes', intent: 'ataque', damage: 8, desc: 'Ataca causando 8.' },
      { name: 'Padding ==', intent: 'defesa', block: 9, desc: 'Ganha 9 de Firewall.' },
      { name: 'Codificar de novo', intent: 'debuff', damage: 4, effect: 'ruido', amount: 2, desc: 'Ataca causando 4 e coloca 2 Ruídos no seu descarte.' },
    ],
    pattern: [0, 2, 1, 0],
    quote: 'Pareço criptografado, né? Ninguém nunca desconfia de mim.',
  },
  {
    id: 'hex', name: 'Espectro Hexadecimal', subtitle: 'Codificação base 16', act: 2, tier: 'normal', kind: 'hex',
    hp: [50, 56], glyph: '🔢', color: '#60a5fa',
    moves: [
      { name: '0xDEAD', intent: 'ataque', damage: 5, hits: 2, desc: 'Ataca 2 vezes causando 5.' },
      { name: '0xBEEF', intent: 'ataque', damage: 11, desc: 'Ataca causando 11.' },
    ],
    pattern: [0, 1],
    quote: '41 42 43... Você leu "ABC"? Então você já me quebrou.',
  },
  {
    id: 'xor1', name: 'XOR de Um Byte', subtitle: 'Chave de 8 bits', act: 2, tier: 'normal', kind: 'xor1',
    hp: [54, 60], glyph: '⊕', color: '#f472b6',
    moves: [
      { name: 'Inverter bits', intent: 'debuff', block: 9, effect: 'rastreado', amount: 1, desc: 'Ganha 9 de Firewall e te aplica 1 de Rastreado.' },
      { name: 'Ataque bit a bit', intent: 'ataque', damage: 11, desc: 'Ataca causando 11.' },
    ],
    pattern: [1, 0, 1],
    quote: 'Duzentas e cinquenta e seis chaves. Você não vai testar todas... vai?',
  },
  {
    id: 'xorN', name: 'Hidra do XOR Repetido', subtitle: 'Chave de vários bytes · ELITE', act: 2, tier: 'elite', kind: 'xorN',
    hp: [86, 92], glyph: '🐉', color: '#f43f5e',
    moves: [
      { name: 'Mordida dupla', intent: 'ataque', damage: 7, hits: 2, desc: 'Ataca 2 vezes causando 7.' },
      { name: 'Chave rotativa', intent: 'buff', block: 12, effect: 'forca', amount: 2, desc: 'Ganha 12 de Firewall e +2 de Força.' },
      { name: 'Fluxo de bytes', intent: 'ataque', damage: 17, desc: 'Ataca causando 17.' },
    ],
    pattern: [0, 1, 2],
    quote: 'Cada cabeça é um byte da chave. Corte uma e as outras continuam girando.',
  },
  {
    id: 'otp', name: 'O Bloco Reutilizado', subtitle: 'One-Time Pad · CHEFE', act: 2, tier: 'chefe', kind: 'otp',
    hp: [135, 135], glyph: '📒', color: '#e2e8f0',
    moves: [
      { name: 'Sigilo perfeito', intent: 'defesa', damage: 7, block: 10, desc: 'Ataca causando 7 e ganha 10 de Firewall. Imune a qualquer análise.' },
      { name: 'Economizar papel', intent: 'especial', effect: 'reuso', desc: 'Reutiliza a MESMA chave em outra mensagem. O sigilo perfeito acaba.' },
      { name: 'Transmissão', intent: 'ataque', damage: 9, hits: 2, desc: 'Ataca 2 vezes causando 9.' },
      { name: 'Código Venona', intent: 'ataque', damage: 18, effect: 'ruido', amount: 1, desc: 'Ataca causando 18 e coloca 1 Ruído no seu descarte.' },
    ],
    pattern: [0, 1, 2, 3, 2],
    start: { imune: 1 },
    quote: 'Chave aleatória, do tamanho da mensagem, usada UMA vez: nem um computador infinito me quebra. A menos que...',
  },

  // ======================= ATO III — HASHES =======================
  {
    id: 'crc', name: 'Checksum CRC-32', subtitle: 'Detector de erros', act: 3, tier: 'normal', kind: 'crc32',
    hp: [62, 68], glyph: '🧮', color: '#a3e635',
    moves: [
      { name: 'Verificar paridade', intent: 'ataque', damage: 10, desc: 'Ataca causando 10.' },
      { name: 'Recalcular', intent: 'defesa', damage: 5, block: 10, desc: 'Ataca causando 5 e ganha 10 de Firewall.' },
    ],
    pattern: [0, 1],
    quote: 'Eu detecto um bit trocado no cabo de rede. Um hacker trocando de propósito? Aí não.',
  },
  {
    id: 'ntlm', name: 'Fantasma NTLM', subtitle: 'MD4 do Windows', act: 3, tier: 'normal', kind: 'ntlm',
    hp: [66, 72], glyph: '🪟', color: '#38bdf8',
    moves: [
      { name: 'Autenticar', intent: 'ataque', damage: 12, desc: 'Ataca causando 12.' },
      { name: 'Pass-the-hash', intent: 'debuff', damage: 6, effect: 'ids', amount: 1, desc: 'Ataca causando 6 e coloca 1 Alerta do IDS no seu descarte.' },
    ],
    pattern: [0, 1],
    quote: 'Sem sal desde 1993. Sua senha tem o mesmo hash em qualquer computador do mundo.',
  },
  {
    id: 'md5', name: 'Cadeado MD5', subtitle: 'Hash quebrado, sem sal', act: 3, tier: 'normal', kind: 'md5',
    hp: [64, 70], glyph: '🔏', color: '#fb923c',
    moves: [
      { name: 'Compressão', intent: 'ataque', damage: 6, hits: 2, desc: 'Ataca 2 vezes causando 6.' },
      { name: '64 rodadas', intent: 'ataque', damage: 13, desc: 'Ataca causando 13.' },
      { name: 'Bloquear conta', intent: 'defesa', block: 12, desc: 'Ganha 12 de Firewall.' },
    ],
    pattern: [0, 2, 1],
    quote: 'Ainda guardo as senhas de metade da internet. Ninguém migrou.',
  },
  {
    id: 'sha1', name: 'Guardião SHA-1', subtitle: 'Hash de 160 bits', act: 3, tier: 'normal', kind: 'sha1',
    hp: [70, 76], glyph: '🛡️', color: '#c084fc',
    moves: [
      { name: '80 rodadas', intent: 'ataque', damage: 14, desc: 'Ataca causando 14.' },
      { name: 'Endurecer', intent: 'buff', block: 10, effect: 'forca', amount: 2, desc: 'Ganha 10 de Firewall e +2 de Força.' },
    ],
    pattern: [0, 1, 0],
    quote: 'Fui padrão do governo americano. Até o Google me partir ao meio em 2017.',
  },
  {
    id: 'pin', name: 'Cofre do PIN', subtitle: 'SHA-256 de 4 dígitos', act: 3, tier: 'normal', kind: 'pin',
    hp: [56, 62], glyph: '🔢', color: '#4ade80',
    moves: [
      { name: 'Teclado travado', intent: 'defesa', block: 15, desc: 'Ganha 15 de Firewall.' },
      { name: 'Bloqueio após 3 tentativas', intent: 'ataque', damage: 16, desc: 'Ataca causando 16.' },
    ],
    pattern: [1, 0, 1],
    quote: 'Uso SHA-256, o mesmo do Bitcoin! ...Pena que só existem 10.000 PINs.',
  },
  {
    id: 'salted', name: 'Sal e Pimenta', subtitle: 'SHA-256 com sal · ELITE', act: 3, tier: 'elite', kind: 'salted',
    hp: [104, 110], glyph: '🧂', color: '#f1f5f9',
    moves: [
      { name: 'Hash temperado', intent: 'ataque', damage: 10, hits: 2, desc: 'Ataca 2 vezes causando 10.' },
      { name: 'Sal novo', intent: 'defesa', block: 16, desc: 'Ganha 16 de Firewall.' },
      { name: 'Alarme', intent: 'debuff', damage: 8, effect: 'ids', amount: 2, desc: 'Ataca causando 8 e coloca 2 Alertas do IDS no seu descarte.' },
    ],
    pattern: [0, 2, 1, 0],
    quote: 'Cada senha tem seu próprio sal. Suas rainbow tables? Pode jogar fora.',
  },
  {
    id: 'pbkdf2', name: 'Torre PBKDF2', subtitle: '100.000 iterações · ELITE', act: 3, tier: 'elite', kind: 'pbkdf2',
    hp: [78, 84], glyph: '🗼', color: '#818cf8',
    moves: [
      { name: 'Iterando...', intent: 'defesa', block: 16, desc: 'Ganha 16 de Firewall enquanto calcula.' },
      { name: 'Iterando... iterando...', intent: 'buff', block: 10, effect: 'forca', amount: 3, desc: 'Ganha 10 de Firewall e +3 de Força.' },
      { name: 'Hash derivado', intent: 'ataque', damage: 22, desc: 'Ataca causando 22.' },
    ],
    pattern: [0, 1, 2],
    quote: 'Cada tentativa sua me custa um milissegundo. A você, custa cem mil hashes.',
  },
  {
    id: 'cofre', name: 'O Cofre de Senhas', subtitle: 'Banco de dados de senhas · CHEFE FINAL', act: 3, tier: 'chefe', kind: 'md5',
    hp: [185, 185], glyph: '🏦', color: '#facc15',
    moves: [
      { name: 'Consulta SQL', intent: 'ataque', damage: 12, desc: 'Ataca causando 12.' },
      { name: 'Auditoria', intent: 'debuff', damage: 8, effect: 'ids', amount: 2, desc: 'Ataca causando 8 e coloca 2 Alertas do IDS no seu descarte.' },
      { name: 'Migrar algoritmo', intent: 'defesa', block: 20, desc: 'Ganha 20 de Firewall.' },
      { name: 'Bloqueio total', intent: 'ataque', damage: 8, hits: 3, desc: 'Ataca 3 vezes causando 8.' },
    ],
    pattern: [0, 1, 2, 3],
    phases: [
      { at: 0.66, kind: 'salted', name: 'Migrou para SHA-256 com sal!' },
      { at: 0.33, kind: 'pbkdf2', name: 'Migrou para PBKDF2!' },
    ],
    quote: 'Comecei em MD5 em 2005. Mas aprendo rápido: a cada invasão, migro para algo melhor.',
  },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(E.map((e) => [e.id, e]));
export const ALL_ENEMIES = E;

export function enemiesFor(act: number, tier: EnemyDef['tier']): EnemyDef[] {
  return E.filter((e) => e.act === act && e.tier === tier);
}
