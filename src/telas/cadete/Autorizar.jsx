// Cadete · Autorizar terceiro (RF12): um colega pode retirar por você.
import { useState } from 'react';
import { usePessoasAtivas } from '../../dados/pessoas';
import { useMinhasAutorizacoes, autorizar, encerrarAutorizacao } from '../../dados/autorizacoes';
import { tratamento } from '../../lib/texto';
import { Topo, BuscaPessoa, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';

export default function Autorizar() {
  const { pessoa } = useSessao();
  const [pessoas] = usePessoasAtivas();
  const [autorizacoes] = useMinhasAutorizacoes(pessoa?.id);
  const [colega, setColega] = useState(null);
  const [executar, ocupado] = useAcao();
  const outros = (pessoas || []).filter((p) => p.id !== pessoa?.id && p.perfil === 'cadete');

  return (
    <>
      <Topo cadete titulo="Autorizar terceiro" sobre="Quem pode retirar suas encomendas na guarda" voltar={{ rotulo: 'Minhas encomendas', to: '/cadete' }} />
      <main className="conteudo">
        <BuscaPessoa pessoas={outros} selecionada={colega} aoSelecionar={setColega} rotulo="Buscar colega" />
        <button className="btn primario" disabled={!colega || ocupado}
          onClick={async () => { if (await executar(() => autorizar(pessoa, colega), `${tratamento(colega)} autorizado.`)) setColega(null); }}>
          Autorizar
        </button>
        <section className="secao">
          <span className="rotulo caps">Autorizados agora</span>
          {autorizacoes?.length === 0 && <div className="vazio">Ninguém autorizado. Sem autorização, a sentinela registra nome e número de quem retirar.</div>}
          {autorizacoes?.map((a) => (
            <div key={a.id} className="cartao" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="titulo">{a.autorizadoNome}</span>
              <button className="btn pequeno neutro" onClick={() => executar(() => encerrarAutorizacao(a), 'Autorização encerrada.')}>Encerrar</button>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
