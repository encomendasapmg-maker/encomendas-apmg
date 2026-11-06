// Cadete · Missões: lote EsFO em aberto, assumido pelo executor no próprio
// celular (RF13/RF14). Separação pelo nº interno e baixa na sala de TV.
import { useMemo } from 'react';
import { useLotesAtivos, assumirLote, marcarSeparado, entregarNaSala, itensValidos, STATUS_LOTE } from '../../dados/lotes';
import { DESTINO_LOTE } from '../../lib/constantes';
import { tratamento } from '../../lib/texto';
import { Topo, Carregando, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';

function Lote({ lote, pessoa }) {
  const [executar, ocupado] = useAcao();
  const meu = lote.executorUid === pessoa.id;
  const itens = itensValidos(lote);
  const separados = new Set(lote.separados || []);
  const qtd = itens.filter((i) => separados.has(i.id)).length;
  const porPelotao = useMemo(() => {
    const m = new Map();
    for (const i of itens) {
      if (!m.has(i.pelotao)) m.set(i.pelotao, []);
      m.get(i.pelotao).push(i);
    }
    return [...m.entries()];
  }, [itens]);

  return (
    <div className="secao" style={{ gap: 12 }}>
      <div className="cartao">
        <div className="linha-entre">
          <span className="rotulo caps">Lote EsFO · {itens.length} volumes</span>
          <span className="selo verde">{STATUS_LOTE[lote.status]}</span>
        </div>
        <span className="muted">Gerado por {lote.criadoPorNome}{lote.prazo ? ` · prazo de retirada ${lote.prazo}` : ''}</span>
        {lote.executorIndicadoNome && !lote.executorUid && <span className="muted">Indicado: {lote.executorIndicadoNome}</span>}
        {lote.executorUid && <span className="titulo">Executor: {meu ? 'você' : lote.executorNome}</span>}
        {meu && (
          <>
            <div className="linha-entre" style={{ fontSize: 14 }}><b>{qtd} de {itens.length} separados</b><span className="pequeno">pelo nº interno</span></div>
            <div className="barra"><div style={{ width: `${itens.length ? (qtd / itens.length) * 100 : 0}%` }} /></div>
          </>
        )}
      </div>

      {!lote.executorUid && (
        <button className="btn primario" disabled={ocupado} onClick={() => executar(() => assumirLote(lote, pessoa), 'Você assumiu o lote.')}>
          Assumir esta missão
        </button>
      )}

      {meu && lote.status === 'separando' && (
        <>
          {porPelotao.map(([pelotao, lista]) => (
            <div key={pelotao} className="secao">
              <span className="rotulo">{pelotao.toUpperCase()}</span>
              {lista.map((i) => (
                <label key={i.id} className="item-check">
                  <input type="checkbox" checked={separados.has(i.id)} onChange={(e) => marcarSeparado(lote, i.id, e.target.checked)} />
                  <span style={{ fontSize: 15 }}><b>{i.numeroInterno}</b> · {i.nome}</span>
                </label>
              ))}
            </div>
          ))}
          <span className="muted">Terminada a separação, a sentinela confirma a saída no aparelho da guarda.</span>
        </>
      )}

      {meu && lote.status === 'saiu' && (
        <button className="btn primario" disabled={ocupado}
          onClick={() => executar(() => entregarNaSala(lote, pessoa), 'Baixa feita. Os cadetes foram avisados.')}>
          Entregue na {DESTINO_LOTE}
        </button>
      )}
      {!meu && lote.executorUid && <span className="muted">Missão assumida por {lote.executorNome}.</span>}
    </div>
  );
}

export default function Missoes() {
  const { pessoa } = useSessao();
  const [lotes, carregando] = useLotesAtivos();
  const visiveis = (lotes || []).filter(
    (l) => ['aberto', 'separando'].includes(l.status) || (l.executorUid === pessoa.id && l.status === 'saiu')
  );
  return (
    <>
      <Topo cadete titulo="Missões" sobre={tratamento(pessoa)} />
      <main className="conteudo">
        {carregando && <Carregando />}
        {!carregando && visiveis.length === 0 && <div className="vazio">Nenhum lote em aberto agora.</div>}
        {visiveis.map((l) => <Lote key={l.id} lote={l} pessoa={pessoa} />)}
      </main>
    </>
  );
}
