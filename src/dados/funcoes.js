// Funções escolhidas pelo próprio cadete ao entrar (seção 4.2).
// Quem assume uma função já ocupada fica no lugar do anterior, que é avisado.
import { writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { NOME_FUNCAO } from '../lib/constantes';
import { tratamento } from '../lib/texto';
import { agora, col, ref, useAoVivo, novoId, aviso } from './base';

export function useFuncoes() {
  return useAoVivo(col('funcoes'), []);
}

export async function ocupante(funcaoId) {
  const snap = await getDoc(ref('funcoes', funcaoId));
  return snap.exists() ? snap.data() : null;
}

// O Respondente é único e responde sempre pelo Oficial de Dia.
const RESPONDENDO_POR = 'oficial_dia';

// funcaoId = null significa "Nenhuma".
export async function escolherFuncao(pessoa, funcaoId) {
  const respondendoPor = funcaoId === 'respondente' ? RESPONDENDO_POR : null;
  const batch = writeBatch(db);
  const nome = tratamento(pessoa);

  // Sai da função anterior.
  if (pessoa.funcao && pessoa.funcao !== funcaoId) {
    const anterior = await ocupante(pessoa.funcao);
    if (anterior?.uid === pessoa.id) batch.delete(ref('funcoes', pessoa.funcao));
  }

  if (funcaoId) {
    const atual = await ocupante(funcaoId);
    batch.set(ref('funcoes', funcaoId), {
      uid: pessoa.id,
      nome,
      respondendoPor,
      desde: agora()
    });
    if (atual && atual.uid !== pessoa.id) {
      batch.update(ref('pessoas', atual.uid), { funcao: null, respondendoPor: null });
      aviso(batch, {
        paraUid: atual.uid,
        titulo: 'Função assumida por outro',
        texto: `${nome} assumiu a função de ${NOME_FUNCAO[funcaoId]} no seu lugar.`,
        tipo: 'funcao'
      });
    }
  }

  batch.update(ref('pessoas', pessoa.id), {
    funcao: funcaoId,
    respondendoPor,
    atualizadoEm: agora()
  });
  batch.set(ref('assuncoes', novoId('assuncoes')), {
    usuarioUid: pessoa.id,
    usuarioNome: nome,
    funcao: funcaoId,
    respondendoPor,
    em: agora()
  });
  await batch.commit();
  return true;
}
