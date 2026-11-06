// Guarda · Início (tela "Main" desenhada).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEncomendasAbertas } from '../../dados/encomendas';
import { useDeliveriesEsperados } from '../../dados/pedidos';
import { useLotesAtivos } from '../../dados/lotes';
import { useContingencia, iniciarContingencia, encerrarContingencia } from '../../dados/posto';
import { SITUACAO } from '../../lib/constantes';
import { hora, dataHora } from '../../lib/texto';
import { Topo, Contador, Icone, Modal, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';
import { usePostoAtual } from './Guarda';

function Contingencia({ aoFechar, ativa, nomePosto }) {
  const [motivo, setMotivo] = useState('');
  const [executar, ocupado] = useAcao();
  const iniciar = async () => {
    const ok = await executar(() => iniciarContingencia(nomePosto, motivo), 'Contingência iniciada: use o livro físico.');
    if (ok) aoFechar();
  };
  const encerrar = async () => {
    const ok = await executar(() => encerrarContingencia(ativa, nomePosto), 'Contingência encerrada.');
    if (ok) aoFechar();
  };
  return (
    <Modal titulo="Contingência (livro físico)" aoFechar={aoFechar}>
      {ativa?.ativa ? (
        <>
          <span className="muted">Livro físico em uso desde {dataHora(ativa.desde)}. As movimentações desse período ficam só no livro e não são lançadas no app.</span>
          <button className="btn primario" onClick={encerrar} disabled={ocupado}>Encerrar contingência e voltar ao app</button>
        </>
      ) : (
        <>
          <span className="muted">Use quando o app não puder ser usado. O app só marca o início e o fim; o que for anotado no livro não é lançado depois.</span>
          <label className="campo">Motivo (opcional)
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: sem internet, aparelho sem bateria" />
          </label>
          <button className="btn perigo" onClick={iniciar} disabled={ocupado}>Iniciar contingência</button>
        </>
      )}
    </Modal>
  );
}

export default function Inicio() {
  const { sair } = useSessao();
  const { posto, nome, trocar } = usePostoAtual();
  const [abertas] = useEncomendasAbertas();
  const [deliveries] = useDeliveriesEsperados();
  const [lotes] = useLotesAtivos();
  const [contingencia] = useContingencia();
  const [vendoContingencia, setVendoContingencia] = useState(false);

  const naGuarda = abertas?.filter((e) => e.situacao === SITUACAO.NA_GUARDA).length;
  const aIdentificar = abertas?.filter((e) => e.situacao === SITUACAO.A_IDENTIFICAR).length;
  const qtdDelivery = deliveries?.length ?? 0;
  const loteParaSair = lotes?.find((l) => l.status === 'separando' || l.status === 'aberto');

  return (
    <>
      <Topo titulo="Encomendas" sobre="Corpo da Guarda · APMG" grande />
      <main className="conteudo">
        {contingencia?.ativa && (
          <div className="caixa-alerta">
            <b>Contingência em andamento.</b> Livro físico em uso desde {dataHora(contingencia.desde)}.{' '}
            <button type="button" className="botao-texto" onClick={() => setVendoContingencia(true)}>Encerrar</button>
          </div>
        )}
        <div className="cartao" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="secao" style={{ gap: 2 }}>
            <span className="rotulo caps">No posto agora</span>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{nome || '—'}</span>
            {posto?.desde && <span className="pequeno">desde {hora(posto.desde)}</span>}
          </div>
          <button type="button" className="btn pequeno" onClick={trocar}>Trocar</button>
        </div>

        <div className="grade-3">
          <Contador valor={naGuarda} rotulo="sob guarda" />
          <Contador valor={qtdDelivery} rotulo="delivery esperado" ambar={qtdDelivery > 0} />
          <Contador valor={aIdentificar} rotulo="a identificar" ambar={aIdentificar > 0} />
        </div>

        <nav className="acoes" aria-label="Ações da guarda">
          <Link to="/guarda/receber" className="acao principal">
            <Icone nome="caixa" tamanho={28} />
            <span><span className="t">Receber encomenda</span><span className="s">ler etiqueta, nome, local</span></span>
          </Link>
          <Link to="/guarda/delivery" className="acao">
            <Icone nome="comida" tamanho={26} cor="#B45309" />
            <span>
              <span className="t">Delivery de comida</span>
              <span className="s">{qtdDelivery ? `${qtdDelivery} pedido(s) esperado(s) pelos cadetes` : 'nenhum pedido esperado'}</span>
            </span>
          </Link>
          <Link to="/guarda/entregar" className="acao">
            <Icone nome="qr" tamanho={26} cor="#1D4E89" />
            <span><span className="t">Entregar</span><span className="s">QR do cadete ou busca pelo nome</span></span>
          </Link>
          <Link to="/guarda/lote" className="acao">
            <Icone nome="caminhao" tamanho={26} cor="#1D4E89" />
            <span>
              <span className="t">Saída de lote EsFO</span>
              <span className="s">{loteParaSair ? `lote com ${loteParaSair.executorNome || 'executor a definir'}` : 'confirmar entrega ao executor'}</span>
            </span>
          </Link>
        </nav>

        <div className="linha-entre" style={{ marginTop: 'auto' }}>
          <button type="button" className="botao-texto" onClick={() => setVendoContingencia(true)}>
            {contingencia?.ativa ? 'Encerrar contingência' : 'Registrar contingência (livro)'}
          </button>
          <button type="button" className="botao-texto" onClick={sair} style={{ color: '#4B5563', fontSize: 12 }}>Conta da Guarda · sair</button>
        </div>
      </main>
      {vendoContingencia && <Contingencia ativa={contingencia} nomePosto={nome} aoFechar={() => setVendoContingencia(false)} />}
    </>
  );
}
