// Cadete · Escolher função (RF22). Aberta a todos; vale até a troca ou a
// passagem de serviço. Se a função estiver ocupada, pergunta antes de assumir.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFuncoes, escolherFuncao } from '../../dados/funcoes';
import { FUNCOES, FUNCOES_LOTE, NOME_FUNCAO } from '../../lib/constantes';
import { quando } from '../../lib/texto';
import { Topo, Modal, Chips, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';

export default function Funcao() {
  const { pessoa } = useSessao();
  const navegar = useNavigate();
  const [funcoes] = useFuncoes();
  const [confirmando, setConfirmando] = useState(null);
  const [respondendoPor, setRespondendoPor] = useState('cmt_guarda');
  const [executar, ocupado] = useAcao();

  const ocupante = (id) => funcoes?.find((f) => f.id === id);

  const escolher = async (id) => {
    const ok = await executar(
      () => escolherFuncao(pessoa, id, { respondendoPor: id === 'respondente' ? respondendoPor : null }),
      id ? `Você está como ${NOME_FUNCAO[id]}.` : 'Sem função.'
    );
    if (ok) navegar('/cadete');
  };

  const tocar = (id) => {
    const atual = id && ocupante(id);
    if (atual && atual.uid !== pessoa.id) setConfirmando({ id, atual });
    else if (id === 'respondente') setConfirmando({ id, atual: null });
    else escolher(id);
  };

  return (
    <>
      <Topo cadete titulo="Minha função agora" sobre="Escolha só a função para a qual foi designado" voltar={{ rotulo: 'Minhas encomendas', to: '/cadete' }} />
      <main className="conteudo">
        <div className="opcoes">
          {FUNCOES.map((f) => {
            const atual = ocupante(f.id);
            return (
              <button key={f.id} type="button" aria-pressed={pessoa?.funcao === f.id} onClick={() => tocar(f.id)} disabled={ocupado}>
                {f.nome}
                <span className="extra">{atual ? `${atual.uid === pessoa?.id ? 'você' : atual.nome} · desde ${quando(atual.desde)}` : 'livre'}</span>
              </button>
            );
          })}
          <button type="button" aria-pressed={!pessoa?.funcao} onClick={() => tocar(null)} disabled={ocupado}>
            Nenhuma<span className="extra">só as minhas encomendas</span>
          </button>
        </div>
        <span className="muted">Toda assunção fica registrada e o painel mostra quem está em cada função.</span>
      </main>
      {confirmando && (
        <Modal titulo={NOME_FUNCAO[confirmando.id]} aoFechar={() => setConfirmando(null)}>
          {confirmando.atual && (
            <span className="muted"><b>{confirmando.atual.nome}</b> está nesta função. Você está assumindo no lugar dele? Ele será avisado.</span>
          )}
          {confirmando.id === 'respondente' && (
            <div className="secao">
              <span className="rotulo">Respondendo por qual função?</span>
              <Chips rotulo="Respondendo por" opcoes={FUNCOES_LOTE.filter((f) => f !== 'respondente').map((f) => ({ id: f, nome: NOME_FUNCAO[f] }))}
                valor={respondendoPor} aoMudar={setRespondendoPor} />
            </div>
          )}
          <button className="btn primario" disabled={ocupado} onClick={() => { setConfirmando(null); escolher(confirmando.id); }}>Assumir a função</button>
        </Modal>
      )}
    </>
  );
}
