// Peças de tela reaproveitadas pelos três modos.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { buscarPessoas, descricaoPessoa, tratamento } from './lib/texto';

// ---------- Ícones (traço, sem emoji) ----------
const CAMINHOS = {
  caixa: <><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" /></>,
  comida: <><path d="M4 11h16" /><path d="M5 11a7 7 0 0 1 14 0" /><path d="M4 15h16l-1.5 4h-13z" /></>,
  qr: <><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2" /></>,
  caminhao: <><path d="M3 7h13v10H3z" /><path d="M16 10h3l2 3v4h-5" /><circle cx="7" cy="18" r="1.6" /><circle cx="18" cy="18" r="1.6" /></>,
  codigo: <><path d="M4 7V5h3M17 5h3v2M20 17v2h-3M7 19H4v-2" /><path d="M8 9v6M11 9v6M14 9v6M17 9v6" /></>,
  cadeado: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  conversa: <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" />,
  painel: <><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></>,
  missao: <><path d="M4 21V4" /><path d="M4 4h12l-2 4 2 4H4" /></>,
  inicio: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>
};

export function Icone({ nome, tamanho = 24, cor = 'currentColor' }) {
  return (
    <svg aria-hidden="true" width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke={cor}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {CAMINHOS[nome]}
    </svg>
  );
}

// ---------- Topo ----------
export function Topo({ titulo, sobre, voltar, cadete, grande, direita, children }) {
  const navegar = useNavigate();
  return (
    <header className={`topo${cadete ? ' cadete' : ''}`}>
      {voltar && (
        <button type="button" className="voltar" onClick={() => (voltar.to ? navegar(voltar.to) : navegar(-1))}>
          ‹ {voltar.rotulo}
        </button>
      )}
      {sobre && !direita && <span className="sobre">{sobre}</span>}
      {direita && (
        <div className="linha">
          <span className="sobre">{sobre}</span>
          {direita}
        </div>
      )}
      <h1 className={grande ? 'grande' : undefined}>{titulo}</h1>
      {children}
    </header>
  );
}

export function Contador({ valor, rotulo, ambar }) {
  return (
    <div className={`contador${ambar ? ' ambar' : ''}`}>
      <b>{valor ?? '–'}</b>
      <span>{rotulo}</span>
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }) {
  return <div className="centro">{texto}</div>;
}

// ---------- Escolha única em botões ----------
export function Chips({ opcoes, valor, aoMudar, redondo, rotulo }) {
  return (
    <div className="chips" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.id} type="button" className={`chip${redondo ? ' redondo' : ''}`}
          aria-pressed={valor === o.id} onClick={() => aoMudar(o.id)}>
          {o.nome}
        </button>
      ))}
    </div>
  );
}

export function Segmentado({ opcoes, valor, aoMudar, rotulo }) {
  return (
    <div className="segmentado" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.id} type="button" aria-pressed={valor === o.id} onClick={() => aoMudar(o.id)}>
          {o.nome}
        </button>
      ))}
    </div>
  );
}

// ---------- Busca de pessoa (nome, nome de guerra ou número) ----------
export function BuscaPessoa({ pessoas, selecionada, aoSelecionar, rotulo = 'Nome, nome de guerra ou número do cadete', autoFocus }) {
  const [termo, setTermo] = useState('');
  const resultados = termo.length >= 2 ? buscarPessoas(pessoas || [], termo) : [];
  return (
    <div className="secao">
      <label className="campo">
        {rotulo}
        <input value={termo} onChange={(e) => setTermo(e.target.value)} autoComplete="off" autoFocus={autoFocus}
          placeholder="Digite as primeiras letras" enterKeyHint="search" />
      </label>
      {selecionada && !termo && (
        <div className="opcoes">
          <button type="button" aria-pressed="true" onClick={() => aoSelecionar(null)}>
            {tratamento(selecionada)}
            <span className="extra">{descricaoPessoa(selecionada)} · trocar</span>
          </button>
        </div>
      )}
      {resultados.length > 0 && (
        <div className="opcoes">
          {resultados.map((p) => (
            <button key={p.id} type="button" aria-pressed={selecionada?.id === p.id}
              onClick={() => { aoSelecionar(p); setTermo(''); }}>
              {tratamento(p)}
              <span className="extra">{descricaoPessoa(p)} · nº {p.numeroCadete}</span>
            </button>
          ))}
        </div>
      )}
      {termo.length >= 2 && resultados.length === 0 && (
        <span className="pequeno">Ninguém encontrado com “{termo}”.</span>
      )}
    </div>
  );
}

// ---------- Janela sobreposta ----------
export function Modal({ titulo, aoFechar, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && aoFechar?.();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aoFechar]);
  return (
    <div className="fundo-modal" onClick={(e) => e.target === e.currentTarget && aoFechar?.()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="linha-entre">
          <h2>{titulo}</h2>
          {aoFechar && <button type="button" className="btn pequeno neutro" onClick={aoFechar}>Fechar</button>}
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Avisos rápidos na tela ----------
const ToastContexto = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const mostrar = useCallback((texto, tipo = 'ok') => {
    setToast({ texto, tipo, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.tipo === 'erro' ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <ToastContexto.Provider value={mostrar}>
      {children}
      {toast && <div className={`toast ${toast.tipo}`} role="status">{toast.texto}</div>}
    </ToastContexto.Provider>
  );
}

export function useToast() {
  return useContext(ToastContexto);
}

// Executa uma ação mostrando erro amigável.
export function useAcao() {
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  const executar = useCallback(async (fn, sucesso) => {
    setOcupado(true);
    try {
      const r = await fn();
      if (sucesso) toast(typeof sucesso === 'function' ? sucesso(r) : sucesso, 'ok');
      // Sucesso sempre devolve algo "verdadeiro"; erro devolve undefined.
      return r === undefined || r === null ? true : r;
    } catch (e) {
      console.error(e);
      toast(traduzirErro(e), 'erro');
      return undefined;
    } finally {
      setOcupado(false);
    }
  }, [toast]);
  return [executar, ocupado];
}

export function traduzirErro(e) {
  const codigo = e?.code || '';
  if (codigo.includes('permission-denied')) return 'Sem permissão para esta ação.';
  if (codigo.includes('unavailable')) return 'Sem conexão com o servidor. Tente de novo em instantes.';
  if (codigo.includes('auth/invalid-credential') || codigo.includes('auth/wrong-password')) return 'E-mail ou senha incorretos.';
  if (codigo.includes('auth/email-already-in-use')) return 'Este e-mail já tem cadastro. Use "Entrar".';
  if (codigo.includes('auth/weak-password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (codigo.includes('auth/invalid-email')) return 'E-mail inválido.';
  if (codigo.includes('auth/too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos.';
  return e?.message || 'Algo deu errado.';
}

// ---------- Leitor de código pela câmera ----------
// Lê código de barras (etiquetas, chave de NF) e QR (retirada do cadete).
export function LeitorCodigo({ aoLer, aoFechar, titulo = 'Aponte para o código' }) {
  const video = useRef(null);
  const retorno = useRef(aoLer);
  retorno.current = aoLer;
  const [erro, setErro] = useState(null);
  useEffect(() => {
    let controles = null;
    let ativo = true;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const leitor = new BrowserMultiFormatReader();
        controles = await leitor.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          video.current,
          (resultado) => {
            if (resultado && ativo) {
              ativo = false;
              if (navigator.vibrate) navigator.vibrate(80);
              retorno.current(resultado.getText());
            }
          }
        );
        if (!ativo) controles.stop();
      } catch (e) {
        console.error(e);
        setErro('Não foi possível abrir a câmera. Verifique a permissão do navegador ou digite o número.');
      }
    })();
    return () => {
      ativo = false;
      controles?.stop();
    };
  }, []);
  return (
    <Modal titulo={titulo} aoFechar={aoFechar}>
      {erro ? <div className="caixa-erro">{erro}</div> : <video ref={video} className="video-leitor" muted playsInline />}
    </Modal>
  );
}

export function ImagemQR({ texto, rotulo }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    QRCode.toDataURL(texto, { margin: 1, width: 600, errorCorrectionLevel: 'M' }).then(setUrl).catch(() => setUrl(null));
  }, [texto]);
  return url ? <img className="qr" src={url} alt={rotulo} /> : <Carregando texto="Gerando QR…" />;
}
