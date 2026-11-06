// Relatórios gerados no próprio aparelho (seção 8.1). Esta primeira versão
// exporta o livro digital do período em planilha (CSV, abre no Excel);
// os demais relatórios usam a mesma base (coleção movimentacoes).
import { getDocs, query, where, orderBy, addDoc, Timestamp } from 'firebase/firestore';
import { NOME_SITUACAO } from '../lib/constantes';
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

export function baixarCSV(nomeArquivo, linhas) {
  const blob = new Blob([csv(linhas)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportarLivroDigital(inicio, fim, usuario) {
  const [movs, conts] = await Promise.all([livroDigital(inicio, fim), contingenciasDoPeriodo(inicio, fim)]);
  const linhas = [['Data/hora', 'Nº interno', 'De', 'Para', 'Quem', 'Função', 'Retirado por', 'Observação']];
  for (const m of movs) {
    linhas.push([
      dataHora(m.em),
      m.numeroInterno,
      NOME_SITUACAO[m.de] || (m.de ? m.de : 'Registro'),
      NOME_SITUACAO[m.para] || m.para,
      m.usuarioNome,
      m.funcao || '',
      m.retiradoPor ? `${m.retiradoPor.nome || 'próprio'}${m.retiradoPor.docMascarado ? ` (doc ${m.retiradoPor.docMascarado})` : ''}` : '',
      m.observacao || ''
    ]);
  }
  for (const c of conts) {
    linhas.push([dataHora(c.inicio), '', 'CONTINGÊNCIA', `até ${c.fim ? dataHora(c.fim) : 'em aberto'}`, c.abertaPor, '', '', 'Livro físico em uso']);
  }
  await addDoc(col('relatoriosGerados'), {
    tipo: 'livro_digital',
    usuarioUid: usuario.uid,
    usuarioNome: usuario.nome,
    inicio: Timestamp.fromDate(inicio),
    fim: Timestamp.fromDate(fim),
    em: agora()
  });
  const nome = `livro-digital_${inicio.toISOString().slice(0, 10)}_${fim.toISOString().slice(0, 10)}.csv`;
  baixarCSV(nome, linhas);
  return movs.length;
}
