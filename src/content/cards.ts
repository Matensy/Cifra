// Todas as cartas do jogo. Cada carta é uma técnica real de criptoanálise
// ou de defesa, com uma explicação ("lore") do porquê ela funciona.
//
// Números: [normal, melhorada]. No texto, {D} = dano, {H} = golpes,
// {B} = Proxy (bloqueio) e {M} = número mágico da carta.

import type { CardType, Rarity, Tag } from '../game/types';

export interface CardCtx {
  up: boolean;
  D: number;
  H: number;
  B: number;
  M: number;
  attack(dmg?: number, hits?: number, opts?: { tag?: Tag; ignoreBlock?: boolean }): void;
  block(n?: number): void;
  draw(n: number): void;
  cpu(n: number): void;
  enemyStatus(key: string, n: number): void;
  selfStatus(key: string, n: number): void;
  loseHp(n: number): void;
  heal(n: number): void;
  enemyHas(key: string): boolean;
  cleanse(): void;
}

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  rarity: Rarity;
  cost: [number, number];
  tag?: Tag;
  icon: string;
  dmg?: [number, number];
  hits?: [number, number];
  blk?: [number, number];
  mag?: [number, number];
  text: string;
  lore: string;
  exhaust?: boolean;
  unplayable?: boolean;
  play?: (c: CardCtx) => void;
}

const C: CardDef[] = [
  // ============ ATAQUES ============
  {
    id: 'forca_bruta', name: 'Força Bruta', type: 'ataque', rarity: 'inicial', cost: [1, 1], tag: 'bruta', icon: '🔨',
    dmg: [6, 9], text: 'Causa {D} de análise.',
    lore: 'Tente todas as chaves. Funciona quando são poucas: César tem 25, um XOR de 1 byte tem 256, um PIN tem 10.000.',
  },
  {
    id: 'rajada', name: 'Rajada de Tentativas', type: 'ataque', rarity: 'comum', cost: [1, 1], tag: 'bruta', icon: '💥',
    dmg: [3, 3], hits: [3, 4], text: 'Causa {D} de análise {H} vezes.',
    lore: 'Um script que dispara milhares de palpites por segundo. Por isso sistemas sérios bloqueiam após poucas tentativas.',
  },
  {
    id: 'gpu', name: 'Cluster de GPUs', type: 'ataque', rarity: 'incomum', cost: [2, 2], tag: 'bruta', icon: '🖥️',
    dmg: [16, 22], text: 'Causa {D} de análise.',
    lore: 'Uma placa de vídeo calcula dezenas de bilhões de MD5 por segundo. Hashes rápidos são péssimos para senhas.',
  },
  {
    id: 'freq', name: 'Análise de Frequência', type: 'ataque', rarity: 'inicial', cost: [1, 1], tag: 'frequencia', icon: '📊',
    dmg: [8, 11], text: 'Causa {D} de análise.',
    lore: 'Al-Kindi, século IX: em português o A, o E e o O são as letras mais comuns. A mais frequente no cifrado provavelmente é uma delas.',
  },
  {
    id: 'bigramas', name: 'Bigramas e Trigramas', type: 'ataque', rarity: 'comum', cost: [1, 1], tag: 'frequencia', icon: '🔤',
    dmg: [5, 7], mag: [1, 2], text: 'Causa {D} de análise. Aplica {M} de Exposto.',
    lore: 'Pares e trios comuns: "QU", "DE", "QUE", "ÇÃO". Depois de achar o "QUE", várias letras caem de uma vez.',
    play: (c) => { c.attack(); c.enemyStatus('exposto', c.M); },
  },
  {
    id: 'kasiski', name: 'Teste de Kasiski', type: 'ataque', rarity: 'comum', cost: [1, 0], tag: 'kasiski', icon: '📏',
    dmg: [4, 5], text: 'Causa {D} de análise. Descobre o PERÍODO da chave.',
    lore: 'Friedrich Kasiski, 1863: trechos repetidos no cifrado aparecem a distâncias múltiplas do tamanho da chave de Vigenère.',
    play: (c) => { c.attack(); c.enemyStatus('periodo', 1); },
  },
  {
    id: 'ic', name: 'Índice de Coincidência', type: 'ataque', rarity: 'comum', cost: [0, 0], tag: 'kasiski', icon: '🎯',
    dmg: [3, 5], text: 'Causa {D} de análise. Compre 1 carta.',
    lore: 'William Friedman, 1922: a chance de duas letras sorteadas serem iguais é ~7,2% em português e ~3,8% em texto aleatório.',
    play: (c) => { c.attack(); c.draw(1); },
  },
  {
    id: 'hamming', name: 'Distância de Hamming', type: 'ataque', rarity: 'incomum', cost: [1, 1], tag: 'kasiski', icon: '📐',
    dmg: [7, 10], text: 'Causa {D} de análise. Se o PERÍODO já foi descoberto, causa o dobro.',
    lore: 'Conte quantos bits diferem entre blocos do cifrado: o tamanho de bloco com menor distância é o tamanho da chave do XOR.',
    play: (c) => { c.attack(c.enemyHas('periodo') ? c.D * 2 : c.D); },
  },
  {
    id: 'crib', name: 'Texto Conhecido', type: 'ataque', rarity: 'comum', cost: [1, 1], tag: 'crib', icon: '🧩',
    dmg: [9, 12], text: 'Causa {D} de análise.',
    lore: 'Em Bletchley Park, os alemães começavam todo boletim com "WETTERBERICHT" (previsão do tempo). Isso bastava para achar a chave da Enigma.',
  },
  {
    id: 'crib_drag', name: 'Crib Dragging', type: 'ataque', rarity: 'incomum', cost: [2, 2], tag: 'crib', icon: '🪝',
    dmg: [8, 10], hits: [2, 2], text: 'Causa {D} de análise {H} vezes.',
    lore: 'Arraste uma palavra provável por todas as posições de c₁ ⊕ c₂. Onde aparecer texto legível, você achou um pedaço das DUAS mensagens.',
  },
  {
    id: 'dicionario', name: 'Ataque de Dicionário', type: 'ataque', rarity: 'comum', cost: [1, 1], tag: 'dicionario', icon: '📖',
    dmg: [9, 12], text: 'Causa {D} de análise.',
    lore: 'Em vez de testar "aaaa", "aaab"..., teste senhas que pessoas reais usam. O vazamento "rockyou.txt" tem 14 milhões delas.',
  },
  {
    id: 'mutacao', name: 'Regras de Mutação', type: 'ataque', rarity: 'incomum', cost: [1, 1], tag: 'dicionario', icon: '🧬',
    dmg: [6, 8], mag: [3, 4], text: 'Causa {D} de análise. Cartas de Dicionário causam +{M} pelo resto do combate.',
    lore: 'Hashcat aplica regras: senha → Senha → s3nh4 → senha123. Uma lista pequena vira milhões de palpites realistas.',
    play: (c) => { c.attack(); c.selfStatus('bonus_dicionario', c.M); },
  },
  {
    id: 'rainbow', name: 'Rainbow Table', type: 'ataque', rarity: 'incomum', cost: [2, 2], tag: 'rainbow', icon: '🌈',
    dmg: [24, 30], exhaust: true, text: 'Causa {D} de análise. Esgota.',
    lore: 'Hashes calculados ANTES do ataque, guardados de forma compacta. Contra MD5 sem sal, a busca é instantânea. Contra sal, não serve para nada.',
  },
  {
    id: 'hibrido', name: 'Ataque Híbrido', type: 'ataque', rarity: 'incomum', cost: [2, 2], icon: '🧪',
    dmg: [8, 10], text: 'Causa {D} de Dicionário e {D} de Força bruta.',
    lore: 'Palavra do dicionário + força bruta no final: "flamengo" + 00..99. Pega quem acha que "colocar um número no fim" deixa a senha forte.',
    play: (c) => { c.attack(c.D, 1, { tag: 'dicionario' }); c.attack(c.D, 1, { tag: 'bruta' }); },
  },
  {
    id: 'aniversario', name: 'Paradoxo do Aniversário', type: 'ataque', rarity: 'incomum', cost: [2, 2], tag: 'colisao', icon: '🎂',
    dmg: [18, 24], text: 'Causa {D} de análise.',
    lore: 'Numa sala com 23 pessoas, há 50% de chance de duas fazerem aniversário no mesmo dia. Para um hash de n bits, uma colisão aparece após ~2^(n/2) tentativas.',
  },
  {
    id: 'decodificar', name: 'Decodificar', type: 'ataque', rarity: 'comum', cost: [0, 0], tag: 'decodificar', icon: '🔓',
    dmg: [8, 12], text: 'Causa {D} de análise.',
    lore: 'Base64, hexadecimal e URL-encoding NÃO são criptografia: não têm chave. Esconder uma senha em Base64 é o mesmo que deixá-la à vista.',
  },
  {
    id: 'social', name: 'Engenharia Social', type: 'ataque', rarity: 'incomum', cost: [1, 1], tag: 'social', icon: '🎭',
    dmg: [8, 11], text: 'Causa {D} de análise. Ignora o Firewall.',
    lore: 'Kevin Mitnick conseguia senhas só ligando e pedindo. Quando a criptografia é forte, o elo mais fraco é o humano.',
    play: (c) => { c.attack(c.D, 1, { ignoreBlock: true }); },
  },
  {
    id: 'timing', name: 'Ataque de Temporização', type: 'ataque', rarity: 'incomum', cost: [1, 1], tag: 'canal', icon: '⏱️',
    dmg: [5, 7], hits: [2, 2], text: 'Causa {D} de análise {H} vezes. Ignora o Firewall.',
    lore: 'Se o servidor compara a senha letra por letra e para no primeiro erro, cada letra certa demora um pouquinho mais. Por isso se usa comparação em tempo constante.',
    play: (c) => { c.attack(c.D, c.H, { ignoreBlock: true }); },
  },
  {
    id: 'zeroday', name: 'Exploit Zero-Day', type: 'ataque', rarity: 'rara', cost: [3, 2], icon: '☄️',
    dmg: [30, 34], exhaust: true, text: 'Causa {D} de análise (sem técnica: dano neutro). Esgota.',
    lore: 'Uma falha que ninguém conhece ainda. Não quebra a matemática: contorna tudo. Por isso vale milhões no mercado.',
  },
  {
    id: 'bombe', name: 'A Bombe', type: 'ataque', rarity: 'rara', cost: [2, 2], tag: 'crib', icon: '⚙️',
    dmg: [12, 15], mag: [2, 2], text: 'Causa {D} de análise. Aplica {M} de Exposto. Compre 1 carta.',
    lore: 'A máquina eletromecânica de Turing e Welchman testava posições da Enigma a partir de um crib, descartando milhões de chaves por dia.',
    play: (c) => { c.attack(); c.enemyStatus('exposto', c.M); c.draw(1); },
  },

  // ============ DEFESAS ============
  {
    id: 'proxy', name: 'Proxy', type: 'defesa', rarity: 'inicial', cost: [1, 1], icon: '🛡️',
    blk: [5, 8], text: 'Ganha {B} de Proxy.',
    lore: 'Um intermediário entre você e o alvo: os logs mostram o IP do proxy, não o seu.',
  },
  {
    id: 'vpn', name: 'VPN', type: 'defesa', rarity: 'comum', cost: [1, 1], icon: '🔒',
    blk: [6, 8], text: 'Ganha {B} de Proxy. Compre 1 carta.',
    lore: 'Um túnel cifrado até outro servidor. Quem está no meio vê só bytes aleatórios.',
    play: (c) => { c.block(); c.draw(1); },
  },
  {
    id: 'tor', name: 'Rede Tor', type: 'defesa', rarity: 'incomum', cost: [2, 2], icon: '🧅',
    blk: [15, 20], text: 'Ganha {B} de Proxy.',
    lore: 'Roteamento em cebola: sua conexão é cifrada em 3 camadas e passa por 3 servidores. Cada um só conhece o anterior e o próximo.',
  },
  {
    id: 'apagar_logs', name: 'Apagar Logs', type: 'defesa', rarity: 'comum', cost: [1, 1], icon: '🧹',
    blk: [4, 7], text: 'Ganha {B} de Proxy. Remove seus efeitos negativos.',
    lore: 'Atacantes apagam rastros; por isso bons sistemas mandam os logs para outro servidor, onde o invasor não alcança.',
    play: (c) => { c.block(); c.cleanse(); },
  },
  {
    id: 'honeypot', name: 'Honeypot', type: 'defesa', rarity: 'incomum', cost: [1, 1], icon: '🍯',
    blk: [5, 8], mag: [3, 5], text: 'Ganha {B} de Proxy. Neste turno, cada ataque recebido devolve {M} de análise.',
    lore: 'Um sistema-isca: parece valioso, mas existe só para atrair e estudar o atacante.',
    play: (c) => { c.block(); c.selfStatus('honeypot', c.M); },
  },

  // ============ FERRAMENTAS ============
  {
    id: 'cafe', name: 'Café Expresso', type: 'ferramenta', rarity: 'comum', cost: [0, 0], icon: '☕',
    mag: [1, 2], exhaust: true, text: 'Ganha {M} de CPU. Compre 1 carta. Esgota.',
    lore: 'Combustível oficial de todo CTF às 3 da manhã.',
    play: (c) => { c.cpu(c.M); c.draw(1); },
  },
  {
    id: 'overclock', name: 'Overclock', type: 'ferramenta', rarity: 'comum', cost: [0, 0], icon: '⚡',
    mag: [3, 1], text: 'Ganha 2 de CPU. Perde {M} de Furtividade.',
    lore: 'Mais desempenho, mais calor, mais barulho. Ventoinhas a 100% chamam atenção.',
    play: (c) => { c.cpu(2); c.loseHp(c.M); },
  },
  {
    id: 'script', name: 'Script em Python', type: 'ferramenta', rarity: 'comum', cost: [1, 1], icon: '🐍',
    mag: [2, 3], text: 'Compre {M} cartas.',
    lore: 'Automatize o chato. Metade da criptoanálise moderna é um script bem escrito.',
    play: (c) => { c.draw(c.M); },
  },
  {
    id: 'sniffer', name: 'Sniffer de Rede', type: 'ferramenta', rarity: 'comum', cost: [1, 1], icon: '📡',
    mag: [2, 3], text: 'Aplica {M} de Exposto. Compre 1 carta.',
    lore: 'Wireshark captura tudo que passa na rede. Tudo que não estiver cifrado (HTTP, FTP, Telnet) aparece em texto puro.',
    play: (c) => { c.enemyStatus('exposto', c.M); c.draw(1); },
  },
  {
    id: 'wordlist', name: 'Wordlist rockyou.txt', type: 'ferramenta', rarity: 'incomum', cost: [1, 0], icon: '📚',
    mag: [4, 4], text: 'Poder: cartas de Dicionário causam +{M}.',
    lore: 'Em 2009 o site RockYou guardava senhas em TEXTO PURO. 32 milhões vazaram e viraram a wordlist mais usada do mundo.',
    play: (c) => { c.selfStatus('bonus_dicionario', c.M); },
  },
  {
    id: 'alkindi', name: 'Tratado de Al-Kindi', type: 'ferramenta', rarity: 'incomum', cost: [1, 0], icon: '📜',
    mag: [4, 4], text: 'Poder: cartas de Frequência causam +{M}.',
    lore: '"Manuscrito sobre a decifração de mensagens criptográficas", Bagdá, ~850 d.C.: a primeira descrição da análise de frequência.',
    play: (c) => { c.selfStatus('bonus_frequencia', c.M); },
  },
  {
    id: 'hashcat', name: 'Hashcat', type: 'ferramenta', rarity: 'rara', cost: [2, 1], icon: '🐈',
    mag: [3, 3], text: 'Poder: cartas de Força bruta, Dicionário e Tabela causam +{M}.',
    lore: 'A ferramenta de quebra de senhas mais rápida do mundo: usa a GPU e suporta centenas de formatos de hash.',
    play: (c) => { c.selfStatus('bonus_bruta', c.M); c.selfStatus('bonus_dicionario', c.M); c.selfStatus('bonus_rainbow', c.M); },
  },
  {
    id: 'foco', name: 'Foco Total', type: 'ferramenta', rarity: 'incomum', cost: [1, 1], icon: '🧠',
    mag: [2, 3], text: 'Poder: todos os seus ataques causam +{M}.',
    lore: 'Fone de ouvido, luz apagada, nenhuma notificação.',
    play: (c) => { c.selfStatus('foco', c.M); },
  },
  {
    id: 'turing', name: 'Pensar como Turing', type: 'ferramenta', rarity: 'rara', cost: [1, 0], icon: '🍎',
    text: 'Seu próximo ataque neste turno causa o DOBRO.',
    lore: 'Alan Turing formalizou o que é "computável" e ajudou a encurtar a Segunda Guerra em cerca de dois anos.',
    play: (c) => { c.selfStatus('turing', 1); },
  },
  {
    id: 'restauracao', name: 'Ponto de Restauração', type: 'ferramenta', rarity: 'rara', cost: [1, 1], icon: '💾',
    mag: [6, 9], exhaust: true, text: 'Recupera {M} de Furtividade. Esgota.',
    lore: 'Backups: a única defesa que funciona de verdade contra ransomware. Regra 3-2-1: 3 cópias, 2 mídias, 1 fora de casa.',
    play: (c) => { c.heal(c.M); },
  },

  // ============ STATUS (enfiados no seu baralho pelos inimigos) ============
  {
    id: 'ruido', name: 'Ruído', type: 'status', rarity: 'status', cost: [0, 0], icon: '📶', unplayable: true,
    text: 'Não pode ser jogada. Só ocupa espaço.',
    lore: 'Tráfego falso para esconder o que importa, ou para te confundir.',
  },
  {
    id: 'ids', name: 'Alerta do IDS', type: 'status', rarity: 'status', cost: [0, 0], icon: '🚨', unplayable: true,
    text: 'Não pode ser jogada. Se estiver na sua mão no fim do turno, perde 3 de Furtividade.',
    lore: 'Um Sistema de Detecção de Intrusão notou algo estranho. Quanto mais tempo você demora, mais perto ele chega.',
  },
];

export const CARDS: Record<string, CardDef> = Object.fromEntries(C.map((c) => [c.id, c]));
export const ALL_CARDS = C;
export const STARTER_DECK = ['forca_bruta', 'forca_bruta', 'forca_bruta', 'forca_bruta', 'forca_bruta', 'proxy', 'proxy', 'proxy', 'proxy', 'freq'];

/** Cartas que podem aparecer como recompensa ou na loja. */
export const REWARD_POOL = C.filter((c) => c.rarity === 'comum' || c.rarity === 'incomum' || c.rarity === 'rara');
