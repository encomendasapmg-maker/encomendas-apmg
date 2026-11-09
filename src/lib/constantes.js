// Valores fixos do sistema, tirados do documento do projeto.

export const SETOR_PILOTO = 'EsFO';
export const SETORES = ['EsFO', 'EsFAEP', 'ABM', 'Administrativo'];
export const DESTINO_LOTE = 'Sala de TV – Bloco III';

// Turmas do CFO (o 1º ano tem duas turmas) e o CHOE, curso dos Alunos Oficiais
// (Al. Of.), com uma turma por ano e duração de cerca de 8 meses.
export const TURMA_CHOE = 'CHOE';
export const TURMAS = ['1º ano/1', '1º ano/2', '2º ano', '3º ano', TURMA_CHOE];
export const NOME_TURMA = { CHOE: 'CHOE (Al. Of.)' };

// As duas turmas do 1º ano andam com cerca de 6 meses de diferença. O app guarda
// de qual turma do 1º ano cada cadete veio ("grupo": '1' ou '2') para promover
// cada uma no seu momento, também no 2º e no 3º ano.
export const GRUPOS = ['1', '2'];
export const NOME_GRUPO = { 1: 'turma 1', 2: 'turma 2' };
export const PELOTOES = ['Alfa', 'Bravo', 'Charlie', 'Delta'];

// Situações de uma encomenda (seção 8 do documento).
export const SITUACAO = {
  NA_GUARDA: 'na_guarda',
  EM_LOTE: 'em_lote',
  SALA_TV: 'sala_tv',
  RETIRADA: 'retirada',
  A_IDENTIFICAR: 'a_identificar'
};

export const NOME_SITUACAO = {
  na_guarda: 'Na guarda',
  em_lote: 'Em lote',
  sala_tv: 'Na sala de TV · Bloco III',
  retirada: 'Retirada',
  a_identificar: 'Setor a identificar'
};

// Tipos de identificação da encomenda.
export const TIPOS_ID = [
  { id: 'nf', nome: 'Nota fiscal' },
  { id: 'rastreio', nome: 'Rastreio' },
  { id: 'pedido', nome: 'Nº do pedido' },
  { id: 'sem_numero', nome: 'Sem número' }
];

// Funções escolhidas pelo próprio cadete ao entrar (seção 4.2).
export const FUNCOES = [
  { id: 'cmt_guarda', nome: 'Comandante da Guarda' },
  { id: 'dia_esfo', nome: 'Dia à EsFO' },
  { id: 'respondente', nome: 'Respondente pelo Oficial de Dia' },
  { id: 'cmt_bloco', nome: 'Comandante do Bloco' }
];
export const NOME_FUNCAO = Object.fromEntries(FUNCOES.map((f) => [f.id, f.nome]));

// Funções que podem gerar lote EsFO.
export const FUNCOES_LOTE = ['cmt_guarda', 'dia_esfo', 'respondente'];

// Perfis fixos (seção 4.3). "cadete" é o padrão do autocadastro;
// "guarda", "oficial" e "admin" só o administrador define.
export const PERFIS = ['cadete', 'guarda', 'oficial', 'admin'];

// Tempo sem uso após o qual o app pergunta se a mesma sentinela continua.
export const MINUTOS_INATIVIDADE_POSTO = 30;

// Delivery sem retirada depois desse tempo gera lembrete e alerta.
export const MINUTOS_ALERTA_DELIVERY = 30;

// Encomenda "parada" no painel a partir de quantos dias.
export const DIAS_PARADA = 3;

// Conteúdo do QR de retirada mostrado pelo cadete.
export const PREFIXO_QR = 'APMG-ENC:';
