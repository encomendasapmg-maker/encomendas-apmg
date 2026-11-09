// Gestão · Cadastros (só administrador): conferência dos cadastros recentes,
// desativação de cadastros indevidos, perfis fixos e passagem de ano.
import { useState } from 'react';
import { query, where } from 'firebase/firestore';
import { useCadastrosRecentes, definirAtivo, definirPerfil, gruposParaPromover, promoverGrupo, encerrarCHOE, usePessoasAtivas } from '../../dados/pessoas';
import { col, useAoVivo } from '../../dados/base';
import { PERFIS, NOME_GRUPO } from '../../lib/constantes';
import { tratamento, descricaoPessoa, quando } from '../../lib/texto';
import { Topo, Modal, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';

function rotuloGrupo(g) {
  if (g.turma.startsWith('1º ano')) return g.turma;
  return `${g.turma} · ${g.grupo ? `vindos da ${NOME_GRUPO[g.grupo]}` : 'sem turma de origem'}`;
}

const NOME_PERFIL = { cadete: 'Cadete', guarda: 'Conta da Guarda', oficial: 'Oficial de Dia', admin: 'Administrador' };

export default function Cadastros() {
  const { ehAdmin, pessoa: eu } = useSessao();
  const [recentes] = useCadastrosRecentes(60);
  const [ativos] = usePessoasAtivas();
  const [alertas] = useAoVivo(ehAdmin ? query(col('alertas'), where('resolvido', '==', false)) : null, [ehAdmin]);
  const [passagem, setPassagem] = useState(false);
  const [escolhido, setEscolhido] = useState(null);
  const [fimChoe, setFimChoe] = useState(false);
  const qtdChoe = (ativos || []).filter((p) => p.turma === 'CHOE' && p.perfil === 'cadete').length;
  const [executar, ocupado] = useAcao();

  if (!ehAdmin) return <div className="centro">Somente o administrador acessa os cadastros.</div>;

  return (
    <>
      <Topo titulo="Cadastros" sobre="Conferência posterior · sem aprovação prévia" voltar={{ rotulo: 'Painel', to: '/gestao' }} />
      <main className="conteudo">
        {alertas?.length > 0 && (
          <div className="caixa-alerta">
            {alertas.map((a) => <div key={a.id}>Tentativa de repetir o número de cadete {a.numeroCadete} ({a.email}) em {quando(a.em)}.</div>)}
          </div>
        )}
        <span className="rotulo caps">Cadastros recentes</span>
        {recentes?.map((p) => (
          <div key={p.id} className="cartao" style={{ opacity: p.ativo ? 1 : 0.6 }}>
            <div className="linha-entre">
              <span className="titulo">{tratamento(p)}</span>
              <span className={`selo ${p.ativo ? 'verde' : 'cinza'}`}>{p.ativo ? 'ativo' : 'inativo'}</span>
            </div>
            <span className="muted">{p.nomeCompleto} · nº {p.numeroCadete} · {descricaoPessoa(p)} · {quando(p.criadoEm)}</span>
            <div className="linha-entre">
              <label className="campo" style={{ flex: 1 }}>
                <select value={p.perfil} disabled={p.id === eu.id || ocupado}
                  onChange={(e) => executar(() => definirPerfil(p.id, e.target.value), 'Perfil atualizado.')}>
                  {PERFIS.map((x) => <option key={x} value={x}>{NOME_PERFIL[x]}</option>)}
                </select>
              </label>
              {p.id !== eu.id && (
                <button className={`btn pequeno ${p.ativo ? 'perigo' : ''}`} disabled={ocupado}
                  onClick={() => executar(() => definirAtivo(p.id, !p.ativo), p.ativo ? 'Cadastro desativado.' : 'Cadastro reativado.')}>
                  {p.ativo ? 'Desativar' : 'Reativar'}
                </button>
              )}
            </div>
          </div>
        ))}
        <button className="btn neutro" onClick={() => { setEscolhido(null); setPassagem(true); }}>Promover turma do CFO</button>
        <button className="btn neutro" onClick={() => setFimChoe(true)}>Encerrar o CHOE ({qtdChoe} Al. Of. ativo(s))</button>
      </main>
      {passagem && (
        <Modal titulo="Promover turma do CFO" aoFechar={() => setPassagem(false)}>
          <span className="muted">As turmas do 1º ano andam com cerca de 6 meses de diferença: promova cada uma no seu momento. O 3º ano promovido é inativado (formados não são apagados). O CHOE não entra aqui.</span>
          <div className="opcoes">
            {gruposParaPromover(ativos || []).map((g) => (
              <button key={g.chave} type="button" aria-pressed={escolhido?.chave === g.chave} onClick={() => setEscolhido(g)}>
                {rotuloGrupo(g)} → {g.destino === 'formado' ? 'formatura' : g.destino}
                <span className="extra">{g.pessoas.length} cadete(s)</span>
              </button>
            ))}
          </div>
          <button className="btn perigo" disabled={ocupado || !escolhido}
            onClick={async () => { if (await executar(() => promoverGrupo(escolhido), (n) => `${n} cadastro(s) atualizado(s).`)) setPassagem(false); }}>
            {escolhido ? `Confirmar: ${rotuloGrupo(escolhido)}` : 'Escolha a turma'}
          </button>
        </Modal>
      )}
      {fimChoe && (
        <Modal titulo="Encerrar o CHOE" aoFechar={() => setFimChoe(false)}>
          <span className="muted">Os {qtdChoe} Aluno(s) Oficial(is) ativo(s) do CHOE serão inativados ao fim do curso. Os registros não são apagados.</span>
          <button className="btn perigo" disabled={ocupado || qtdChoe === 0}
            onClick={async () => { if (await executar(() => encerrarCHOE(ativos || []), (n) => `${n} cadastro(s) inativado(s).`)) setFimChoe(false); }}>
            Confirmar encerramento
          </button>
        </Modal>
      )}
    </>
  );
}
