// Implantes: itens permanentes da partida.

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  rarity: 'inicial' | 'comum' | 'rara' | 'chefe';
  text: string;
  lore: string;
}

const R: RelicDef[] = [
  { id: 'terminal', name: 'Terminal Linux', icon: '🐧', rarity: 'inicial',
    text: 'No início de cada combate, compre 1 carta a mais.',
    lore: 'Todo hacker começa com uma tela preta e um cursor piscando.' },
  { id: 'placa_video', name: 'Placa de Vídeo RTX', icon: '🎮', rarity: 'comum',
    text: 'Cartas de Força bruta causam +3.',
    lore: 'Milhares de núcleos feitos para pintar pixels; ótimos também para calcular hashes em paralelo.' },
  { id: 'alkindi', name: 'Manuscrito de Al-Kindi', icon: '📜', rarity: 'comum',
    text: 'Cartas de Frequência causam +3.',
    lore: 'O polímata árabe que, por volta de 850 d.C., descreveu como quebrar qualquer substituição simples.' },
  { id: 'rockyou', name: 'Pendrive com rockyou.txt', icon: '💾', rarity: 'comum',
    text: 'Cartas de Dicionário causam +3.',
    lore: '14 milhões de senhas reais, vazadas em texto puro em 2009.' },
  { id: 'bombe', name: 'Rotor da Bombe', icon: '⚙️', rarity: 'rara',
    text: 'Cartas de Texto conhecido causam +4.',
    lore: 'Uma peça da máquina que Turing usou contra a Enigma em Bletchley Park.' },
  { id: 'cafeteira', name: 'Cafeteira Italiana', icon: '☕', rarity: 'comum',
    text: 'Ganha +1 de CPU no primeiro turno de cada combate.',
    lore: 'Turno da madrugada.' },
  { id: 'firewall', name: 'Firewall Pessoal', icon: '🧱', rarity: 'comum',
    text: 'Começa cada combate com 6 de Proxy.',
    lore: 'Bloqueia por padrão, libera por exceção.' },
  { id: 'hd', name: 'HD Extra', icon: '🗄️', rarity: 'comum',
    text: '+10 de Furtividade máxima.',
    lore: 'Mais espaço para wordlists, rainbow tables e logs falsos.' },
  { id: 'yubikey', name: 'YubiKey', icon: '🔑', rarity: 'rara',
    text: 'O primeiro ataque que você receberia em cada combate é anulado.',
    lore: 'Autenticação de dois fatores por hardware: mesmo com sua senha, o atacante precisa da chave física.' },
  { id: 'enigma', name: 'Enigma de Bolso', icon: '⌨️', rarity: 'comum',
    text: 'No início de cada combate, o inimigo recebe 2 de Exposto.',
    lore: 'Três rotores, um refletor e um painel de plugues. Nenhuma letra cifrava para si mesma, e essa foi a falha fatal.' },
  { id: 'ascii', name: 'Tabela ASCII', icon: '🔡', rarity: 'comum',
    text: 'Cartas de Decodificar causam +5.',
    lore: '65 = A, 97 = a, 32 = espaço. Quem decora isso lê hexadecimal de cabeça.' },
  { id: 'nonce', name: 'Gerador de Nonce', icon: '🎲', rarity: 'rara',
    text: 'Compre 1 carta extra em todo turno.',
    lore: '"Number used once": aleatoriedade boa é a base de toda chave segura.' },
  { id: 'cofre_frio', name: 'Carteira Fria', icon: '🧊', rarity: 'comum',
    text: 'Recupera 4 de Furtividade ao vencer um combate.',
    lore: 'Chaves guardadas fora da internet: o que não está online não é hackeado online.' },
  { id: 'gpg', name: 'Chave GPG', icon: '✉️', rarity: 'rara',
    text: 'Todos os seus ataques causam +1.',
    lore: 'Pretty Good Privacy, 1991: Phil Zimmermann foi investigado pelo governo dos EUA por "exportar armas" ao publicá-lo.' },
  { id: 'sal_grosso', name: 'Pote de Sal Grosso', icon: '🧂', rarity: 'rara',
    text: 'Cartas de Tabela pré-calculada e Colisão causam +6.',
    lore: 'Ironia: o que protege senhas contra rainbow tables agora está no seu bolso.' },
];

export const RELICS: Record<string, RelicDef> = Object.fromEntries(R.map((r) => [r.id, r]));
export const RELIC_POOL = R.filter((r) => r.rarity !== 'inicial');

/** Bônus de dano por técnica concedido pelos implantes. */
export function relicTagBonus(relics: string[], tag: string | undefined): number {
  let b = relics.includes('gpg') ? 1 : 0;
  if (!tag) return b;
  if (tag === 'bruta' && relics.includes('placa_video')) b += 3;
  if (tag === 'frequencia' && relics.includes('alkindi')) b += 3;
  if (tag === 'dicionario' && relics.includes('rockyou')) b += 3;
  if (tag === 'crib' && relics.includes('bombe')) b += 4;
  if (tag === 'decodificar' && relics.includes('ascii')) b += 5;
  if ((tag === 'rainbow' || tag === 'colisao') && relics.includes('sal_grosso')) b += 6;
  return b;
}
