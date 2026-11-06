// Guarda · Saída de lote EsFO: a sentinela confirma que entregou o lote ao executor.
import { useNavigate } from 'react-router-dom';
import { useLotesAtivos, confirmarSaida, itensValidos, STATUS_LOTE } from '../../dados/lotes';
import { Topo, Carregando, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';
import { usePostoAtual } from './Guarda';

export default function SaidaLote() {
  const { eu } = useSessao();
  const { nome: posto } = usePostoAtual();
  const navegar = useNavigate();
  const [lotes, carregando] = useLotesAtivos();
  const [executar, ocupado] = useAcao();
  const lote = lotes?.find((l) => l.status === 'separando' || l.status === 'aberto');

  if (carregando) return <Carregando />;

  const itens = lote ? itensValidos(lote) : [];
  const separados = new Set(lote?.separados || []);
  const qtdSeparados = itens.filter((i) => separados.has(i.id)).length;
  const faltam = itens.length - qtdSeparados;

  const confirmar = async () => {
    const ok = await executar(() => confirmarSaida(lote, posto, eu), 'Saída do lote confirmada.');
    if (ok) navegar('/guarda');
  };

  return (
    <>
      <Topo titulo="Saída de lote EsFO" sobre={`No posto: ${posto || '—'}`} voltar={{ rotulo: 'Início', to: '/guarda' }} />
      <main className="conteudo">
        {!lote && <div className="vazio">Nenhum lote em aberto. O lote é gerado pelo Cmt da Guarda, Dia à EsFO ou respondente.</div>}
        {lote && (
          <>
            <div className="cartao">
              <div className="linha-entre">
                <span className="rotulo caps">Executor</span>
                <span className="selo verde">{STATUS_LOTE[lote.status]}</span>
              </div>
              <span className="titulo">{lote.executorNome || 'Ninguém assumiu ainda'}</span>
              <div className="linha-entre" style={{ fontSize: 14 }}>
                <b>{qtdSeparados} de {itens.length} separados</b>
                <span className="pequeno">pelo nº interno</span>
              </div>
              <div className="barra"><div style={{ width: `${itens.length ? (qtdSeparados / itens.length) * 100 : 0}%` }} /></div>
            </div>
            {faltam > 0 && lote.executorUid && (
              <div className="caixa-alerta">
                {faltam} volume(s) não marcado(s) como separado(s). Ao confirmar, eles continuam na guarda e viram pendência no painel.
              </div>
            )}
            <button className="btn primario" disabled={!lote.executorUid || qtdSeparados === 0 || ocupado} onClick={confirmar}>
              Confirmar saída da guarda · {posto}
            </button>
            {!lote.executorUid && <span className="pequeno">O executor precisa assumir o lote no próprio celular (Missões).</span>}
          </>
        )}
      </main>
    </>
  );
}
