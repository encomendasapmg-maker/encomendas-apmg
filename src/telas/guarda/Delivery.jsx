// Guarda · Delivery de comida (seção 5.2). O código de confirmação só
// aparece quando a sentinela toca no pedido, na chegada do entregador.
import { useState } from 'react';
import { getDoc } from 'firebase/firestore';
import { useDeliveriesEsperados, lerCodigo, receberDelivery } from '../../dados/pedidos';
import { registrarEncomenda } from '../../dados/encomendas';
import { usePessoasAtivas } from '../../dados/pessoas';
import { ref } from '../../dados/base';
import { MINUTOS_ALERTA_DELIVERY } from '../../lib/constantes';
import { hora, paraData, linkWhatsApp, tratamento } from '../../lib/texto';
import { Topo, BuscaPessoa, Icone, Modal, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';
import { usePostoAtual } from './Guarda';

async function celularDe(uid) {
  const snap = await getDoc(ref('contatos', uid)).catch(() => null);
  return snap?.exists() ? snap.data().celular : null;
}

function BotaoWhatsApp({ pessoa, mensagem }) {
  const [executar, ocupado] = useAcao();
  const abrir = () => executar(async () => {
    const cel = await celularDe(pessoa.id);
    const link = linkWhatsApp(mensagem, cel);
    const janela = window.open(link, '_blank');
    if (janela) janela.opener = null;
    else window.location.href = link;
  });
  return (
    <button type="button" className="btn verde-claro" onClick={abrir} disabled={ocupado}>
      <Icone nome="conversa" tamanho={20} /> Avisar pelo WhatsApp
    </button>
  );
}

function Recebido({ info, aoFechar }) {
  return (
    <Modal titulo="Delivery registrado" aoFechar={aoFechar}>
      <span className="muted">
        {info.nome} foi avisado com prioridade. Sem retirada em cerca de {MINUTOS_ALERTA_DELIVERY} min, o app lembra o cadete e alerta a sentinela.
      </span>
      <BotaoWhatsApp pessoa={info.pessoa} mensagem={`${info.nome}, seu delivery chegou e está no Corpo da Guarda (nº ${info.numeroInterno}). Retire o quanto antes.`} />
      <button className="btn primario" onClick={aoFechar}>Concluir</button>
    </Modal>
  );
}

export default function Delivery() {
  const { eu } = useSessao();
  const { nome: posto } = usePostoAtual();
  const [pedidos] = useDeliveriesEsperados();
  const [pessoas] = usePessoasAtivas();
  const [aberto, setAberto] = useState(null);
  const [codigo, setCodigo] = useState(null);
  const [avulso, setAvulso] = useState(false);
  const [destinoAvulso, setDestinoAvulso] = useState(null);
  const [recebido, setRecebido] = useState(null);
  const [executar, ocupado] = useAcao();

  const validos = (pedidos || []).filter((p) => !p.validade || paraData(p.validade) > new Date());
  const pessoaDe = (uid) => pessoas?.find((p) => p.id === uid);

  const abrir = async (pedido) => {
    setAberto(pedido.id);
    setCodigo(null);
    const c = await executar(() => lerCodigo(pedido));
    setCodigo(c ?? '');
  };

  const receber = async (pedido) => {
    const pessoa = pessoaDe(pedido.destinatarioUid);
    if (!pessoa) return executar(() => Promise.reject(new Error('Destinatário não encontrado no cadastro.')));
    const r = await executar(() => receberDelivery(pedido, pessoa, posto, eu));
    if (r) {
      setAberto(null);
      setCodigo(null);
      setRecebido({ ...r, nome: tratamento(pessoa), pessoa });
    }
  };

  const receberAvulso = async () => {
    const r = await executar(() =>
      registrarEncomenda(
        {
          destinatario: destinoAvulso,
          idTipo: 'sem_numero',
          descricao: 'Delivery sem aviso prévio',
          entregador: { id: 'delivery', nome: 'Entregador de delivery', empresa: 'Delivery' },
          local: 'Delivery · balcão',
          perecivel: true
        },
        posto,
        eu
      )
    );
    if (r) {
      setAvulso(false);
      setRecebido({ ...r, nome: tratamento(destinoAvulso), pessoa: destinoAvulso });
      setDestinoAvulso(null);
    }
  };

  return (
    <>
      <Topo titulo="Delivery de comida" sobre="Toque no pedido quando o entregador chegar" voltar={{ rotulo: 'Início', to: '/guarda' }} />
      <main className="conteudo">
        <span className="rotulo caps">Pedidos esperados</span>
        {validos.length === 0 && <div className="vazio">Nenhum delivery avisado pelos cadetes agora.</div>}
        {validos.map((p) => (
          aberto === p.id ? (
            <div key={p.id} className="cartao destaque" style={{ gap: 12 }}>
              <div className="linha-entre">
                <div className="secao" style={{ gap: 2 }}>
                  <span className="titulo">{p.destinatarioNome}</span>
                  <span className="pequeno">{p.restaurante} · avisou às {hora(p.criadoEm)}</span>
                </div>
                <span className="selo">{p.destinatarioSetor}</span>
              </div>
              {codigo === null ? (
                <span className="muted">Buscando o código…</span>
              ) : codigo ? (
                <div className="caixa-codigo">
                  <span className="r">CÓDIGO DE CONFIRMAÇÃO</span>
                  <span className="c">{codigo}</span>
                  <span className="pequeno" style={{ color: '#92400E' }}>Informe ao entregador · apagado após o uso</span>
                </div>
              ) : (
                <span className="muted">O cadete não deixou código: o entregador fala com ele pelo aplicativo de delivery.</span>
              )}
              <button className="btn primario" disabled={ocupado} onClick={() => receber(p)}>Registrar recebimento e avisar</button>
              <button className="btn neutro pequeno" onClick={() => { setAberto(null); setCodigo(null); }}>Não é este</button>
            </div>
          ) : (
            <div key={p.id} className="cartao" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="secao" style={{ gap: 2 }}>
                <span className="titulo">{p.destinatarioNome}</span>
                <span className="pequeno">{p.restaurante} · {p.temCodigo ? 'código informado' : 'sem código'}</span>
              </div>
              <button className="btn pequeno" onClick={() => abrir(p)}>Chegou</button>
            </div>
          )
        ))}

        <span className="rotulo caps" style={{ paddingTop: 6 }}>Pedido sem aviso prévio</span>
        <div className="cartao" style={{ gap: 10 }}>
          <span className="muted">Busque o destinatário e avise na hora. Sem código, o entregador fala com o cadete pelo app de delivery.</span>
          {avulso ? (
            <>
              <BuscaPessoa pessoas={pessoas} selecionada={destinoAvulso} aoSelecionar={setDestinoAvulso} autoFocus />
              <button className="btn primario" disabled={!destinoAvulso || ocupado} onClick={receberAvulso}>Registrar e avisar</button>
            </>
          ) : (
            <button className="btn neutro" onClick={() => setAvulso(true)}>Registrar delivery avulso</button>
          )}
        </div>
      </main>
      {recebido && <Recebido info={recebido} aoFechar={() => setRecebido(null)} />}
    </>
  );
}
