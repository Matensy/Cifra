// Mensagens secretas e senhas usadas nos puzzles. As mensagens contam a
// própria história da criptografia: quebrar uma cifra também ensina algo.

export const CLASSIC_MESSAGES = [
  'JULIO CESAR PROTEGIA SUAS ORDENS DESLOCANDO CADA LETRA',
  'O EXERCITO ATACA AO AMANHECER PELO PORTAO NORTE',
  'AL KINDI DESCOBRIU A ANALISE DE FREQUENCIA EM BAGDA',
  'A CHAVE ESTA ESCONDIDA SOB A ESTATUA DO IMPERADOR',
  'NUNCA CONFIE EM UMA CIFRA QUE VOCE MESMO INVENTOU',
  'OS ESPARTANOS ENROLAVAM MENSAGENS EM UM BASTAO',
  'A RAINHA MARIA STUART FOI CONDENADA POR CARTAS CIFRADAS',
  'O SEGREDO DEVE ESTAR NA CHAVE E NAO NO METODO',
  'ENVIEM REFORCOS PARA A FRONTEIRA SUL IMEDIATAMENTE',
  'O TESOURO ESTA ENTERRADO A DEZ PASSOS DA FIGUEIRA',
  'OS ESCRIBAS HEBREUS USAVAM O ALFABETO ESPELHADO',
  'A LETRA MAIS COMUM DO PORTUGUES E A LETRA A',
  'A SENHA DO PORTAO DO CASTELO MUDA TODA LUA CHEIA',
  'O ESPIAO ENTREGARA O MAPA NA PRACA DO MERCADO',
];

/** Vigenère precisa de mais texto para o Kasiski encontrar repetições. */
export const LONG_MESSAGES = [
  'A CIFRA DE VIGENERE FOI CHAMADA DE INDECIFRAVEL POR TRES SECULOS ATE QUE BABBAGE E KASISKI A QUEBRARAM PROCURANDO TRECHOS REPETIDOS NO TEXTO CIFRADO',
  'QUEM SABE O TAMANHO DA CHAVE TRANSFORMA UMA CIFRA POLIALFABETICA EM VARIAS CIFRAS DE CESAR E CADA CIFRA DE CESAR CAI COM A ANALISE DE FREQUENCIA',
  'O ATAQUE COMECA PELA CHAVE E A CHAVE SE REPETE E QUANDO A CHAVE SE REPETE O TEXTO CIFRADO TAMBEM SE REPETE E A REPETICAO ENTREGA O SEGREDO',
];

export const VIGENERE_KEYS = ['SOL', 'LUA', 'CHAVE', 'TURING', 'ENIGMA', 'SEGREDO', 'CIFRA', 'BRASIL'];

/** Mensagens do Ato II (ASCII minúsculo, para XOR/Base64/hex). */
export const BYTE_MESSAGES = [
  'senha do servidor: dragao42',
  'o backup fica em /var/segredos',
  'reuniao secreta as 23h no porao',
  'a flag e CIFRA{xor_nao_e_seguro}',
  'codificar nao e criptografar',
  'a chave do cofre e 7391',
  'base64 qualquer um decodifica',
  'nunca reutilize a mesma chave',
  'o admin usa a senha admin123',
];

export const XOR_KEYS = ['KEY', 'ICE', 'LUA', 'BYTE', 'XOR', 'BIT', 'HACK'];

/** Pares para o one-time pad com reuso de chave. */
export const OTP_PAIRS: [string, string][] = [
  ['ataque ao amanhecer pelo norte', 'o espiao esta no hotel central'],
  ['o codigo do cofre muda amanha', 'envie o dinheiro para a conta'],
  ['a reuniao foi cancelada hoje', 'o agente duplo trabalha la'],
];

/**
 * Lista de senhas comuns (inspirada nos vazamentos reais mais famosos e nas
 * senhas brasileiras mais usadas). Todo hash do Ato III esconde uma delas.
 */
export const WORDLIST = [
  '123456', 'senha', '123456789', '12345678', '12345', 'qwerty', 'password', '111111', '1234567', 'abc123',
  '123123', 'brasil', 'flamengo', 'corinthians', 'palmeiras', 'saopaulo', 'vasco', 'gremio', 'cruzeiro', 'santos',
  'amor', 'iloveyou', 'teamo', 'deus', 'jesus', 'familia', 'futebol', 'mudar123', 'admin', 'admin123',
  'root', 'master', 'dragon', 'monkey', 'letmein', 'sunshine', 'princess', 'football', 'baseball', 'welcome',
  'shadow', 'superman', 'batman', 'trustno1', 'starwars', 'pokemon', 'naruto', 'minecraft', 'roblox', 'fortnite',
  '102030', '159753', '147258', '000000', '654321', '987654321', '112233', '1q2w3e', '1q2w3e4r', 'qwerty123',
  'zaq12wsx', 'asdfgh', 'senha123', 'senha1', 'mudar', 'mudarsenha', 'gabriel', 'lucas', 'matheus', 'pedro',
  'julia', 'maria', 'ana', 'joao', 'felipe', 'bruna', 'camila', 'rafael', 'amanda', 'leticia',
  'chocolate', 'morango', 'banana', 'cachorro', 'gatinho', 'estrela', 'flor', 'princesa', 'anjo', 'vida',
  'segredo', 'secreto', 'hacker', 'matrix', 'cifra', 'enigma', 'turing', 'linux', 'windows', 'internet',
  'computador', 'google', 'facebook', 'instagram', 'whatsapp', 'netflix', 'spotify', 'playstation', 'xbox', 'nintendo',
  'abcdef', 'abcd1234', 'a1b2c3', 'q1w2e3', 'p@ssw0rd', 'passw0rd', 'senha@123', 'Brasil2026', 'verao', 'inverno',
];

/** Senhas usadas como alvo (todas estão na WORDLIST, para o dicionário funcionar). */
export const TARGET_PASSWORDS = [
  'flamengo', 'dragon', 'segredo', 'princesa', 'chocolate', 'naruto', 'cachorro', 'estrela', 'futebol',
  'monkey', 'shadow', 'matrix', 'enigma', 'iloveyou', 'sunshine', 'pokemon', 'gatinho', 'internet', 'corinthians',
];
