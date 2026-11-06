// Encomendas: recebimento (5.1), retirada (5.3) e setor a identificar (5.5).
import {
  writeBatch, getDoc, getDocs, query, where, orderBy, limit, increment, arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase';
import { SITUACAO, SETOR_PILOTO } from '../lib/constantes';
import { mascararDocumento, tratamento, normalizar } from '../lib/texto';
import { agora, col, ref, gravar, movimentacao, aviso, novoId, useAoVivo } from './base';

const ABERTAS = [SITUACAO.NA_GUARDA, SITUACAO.EM_LOTE, SITUACAO.SALA_TV, SITUACAO.A_IDENTIFICAR];

// ---------- Leituras ----------

export function useMinhasEncomendas(uid) {
  return useAoVivo(
    uid ? query(col('encomendas'), where('destinatarioUid', '==', uid), orderBy('chegada', 'desc'), limit(30)) : null,
    [uid]
  );
}

// Tudo o que ainda não foi retirado (painel e tela inicial da guarda).
export function useEncomendasAbertas() {
  return useAoVivo(query(col('encomendas'), where('situacao', 'in', ABERTAS)), []);
}

export async function encomendasNaGuardaDe(uidDestinatario) {
  const snap = await getDocs(
    query(
      col('encomendas'),
      where('destinatarioUid', '==', uidDestinatario),
      where('situacao', '==', SITUACAO.NA_GUARDA)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Alerta de possível duplicidade: mesmo número de identificação já registrado.
export async function procurarDuplicada(idNumero) {
  if (!idNumero) return null;
  const snap = await getDocs(query(col('encomendas'), where('idNumero', '==', idNumero), limit(1)));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// Se o destinatário informou o rastreio antes ("Estou esperando"), o app já sabe de quem é.
export async function procurarPedidoEsperado(idNumero) {
  if (!idNumero) return null;
  const snap = await getDocs(
    query(
      col('pedidosEsperados'),
      where('tipo', '==', 'rastreio'),
      where('rastreio', '==', String(idNumero).toUpperCase()),
      where('ativo', '==', true),
      limit(1)
    )
  );
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ---------- Entregadores frequentes ----------

export function useEntregadores() {
  return useAoVivo(query(col('entregadores'), orderBy('usos', 'desc'), limit(12)), []);
}

export function prepararEntregador(batch, { nome, empresa, documento }) {
  const id = normalizar(`${empresa || ''} ${nome}`).replace(/ /g, '-') || novoId('entregadores');
  batch.set(
    ref('entregadores', id),
    {
      nome: nome.trim(),
      empresa: empresa?.trim() || null,
      docMascarado: documento ? mascararDocumento(documento) : null,
      usos: increment(1),
      ultimoUso: agora()
    },
    { merge: true }
  );
  // Documento completo: só o administrador lê (LGPD).
  if (documento) batch.set(ref('entregadoresDocs', id), { documento: documento.trim(), em: agora() });
  return id;
}

// ---------- Número interno curto ----------

// Lê o contador (do servidor ou, sem internet, do cache do aparelho) e
// reserva o próximo número. O incremento é feito no servidor.
async function proximoNumero(batch) {
  const contadorRef = ref('config', 'contador');
  const snap = await getDoc(contadorRef);
  if (!snap.exists()) {
    batch.set(contadorRef, { ultimo: 1001 });
    return 1001;
  }
  batch.update(contadorRef, { ultimo: increment(1) });
  return (snap.data().ultimo || 1000) + 1;
}

// ---------- Recebimento pela sentinela ----------

/**
 * Registra uma encomenda.
 * dados: { destinatario (pessoa|null), nomeInformado, idTipo, idNumero, chaveNF,
 *          descricao, entregador {id, nome, empresa}, local, perecivel, pedidoEsperadoId }
 * posto: nome de quem está no posto (obrigatório)
 */
export async function registrarEncomenda(dados, posto, usuario) {
  if (!posto) throw new Error('Preencha "No posto agora" antes de registrar.');
  if (!dados.destinatario && !dados.nomeInformado) throw new Error('Informe o destinatário.');
  if (!dados.entregador?.nome) throw new Error('Escolha quem entregou.');
  if (dados.idTipo === 'sem_numero' && !dados.descricao) throw new Error('Descreva o volume (ex.: caixa parda – Loja X).');

  const batch = writeBatch(db);
  const numeroInterno = await proximoNumero(batch);
  const id = novoId('encomendas');
  const p = dados.destinatario;
  const situacao = p ? SITUACAO.NA_GUARDA : SITUACAO.A_IDENTIFICAR;

  const encomenda = {
    numeroInterno,
    destinatarioUid: p?.id ?? null,
    destinatarioNome: p ? tratamento(p) : dados.nomeInformado.trim(),
    destinatarioPelotao: p?.pelotao ?? null,
    setor: p?.setor ?? null,
    chegada: agora(),
    idTipo: dados.idTipo,
    idNumero: dados.idNumero ? String(dados.idNumero).trim().toUpperCase() : null,
    chaveNF: dados.chaveNF || null,
    descricao: dados.descricao?.trim() || null,
    entregadorId: dados.entregador.id,
    entregadorNome: dados.entregador.nome,
    transportadora: dados.entregador.empresa || null,
    perecivel: Boolean(dados.perecivel),
    local: dados.local || null,
    situacao,
    loteId: null,
    registradaPor: posto,
    pedidoEsperadoId: dados.pedidoEsperadoId || null
  };
  batch.set(ref('encomendas', id), encomenda);
  movimentacao(batch, { encomenda: { id, ...encomenda }, de: null, para: situacao, usuario: { ...usuario, nome: posto } });

  if (p) {
    aviso(batch, {
      paraUid: p.id,
      titulo: dados.perecivel ? 'Seu delivery chegou' : 'Encomenda na guarda',
      texto: dados.perecivel
        ? 'Seu pedido está no Corpo da Guarda. Retire o quanto antes.'
        : `Nº ${numeroInterno}${encomenda.transportadora ? ` · ${encomenda.transportadora}` : ''}. Retire no Corpo da Guarda a qualquer hora.`,
      tipo: dados.perecivel ? 'delivery' : 'encomenda',
      prioridade: dados.perecivel ? 'alta' : 'normal'
    });
  }
  if (dados.pedidoEsperadoId) {
    batch.update(ref('pedidosEsperados', dados.pedidoEsperadoId), { ativo: false, atendidoEm: agora(), encomendaId: id });
  }

  const status = await gravar(batch);
  return { id, numeroInterno, situacao, status, local: encomenda.local };
}

// Local sugerido: prateleira padrão do setor; sem setor, local separado.
export function localSugerido(pessoa, perecivel) {
  if (perecivel) return 'Delivery · balcão';
  if (!pessoa) return 'A identificar · separado';
  if (pessoa.setor === SETOR_PILOTO) return 'EsFO · Prateleira';
  return `${pessoa.setor} · Prateleira`;
}

// ---------- Retirada na guarda ----------

/**
 * Entrega na guarda (QR ou identificação), confirmada pela sentinela.
 * retiradoPor: { tipo: 'proprio' | 'terceiro', nome, numeroCadete?, documento?, autorizacaoId? }
 */
export async function entregarNaGuarda(encomendas, retiradoPor, posto, usuario) {
  if (!posto) throw new Error('Preencha "No posto agora" antes de entregar.');
  if (!encomendas.length) throw new Error('Marque ao menos uma encomenda.');
  if (retiradoPor.tipo === 'terceiro' && !retiradoPor.nome) throw new Error('Informe quem está retirando.');

  const quem = {
    tipo: retiradoPor.tipo,
    nome: retiradoPor.nome || null,
    numeroCadete: retiradoPor.numeroCadete || null,
    docMascarado: retiradoPor.documento ? mascararDocumento(retiradoPor.documento) : null,
    autorizacaoId: retiradoPor.autorizacaoId || null
  };
  const batch = writeBatch(db);
  for (const e of encomendas) {
    batch.update(ref('encomendas', e.id), {
      situacao: SITUACAO.RETIRADA,
      retiradaEm: agora(),
      retiradaPor: quem,
      entreguePor: posto
    });
    // Retirada durante a separação do lote: sai da lista na hora.
    if (e.loteId) {
      batch.update(ref('lotes', e.loteId), { retirados: arrayUnion(e.id) });
    }
    movimentacao(batch, {
      encomenda: e,
      de: e.situacao,
      para: SITUACAO.RETIRADA,
      usuario: { ...usuario, nome: posto },
      retiradoPor: quem
    });
  }
  return gravar(batch);
}

// Retirada na sala de TV, confirmada pelo próprio cadete.
export async function confirmarRetiradaSalaTV(encomenda, pessoa) {
  const batch = writeBatch(db);
  const quem = { tipo: 'proprio', nome: tratamento(pessoa), numeroCadete: pessoa.numeroCadete };
  batch.update(ref('encomendas', encomenda.id), {
    situacao: SITUACAO.RETIRADA,
    retiradaEm: agora(),
    retiradaPor: quem
  });
  movimentacao(batch, {
    encomenda,
    de: SITUACAO.SALA_TV,
    para: SITUACAO.RETIRADA,
    usuario: { uid: pessoa.id, nome: tratamento(pessoa) },
    retiradoPor: quem,
    observacao: 'Confirmada pelo destinatário na sala de TV'
  });
  return gravar(batch);
}

// Identificar o destinatário de uma encomenda "a identificar".
export async function identificarDestinatario(encomenda, pessoa, usuario) {
  const batch = writeBatch(db);
  batch.update(ref('encomendas', encomenda.id), {
    destinatarioUid: pessoa.id,
    destinatarioNome: tratamento(pessoa),
    destinatarioPelotao: pessoa.pelotao,
    setor: pessoa.setor,
    situacao: SITUACAO.NA_GUARDA
  });
  movimentacao(batch, {
    encomenda: { ...encomenda, destinatarioUid: pessoa.id },
    de: SITUACAO.A_IDENTIFICAR,
    para: SITUACAO.NA_GUARDA,
    usuario,
    observacao: `Destinatário identificado: ${tratamento(pessoa)}`
  });
  aviso(batch, {
    paraUid: pessoa.id,
    titulo: 'Encomenda na guarda',
    texto: `Nº ${encomenda.numeroInterno}. Retire no Corpo da Guarda a qualquer hora.`,
    tipo: 'encomenda'
  });
  return gravar(batch);
}
