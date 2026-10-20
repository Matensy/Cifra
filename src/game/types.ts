// Tipos centrais do jogo.

/** Técnica de ataque que uma carta usa. Cada cifra é forte ou fraca contra cada técnica. */
export type Tag =
  | 'bruta' | 'frequencia' | 'kasiski' | 'crib' | 'dicionario'
  | 'rainbow' | 'colisao' | 'decodificar' | 'social' | 'canal';

/** Que tipo de proteção um inimigo usa. */
export type CipherKind =
  | 'caesar' | 'rot13' | 'atbash' | 'railfence' | 'substitution' | 'vigenere'
  | 'base64' | 'hex' | 'xor1' | 'xorN' | 'otp'
  | 'crc32' | 'ntlm' | 'md5' | 'sha1' | 'pin' | 'salted' | 'pbkdf2';

export type CardType = 'ataque' | 'defesa' | 'ferramenta' | 'status';
export type Rarity = 'inicial' | 'comum' | 'incomum' | 'rara' | 'status';

export interface CardInst {
  uid: string;
  id: string;
  up: boolean;
  /** Cartas criadas durante o combate (ex.: Ruído) somem ao final dele. */
  temp?: boolean;
}

export type Statuses = Record<string, number>;

export interface MoveDef {
  name: string;
  intent: 'ataque' | 'defesa' | 'buff' | 'debuff' | 'especial';
  damage?: number;
  hits?: number;
  block?: number;
  /** Efeito extra executado pelo motor de combate. */
  effect?: 'ruido' | 'ids' | 'forca' | 'rastreado' | 'fragil' | 'trocarChave' | 'reuso' | 'cura';
  amount?: number;
  desc: string;
}

export interface Phase {
  /** Entra nesta fase quando a vida cair a esta fração do máximo. */
  at: number;
  kind: CipherKind;
  name: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  subtitle: string;
  act: 1 | 2 | 3;
  tier: 'normal' | 'elite' | 'chefe';
  kind: CipherKind;
  hp: [number, number];
  glyph: string;
  color: string;
  moves: MoveDef[];
  /** Ordem das jogadas (índices em `moves`); repete em ciclo. */
  pattern: number[];
  phases?: Phase[];
  /** Começa com estes status (ex.: OTP começa imune). */
  start?: Statuses;
  quote: string;
}

export interface EnemyState {
  defId: string;
  name: string;
  kind: CipherKind;
  hp: number;
  maxHp: number;
  block: number;
  statuses: Statuses;
  step: number;
  intent: MoveDef;
  phase: number;
}

export interface Puzzle {
  kind: CipherKind;
  /** O que aparece "cifrado" na tela (texto, hex, digest...). */
  cipher: string;
  /** Segunda mensagem (só no OTP com reuso de chave). */
  cipher2?: string;
  /** O segredo que vai sendo revelado conforme a entropia cai. */
  secret: string;
  /** Ordem (embaralhada) em que os caracteres do segredo aparecem. */
  order: number[];
  /** Dados extras para as ferramentas de quebra manual. */
  data: Record<string, unknown>;
  hint: string;
}

export interface RunStats {
  combats: number;
  manualBreaks: number;
  damageDealt: number;
  cardsPlayed: number;
  bestHit: number;
}

export type NodeType = 'combate' | 'elite' | 'descanso' | 'loja' | 'evento' | 'tesouro' | 'chefe';

export interface MapNode {
  id: string;
  row: number;
  col: number;
  type: NodeType;
  next: string[];
}

export interface GameMap {
  act: 1 | 2 | 3;
  nodes: MapNode[];
}

export interface RunState {
  version: 1;
  seed: string;
  rngState: number;
  act: 1 | 2 | 3;
  hp: number;
  maxHp: number;
  credits: number;
  deck: CardInst[];
  relics: string[];
  map: GameMap;
  /** Nós já visitados no ato atual (o último é a posição atual). */
  path: string[];
  stats: RunStats;
  nextUid: number;
  startedAt: number;
  /** Tipos de cifra encontrados nesta partida. */
  seen: string[];
}
