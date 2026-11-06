// Guarda · Entregar (seção 5.3): QR do cadete ou busca pelo nome; o próprio
// ou um terceiro retira, e a sentinela confirma no aparelho da guarda.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePessoasAtivas } from '../../dados/pessoas';
import { encomendasNaGuardaDe, entregarNaGuarda } from '../../dados/encomendas';
import { autorizadosDe } from '../../dados/autorizacoes';
import { tratamento, descricaoPessoa } from '../../lib/texto';
import { PREFIXO_QR } from '../../lib/constantes';
import { Topo, BuscaPessoa, LeitorCodigo, Segmentado, useAcao, useToast } from '../../componentes';
import { useSessao } from '../../sessao';
import { usePostoAtual } from './Guarda';



export default function Entregar() {
  const { eu } = useSessao();
  const { nome: posto } = usePostoAtual();
  const navegar = useNavigate();
  const toast = useToast();
  const [pessoas] = usePessoasAtivas();
  const [modo, setModo] = useState(null);
  const [pessoa, setPessoa] = useState(null);
  const [encomendas, setEncomendas] = useState(null);
  const [marcadas, setMarcadas] = useState(new Set());
  const [quem, setQuem] = useState('proprio');
  const [autorizados, setAutorizados] = useState([]);
  const [terceiro, setTerceiro] = useState({ nome: '', numeroCadete: '', documento: '', autorizacaoId: null });
  const [executar, ocupado] = useAcao();

  useEffect(() => {
    if (!pessoa) return;
    setEncomendas(null);
    encomendasNaGuardaDe(pessoa.id).then((lista) => {
      setEncomendas(lista);
      setMarcadas(new Set(lista.map((e) => e.id)));
    });
    autorizadosDe(pessoa.id).then(setAutorizados).catch(() => setAutorizados([]));
  }, [pessoa]);

  const aoLerQR = (texto) => {
    setModo(null);
    const uid = texto.startsWith(PREFIXO_QR) ? texto.slice(PREFIXO_QR.length) : null;
    const p = uid && pessoas?.find((x) => x.id === uid);
    if (p) setPessoa(p);
    else toast('QR não reconhecido. Busque pelo nome.', 'erro');
  };

  const alternar = (id) => {
    const s = new Set(marcadas);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setMarcadas(s);
  };

  const confirmar = async () => {
    const lista = encomendas.filter((e) => marcadas.has(e.id));
    const retiradoPor = quem === 'proprio'
      ? { tipo: 'proprio', nome: tratamento(pessoa), numeroCadete: pessoa.numeroCadete }
      : { tipo: 'terceiro', ...terceiro };
    const ok = await executar(() => entregarNaGuarda(lista, retiradoPor, posto, eu), `${lista.length} encomenda(s) entregue(s).`);
    if (ok) navegar('/guarda');
  };

  return (
    <>
      <Topo titulo="Entregar encomenda" voltar={{ rotulo: 'Início', to: '/guarda' }} />
      <main className="conteudo">
        <div className="grade-2">
          <button className="btn primario" onClick={() => setModo('qr')}>Ler QR do cadete</button>
          <button className="btn neutro" style={{ minHeight: 52 }} onClick={() => { setModo('busca'); setPessoa(null); }}>Buscar nome</button>
        </div>

        {modo === 'busca' && !pessoa && (
          <BuscaPessoa pessoas={pessoas} selecionada={null} aoSelecionar={(p) => { setPessoa(p); setModo(null); }} autoFocus />
        )}

        {pessoa && (
          <div className="cartao" style={{ gap: 12 }}>
            <div className="linha-entre">
              <span style={{ fontSize: 18, fontWeight: 600 }}>{tratamento(pessoa)}</span>
              <span className="selo">{descricaoPessoa(pessoa)}</span>
            </div>
            {encomendas === null && <span className="muted">Buscando…</span>}
            {encomendas?.length === 0 && <span className="muted">Nenhuma encomenda na guarda para esta pessoa.</span>}
            {encomendas?.length > 0 && <span className="pequeno">{encomendas.length} encomenda(s) na guarda</span>}
            {encomendas?.map((e) => (
              <label key={e.id} className="item-check">
                <input type="checkbox" checked={marcadas.has(e.id)} onChange={() => alternar(e.id)} />
                <span>
                  <span className="t">{e.numeroInterno} · {e.transportadora || e.entregadorNome}{e.perecivel ? ' · delivery' : ''}</span>
                  <span className="s">{e.idNumero ? `${e.idTipo === 'nf' ? 'NF' : e.idTipo === 'pedido' ? 'Pedido' : 'Rastreio'} ${e.idNumero}` : e.descricao} · {e.local}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {encomendas?.length > 0 && (
          <section className="secao">
            <span className="rotulo caps">Quem está retirando?</span>
            <Segmentado rotulo="Quem retira" opcoes={[{ id: 'proprio', nome: 'O próprio' }, { id: 'terceiro', nome: 'Terceiro' }]} valor={quem} aoMudar={setQuem} />
            {quem === 'terceiro' && (
              <>
                {autorizados.length > 0 && (
                  <div className="opcoes">
                    {autorizados.map((a) => (
                      <button key={a.id} type="button" aria-pressed={terceiro.autorizacaoId === a.id}
                        onClick={() => setTerceiro({ nome: a.autorizadoNome, numeroCadete: a.autorizadoNumero, documento: '', autorizacaoId: a.id })}>
                        {a.autorizadoNome}<span className="extra">autorizado no app</span>
                      </button>
                    ))}
                  </div>
                )}
                <label className="campo">Nome de guerra de quem retira
                  <input value={terceiro.nome} onChange={(e) => setTerceiro({ ...terceiro, nome: e.target.value, autorizacaoId: null })} />
                </label>
                <label className="campo">Número do cadete
                  <input value={terceiro.numeroCadete} onChange={(e) => setTerceiro({ ...terceiro, numeroCadete: e.target.value, autorizacaoId: null })} inputMode="numeric" />
                </label>
                <label className="campo">Documento (opcional, se não for cadete)
                  <input value={terceiro.documento} onChange={(e) => setTerceiro({ ...terceiro, documento: e.target.value })} inputMode="numeric" />
                </label>
                <span className="pequeno">Terceiro: autorizado no app pelo destinatário, ou nome e número de quem retira. Documento aparece mascarado.</span>
              </>
            )}
            <button className="btn verde" style={{ marginTop: 8 }} disabled={ocupado || marcadas.size === 0 || (quem === 'terceiro' && !terceiro.nome.trim())} onClick={confirmar}>
              Confirmar entrega · {posto}
            </button>
          </section>
        )}
      </main>
      {modo === 'qr' && <LeitorCodigo aoLer={aoLerQR} aoFechar={() => setModo(null)} titulo="Aponte para o QR do cadete" />}
    </>
  );
}
