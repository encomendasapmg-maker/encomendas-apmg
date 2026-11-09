// Relatórios gerados no próprio aparelho (seção 8.1). O livro digital do
// período sai em PDF (baixar ou compartilhar) ou em planilha (CSV, abre no Excel);
// os demais relatórios usam a mesma base (coleção movimentacoes).
import { getDocs, query, where, orderBy, addDoc, Timestamp } from 'firebase/firestore';
import { NOME_SITUACAO, NOME_FUNCAO } from '../lib/constantes';
import { dataHora } from '../lib/texto';
import { agora, col } from './base';

export async function livroDigital(inicio, fim) {
  const snap = await getDocs(
    query(
      col('movimentacoes'),
      where('em', '>=', Timestamp.fromDate(inicio)),
      where('em', '<', Timestamp.fromDate(fim)),
      orderBy('em', 'asc')
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function contingenciasDoPeriodo(inicio, fim) {
  const snap = await getDocs(
    query(col('contingencias'), where('inicio', '>=', Timestamp.fromDate(inicio)), where('inicio', '<', Timestamp.fromDate(fim)))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function csv(linhas) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + linhas.map((l) => l.map(esc).join(';')).join('\r\n');
}

export function baixarCSV(nome, linhas) {
  baixarArquivo(nome, new Blob([csv(linhas)], { type: 'text/csv;charset=utf-8' }));
}

// Monta as linhas do livro digital do período (mesmo conteúdo na planilha e no PDF).
async function dadosLivroDigital(inicio, fim) {
  const [movs, conts] = await Promise.all([livroDigital(inicio, fim), contingenciasDoPeriodo(inicio, fim)]);
  const itens = [];
  for (const m of movs) {
    itens.push({
      quando: paraMs(m.em),
      contingencia: false,
      linha: [
        dataHora(m.em),
        m.numeroInterno ?? '',
        NOME_SITUACAO[m.de] || (m.de ? m.de : 'Registro'),
        NOME_SITUACAO[m.para] || m.para || '',
        m.usuarioNome || '',
        m.funcao ? NOME_FUNCAO[m.funcao] || m.funcao : '',
        m.retiradoPor ? `${m.retiradoPor.nome || 'próprio'}${m.retiradoPor.docMascarado ? ` (doc ${m.retiradoPor.docMascarado})` : ''}` : '',
        m.observacao || ''
      ]
    });
  }
  for (const c of conts) {
    itens.push({
      quando: paraMs(c.inicio),
      contingencia: true,
      linha: [dataHora(c.inicio), '', 'CONTINGÊNCIA', `até ${c.fim ? dataHora(c.fim) : 'em aberto'}`, c.abertaPor || '', '', '', 'Livro físico em uso']
    });
  }
  itens.sort((a, b) => a.quando - b.quando);
  return { itens, totalMovimentacoes: movs.length, totalContingencias: conts.length };
}

function paraMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  return new Date(v).getTime() || 0;
}

const CABECALHO = ['Data/hora', 'Nº interno', 'De', 'Para', 'Quem', 'Função', 'Retirado por', 'Observação'];

function nomeArquivo(inicio, fim, ext) {
  // fim é meia-noite do dia seguinte: o arquivo mostra o último dia incluído.
  const ultimo = new Date(fim.getTime() - 1);
  const d = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const a = d(inicio);
  const b = d(ultimo);
  return `livro-digital_${a === b ? a : `${a}_a_${b}`}.${ext}`;
}

async function registrarGeracao(inicio, fim, usuario, formato) {
  await addDoc(col('relatoriosGerados'), {
    tipo: 'livro_digital',
    formato,
    usuarioUid: usuario.uid,
    usuarioNome: usuario.nome,
    inicio: Timestamp.fromDate(inicio),
    fim: Timestamp.fromDate(fim),
    em: agora()
  });
}

export async function exportarLivroDigital(inicio, fim, usuario) {
  const { itens, totalMovimentacoes } = await dadosLivroDigital(inicio, fim);
  await registrarGeracao(inicio, fim, usuario, 'planilha');
  baixarCSV(nomeArquivo(inicio, fim, 'csv'), [CABECALHO, ...itens.map((i) => i.linha)]);
  return totalMovimentacoes;
}

// PDF do livro digital. A biblioteca de PDF só é carregada quando alguém gera
// o relatório, para não pesar na abertura do app.
// modo: 'baixar' ou 'compartilhar' (no celular abre WhatsApp, e-mail etc.).
export async function livroDigitalPDF(inicio, fim, usuario, modo = 'baixar') {
  const [{ itens, totalMovimentacoes, totalContingencias }, { jsPDF }, { autoTable }] = await Promise.all([
    dadosLivroDigital(inicio, fim),
    import('jspdf'),
    import('jspdf-autotable')
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const ultimoDia = new Date(fim.getTime() - 1);
  const periodo = `${dataHora(inicio).split(',')[0]} a ${dataHora(ultimoDia).split(',')[0]}`;
  const geradoEm = dataHora(new Date());

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Livro digital de encomendas', 14, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Corpo da Guarda · Academia Policial Militar do Guatupé', 14, 21);
  doc.text(`Período: ${periodo}`, 14, 27);
  doc.text(`Gerado por ${usuario.nome} em ${geradoEm}`, largura - 14, 21, { align: 'right' });
  doc.text(
    `${totalMovimentacoes} movimentação(ões)${totalContingencias ? ` · ${totalContingencias} período(s) de contingência` : ''}`,
    largura - 14, 27, { align: 'right' }
  );

  autoTable(doc, {
    startY: 32,
    head: [CABECALHO],
    body: itens.length ? itens.map((i) => i.linha.map((v) => String(v))) : [['Nenhuma movimentação no período.', '', '', '', '', '', '', '']],
    styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 18 }, 7: { cellWidth: 55 } },
    margin: { left: 14, right: 14, bottom: 14 },
    didParseCell: (d) => {
      if (d.section === 'body' && itens[d.row.index]?.contingencia) {
        d.cell.styles.fillColor = [254, 243, 199];
        d.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: () => {
      const altura = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text('Documento gerado pelo app de Encomendas da APMG. Uso interno — dados pessoais protegidos (LGPD).', 14, altura - 7);
      doc.text(`Página ${doc.internal.getNumberOfPages()}`, largura - 14, altura - 7, { align: 'right' });
      doc.setTextColor(0);
    }
  });

  const nome = nomeArquivo(inicio, fim, 'pdf');
  const blob = doc.output('blob');
  await registrarGeracao(inicio, fim, usuario, 'pdf');

  if (modo === 'compartilhar') {
    const arquivo = new File([blob], nome, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: 'Livro digital de encomendas', text: `Livro digital de encomendas · ${periodo}` });
        return { quantidade: totalMovimentacoes, compartilhado: true };
      } catch (e) {
        if (e?.name === 'AbortError') return { quantidade: totalMovimentacoes, cancelado: true };
        // outro erro: cai para o download
      }
    }
  }
  baixarArquivo(nome, blob);
  return { quantidade: totalMovimentacoes, compartilhado: false };
}

function baixarArquivo(nome, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
