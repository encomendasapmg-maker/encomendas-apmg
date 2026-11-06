// Modo Guarda: aparelho exclusivo do posto, logado na Conta da Guarda.
// Nada é registrado sem o nome de quem está no posto (RF07).
import { createContext, useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { usePosto, useNomesUsados, assumirPosto, registrarAtividade } from '../../dados/posto';
import { MINUTOS_INATIVIDADE_POSTO } from '../../lib/constantes';
import { paraData, hora } from '../../lib/texto';
import { Modal, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';

const PostoContexto = createContext(null);
export const usePostoAtual = () => useContext(PostoContexto);

export function TrocarPosto({ aoFechar, atual }) {
  const [nome, setNome] = useState('');
  const [nomes] = useNomesUsados();
  const [executar, ocupado] = useAcao();
  const confirmar = async (valor) => {
    const ok = await executar(() => assumirPosto(valor), `${valor.trim()} no posto.`);
    if (ok) aoFechar?.();
  };
  return (
    <Modal titulo="Quem está no posto agora?" aoFechar={atual ? aoFechar : undefined}>
      <span className="muted">Graduação e nome de guerra. Tudo o que for registrado fica com este nome.</span>
      <form className="secao" onSubmit={(e) => { e.preventDefault(); confirmar(nome); }}>
        <label className="campo">No posto agora
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Sd. Silva" autoFocus required />
        </label>
        <button className="btn primario" disabled={ocupado || nome.trim().length < 3}>Assumir o posto</button>
      </form>
      {nomes?.length > 0 && (
        <div className="secao">
          <span className="rotulo">Nomes já usados</span>
          <div className="chips">
            {nomes.map((n) => (
              <button key={n.id} type="button" className="chip" onClick={() => confirmar(n.nome)} disabled={ocupado}>{n.nome}</button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function ConfirmarContinua({ posto, aoTrocar }) {
  const [executar] = useAcao();
  return (
    <Modal titulo="Mesma sentinela?">
      <span className="muted">O aparelho ficou um tempo sem uso. <b>{posto.nome}</b> continua no posto desde {hora(posto.desde)}?</span>
      <button className="btn primario" onClick={() => executar(async () => registrarAtividade())}>Sim, continuo</button>
      <button className="btn" onClick={aoTrocar}>Não, trocar</button>
    </Modal>
  );
}

export function GuardaLayout() {
  const { ehGuarda } = useSessao();
  const [posto, carregando] = usePosto();
  const [trocando, setTrocando] = useState(false);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // Toda interação conta como atividade (no máximo uma gravação a cada 5 min).
  useEffect(() => {
    let ultima = 0;
    const toque = () => {
      if (Date.now() - ultima > 5 * 60000) {
        ultima = Date.now();
        registrarAtividade();
      }
    };
    window.addEventListener('pointerdown', toque);
    return () => window.removeEventListener('pointerdown', toque);
  }, []);

  if (!ehGuarda) return <div className="centro">Esta área é só do aparelho do Corpo da Guarda.</div>;

  const ultima = paraData(posto?.ultimaAtividade);
  const inativo = posto?.nome && ultima && agora - ultima.getTime() > MINUTOS_INATIVIDADE_POSTO * 60000;
  const nome = posto?.nome || null;

  return (
    <PostoContexto.Provider value={{ posto, nome, trocar: () => setTrocando(true) }}>
      <div className="app">
        <Outlet />
      </div>
      {!carregando && (!nome || trocando) && <TrocarPosto atual={nome} aoFechar={() => setTrocando(false)} />}
      {nome && !trocando && inativo && <ConfirmarContinua posto={posto} aoTrocar={() => setTrocando(true)} />}
    </PostoContexto.Provider>
  );
}
