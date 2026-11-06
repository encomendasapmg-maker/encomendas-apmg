// Guarda · Receber encomenda (seção 5.1). Meta: menos de 1 minuto, sem fotos.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePessoasAtivas } from '../../dados/pessoas';
import {
  registrarEncomenda, procurarDuplicada, procurarPedidoEsperado, useEntregadores, prepararEntregador, localSugerido
} from '../../dados/encomendas';
import { TIPOS_ID } from '../../lib/constantes';
import { interpretarCodigo, numeroDaChaveNF, tratamento, dataHora } from '../../lib/texto';
import { Topo, Chips, BuscaPessoa, LeitorCodigo, Icone, Modal, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';
import { usePostoAtual } from './Guarda';
import { writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';

const VAZIO = { idTipo: 'rastreio', idNumero: '', chaveNF: null, descricao: '', destinatario: null, nomeInformado: '', semCadastro: false, local: '' };

function NovoEntregador({ aoSalvar, aoFechar }) {
  const [f, setF] = useState({ nome: '', empresa: '', documento: '' });
  return (
    <Modal titulo="Novo entregador" aoFechar={aoFechar}>
      <label className="campo">Nome<input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoFocus /></label>
      <label className="campo">Empresa (Correios, Mercado Livre, Shopee…)<input value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value })} /></label>
      <label className="campo">Documento (opcional, aparece mascarado)<input value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} inputMode="numeric" /></label>
      <button className="btn primario" disabled={!f.nome.trim()} onClick={() => aoSalvar(f)}>Usar este entregador</button>
    </Modal>
  );
}

export default function Receber() {
  const { eu } = useSessao();
  const { nome: posto } = usePostoAtual();
  const navegar = useNavigate();
  const [pessoas] = usePessoasAtivas();
  const [entregadores] = useEntregadores();
  const [f, setF] = useState(VAZIO);
  const [entregador, setEntregador] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [novoEntregador, setNovoEntregador] = useState(false);
  const [alerta, setAlerta] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [executar, ocupado] = useAcao();

  const local = f.local || localSugerido(f.destinatario, false);
  const muda = (campos) => setF((atual) => ({ ...atual, ...campos }));

  const conferirNumero = async (numero) => {
    setAlerta(null);
    if (!numero) return;
    const [dup, esperado] = await Promise.all([
      procurarDuplicada(numero).catch(() => null),
      procurarPedidoEsperado(numero).catch(() => null)
    ]);
    if (dup) setAlerta(`Possível duplicidade: o nº ${numero} já foi registrado (${dup.destinatarioNome}, ${dataHora(dup.chegada)}).`);
    if (esperado && pessoas) {
      const p = pessoas.find((x) => x.id === esperado.destinatarioUid);
      if (p) muda({ destinatario: p, pedidoEsperadoId: esperado.id, semCadastro: false });
    }
  };

  const aoLer = (texto) => {
    setLendo(false);
    const lido = interpretarCodigo(texto);
    muda({ idTipo: lido.tipo, idNumero: lido.numero, chaveNF: lido.chave || null });
    conferirNumero(lido.numero);
  };

  const escolherEntregador = (id) => {
    if (id === 'novo') return setNovoEntregador(true);
    const e = entregadores?.find((x) => x.id === id);
    if (e) setEntregador({ id: e.id, nome: e.nome, empresa: e.empresa, docMascarado: e.docMascarado });
  };

  const opcoesEntregador = useMemo(() => {
    const lista = (entregadores || [])
      .filter((e) => e.id !== 'delivery')
      .map((e) => ({ id: e.id, nome: e.empresa ? `${e.empresa} · ${e.nome}` : e.nome }));
    if (entregador && !lista.some((o) => o.id === entregador.id)) {
      lista.unshift({ id: entregador.id, nome: entregador.empresa ? `${entregador.empresa} · ${entregador.nome}` : entregador.nome });
    }
    return [...lista, { id: 'novo', nome: '+ Novo' }];
  }, [entregadores, entregador]);

  const salvar = async (outra) => {
    const r = await executar(async () => {
      // Entregador novo é gravado junto (entregadores frequentes ficam salvos).
      let ent = entregador;
      if (ent?.novo) {
        const b = writeBatch(db);
        const id = prepararEntregador(b, ent);
        b.commit().catch((e) => console.error(e));
        ent = { id, nome: ent.nome, empresa: ent.empresa };
        setEntregador(ent);
      }
      return registrarEncomenda(
        {
          ...f,
          idNumero: f.idTipo === 'sem_numero' ? null : f.idNumero,
          nomeInformado: f.semCadastro ? f.nomeInformado : '',
          destinatario: f.semCadastro ? null : f.destinatario,
          entregador: ent,
          local
        },
        posto,
        eu
      );
    });
    if (!r) return;
    setResultado({ ...r, nome: f.semCadastro ? f.nomeInformado : tratamento(f.destinatario), outra });
  };

  const fecharResultado = () => {
    const outra = resultado?.outra;
    setResultado(null);
    setAlerta(null);
    setF(VAZIO);
    if (!outra) navegar('/guarda');
  };

  const podeSalvar = posto && entregador && (f.semCadastro ? f.nomeInformado.trim() : f.destinatario)
    && (f.idTipo === 'sem_numero' ? f.descricao.trim() : f.idNumero.trim());

  return (
    <>
      <Topo titulo="Receber encomenda" sobre={`No posto: ${posto || '—'}`} voltar={{ rotulo: 'Início', to: '/guarda' }} />
      <main className="conteudo">
        <section className="secao">
          <span className="rotulo">1 · Identificação da encomenda</span>
          <button type="button" className="btn tracejado" onClick={() => setLendo(true)}>
            <Icone nome="codigo" tamanho={22} /> Ler código com a câmera
          </button>
          <Chips redondo rotulo="Tipo de identificação" opcoes={TIPOS_ID} valor={f.idTipo} aoMudar={(idTipo) => muda({ idTipo })} />
          {f.idTipo === 'sem_numero' ? (
            <label className="campo">Descrição curta
              <input value={f.descricao} onChange={(e) => muda({ descricao: e.target.value })} placeholder="Ex.: caixa parda – Loja X" />
            </label>
          ) : (
            <label className="campo">{f.idTipo === 'nf' ? 'Número da nota (ou chave de 44 dígitos)' : 'Número lido'}
              <input value={f.idNumero} inputMode={f.idTipo === 'nf' ? 'numeric' : 'text'}
                onChange={(e) => {
                  const v = e.target.value;
                  const nf = f.idTipo === 'nf' ? numeroDaChaveNF(v) : null;
                  muda(nf ? { idNumero: nf, chaveNF: v.replace(/\D/g, '') } : { idNumero: v });
                }}
                onBlur={() => conferirNumero(f.idNumero.trim().toUpperCase())} />
            </label>
          )}
          {alerta && <div className="caixa-alerta">{alerta}</div>}
        </section>

        <section className="secao">
          <span className="rotulo">2 · Destinatário</span>
          {f.semCadastro ? (
            <>
              <label className="campo">Nome como está na etiqueta
                <input value={f.nomeInformado} onChange={(e) => muda({ nomeInformado: e.target.value })} />
              </label>
              <span className="pequeno">Fica como “Setor a identificar”, guardada em local separado.</span>
              <button type="button" className="botao-texto" onClick={() => muda({ semCadastro: false })}>Voltar a buscar no cadastro</button>
            </>
          ) : (
            <>
              <BuscaPessoa pessoas={pessoas} selecionada={f.destinatario} aoSelecionar={(p) => muda({ destinatario: p, local: '' })} rotulo="Nome, nome de guerra ou número do cadete" />
              <button type="button" className="botao-texto" onClick={() => muda({ semCadastro: true, destinatario: null })}>Não encontrei no cadastro</button>
            </>
          )}
        </section>

        <section className="secao">
          <span className="rotulo">3 · Entregador</span>
          <Chips rotulo="Entregador" opcoes={opcoesEntregador} valor={entregador?.id} aoMudar={escolherEntregador} />
          {entregador?.docMascarado && <span className="pequeno">Documento: {entregador.docMascarado}</span>}
        </section>

        <section className="secao">
          <span className="rotulo">4 · Local de guarda</span>
          <label className="campo">Local
            <input value={local} onChange={(e) => muda({ local: e.target.value })} />
          </label>
          <span className="pequeno">O número interno aparece ao salvar, para escrever no volume.</span>
        </section>

        <div className="acoes">
          <button className="btn primario" disabled={!podeSalvar || ocupado} onClick={() => salvar(false)}>Salvar e avisar o cadete</button>
          <button className="btn" disabled={!podeSalvar || ocupado} onClick={() => salvar(true)}>Salvar e registrar outra</button>
        </div>
      </main>

      {lendo && <LeitorCodigo aoLer={aoLer} aoFechar={() => setLendo(false)} titulo="Aponte para o código da etiqueta" />}
      {novoEntregador && (
        <NovoEntregador
          aoFechar={() => setNovoEntregador(false)}
          aoSalvar={(e) => {
            setEntregador({ id: `novo-${Date.now()}`, ...e, novo: true });
            setNovoEntregador(false);
          }}
        />
      )}
      {resultado && (
        <Modal titulo="Encomenda registrada" aoFechar={fecharResultado}>
          <div className="grade-2">
            <div className="contador"><span>Escreva no volume</span><b className="numero-volume">{resultado.numeroInterno}</b></div>
            <div className="contador"><span>Guardar em</span><b style={{ fontSize: 16 }}>{resultado.local}</b></div>
          </div>
          <span className="muted">
            {resultado.situacao === 'a_identificar'
              ? `“${resultado.nome}” ficou como setor a identificar.`
              : `${resultado.nome} foi avisado.`}
            {resultado.status === 'no_aparelho' && ' Sem internet: o registro está salvo no aparelho e será enviado quando a conexão voltar.'}
          </span>
          <button className="btn primario" onClick={fecharResultado}>{resultado.outra ? 'Registrar a próxima' : 'Concluir'}</button>
        </Modal>
      )}
    </>
  );
}
