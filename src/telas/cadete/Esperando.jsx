// Cadete · Estou esperando (RF09): rastreio da compra ou delivery com código.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { avisarEsperando } from '../../dados/pedidos';
import { Topo, Segmentado, Icone, useAcao } from '../../componentes';
import { useSessao } from '../../sessao';

export default function Esperando() {
  const { pessoa } = useSessao();
  const navegar = useNavigate();
  const [tipo, setTipo] = useState('delivery');
  const [f, setF] = useState({ rastreio: '', restaurante: '', codigo: '' });
  const [executar, ocupado] = useAcao();

  const enviar = async (e) => {
    e.preventDefault();
    const ok = await executar(() => avisarEsperando(pessoa, { tipo, ...f }), 'A guarda foi avisada.');
    if (ok) navegar('/cadete');
  };

  const valido = tipo === 'delivery' ? f.restaurante.trim() : f.rastreio.trim().length >= 6;

  return (
    <>
      <Topo cadete titulo="Estou esperando" sobre="A guarda reconhece sua encomenda na chegada" voltar={{ rotulo: 'Minhas encomendas', to: '/cadete' }} />
      <form className="conteudo" style={{ gap: 18 }} onSubmit={enviar}>
        <Segmentado rotulo="Tipo" opcoes={[{ id: 'rastreio', nome: 'Encomenda' }, { id: 'delivery', nome: 'Delivery de comida' }]} valor={tipo} aoMudar={setTipo} />
        {tipo === 'delivery' ? (
          <>
            <label className="campo" style={{ fontWeight: 600 }}>Aplicativo ou restaurante
              <input value={f.restaurante} onChange={(e) => setF({ ...f, restaurante: e.target.value })} placeholder="Ex.: iFood · Restaurante X" />
            </label>
            <label className="campo codigo" style={{ fontWeight: 600 }}>Código de confirmação (se o app pedir)
              <input value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} inputMode="numeric" autoComplete="off" />
            </label>
            <div className="cartao" style={{ flexDirection: 'row', gap: 10 }}>
              <Icone nome="cadeado" tamanho={22} cor="#1D4E89" />
              <span className="muted">O código só aparece para a sentinela quando o entregador chegar e é apagado logo após o uso.</span>
            </div>
          </>
        ) : (
          <>
            <label className="campo" style={{ fontWeight: 600 }}>Código de rastreio da compra
              <input value={f.rastreio} onChange={(e) => setF({ ...f, rastreio: e.target.value })} placeholder="Ex.: AA123456789BR" autoCapitalize="characters" />
            </label>
            <span className="muted">Na chegada, a sentinela lê a etiqueta e o app já sabe que é sua. Dica: no endereço, inclua o setor (ex.: “Cad. Romeiro – EsFO – 1º Pel”).</span>
          </>
        )}
        <button className="btn primario" disabled={!valido || ocupado}>Avisar a guarda</button>
      </form>
    </>
  );
}
