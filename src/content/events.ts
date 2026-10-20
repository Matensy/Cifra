// Eventos "Terminal ?": escolhas e quizzes que ensinam algo, com recompensa.

import { hammingBits, toHex, utf8 } from '../crypto/bytes';
import { encodeBase64 } from '../crypto/ciphers';
import { hashById } from '../crypto/hash';
import type { Rng } from '../game/rng';
import type { RunState } from '../game/types';
import { BYTE_MESSAGES, WORDLIST } from './texts';

export interface Outcome {
  text: string;
  good: boolean;
  credits?: number;
  hp?: number;
  maxHp?: number;
  card?: string;
  cardUp?: boolean;
  relic?: 'random';
  addStatusCard?: string;
  pick?: 'remove' | 'upgrade';
  upgradeRandom?: boolean;
  codex?: string[];
}

export interface Choice {
  label: string;
  hint?: string;
  apply: () => Outcome;
}

export interface EventInstance {
  id: string;
  title: string;
  icon: string;
  text: string;
  /** Bloco "técnico" exibido em fonte monoespaçada (hash, Base64...). */
  code?: string;
  choices: Choice[];
}

type Builder = (run: RunState, rng: Rng) => EventInstance;

const qualHash: Builder = (_run, rng) => {
  const algos = ['md5', 'sha1', 'sha256', 'sha512'];
  const id = rng.pick(algos);
  const word = rng.pick(WORDLIST);
  const digest = toHex(hashById(id).fn(utf8(word)));
  const name = hashById(id).name;
  const explain = `${digest.length} caracteres hex × 4 bits = ${digest.length * 4} bits. MD5 = 128, SHA-1 = 160, SHA-256 = 256, SHA-512 = 512. O tamanho do hash entrega o algoritmo (ou pelo menos a família).`;
  return {
    id: 'qual_hash', title: 'Hash Desconhecido', icon: '🔍',
    text: 'Você encontra uma tabela de senhas sem documentação. Antes de atacar, precisa saber QUAL algoritmo gerou isto:',
    code: digest,
    choices: rng.shuffle(algos.slice()).map((a) => ({
      label: hashById(a).name,
      apply: () => (a === id
        ? { good: true, credits: 40, text: `Certo, é ${name}! ${explain}`, codex: ['conceito:tamanho'] }
        : { good: false, hp: -6, text: `Errado, era ${name}. ${explain}`, codex: ['conceito:tamanho'] }),
    })),
  };
};

const avalanche: Builder = (_run, rng) => {
  const w = rng.pick(['CIFRA', 'SENHA', 'TURING', 'BRASIL', 'ENIGMA']);
  const w2 = w.slice(0, -1) + String.fromCharCode(w.charCodeAt(w.length - 1) ^ 1);
  const a = hashById('sha256').fn(utf8(w));
  const b = hashById('sha256').fn(utf8(w2));
  const diff = hammingBits(a, b);
  const explain = `"${w}" e "${w2}" diferem em UM bit, mas ${diff} dos 256 bits do SHA-256 mudaram (~${Math.round((diff / 256) * 100)}%). Isso é o EFEITO AVALANCHE: uma boa função de hash espalha qualquer mudança por toda a saída, então hashes parecidos não indicam entradas parecidas.`;
  return {
    id: 'avalanche', title: 'Efeito Avalanche', icon: '🏔️',
    text: `Um professor rabiscou no quadro: SHA-256("${w}") e SHA-256("${w2}"). As entradas diferem em um único bit. Quantos dos 256 bits da saída você acha que mudaram?`,
    code: `${toHex(a)}\n${toHex(b)}`,
    choices: [
      { label: 'Uns 2 ou 3 bits', apply: () => ({ good: false, hp: -4, text: explain, codex: ['conceito:avalanche'] }) },
      { label: 'Uns 30 bits', apply: () => ({ good: false, hp: -4, text: explain, codex: ['conceito:avalanche'] }) },
      { label: 'Mais ou menos a metade (~128)', apply: () => ({ good: true, upgradeRandom: true, text: 'Exato! ' + explain + ' (Uma carta aleatória foi melhorada.)', codex: ['conceito:avalanche'] }) },
      { label: 'Quase todos (~250)', apply: () => ({ good: false, hp: -4, text: explain + ' Se quase todos mudassem, bastaria inverter a saída: isso também seria um padrão!', codex: ['conceito:avalanche'] }) },
    ],
  };
};

const base64msg: Builder = (_run, rng) => {
  const msg = rng.pick(BYTE_MESSAGES);
  return {
    id: 'base64', title: 'Mensagem "Criptografada"', icon: '📨',
    text: 'Um e-mail interno diz: "Mandei a informação CRIPTOGRAFADA, pode ficar tranquilo". O conteúdo é:',
    code: encodeBase64(msg),
    choices: [
      { label: 'Decodificar o Base64', hint: 'qualquer um consegue', apply: () => ({ good: true, credits: 30,
        text: `Decodificado: "${msg}". Base64 é uma CODIFICAÇÃO: não tem chave e qualquer pessoa desfaz. Confundir codificar com criptografar é um dos erros mais comuns em sistemas reais.`,
        codex: ['base64'] }) },
      { label: 'Respeitar a criptografia e seguir em frente', apply: () => ({ good: false,
        text: 'Você deixou passar. Aquilo era só Base64: dava para ler com um clique. Terminar com "=" ou "==" é uma pista clássica de Base64.',
        codex: ['base64'] }) },
    ],
  };
};

const pendrive: Builder = () => ({
  id: 'pendrive', title: 'Pendrive no Estacionamento', icon: '🔌',
  text: 'Há um pendrive caído perto da entrada, com uma etiqueta: "SALÁRIOS 2026 — CONFIDENCIAL".',
  choices: [
    { label: 'Plugar no seu notebook', hint: 'arriscado', apply: () => ({ good: false, hp: -10, addStatusCard: 'ids',
      text: 'Era uma armadilha (BadUSB). Ele se apresentou como teclado e digitou comandos sozinho. Você perde 10 de Furtividade e ganha um Alerta do IDS no baralho. Em 2010 o Stuxnet entrou numa usina nuclear isolada da internet do mesmo jeito.' }) },
    { label: 'Entregar para a equipe de segurança', apply: () => ({ good: true, credits: 35,
      text: 'A equipe analisou numa máquina isolada: era malware. Você recebe 35 créditos de recompensa. Regra de ouro: nunca conecte mídia desconhecida.' }) },
  ],
});

const senhaForte: Builder = (_run, rng) => {
  const opts = [
    { label: 'Tr0ub4dor&3', ok: false },
    { label: 'cavalo correto bateria grampo', ok: true },
    { label: 'P@ssw0rd!2026', ok: false },
  ];
  const explain = '"Tr0ub4dor&3" tem cerca de 28 bits de entropia: substituições como o→0 e a→4 são as primeiras que os programas testam. Quatro palavras aleatórias de um dicionário grande dão ~44 bits, e são mais fáceis de lembrar (xkcd 936). "P@ssw0rd!2026" está em toda wordlist. Comprimento vence complexidade.';
  return {
    id: 'senha_forte', title: 'Política de Senhas', icon: '🔐',
    text: 'O RH quer sua opinião: qual destas senhas é a MAIS difícil de quebrar?',
    choices: rng.shuffle(opts).map((o) => ({
      label: o.label,
      apply: () => (o.ok
        ? { good: true, credits: 35, card: 'dicionario', text: 'Isso! ' + explain, codex: ['conceito:entropia'] }
        : { good: false, hp: -5, text: 'Não. ' + explain, codex: ['conceito:entropia'] }),
    })),
  };
};

const vazamento: Builder = () => ({
  id: 'vazamento', title: 'Vazamento de Dados', icon: '🗃️',
  text: 'Num fórum, alguém posta o dump de um site: 2 milhões de e-mails e senhas em MD5 sem sal.',
  choices: [
    { label: 'Usar as senhas como wordlist', apply: () => ({ good: true, card: 'dicionario', cardUp: true,
      text: 'Senhas vazadas são o melhor dicionário: pessoas reutilizam senhas. Você ganha um Ataque de Dicionário+. (Por isso existe o haveibeenpwned.com: confira se as suas já vazaram.)' }) },
    { label: 'Avisar o site (divulgação responsável)', apply: () => ({ good: true, credits: 50, hp: 8,
      text: 'O site agradece, força a troca de senhas e paga uma recompensa de bug bounty. Divulgação responsável é como pesquisadores de segurança trabalham do lado certo.' }) },
  ],
});

const servidor: Builder = () => ({
  id: 'servidor', title: 'Servidor Esquecido', icon: '🗄️',
  text: 'Uma máquina antiga, sem atualização há 10 anos, ainda está ligada no rack.',
  choices: [
    { label: 'Limpar seu baralho', hint: 'remova uma carta', apply: () => ({ good: true, pick: 'remove', text: 'Você usa a máquina para depurar seus scripts. Escolha uma carta para remover.' }) },
    { label: 'Minerar os créditos esquecidos', apply: () => ({ good: true, credits: 50, text: 'Havia créditos esquecidos numa conta de teste. +50.' }) },
  ],
});

const bletchley: Builder = () => ({
  id: 'bletchley', title: 'Cabana 8 de Bletchley Park', icon: '🏚️',
  text: 'Você encontra as anotações dos decifradores da Enigma: Turing, Joan Clarke, Gordon Welchman...',
  choices: [
    { label: 'Estudar as anotações', hint: 'melhore uma carta', apply: () => ({ good: true, pick: 'upgrade',
      text: 'A Enigma tinha ~10²³ configurações por dia, mas uma falha: nenhuma letra cifrava para si mesma. Isso, junto com cribs como "WETTERBERICHT", bastou. Escolha uma carta para melhorar.', codex: ['conceito:enigma'] }) },
    { label: 'Descansar no alojamento', apply: () => ({ good: true, hp: 18, text: 'Um chá quente e algumas horas de sono. +18 de Furtividade.', codex: ['conceito:enigma'] }) },
  ],
});

export const EVENTS: Builder[] = [qualHash, avalanche, base64msg, pendrive, senhaForte, vazamento, servidor, bletchley];
