// Quem está usando o app: login, cadastro da pessoa e o que ela pode ver.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { ref, useAoVivo } from './dados/base';
import { FUNCOES_LOTE } from './lib/constantes';
import { tratamento } from './lib/texto';

const Contexto = createContext(null);

export function SessaoProvider({ children }) {
  const [usuario, setUsuario] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUsuario), []);
  const [pessoa, carregandoPessoa] = useAoVivo(usuario ? ref('pessoas', usuario.uid) : null, [usuario?.uid]);

  const valor = useMemo(() => {
    const perfil = pessoa?.perfil ?? null;
    const funcao = pessoa?.funcao ?? null;
    const oficial = perfil === 'oficial' || perfil === 'admin';
    return {
      usuario,
      pessoa,
      carregando: usuario === undefined || (usuario && carregandoPessoa),
      ehGuarda: perfil === 'guarda',
      ehAdmin: perfil === 'admin',
      ehOficial: oficial,
      funcao,
      ehGestor: oficial || Boolean(funcao),
      podeLote: oficial || FUNCOES_LOTE.includes(funcao),
      ehCmtBloco: funcao === 'cmt_bloco',
      // identificação usada nas movimentações
      eu: usuario ? { uid: usuario.uid, nome: pessoa ? tratamento(pessoa) : usuario.email, funcao } : null,
      sair: () => signOut(auth)
    };
  }, [usuario, pessoa, carregandoPessoa]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao() {
  return useContext(Contexto);
}
