// Conta da Guarda: "No posto agora" e contingência (seções 4.1 e 7).
import { writeBatch, query, orderBy, limit, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizar } from '../lib/texto';
import { agora, col, gravar, ref, useAoVivo, novoId } from './base';

export function usePosto() {
  return useAoVivo(ref('posto', 'atual'), []);
}

export function useNomesUsados() {
  return useAoVivo(query(col('postoNomes'), orderBy('usadoEm', 'desc'), limit(12)), []);
}

export async function assumirPosto(nome) {
  const limpo = nome.trim().replace(/\s+/g, ' ');
  if (limpo.length < 3) throw new Error('Informe graduação e nome de guerra (ex.: Sd. Silva).');
  const batch = writeBatch(db);
  batch.set(ref('posto', 'atual'), { nome: limpo, desde: agora(), ultimaAtividade: agora() });
  batch.set(ref('postoHistorico', novoId('postoHistorico')), { nome: limpo, em: agora() });
  batch.set(ref('postoNomes', normalizar(limpo).replace(/ /g, '-') || 'sem-nome'), { nome: limpo, usadoEm: agora() });
  return gravar(batch);
}

export function registrarAtividade() {
  updateDoc(ref('posto', 'atual'), { ultimaAtividade: agora() }).catch(() => {});
}

export function useContingencia() {
  return useAoVivo(ref('config', 'contingencia'), []);
}

// Contingência: o livro físico volta a ser usado. As movimentações desse
// período não são lançadas depois; o app só marca início e fim.
export async function iniciarContingencia(nomePosto, motivo) {
  const id = novoId('contingencias');
  const batch = writeBatch(db);
  batch.set(ref('contingencias', id), { inicio: agora(), abertaPor: nomePosto, motivo: motivo || null, fim: null });
  batch.set(ref('config', 'contingencia'), { ativa: true, id, desde: agora() });
  return gravar(batch);
}

export async function encerrarContingencia(atual, nomePosto) {
  const batch = writeBatch(db);
  batch.update(ref('contingencias', atual.id), { fim: agora(), encerradaPor: nomePosto });
  batch.set(ref('config', 'contingencia'), { ativa: false, id: null, desde: null });
  return gravar(batch);
}
