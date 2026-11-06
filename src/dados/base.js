// Utilitários comuns da camada de dados.
import { useEffect, useState } from 'react';
import { onSnapshot, serverTimestamp, doc, collection } from 'firebase/firestore';
import { db } from '../firebase';

export const agora = () => serverTimestamp();
export const ref = (caminho, ...partes) => doc(db, caminho, ...partes);
export const col = (caminho) => collection(db, caminho);
export const novoId = (caminho) => doc(collection(db, caminho)).id;

// Sem internet, o Firestore guarda a gravação no aparelho e só confirma
// quando a conexão volta. Para a sentinela não ficar esperando, damos o
// registro por "salvo no aparelho" depois de um curto intervalo.
export async function gravar(batchOuPromessa, esperaMs = 1500) {
  const promessa = typeof batchOuPromessa.commit === 'function' ? batchOuPromessa.commit() : batchOuPromessa;
  const resultado = await Promise.race([
    promessa.then(() => 'enviado'),
    new Promise((r) => setTimeout(() => r('no_aparelho'), esperaMs))
  ]);
  if (resultado === 'no_aparelho') {
    // Se o servidor recusar depois (regra de acesso), avisamos no console.
    promessa.catch((e) => console.error('Gravação recusada ao sincronizar:', e));
  }
  return resultado;
}

// Lê uma consulta ou documento em tempo real.
export function useAoVivo(fonte, deps = []) {
  const [estado, setEstado] = useState({ dados: undefined, erro: null });
  useEffect(() => {
    if (!fonte) {
      setEstado({ dados: null, erro: null });
      return undefined;
    }
    return onSnapshot(
      fonte,
      (snap) => {
        if ('docs' in snap) setEstado({ dados: snap.docs.map((d) => ({ id: d.id, ...d.data() })), erro: null });
        else setEstado({ dados: snap.exists() ? { id: snap.id, ...snap.data() } : null, erro: null });
      },
      (erro) => {
        console.error(erro);
        setEstado({ dados: null, erro });
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [estado.dados, estado.dados === undefined, estado.erro];
}

// Registro no livro digital. Toda mudança de situação passa por aqui.
export function movimentacao(batch, { encomenda, de, para, usuario, observacao, retiradoPor }) {
  const r = doc(collection(db, 'movimentacoes'));
  batch.set(r, {
    encomendaId: encomenda.id,
    numeroInterno: encomenda.numeroInterno ?? null,
    destinatarioUid: encomenda.destinatarioUid ?? null,
    de: de ?? null,
    para,
    usuarioUid: usuario.uid,
    usuarioNome: usuario.nome,
    funcao: usuario.funcao ?? null,
    retiradoPor: retiradoPor ?? null,
    observacao: observacao ?? null,
    em: serverTimestamp()
  });
  return r;
}

// Aviso a um destinatário: aparece no app na hora e vai por notificação
// quando a rotina agendada rodar.
export function aviso(batch, { paraUid, titulo, texto, tipo, url = '/', prioridade = 'normal' }) {
  if (!paraUid) return;
  batch.set(doc(collection(db, 'avisos')), {
    paraUid,
    titulo,
    texto,
    tipo,
    url,
    prioridade,
    enviado: false,
    lido: false,
    criadoEm: serverTimestamp()
  });
}
