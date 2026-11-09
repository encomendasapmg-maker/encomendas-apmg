// Cadastro de pessoas (seção 4.4): autocadastro, acesso imediato, sem RG.
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { getDoc, query, where, writeBatch, orderBy, limit, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { SETOR_PILOTO } from '../lib/constantes';
import { normalizar } from '../lib/texto';
import { agora, col, ref, useAoVivo } from './base';

function camposBusca(p) {
  return normalizar(`${p.nomeGuerra} ${p.nomeCompleto} ${p.numeroCadete}`).split(' ');
}

export async function cadastrar({ nomeCompleto, nomeGuerra, numeroCadete, turma, pelotao, email, senha, celular }) {
  const numero = String(numeroCadete).replace(/\D/g, '');
  if (!numero) throw new Error('Informe o número do cadete.');

  // Avisa cedo se o número já foi usado, antes de criar o login.
  const reserva = await getDoc(ref('numerosCadete', numero)).catch(() => null);
  if (reserva?.exists()) {
    throw new Error('Este número de cadete já está cadastrado. Procure o administrador do sistema.');
  }

  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), senha);
  const pessoa = {
    nomeCompleto: nomeCompleto.trim(),
    nomeGuerra: nomeGuerra.trim(),
    numeroCadete: numero,
    setor: SETOR_PILOTO,
    turma,
    pelotao: pelotao || null,
    perfil: 'cadete',
    funcao: null,
    ativo: true,
    origem: 'autocadastro',
    criadoEm: agora()
  };
  pessoa.busca = camposBusca(pessoa);

  const batch = writeBatch(db);
  batch.set(ref('numerosCadete', numero), { uid: user.uid, criadoEm: agora() });
  batch.set(ref('pessoas', user.uid), pessoa);
  batch.set(ref('contatos', user.uid), { email: email.trim(), celular: celular?.trim() || null });
  try {
    await batch.commit();
  } catch (e) {
    // Alguém registrou o mesmo número ao mesmo tempo: o administrador é avisado.
    const b = writeBatch(db);
    b.set(ref('alertas', `numero-${numero}-${user.uid}`), {
      tipo: 'numero_repetido',
      numeroCadete: numero,
      uid: user.uid,
      email: email.trim(),
      resolvido: false,
      em: agora()
    });
    await b.commit().catch(() => {});
    await user.delete().catch(() => {});
    throw new Error('Não foi possível concluir o cadastro: o número do cadete já está em uso.');
  }
  sendEmailVerification(user).catch(() => {});
  return user;
}

// Lista de pessoas ativas para a busca de destinatário (feita no aparelho,
// com tolerância a erro de grafia, em menos de 2 segundos).
export function usePessoasAtivas(habilitado = true) {
  return useAoVivo(habilitado ? query(col('pessoas'), where('ativo', '==', true)) : null, [habilitado]);
}

export function useCadastrosRecentes(qtd = 50) {
  return useAoVivo(query(col('pessoas'), orderBy('criadoEm', 'desc'), limit(qtd)), [qtd]);
}

export async function definirAtivo(uidPessoa, ativo) {
  await updateDoc(ref('pessoas', uidPessoa), { ativo, atualizadoEm: agora() });
}

export async function definirPerfil(uidPessoa, perfil) {
  await updateDoc(ref('pessoas', uidPessoa), { perfil, atualizadoEm: agora() });
}

// Passagem de ano do CFO: 1º ano (/1 e /2) → 2º ano → 3º ano; o 3º ano é
// inativado (formados não são apagados). O CHOE não entra: tem botão próprio.
export async function passagemDeAno(pessoas) {
  const proxima = { '1º ano': '2º ano', '1º ano/1': '2º ano', '1º ano/2': '2º ano', '2º ano': '3º ano' };
  let batch = writeBatch(db);
  let n = 0;
  for (const p of pessoas) {
    if (p.perfil !== 'cadete' || p.turma === 'CHOE') continue;
    const dados = proxima[p.turma]
      ? { turma: proxima[p.turma], atualizadoEm: agora() }
      : { ativo: false, inativadoPor: 'formatura', atualizadoEm: agora() };
    batch.update(ref('pessoas', p.id), dados);
    n += 1;
    if (n % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  await batch.commit();
  return n;
}

// Fim do CHOE: inativa a turma de Alunos Oficiais (os registros não são apagados).
export async function encerrarCHOE(pessoas) {
  const alvo = pessoas.filter((p) => p.perfil === 'cadete' && p.turma === 'CHOE' && p.ativo);
  for (let i = 0; i < alvo.length; i += 400) {
    const batch = writeBatch(db);
    for (const p of alvo.slice(i, i + 400)) {
      batch.update(ref('pessoas', p.id), { ativo: false, inativadoPor: 'fim_choe', atualizadoEm: agora() });
    }
    await batch.commit();
  }
  return alvo.length;
}

// O próprio usuário corrige a turma (ex.: cadastros antigos com "1º ano").
export async function atualizarMinhaTurma(uidPessoa, turma, pelotao) {
  const dados = { turma, atualizadoEm: agora() };
  if (pelotao !== undefined) dados.pelotao = pelotao;
  await updateDoc(ref('pessoas', uidPessoa), dados);
}
