// Modo Cadete (celular de cada um) com a aba Gestão para quem tem função ou perfil fixo.
import { NavLink, Outlet } from 'react-router-dom';
import { Icone } from '../../componentes';
import { useSessao } from '../../sessao';
import { useLotesAtivos } from '../../dados/lotes';

export function CadeteLayout() {
  const { ehGestor, pessoa } = useSessao();
  const [lotes] = useLotesAtivos();
  const missoes = (lotes || []).filter(
    (l) => ['aberto', 'separando'].includes(l.status) || (l.executorUid === pessoa?.id && l.status === 'saiu')
  ).length;
  return (
    <div className="app">
      <Outlet />
      <nav className="nav-inferior" aria-label="Navegação">
        <NavLink to="/cadete" end><Icone nome="caixa" tamanho={22} />Encomendas</NavLink>
        <NavLink to="/cadete/missoes"><Icone nome="missao" tamanho={22} />Missões{missoes ? ` (${missoes})` : ''}</NavLink>
        {ehGestor && <NavLink to="/gestao"><Icone nome="painel" tamanho={22} />Gestão</NavLink>}
      </nav>
    </div>
  );
}
