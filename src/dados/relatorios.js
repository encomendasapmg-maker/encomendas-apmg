// Relatórios gerados no próprio aparelho (seção 8.1).
//
// Livro digital do período: UMA LINHA POR ENCOMENDA, com o caminho completo
// dela (chegada → retirada). Entram no relatório:
//   - as encomendas que chegaram no período;
//   - as que chegaram antes, mas foram retiradas no período;
//   - as que chegaram antes e continuam pendentes (na guarda, em lote,
//     na sala de TV ou a identificar), para a passagem de serviço.
// Sai em PDF (baixar ou compartilhar) ou em planilha (CSV, abre no Excel).
// O registro detalhado de movimentações continua disponível em planilha.
import { getDoc, getDocs, query, where, orderBy, addDoc, Timestamp } from 'firebase/firestore';
import { NOME_SITUACAO, NOME_FUNCAO, SITUACAO, TIPOS_ID, DESTINO_LOTE } from '../lib/constantes';
import { paraData } from '../lib/texto';
import { agora, col, ref } from './base';

const ABERTAS = [SITUACAO.NA_GUARDA, SITUACAO.EM_LOTE, SITUACAO.SALA_TV, SITUACAO.A_IDENTIFICAR];
const NOME_TIPO_ID = Object.fromEntries(TIPOS_ID.map((t) => [t.id, t.nome]));

// ---------- Leitura dos dados ----------

const lista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

async function encomendasDoPeriodo(inicio, fim) {
  const ini = Timestamp.fromDate(inicio);
  const ate = Timestamp.fromDate(fim);
  const [chegaram, retiradas, abertas] = await Promise.all([
    getDocs(query(col('encomendas'), where('chegada', '>=', ini), where('chegada', '<', ate), orderBy('chegada', 'asc'))),
    getDocs(query(col('encomendas'), where('retiradaEm', '>=', ini), where('retiradaEm', '<', ate), orderBy('retiradaEm', 'asc'))),
    getDocs(query(col('encomendas'), where('situacao', 'in', ABERTAS)))
  ]);
  const porId = new Map();
  for (const e of [...lista(chegaram), ...lista(retiradas)]) porId.set(e.id, e);
  // Pendentes que chegaram antes do fim do período (as mais novas não interessam
  // a um relatório de dias anteriores).
  for (const e of lista(abertas)) {
    if (paraMs(e.chegada) < fim.getTime()) porId.set(e.id, e);
  }
  return [...porId.values()].sort((a, b) => paraMs(a.chegada) - paraMs(b.chegada));
}

// Lotes das encomendas que foram para a sala de TV (executor e Cmt do Bloco).
async function lotesDe(encomendas) {
  const ids = [...new Set(encomendas.map((e) => e.loteId).filter(Boolean))];
  const lotes = await Promise.all(ids.map((id) => getDoc(ref('lotes', id)).catch(() => null)));
  return new Map(lotes.filter((l) => l?.exists()).map((l) => [l.id, l.data()]));
}

export async function livroDigital(inicio, fim) {
  const snap = await getDocs(
    query(
      col('movimentacoes'),
      where('em', '>=', Timestamp.fromDate(inicio)),
      where('em', '<', Timestamp.fromDate(fim)),
      orderBy('em', 'asc')
    )
  );
  return lista(snap);
}

export async function contingenciasDoPeriodo(inicio, fim) {
  const snap = await getDocs(
    query(col('contingencias'), where('inicio', '>=', Timestamp.fromDate(inicio)), where('inicio', '<', Timestamp.fromDate(fim)))
  );
  return lista(snap);
}

// ---------- Textos de cada coluna ----------

function paraMs(v) {
  const d = paraData(v);
  return d ? d.getTime() || 0 : 0;
}

// Data com ano: "11/11/2026 14h05".
function dataCompleta(v) {
  const d = paraData(v);
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}h${p(d.getMinutes())}`;
}

function duracao(ms) {
  if (!(ms > 0)) return '';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h${String(min % 60).padStart(2, '0')}`;
  const d = Math.floor(h / 24);
  return `${d} dia${d > 1 ? 's' : ''}${h % 24 ? ` ${h % 24}h` : ''}`;
}

function setorDe(e) {
  if (e.setor) return e.setor;
  return e.situacao === SITUACAO.A_IDENTIFICAR ? 'A identificar' : '';
}

function destinatarioDe(e) {
  return [e.destinatarioNome, e.destinatarioPelotao && `Pel. ${e.destinatarioPelotao}`].filter(Boolean).join(' · ');
}

function entregadorDe(e) {
  return [e.entregadorNome, e.transportadora].filter(Boolean).join(' · ');
}

function volumeDe(e) {
  const partes = [];
  if (e.perecivel) partes.push('DELIVERY');
  if (e.idNumero) partes.push(`${NOME_TIPO_ID[e.idTipo] || 'Nº'} ${e.idNumero}`);
  else if (e.idTipo === 'sem_numero') partes.push('Sem número');
  if (e.descricao) partes.push(e.descricao);
  return partes.join(' · ');
}

function retiradaPorDe(e) {
  const r = e.retiradaPor;
  if (!r) return '';
  if (r.tipo === 'terceiro') {
    const extras = [
      r.numeroCadete && `nº ${r.numeroCadete}`,
      r.docMascarado && `doc ${r.docMascarado}`,
      r.autorizacaoId ? 'autorizado no app' : null
    ].filter(Boolean);
    return `${r.nome || 'Terceiro'} (terceiro${extras.length ? `; ${extras.join('; ')}` : ''})`;
  }
  return `${r.nome || e.destinatarioNome || ''} (o próprio)`;
}

// Quem entregou: a sentinela, na guarda; ou a cadeia do lote, na sala de TV.
function entreguePorDe(e, lote) {
  if (e.situacao !== SITUACAO.RETIRADA && e.situacao !== SITUACAO.SALA_TV && e.situacao !== SITUACAO.EM_LOTE) return '';
  if (e.entreguePor) return `${e.entreguePor} (guarda)`;
  if (e.salaTvEm || e.situacao === SITUACAO.SALA_TV || e.situacao === SITUACAO.EM_LOTE) {
    const cadeia = [
      lote?.saidaConfirmadaPor && `saída: ${lote.saidaConfirmadaPor}`,
      lote?.executorNome && `levou: ${lote.executorNome}`,
      lote?.recebidoPor && `Cmt Bloco: ${lote.recebidoPor}`
    ].filter(Boolean);
    return `Lote › ${DESTINO_LOTE}${cadeia.length ? ` (${cadeia.join('; ')})` : ''}`;
  }
  return '';
}

function situacaoDe(e, agoraMs) {
  const chegada = paraMs(e.chegada);
  if (e.situacao === SITUACAO.RETIRADA) {
    const t = duracao(paraMs(e.retiradaEm) - chegada);
    return `Retirada${t ? ` · ficou ${t}` : ''}`;
  }
  const nome = NOME_SITUACAO[e.situacao] || e.situacao || '';
  const t = duracao(agoraMs - chegada);
  const extra = e.pendenciaLote ? ' · não encontrada na separação do lote' : '';
  return `PENDENTE: ${nome}${t ? ` há ${t}` : ''}${extra}`;
}

const CABECALHO = [
  'Nº',
  'Chegada',
  'Destinatário',
  'Setor',
  'Recebida por (sentinela)',
  'Entregador',
  'Volume',
  'Retirada em',
  'Retirada por',
  'Entregue por',
  'Situação'
];

async function dadosRelatorio(inicio, fim) {
  const [encomendas, conts] = await Promise.all([encomendasDoPeriodo(inicio, fim), contingenciasDoPeriodo(inicio, fim)]);
  const lotes = await lotesDe(encomendas);
  const agoraMs = Date.now();
  const iniMs = inicio.getTime();
  const fimMs = fim.getTime();
  const dentro = (v) => {
    const ms = paraMs(v);
    return ms >= iniMs && ms < fimMs;
  };

  const linhas = encomendas.map((e) => ({
    pendente: e.situacao !== SITUACAO.RETIRADA,
    delivery: Boolean(e.perecivel),
    linha: [
      e.numeroInterno ?? '',
      dataCompleta(e.chegada),
      destinatarioDe(e),
      setorDe(e),
      e.registradaPor || '',
      entregadorDe(e),
      volumeDe(e),
      dataCompleta(e.retiradaEm),
      retiradaPorDe(e),
      entreguePorDe(e, lotes.get(e.loteId)),
      situacaoDe(e, agoraMs)
    ]
  }));

  const retiradas = encomendas.filter((e) => e.situacao === SITUACAO.RETIRADA && e.retiradaEm);
  const permanencias = retiradas.map((e) => paraMs(e.retiradaEm) - paraMs(e.chegada)).filter((ms) => ms > 0);
  const resumo = {
    recebidas: encomendas.filter((e) => dentro(e.chegada)).length,
    retiradas: retiradas.filter((e) => dentro(e.retiradaEm)).length,
    pendentes: encomendas.filter((e) => e.situacao !== SITUACAO.RETIRADA).length,
    aIdentificar: encomendas.filter((e) => e.situacao === SITUACAO.A_IDENTIFICAR).length,
    deliveries: encomendas.filter((e) => e.perecivel && dentro(e.chegada)).length,
    porTerceiro: retiradas.filter((e) => dentro(e.retiradaEm) && e.retiradaPor?.tipo === 'terceiro').length,
    permanenciaMedia: permanencias.length ? duracao(permanencias.reduce((a, b) => a + b, 0) / permanencias.length) : '',
    porSetor: contarPorSetor(encomendas.filter((e) => dentro(e.chegada))),
    contingencias: conts
      .sort((a, b) => paraMs(a.inicio) - paraMs(b.inicio))
      .map((c) => `${dataCompleta(c.inicio)} até ${c.fim ? dataCompleta(c.fim) : 'em aberto'}${c.abertaPor ? ` (${c.abertaPor})` : ''}`)
  };
  return { linhas, resumo, total: encomendas.length };
}

function contarPorSetor(encomendas) {
  const m = new Map();
  for (const e of encomendas) {
    const s = setorDe(e) || 'Sem setor';
    m.set(s, (m.get(s) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}: ${n}`).join(' · ');
}

function linhasResumo(r) {
  return [
    `Recebidas no período: ${r.recebidas}${r.porSetor ? ` (${r.porSetor})` : ''}${r.deliveries ? ` · ${r.deliveries} delivery(s)` : ''}`,
    `Retiradas no período: ${r.retiradas}${r.porTerceiro ? ` (${r.porTerceiro} por terceiro)` : ''}${r.permanenciaMedia ? ` · permanência média: ${r.permanenciaMedia}` : ''}`,
    `Pendentes agora: ${r.pendentes}${r.aIdentificar ? ` (${r.aIdentificar} a identificar)` : ''}`
  ];
}

// ---------- Arquivos ----------

function csv(linhas) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + linhas.map((l) => l.map(esc).join(';')).join('\r\n');
}

export function baixarCSV(nome, linhas) {
  baixarArquivo(nome, new Blob([csv(linhas)], { type: 'text/csv;charset=utf-8' }));
}

function nomeArquivo(prefixo, inicio, fim, ext) {
  // fim é meia-noite do dia seguinte: o arquivo mostra o último dia incluído.
  const ultimo = new Date(fim.getTime() - 1);
  const d = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const a = d(inicio);
  const b = d(ultimo);
  return `${prefixo}_${a === b ? a : `${a}_a_${b}`}.${ext}`;
}

function textoPeriodo(inicio, fim) {
  const d = (x) => dataCompleta(x).split(' ')[0];
  const a = d(inicio);
  const b = d(new Date(fim.getTime() - 1));
  return a === b ? a : `${a} a ${b}`;
}

async function registrarGeracao(inicio, fim, usuario, formato, tipo = 'livro_digital') {
  await addDoc(col('relatoriosGerados'), {
    tipo,
    formato,
    usuarioUid: usuario.uid,
    usuarioNome: usuario.nome,
    inicio: Timestamp.fromDate(inicio),
    fim: Timestamp.fromDate(fim),
    em: agora()
  });
}

// Planilha do relatório de encomendas (uma linha por encomenda).
export async function exportarLivroDigital(inicio, fim, usuario) {
  const { linhas, resumo, total } = await dadosRelatorio(inicio, fim);
  await registrarGeracao(inicio, fim, usuario, 'planilha');
  const rodape = [
    [],
    ['Resumo'],
    ...linhasResumo(resumo).map((l) => [l]),
    ...(resumo.contingencias.length ? [['Contingência (livro físico): ' + resumo.contingencias.join(' | ')]] : []),
    [`Gerado por ${usuario.nome} em ${dataCompleta(new Date())}`]
  ];
  baixarCSV(nomeArquivo('encomendas', inicio, fim, 'csv'), [CABECALHO, ...linhas.map((i) => i.linha), ...rodape]);
  return total;
}

// Planilha detalhada com todas as movimentações (trilha completa, para auditoria).
const CABECALHO_MOV = ['Data/hora', 'Nº interno', 'De', 'Para', 'Quem', 'Função', 'Retirado por', 'Observação'];

export async function exportarMovimentacoes(inicio, fim, usuario) {
  const movs = await livroDigital(inicio, fim);
  await registrarGeracao(inicio, fim, usuario, 'planilha', 'movimentacoes');
  const linhas = movs.map((m) => [
    dataCompleta(m.em),
    m.numeroInterno ?? '',
    NOME_SITUACAO[m.de] || (m.de ? m.de : 'Registro'),
    NOME_SITUACAO[m.para] || m.para || '',
    m.usuarioNome || '',
    m.funcao ? NOME_FUNCAO[m.funcao] || m.funcao : '',
    m.retiradoPor ? `${m.retiradoPor.nome || 'próprio'}${m.retiradoPor.docMascarado ? ` (doc ${m.retiradoPor.docMascarado})` : ''}` : '',
    m.observacao || ''
  ]);
  baixarCSV(nomeArquivo('movimentacoes', inicio, fim, 'csv'), [CABECALHO_MOV, ...linhas]);
  return movs.length;
}

// PDF do relatório de encomendas. A biblioteca de PDF só é carregada quando
// alguém gera o relatório, para não pesar na abertura do app.
// modo: 'baixar' ou 'compartilhar' (no celular abre WhatsApp, e-mail etc.).
export async function livroDigitalPDF(inicio, fim, usuario, modo = 'baixar') {
  const [{ linhas, resumo, total }, { jsPDF }, { autoTable }] = await Promise.all([
    dadosRelatorio(inicio, fim),
    import('jspdf'),
    import('jspdf-autotable')
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const periodo = textoPeriodo(inicio, fim);
  const geradoEm = dataCompleta(new Date());

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Livro digital de encomendas', 10, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Corpo da Guarda · Academia Policial Militar do Guatupé', 10, 18.5);
  doc.text(`Período: ${periodo}`, 10, 23.5);
  doc.text(`Gerado por ${usuario.nome} em ${geradoEm}`, largura - 10, 18.5, { align: 'right' });

  // Resumo
  let y = 30;
  doc.setFontSize(9);
  for (const l of linhasResumo(resumo)) {
    doc.text(l, 10, y);
    y += 4.5;
  }
  if (resumo.contingencias.length) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(146, 64, 14);
    const t = doc.splitTextToSize(`Contingência (livro físico em uso): ${resumo.contingencias.join(' | ')}. Os registros desse período estão no livro físico.`, largura - 20);
    doc.text(t, 10, y);
    y += 4.5 * t.length;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
  }

  autoTable(doc, {
    startY: y + 1,
    head: [CABECALHO],
    body: linhas.length
      ? linhas.map((i) => i.linha.map((v) => String(v)))
      : [[{ content: 'Nenhuma encomenda no período.', colSpan: CABECALHO.length }]],
    styles: { fontSize: 7, cellPadding: 1.3, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 19 },
      2: { cellWidth: 28 },
      3: { cellWidth: 16 },
      4: { cellWidth: 23 },
      5: { cellWidth: 27 },
      6: { cellWidth: 30 },
      7: { cellWidth: 19 },
      8: { cellWidth: 32 },
      9: { cellWidth: 37 }
      // 10 (Situação): o restante da largura
    },
    margin: { left: 10, right: 10, bottom: 14 },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      const item = linhas[d.row.index];
      if (item?.pendente) d.cell.styles.fillColor = [254, 243, 199];
      if (item?.pendente && d.column.index === 10) d.cell.styles.fontStyle = 'bold';
      if (item?.delivery && d.column.index === 6) d.cell.styles.fontStyle = 'bold';
    },
    didDrawPage: () => {
      const altura = doc.internal.pageSize.getHeight();
      doc.setFontSize(7.5);
      doc.setTextColor(110);
      doc.text('Documento gerado pelo app de Encomendas da APMG. Uso interno — dados pessoais protegidos (LGPD). Linhas em amarelo: encomendas ainda não retiradas.', 10, altura - 7);
      doc.text(`Página ${doc.internal.getNumberOfPages()}`, largura - 10, altura - 7, { align: 'right' });
      doc.setTextColor(0);
    }
  });

  // Campo de conferência, como no livro físico.
  const altura = doc.internal.pageSize.getHeight();
  let yFim = (doc.lastAutoTable?.finalY || y) + 14;
  if (yFim > altura - 22) {
    doc.addPage();
    yFim = 25;
  }
  doc.setFontSize(9);
  doc.line(10, yFim, 100, yFim);
  doc.text('Comandante da Guarda', 10, yFim + 4.5);

  const nome = nomeArquivo('encomendas', inicio, fim, 'pdf');
  const blob = doc.output('blob');
  await registrarGeracao(inicio, fim, usuario, 'pdf');

  if (modo === 'compartilhar') {
    const arquivo = new File([blob], nome, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: 'Livro digital de encomendas', text: `Livro digital de encomendas · ${periodo}` });
        return { quantidade: total, compartilhado: true };
      } catch (e) {
        if (e?.name === 'AbortError') return { quantidade: total, cancelado: true };
        // outro erro: cai para o download
      }
    }
  }
  baixarArquivo(nome, blob);
  return { quantidade: total, compartilhado: false };
}

function baixarArquivo(nome, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
