// Gestão · Lote EsFO (tela "Lote" desenhada): gerar, indicar executor,
// prazo, acompanhar a cadeia de confirmações e mensagem para o WhatsApp.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useLote, gerarLote, candidatasAoLote, confirmarRecebimentoBloco, mensagemWhatsApp, itensValidos, descricaoLote, STATUS_LOTE
} from '../../dados/lotes';
import { usePessoasAtivas } from '../../dados/pessoas';
import { DESTINO_LOTE } from '../../lib/constantes';
import { dataHora, hora, linkWhatsApp } from '../../lib/texto';
import { Topo, BuscaPessoa, Carregando, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';

function prazoPadrao() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}, 20h`;
}

function NovoLote() {
  const { pessoa } = useSessao();
  const navegar = useNavigate();
  const [pessoas] = usePessoasAtivas();
  const [candidatas, setCandidatas] = useState(null);
  const [prazo, setPrazo] = useState(prazoPadrao());
  const [indicado, setIndicado] = useState(null);
  const [executar, ocupado] = useAcao();

  useEffect(() => {
    candidatasAoLote().then(setCandidatas).catch(() => setCandidatas([]));
  }, []);

  const gerar = async () => {
    const id = await executar(() => gerarLote(pessoa, { prazo, executorIndicado: indicado }), 'Lote gerado. Qualquer cadete pode assumir a missão.');
    if (id) navegar(`/gestao/lote/${id}`, { replace: true });
  };

  return (
    <>
      <Topo titulo="Gerar lote EsFO" sobre={`Destino: ${DESTINO_LOTE}`} voltar={{ rotulo: 'Painel', to: '/gestao' }} />
      <main className="conteudo">
        {candidatas === null ? <Carregando /> : (
          <div className="cartao">
            <span className="titulo">{candidatas.length} volume(s) na guarda</span>
            <span className="muted">Só o que continua na guarda, sem deliveries e sem pendências de identificação.</span>
          </div>
        )}
        <label className="campo">Prazo para retirada na sala de TV
          <input value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </label>
        <section className="secao">
          <span className="rotulo">Indicar executor (opcional)</span>
          <span className="pequeno">Sem indicação, o lote fica em aberto e qualquer cadete pode assumir no próprio celular.</span>
          <BuscaPessoa pessoas={pessoas?.filter((p) => p.perfil === 'cadete')} selecionada={indicado} aoSelecionar={setIndicado} rotulo="Buscar cadete" />
        </section>
        <button className="btn primario" disabled={!candidatas?.length || ocupado} onClick={gerar}>Gerar lote</button>
      </main>
    </>
  );
}

function Passo({ numero, texto, feito, detalhe, children }) {
  return (
    <div className="cartao" style={{ borderColor: feito ? '#166534' : undefined }}>
      <div className="linha-entre">
        <span style={{ fontWeight: 600, fontSize: 15 }}>{numero} · {texto}</span>
        <span className={`selo ${feito ? 'verde' : 'cinza'}`}>{feito ? 'feito' : 'aguardando'}</span>
      </div>
      {detalhe && <span className="pequeno">{detalhe}</span>}
      {children}
    </div>
  );
}

function AcompanharLote({ id }) {
  const { pessoa, ehCmtBloco } = useSessao();
  const [lote, carregando] = useLote(id);
  const [executar, ocupado] = useAcao();
  if (carregando) return <Carregando />;
  if (!lote) return <div className="centro">Lote não encontrado.</div>;

  const itens = itensValidos(lote);
  const separados = new Set(lote.separados || []);
  const qtd = itens.filter((i) => separados.has(i.id)).length;
  const faltantes = new Set(lote.faltantes || []);
  const porPelotao = new Map();
  for (const i of itens) {
    if (!porPelotao.has(i.pelotao)) porPelotao.set(i.pelotao, []);
    porPelotao.get(i.pelotao).push(i);
  }
  const ordem = ['aberto', 'separando', 'saiu', 'entregue', 'recebido'];
  const passou = (s) => ordem.indexOf(lote.status) >= ordem.indexOf(s);
  const mensagem = mensagemWhatsApp(lote);

  return (
    <>
      <Topo titulo={`Lote EsFO · ${dataHora(lote.criadoEm).split(',')[0]}`} sobre={descricaoLote(lote)} voltar={{ rotulo: 'Painel', to: '/gestao' }} />
      <main className="conteudo">
        <div className="cartao">
          <div className="linha-entre">
            <span className="rotulo caps">Executor</span>
            <span className="selo verde">{STATUS_LOTE[lote.status]}</span>
          </div>
          <span className="titulo">{lote.executorNome || (lote.executorIndicadoNome ? `${lote.executorIndicadoNome} (indicado)` : 'Em aberto · ninguém assumiu')}</span>
          <div className="linha-entre" style={{ fontSize: 14 }}><b>{qtd} de {itens.length} separados</b><span className="pequeno">pelo nº interno</span></div>
          <div className="barra"><div style={{ width: `${itens.length ? (qtd / itens.length) * 100 : 0}%` }} /></div>
        </div>

        {[...porPelotao.entries()].map(([pelotao, lista]) => (
          <section key={pelotao} className="secao">
            <span className="rotulo">{pelotao.toUpperCase()}</span>
            {lista.map((i) => (
              <div key={i.id} className={`item-check${faltantes.has(i.id) ? ' falta' : ''}`} style={{ cursor: 'default' }}>
                <input type="checkbox" checked={separados.has(i.id)} readOnly aria-label="Separado" />
                <span style={{ fontSize: 15 }}><b>{i.numeroInterno}</b> · {i.nome}{faltantes.has(i.id) && <span className="pequeno" style={{ color: '#92400E' }}> · não localizado</span>}</span>
              </div>
            ))}
          </section>
        ))}
        {(lote.retirados || []).length > 0 && <span className="pequeno">{lote.retirados.length} volume(s) retirado(s) na guarda durante a separação.</span>}

        <Passo numero={1} texto="Sentinela confirma saída da guarda" feito={passou('saiu')}
          detalhe={lote.saidaEm ? `${lote.saidaConfirmadaPor} às ${hora(lote.saidaEm)}` : 'No aparelho da guarda › Saída de lote EsFO'} />
        <Passo numero={2} texto={`Entregue na ${DESTINO_LOTE}`} feito={passou('entregue')}
          detalhe={lote.entregueSalaEm ? `${lote.executorNome} às ${hora(lote.entregueSalaEm)}` : 'Executor dá baixa no próprio celular'} />
        <Passo numero={3} texto="Cmt do Bloco confirma recebimento" feito={passou('recebido')}
          detalhe={lote.recebidoEm ? `${lote.recebidoPor} às ${hora(lote.recebidoEm)}` : 'Depois disso, o Cmt do Bloco responde pelas encomendas no bloco'}>
          {lote.status === 'entregue' && ehCmtBloco && (
            <button className="btn primario" disabled={ocupado}
              onClick={() => executar(() => confirmarRecebimentoBloco(lote, pessoa), 'Recebimento confirmado.')}>
              Confirmar recebimento no bloco
            </button>
          )}
        </Passo>

        <div className="caixa-ok">
          <span className="r">MENSAGEM PARA O GRUPO</span>
          <span className="mensagem-texto">{mensagem}</span>
          <a className="btn verde" style={{ minHeight: 48 }} href={linkWhatsApp(mensagem)} target="_blank" rel="noreferrer">Compartilhar no WhatsApp</a>
        </div>
      </main>
    </>
  );
}

export default function Lote() {
  const { id } = useParams();
  return id === 'novo' ? <NovoLote /> : <AcompanharLote id={id} />;
}
