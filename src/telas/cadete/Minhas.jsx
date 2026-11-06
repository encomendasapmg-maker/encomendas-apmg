// Cadete · Minhas encomendas (tela "Cadete" desenhada).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMinhasEncomendas, confirmarRetiradaSalaTV } from '../../dados/encomendas';
import { useMeusPedidos, cancelarPedido } from '../../dados/pedidos';
import { ativarNotificacoes, notificacoesDisponiveis, permissaoAtual } from '../../dados/notificacoes';
import { NOME_SITUACAO, NOME_FUNCAO, SITUACAO, PREFIXO_QR } from '../../lib/constantes';
import { tratamento, descricaoPessoa, quando } from '../../lib/texto';
import { Topo, Icone, Modal, ImagemQR, Carregando, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';


const COR_SELO = { na_guarda: '', sala_tv: 'ambar', em_lote: 'ambar', retirada: 'verde', a_identificar: 'cinza' };

function linhaIdentificacao(e) {
  if (e.idNumero) return `${e.idTipo === 'nf' ? 'NF' : e.idTipo === 'pedido' ? 'Pedido' : 'Rastreio'} ${e.idNumero}`;
  return e.descricao || '';
}

function CartaoEncomenda({ e, pessoa }) {
  const [executar, ocupado] = useAcao();
  return (
    <div className="cartao" style={{ opacity: e.situacao === SITUACAO.RETIRADA ? 0.85 : 1 }}>
      <div className="linha-entre">
        <span className={`selo ${COR_SELO[e.situacao] || ''}`}>{NOME_SITUACAO[e.situacao]?.toUpperCase()}</span>
        <span className="pequeno">{quando(e.retiradaEm || e.salaTvEm || e.chegada)}</span>
      </div>
      <span className="titulo">{e.transportadora || e.entregadorNome} · nº {e.numeroInterno}</span>
      {e.situacao === SITUACAO.NA_GUARDA && (
        <span className="muted">{linhaIdentificacao(e)} · retire no Corpo da Guarda a qualquer hora{e.perecivel ? '. É comida: retire logo!' : ''}</span>
      )}
      {e.situacao === SITUACAO.EM_LOTE && <span className="muted">A caminho da sala de TV do Bloco III.</span>}
      {e.situacao === SITUACAO.SALA_TV && (
        <button className="btn pequeno contorno-verde" disabled={ocupado}
          onClick={() => executar(() => confirmarRetiradaSalaTV(e, pessoa), 'Retirada confirmada.')}>
          Já retirei
        </button>
      )}
      {e.situacao === SITUACAO.RETIRADA && e.retiradaPor && (
        <span className="muted">
          {e.retiradaPor.tipo === 'terceiro' ? `Retirada por ${e.retiradaPor.nome}${e.retiradaPor.autorizacaoId ? ' (autorizado)' : ''}` : 'Retirada por você'}
        </span>
      )}
    </div>
  );
}

function AtivarAvisos({ uid }) {
  const [mostrar, setMostrar] = useState(false);
  const [executar, ocupado] = useAcao();
  useEffect(() => {
    notificacoesDisponiveis().then((ok) => setMostrar(ok && permissaoAtual() === 'default'));
  }, []);
  if (!mostrar) return null;
  return (
    <div className="cartao">
      <span className="titulo">Receber aviso no celular</span>
      <span className="muted">Seja avisado quando chegar encomenda, mesmo com o app fechado.</span>
      <button className="btn" disabled={ocupado}
        onClick={async () => { if (await executar(() => ativarNotificacoes(uid), 'Avisos ativados.')) setMostrar(false); }}>
        Ativar avisos
      </button>
    </div>
  );
}

export default function Minhas() {
  const { pessoa, funcao, sair } = useSessao();
  const [encomendas, carregando] = useMinhasEncomendas(pessoa?.id);
  const [pedidos] = useMeusPedidos(pessoa?.id);
  const [vendoQR, setVendoQR] = useState(false);
  const [executar] = useAcao();

  return (
    <>
      <Topo cadete titulo="Minhas encomendas"
        sobre={`${tratamento(pessoa)} · ${descricaoPessoa(pessoa)}`}
        direita={<Link to="/cadete/funcao" className="pilula-topo">Função: {funcao ? NOME_FUNCAO[funcao] : 'Nenhuma'} ▾</Link>}>
        <button className="btn" style={{ background: '#fff', borderColor: '#fff', minHeight: 52, marginTop: 4 }} onClick={() => setVendoQR(true)}>
          <Icone nome="qr" tamanho={22} /> Mostrar QR de retirada
        </button>
      </Topo>
      <main className="conteudo" style={{ gap: 12 }}>
        <AtivarAvisos uid={pessoa?.id} />
        {carregando && <Carregando />}
        {encomendas?.length === 0 && <div className="vazio">Nenhuma encomenda registrada para você ainda.</div>}
        {encomendas?.map((e) => <CartaoEncomenda key={e.id} e={e} pessoa={pessoa} />)}

        {pedidos?.length > 0 && (
          <section className="secao">
            <span className="rotulo caps">Avisos que você deixou na guarda</span>
            {pedidos.map((p) => (
              <div key={p.id} className="cartao" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="muted">{p.tipo === 'delivery' ? `Delivery · ${p.restaurante}` : `Rastreio ${p.rastreio}`}</span>
                <button className="btn pequeno neutro" onClick={() => executar(() => cancelarPedido(p), 'Aviso cancelado.')}>Cancelar</button>
              </div>
            ))}
          </section>
        )}

        <div className="grade-2" style={{ paddingTop: 4 }}>
          <Link to="/cadete/esperando" className="btn primario">Estou esperando</Link>
          <Link to="/cadete/autorizar" className="btn neutro" style={{ minHeight: 52 }}>Autorizar terceiro</Link>
        </div>
        <button className="botao-texto" style={{ color: '#4B5563' }} onClick={sair}>Sair do app</button>
      </main>
      {vendoQR && (
        <Modal titulo="QR de retirada" aoFechar={() => setVendoQR(false)}>
          <ImagemQR texto={`${PREFIXO_QR}${pessoa.id}`} rotulo={`QR de retirada de ${tratamento(pessoa)}`} />
          <span className="muted" style={{ textAlign: 'center' }}>{tratamento(pessoa)} · nº {pessoa.numeroCadete}<br />Mostre à sentinela no Corpo da Guarda.</span>
        </Modal>
      )}
    </>
  );
}
