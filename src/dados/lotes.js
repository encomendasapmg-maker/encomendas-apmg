// Lote noturno para a sala de TV do Bloco III (seção 5.4).
// Cadeia: gerar → executor assume e separa → sentinela confirma a saída →
// executor dá baixa na sala de TV → Comandante do Bloco confirma o recebimento.
import { writeBatch, getDocs, query, where, orderBy, limit, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { SITUACAO, SETOR_PILOTO, DESTINO_LOTE } from '../lib/constantes';
import { tratamento, dataHora } from '../lib/texto';
import { agora, col, ref, novoId, useAoVivo, gravar, movimentacao, aviso } from './base';

export const STATUS_LOTE = {
  aberto: 'em aberto',
  separando: 'em separação',
  saiu: 'saiu da guarda',
  entregue: 'na sala de TV',
  recebido: 'recebido pelo Cmt do Bloco'
};

export function useLotesAtivos() {
  return useAoVivo(
    query(col('lotes'), where('status', 'in', ['aberto', 'separando', 'saiu', 'entregue']), orderBy('criadoEm', 'desc'), limit(5)),
    []
  );
}

export function useLote(id) {
  return useAoVivo(id ? ref('lotes', id) : null, [id]);
}

// O que entra no lote: só o que continua na guarda, sem deliveries e sem
// pendências de identificação, e que ainda não está em outro lote.
export async function candidatasAoLote() {
  const snap = await getDocs(
    query(col('encomendas'), where('setor', '==', SETOR_PILOTO), where('situacao', '==', SITUACAO.NA_GUARDA))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => !e.perecivel && !e.loteId)
    .sort((a, b) => (a.destinatarioPelotao || '').localeCompare(b.destinatarioPelotao || '') || a.numeroInterno - b.numeroInterno);
}

export async function gerarLote(gestor, { prazo, executorIndicado }) {
  const encomendas = await candidatasAoLote();
  if (!encomendas.length) throw new Error('Não há encomendas da EsFO na guarda para o lote.');
  const id = novoId('lotes');
  const batch = writeBatch(db);
  batch.set(ref('lotes', id), {
    status: 'aberto',
    destino: DESTINO_LOTE,
    criadoEm: agora(),
    criadoPorUid: gestor.id,
    criadoPorNome: tratamento(gestor),
    criadoComoFuncao: gestor.funcao ?? gestor.perfil,
    executorIndicadoUid: executorIndicado?.id ?? null,
    executorIndicadoNome: executorIndicado ? tratamento(executorIndicado) : null,
    executorUid: null,
    executorNome: null,
    prazo: prazo || null,
    itens: encomendas.map((e) => ({
      id: e.id,
      numeroInterno: e.numeroInterno,
      destinatarioUid: e.destinatarioUid,
      nome: e.destinatarioNome,
      pelotao: e.destinatarioPelotao || 'Sem pelotão',
      local: e.local || null
    })),
    separados: [],
    retirados: [],
    faltantes: []
  });
  for (const e of encomendas) batch.update(ref('encomendas', e.id), { loteId: id });
  if (executorIndicado) {
    aviso(batch, {
      paraUid: executorIndicado.id,
      titulo: 'Missão: lote EsFO',
      texto: `${tratamento(gestor)} indicou você para levar o lote (${encomendas.length} volumes) à ${DESTINO_LOTE}.`,
      tipo: 'missao',
      url: `/cadete/missoes`
    });
  }
  await gravar(batch);
  return id;
}

export async function assumirLote(lote, pessoa) {
  await updateDoc(ref('lotes', lote.id), {
    executorUid: pessoa.id,
    executorNome: tratamento(pessoa),
    assumidoEm: agora(),
    status: 'separando'
  });
}

export async function marcarSeparado(lote, itemId, separado) {
  await updateDoc(ref('lotes', lote.id), {
    separados: separado ? arrayUnion(itemId) : arrayRemove(itemId),
    executorUid: lote.executorUid
  });
}

// Itens ainda válidos: os retirados na guarda durante a separação saem da lista.
export function itensValidos(lote) {
  const retirados = new Set(lote?.retirados || []);
  return (lote?.itens || []).filter((i) => !retirados.has(i.id));
}

// 1 · Sentinela confirma que entregou o lote ao executor.
export async function confirmarSaida(lote, posto, usuario) {
  if (!posto) throw new Error('Preencha "No posto agora" antes de confirmar.');
  if (!lote.executorUid) throw new Error('Nenhum executor assumiu este lote.');
  const separados = new Set(lote.separados || []);
  const itens = itensValidos(lote);
  const levados = itens.filter((i) => separados.has(i.id));
  const faltantes = itens.filter((i) => !separados.has(i.id));
  const batch = writeBatch(db);
  batch.update(ref('lotes', lote.id), {
    status: 'saiu',
    saidaEm: agora(),
    saidaConfirmadaPor: posto,
    faltantes: faltantes.map((i) => i.id)
  });
  for (const i of levados) {
    batch.update(ref('encomendas', i.id), { situacao: SITUACAO.EM_LOTE });
    movimentacao(batch, {
      encomenda: { id: i.id, numeroInterno: i.numeroInterno, destinatarioUid: i.destinatarioUid },
      de: SITUACAO.NA_GUARDA,
      para: SITUACAO.EM_LOTE,
      usuario: { ...usuario, nome: posto },
      observacao: `Entregue ao executor ${lote.executorNome}`
    });
  }
  // Volume não encontrado vira pendência: continua na guarda, fora do lote.
  for (const i of faltantes) batch.update(ref('encomendas', i.id), { loteId: null, pendenciaLote: lote.id });
  return gravar(batch);
}

// 2 · Executor dá baixa: "Entregue na sala de TV – Bloco III".
export async function entregarNaSala(lote, pessoa) {
  const separados = new Set(lote.separados || []);
  const levados = itensValidos(lote).filter((i) => separados.has(i.id));
  const batch = writeBatch(db);
  batch.update(ref('lotes', lote.id), {
    status: 'entregue',
    entregueSalaEm: agora(),
    executorUid: pessoa.id
  });
  for (const i of levados) {
    batch.update(ref('encomendas', i.id), { situacao: SITUACAO.SALA_TV, salaTvEm: agora() });
    movimentacao(batch, {
      encomenda: { id: i.id, numeroInterno: i.numeroInterno, destinatarioUid: i.destinatarioUid },
      de: SITUACAO.EM_LOTE,
      para: SITUACAO.SALA_TV,
      usuario: { uid: pessoa.id, nome: tratamento(pessoa) },
      observacao: DESTINO_LOTE
    });
    aviso(batch, {
      paraUid: i.destinatarioUid,
      titulo: 'Encomenda na sala de TV',
      texto: `Nº ${i.numeroInterno} está na ${DESTINO_LOTE}.${lote.prazo ? ` Prazo para retirada: ${lote.prazo}.` : ''}`,
      tipo: 'sala_tv'
    });
  }
  return gravar(batch);
}

// 3 · Comandante do Bloco confirma o recebimento e passa a responder pelas encomendas.
export async function confirmarRecebimentoBloco(lote, pessoa) {
  await updateDoc(ref('lotes', lote.id), {
    status: 'recebido',
    recebidoEm: agora(),
    recebidoPor: tratamento(pessoa),
    recebidoPorUid: pessoa.id
  });
}

export function mensagemWhatsApp(lote) {
  const separados = new Set(lote.separados || []);
  const contagem = new Map();
  for (const i of itensValidos(lote)) {
    if (lote.status !== 'aberto' && lote.status !== 'separando' && !separados.has(i.id)) continue;
    contagem.set(i.nome, (contagem.get(i.nome) || 0) + 1);
  }
  const nomes = [...contagem.entries()].map(([n, q]) => `${n} (${q})`).join(', ');
  return [
    `Encomendas na ${DESTINO_LOTE}: ${nomes}.`,
    lote.prazo ? `Prazo para retirada: ${lote.prazo}.` : null,
    'Confirme a retirada no app (Minhas encomendas › Já retirei).'
  ]
    .filter(Boolean)
    .join('\n');
}

export function descricaoLote(lote) {
  return `Gerado por ${lote.criadoPorNome} em ${dataHora(lote.criadoEm)}`;
}
