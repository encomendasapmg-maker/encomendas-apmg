// Gestão · Painel do serviço (RF18): quem está em cada função, volumes por
// situação, paradas há mais de 3 dias, pendências e deliveries aguardando.
import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { deleteDoc, updateDoc } from 'firebase/firestore';
import { useEncomendasAbertas, identificarDestinatario } from '../../dados/encomendas';
import { useFuncoes } from '../../dados/funcoes';
import { usePosto } from '../../dados/posto';
import { usePessoasAtivas } from '../../dados/pessoas';
import { useLotesAtivos } from '../../dados/lotes';
import { ref } from '../../dados/base';
import { FUNCOES, NOME_FUNCAO, SITUACAO, DIAS_PARADA, MINUTOS_ALERTA_DELIVERY } from '../../lib/constantes';
import { diasDesde, paraData, tratamento } from '../../lib/texto';
import { Topo, Contador, Modal, BuscaPessoa, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';

export function GestaoLayout() {
  const { ehGestor } = useSessao();
  if (!ehGestor) {
    return <div className="centro">A Gestão aparece para quem escolheu uma função ou tem perfil de Oficial de Dia/administrador.</div>;
  }
  return <Outlet />;
}

function Identificar({ encomenda, aoFechar }) {
  const { eu } = useSessao();
  const [pessoas] = usePessoasAtivas();
  const [pessoa, setPessoa] = useState(null);
  const [executar, ocupado] = useAcao();
  return (
    <Modal titulo={`Identificar nº ${encomenda.numeroInterno}`} aoFechar={aoFechar}>
      <span className="muted">Na etiqueta: “{encomenda.destinatarioNome}”. Confirme com o código de rastreio antes de identificar.</span>
      <BuscaPessoa pessoas={pessoas} selecionada={pessoa} aoSelecionar={setPessoa} autoFocus />
      <button className="btn primario" disabled={!pessoa || ocupado}
        onClick={async () => { if (await executar(() => identificarDestinatario(encomenda, pessoa, eu), 'Destinatário identificado e avisado.')) aoFechar(); }}>
        Identificar e avisar
      </button>
    </Modal>
  );
}

export default function Painel() {
  const { pessoa, funcao, ehOficial, ehAdmin, podeLote, sair } = useSessao();
  const [abertas] = useEncomendasAbertas();
  const [funcoes] = useFuncoes();
  const [posto] = usePosto();
  const [lotes] = useLotesAtivos();
  const [identificando, setIdentificando] = useState(null);
  const [executar] = useAcao();

  const lista = abertas || [];
  const naGuarda = lista.filter((e) => e.situacao === SITUACAO.NA_GUARDA);
  const salaTv = lista.filter((e) => e.situacao === SITUACAO.SALA_TV);
  const aIdentificar = lista.filter((e) => e.situacao === SITUACAO.A_IDENTIFICAR);
  const paradas = lista
    .filter((e) => [SITUACAO.NA_GUARDA, SITUACAO.A_IDENTIFICAR].includes(e.situacao) && diasDesde(e.chegada) > DIAS_PARADA)
    .sort((a, b) => paraData(a.chegada) - paraData(b.chegada));
  const deliveriesParados = naGuarda.filter(
    (e) => e.perecivel && Date.now() - (paraData(e.chegada)?.getTime() ?? Date.now()) > MINUTOS_ALERTA_DELIVERY * 60000
  );
  const pendenciasLote = naGuarda.filter((e) => e.pendenciaLote);
  const paraLote = naGuarda.filter((e) => e.setor === 'EsFO' && !e.perecivel && !e.loteId).length;
  const loteAtivo = lotes?.[0];
  const ocupante = (id) => funcoes?.find((f) => f.id === id);

  const retirarFuncao = (id) => executar(async () => {
    const f = ocupante(id);
    if (!f) return;
    await updateDoc(ref('pessoas', f.uid), { funcao: null, respondendoPor: null });
    await deleteDoc(ref('funcoes', id));
  }, 'Função liberada.');

  const papel = funcao ? NOME_FUNCAO[funcao] : ehAdmin ? 'Administrador' : 'Oficial de Dia';

  return (
    <>
      <Topo titulo="Painel do serviço" sobre={`Gestão · ${tratamento(pessoa)} como ${papel}`} />
      <main className="conteudo">
        <div className="cartao">
          <span className="rotulo caps">Em serviço agora</span>
          <div className="grade-2" style={{ gap: '10px 12px' }}>
            {FUNCOES.map((f) => {
              const o = ocupante(f.id);
              return (
                <div key={f.id} className="secao" style={{ gap: 2 }}>
                  <span className="pequeno">{f.nome}</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{o?.nome || '—'}</span>
                  {ehOficial && o && <button type="button" className="botao-texto" style={{ padding: '4px 0', fontSize: 12 }} onClick={() => retirarFuncao(f.id)}>retirar função</button>}
                </div>
              );
            })}
            <div className="secao" style={{ gap: 2 }}>
              <span className="pequeno">No posto</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{posto?.nome || '—'}</span>
            </div>
          </div>
        </div>

        <div className="grade-3">
          <Contador valor={abertas ? naGuarda.length : null} rotulo="na guarda" />
          <Contador valor={abertas ? salaTv.length : null} rotulo="na sala de TV" />
          <Contador valor={abertas ? aIdentificar.length : null} rotulo="a identificar" ambar={aIdentificar.length > 0} />
        </div>

        {deliveriesParados.length > 0 && (
          <div className="caixa-alerta">
            {deliveriesParados.length} delivery(s) na guarda há mais de {MINUTOS_ALERTA_DELIVERY} min: {deliveriesParados.map((e) => e.destinatarioNome).join(', ')}.
          </div>
        )}

        <div className="cartao">
          <span className="rotulo caps">Paradas há mais de {DIAS_PARADA} dias</span>
          {paradas.length === 0 && <span className="muted">Nenhuma.</span>}
          {paradas.slice(0, 10).map((e) => (
            <div key={e.id} className="linha-entre" style={{ fontSize: 14, borderBottom: '1px solid #E5E7EB', paddingBottom: 8 }}>
              <span>{e.numeroInterno} · {e.situacao === SITUACAO.A_IDENTIFICAR ? `“${e.destinatarioNome}” (a identificar)` : e.destinatarioNome}</span>
              <span style={{ color: '#92400E', fontWeight: 600 }}>{diasDesde(e.chegada)} dias</span>
            </div>
          ))}
        </div>

        {(aIdentificar.length > 0 || pendenciasLote.length > 0) && (
          <div className="cartao">
            <span className="rotulo caps">Pendências</span>
            {aIdentificar.map((e) => (
              <div key={e.id} className="linha-entre" style={{ fontSize: 14 }}>
                <span>{e.numeroInterno} · “{e.destinatarioNome}”</span>
                {podeLote && <button className="btn pequeno" onClick={() => setIdentificando(e)}>Identificar</button>}
              </div>
            ))}
            {pendenciasLote.map((e) => (
              <div key={e.id} className="linha-entre" style={{ fontSize: 14 }}>
                <span>{e.numeroInterno} · {e.destinatarioNome}</span>
                <span className="selo ambar">não localizado no lote</span>
              </div>
            ))}
          </div>
        )}

        <div className="acoes">
          {loteAtivo && <Link to={`/gestao/lote/${loteAtivo.id}`} className="btn primario">Acompanhar lote EsFO ({loteAtivo.itens?.length} volumes)</Link>}
          {podeLote && !loteAtivo && <Link to="/gestao/lote/novo" className="btn primario">Gerar lote EsFO ({paraLote} volumes)</Link>}
          <Link to="/gestao/relatorios" className="btn neutro" style={{ minHeight: 52 }}>Relatórios</Link>
          {ehAdmin && <Link to="/gestao/cadastros" className="btn neutro" style={{ minHeight: 52 }}>Cadastros</Link>}
        </div>
        <button className="botao-texto" style={{ color: '#4B5563' }} onClick={sair}>Sair do app</button>
      </main>
      {identificando && <Identificar encomenda={identificando} aoFechar={() => setIdentificando(null)} />}
    </>
  );
}
