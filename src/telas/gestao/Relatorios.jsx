// Gestão · Relatórios (seção 8.1). Livro digital do período em PDF (baixar ou
// compartilhar) ou em planilha. Os demais relatórios (trilha, por serviço, por pessoa, lotes,
// pendências, correções) seguem a mesma base e entram nas próximas versões.
import { useState } from 'react';
import { exportarLivroDigital, exportarMovimentacoes, livroDigitalPDF } from '../../dados/relatorios';
import { Topo, Chips, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';

function intervalo(periodo) {
  const fim = new Date();
  fim.setHours(24, 0, 0, 0);
  const inicio = new Date(fim);
  if (periodo === 'dia') inicio.setDate(inicio.getDate() - 1);
  if (periodo === 'semana') inicio.setDate(inicio.getDate() - 7);
  if (periodo === 'mes') inicio.setMonth(inicio.getMonth() - 1);
  return [inicio, fim];
}

const PROXIMOS = [
  'Trilha de uma encomenda',
  'Por serviço',
  'Por pessoa',
  'Lotes da EsFO',
  'Pendências',
  'Correções'
];

export default function Relatorios() {
  const { eu, ehOficial } = useSessao();
  const [periodo, setPeriodo] = useState('dia');
  const [executar, ocupado] = useAcao();
  const podeCompartilhar = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const pdf = (modo) => executar(
    () => livroDigitalPDF(...intervalo(periodo), eu, modo),
    (r) => r?.cancelado ? 'Compartilhamento cancelado.' : r?.compartilhado ? 'PDF pronto para enviar.' : `PDF baixado · ${r?.quantidade ?? 0} encomenda(s).`
  );
  const opcoes = [{ id: 'dia', nome: 'Hoje' }, ...(ehOficial ? [{ id: 'semana', nome: '7 dias' }, { id: 'mes', nome: '30 dias' }] : [])];

  return (
    <>
      <Topo titulo="Relatórios" sobre="Gerados no aparelho · quem gera fica registrado" voltar={{ rotulo: 'Painel', to: '/gestao' }} />
      <main className="conteudo">
        <div className="cartao" style={{ gap: 12 }}>
          <span className="titulo">Livro digital do período</span>
          <span className="muted">Uma linha por encomenda: chegada, destinatário, setor, sentinela que recebeu, entregador, retirada e quem retirou. Inclui o que chegou ou foi retirado no período e o que ainda está pendente.</span>
          <Chips rotulo="Período" opcoes={opcoes} valor={periodo} aoMudar={setPeriodo} />
          {podeCompartilhar && (
            <button className="btn primario" disabled={ocupado} onClick={() => pdf('compartilhar')}>
              Compartilhar PDF
            </button>
          )}
          <button className={podeCompartilhar ? 'btn' : 'btn primario'} disabled={ocupado} onClick={() => pdf('baixar')}>
            Baixar PDF
          </button>
          <button className="btn" disabled={ocupado}
            onClick={() => executar(() => exportarLivroDigital(...intervalo(periodo), eu), (n) => `${n} encomenda(s) exportada(s).`)}>
            Baixar planilha (Excel)
          </button>
          {ehOficial && (
            <button className="btn" disabled={ocupado}
              onClick={() => executar(() => exportarMovimentacoes(...intervalo(periodo), eu), (n) => `${n} movimentação(ões) exportada(s).`)}>
              Planilha detalhada de movimentações
            </button>
          )}
          {!ehOficial && <span className="pequeno">O relatório do dia fica disponível às funções de serviço; os demais, ao Oficial de Dia e ao administrador.</span>}
        </div>
        <div className="cartao">
          <span className="rotulo caps">Próximas versões</span>
          {PROXIMOS.map((r) => <span key={r} className="muted">· {r}</span>)}
        </div>
      </main>
    </>
  );
}
