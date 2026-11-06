// Entrar e autocadastro (seção 4.4): o cadete se cadastra e já tem acesso.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, configurado } from '../firebase';
import { cadastrar } from '../dados/pessoas';
import { TURMAS, PELOTOES } from '../lib/constantes';
import { Topo, Chips, useAcao, useToast } from '../componentes';

function AvisoConfiguracao() {
  if (configurado) return null;
  return (
    <div className="caixa-alerta">
      O app ainda não foi ligado ao Firebase. Crie o arquivo <b>.env.local</b> a partir do <b>.env.example</b> (veja o README).
    </div>
  );
}

export function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [executar, ocupado] = useAcao();
  const toast = useToast();

  const entrar = (e) => {
    e.preventDefault();
    executar(() => signInWithEmailAndPassword(auth, email.trim(), senha));
  };

  const esqueci = () => {
    if (!email) return toast('Digite seu e-mail primeiro.', 'erro');
    executar(() => sendPasswordResetEmail(auth, email.trim()), 'Enviamos um link para redefinir a senha.');
  };

  return (
    <div className="app">
      <Topo titulo="Encomendas" sobre="Corpo da Guarda · APMG" grande />
      <form className="conteudo" onSubmit={entrar}>
        <AvisoConfiguracao />
        <label className="campo">E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="campo">Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
        </label>
        <button className="btn primario" disabled={ocupado}>Entrar</button>
        <button type="button" className="botao-texto" onClick={esqueci}>Esqueci a senha</button>
        <div className="cartao">
          <span className="titulo">Primeiro acesso?</span>
          <span className="muted">Faça seu cadastro com o número do cadete. O acesso é imediato.</span>
          <Link to="/cadastro" className="btn">Fazer meu cadastro</Link>
        </div>
      </form>
    </div>
  );
}

export function Cadastro() {
  const [f, setF] = useState({
    nomeCompleto: '', nomeGuerra: '', numeroCadete: '', turma: '', pelotao: '', email: '', senha: '', celular: ''
  });
  const [executar, ocupado] = useAcao();
  const navegar = useNavigate();
  const muda = (campo) => (e) => setF({ ...f, [campo]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    if (!f.turma || !f.pelotao) return executar(() => Promise.reject(new Error('Escolha a turma e o pelotão.')));
    const ok = await executar(() => cadastrar(f), 'Cadastro feito! Confirme seu e-mail quando puder.');
    if (ok) navegar('/');
  };

  return (
    <div className="app">
      <Topo titulo="Meu cadastro" sobre="Sem RG, CPF ou endereço" voltar={{ rotulo: 'Entrar', to: '/' }} />
      <form className="conteudo" onSubmit={enviar}>
        <AvisoConfiguracao />
        <label className="campo">Nome completo
          <input value={f.nomeCompleto} onChange={muda('nomeCompleto')} autoComplete="name" required />
        </label>
        <label className="campo">Nome de guerra
          <input value={f.nomeGuerra} onChange={muda('nomeGuerra')} required />
        </label>
        <label className="campo">Número do cadete
          <input value={f.numeroCadete} onChange={muda('numeroCadete')} inputMode="numeric" required />
        </label>
        <div className="secao">
          <span className="rotulo">Turma</span>
          <Chips rotulo="Turma" opcoes={TURMAS.map((t) => ({ id: t, nome: t }))} valor={f.turma} aoMudar={(turma) => setF({ ...f, turma })} />
        </div>
        <div className="secao">
          <span className="rotulo">Pelotão</span>
          <Chips rotulo="Pelotão" opcoes={PELOTOES.map((p) => ({ id: p, nome: p }))} valor={f.pelotao} aoMudar={(pelotao) => setF({ ...f, pelotao })} />
        </div>
        <label className="campo">E-mail
          <input type="email" value={f.email} onChange={muda('email')} autoComplete="email" required />
        </label>
        <label className="campo">Senha (mínimo 6 caracteres)
          <input type="password" value={f.senha} onChange={muda('senha')} autoComplete="new-password" minLength={6} required />
        </label>
        <label className="campo">Celular (opcional, para aviso urgente de delivery)
          <input type="tel" value={f.celular} onChange={muda('celular')} autoComplete="tel" placeholder="(41) 9…" />
        </label>
        <span className="pequeno">
          Seus dados servem só para avisar e entregar suas encomendas (LGPD). Outros cadetes veem apenas nome de guerra, turma e pelotão.
        </span>
        <button className="btn primario" disabled={ocupado}>Criar cadastro</button>
      </form>
    </div>
  );
}
