// Rotas do app. O modo aberto depende de quem entrou:
// Conta da Guarda → Modo Guarda; demais → Modo Cadete (+ Gestão se tiver função).
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useSessao } from './sessao';
import { Carregando } from './componentes';
import { Entrar, Cadastro } from './telas/Entrar';
import { GuardaLayout } from './telas/guarda/Guarda';
import InicioGuarda from './telas/guarda/Inicio';
import Receber from './telas/guarda/Receber';
import Delivery from './telas/guarda/Delivery';
import Entregar from './telas/guarda/Entregar';
import SaidaLote from './telas/guarda/SaidaLote';
import { CadeteLayout } from './telas/cadete/Cadete';
import Minhas from './telas/cadete/Minhas';
import Esperando from './telas/cadete/Esperando';
import Autorizar from './telas/cadete/Autorizar';
import Funcao from './telas/cadete/Funcao';
import Missoes from './telas/cadete/Missoes';
import Painel, { GestaoLayout } from './telas/gestao/Painel';
import Lote from './telas/gestao/Lote';
import Relatorios from './telas/gestao/Relatorios';
import Cadastros from './telas/gestao/Cadastros';

function SemAcesso({ texto }) {
  const { sair } = useSessao();
  return (
    <div className="app">
      <div className="centro" style={{ flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <span>{texto}</span>
        <button className="btn" onClick={sair}>Sair</button>
      </div>
    </div>
  );
}

function Rotas() {
  const { usuario, pessoa, carregando, ehGuarda } = useSessao();

  if (carregando) return <div className="app"><Carregando /></div>;

  if (!usuario) {
    return (
      <Routes>
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="*" element={<Entrar />} />
      </Routes>
    );
  }
  if (!pessoa) return <SemAcesso texto="Login sem cadastro no sistema. Se esta é a Conta da Guarda, peça ao administrador para concluir a configuração (veja o README)." />;
  if (!pessoa.ativo) return <SemAcesso texto="Cadastro inativo. Procure o administrador do sistema." />;

  const inicio = ehGuarda ? '/guarda' : '/cadete';
  return (
    <Routes>
      <Route path="/guarda" element={<GuardaLayout />}>
        <Route index element={<InicioGuarda />} />
        <Route path="receber" element={<Receber />} />
        <Route path="delivery" element={<Delivery />} />
        <Route path="entregar" element={<Entregar />} />
        <Route path="lote" element={<SaidaLote />} />
      </Route>
      <Route element={<CadeteLayout />}>
        <Route path="/cadete" element={<Minhas />} />
        <Route path="/cadete/esperando" element={<Esperando />} />
        <Route path="/cadete/autorizar" element={<Autorizar />} />
        <Route path="/cadete/funcao" element={<Funcao />} />
        <Route path="/cadete/missoes" element={<Missoes />} />
        <Route path="/gestao" element={<GestaoLayout />}>
          <Route index element={<Painel />} />
          <Route path="lote/:id" element={<Lote />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="cadastros" element={<Cadastros />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={inicio} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Rotas />
    </BrowserRouter>
  );
}
