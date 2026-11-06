// Retirada por terceiro (seção 5.3): o destinatário autoriza um colega no app.
import { addDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { tratamento } from '../lib/texto';
import { agora, col, ref, useAoVivo } from './base';

export function useMinhasAutorizacoes(uid) {
  return useAoVivo(
    uid ? query(col('autorizacoes'), where('destinatarioUid', '==', uid), where('ativa', '==', true)) : null,
    [uid]
  );
}

export async function autorizar(pessoa, colega) {
  return addDoc(col('autorizacoes'), {
    destinatarioUid: pessoa.id,
    destinatarioNome: tratamento(pessoa),
    autorizadoUid: colega.id,
    autorizadoNome: tratamento(colega),
    autorizadoNumero: colega.numeroCadete,
    ativa: true,
    criadaEm: agora()
  });
}

export async function encerrarAutorizacao(aut) {
  await updateDoc(ref('autorizacoes', aut.id), { ativa: false, encerradaEm: agora() });
}

// Na guarda: quem o destinatário autorizou.
export async function autorizadosDe(uidDestinatario) {
  const snap = await getDocs(
    query(col('autorizacoes'), where('destinatarioUid', '==', uidDestinatario), where('ativa', '==', true))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
