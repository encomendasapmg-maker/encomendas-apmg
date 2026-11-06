// Pedido esperado e delivery de comida (seções 5.2 e RF09/RF10).
// O código de confirmação do delivery fica numa subcoleção que só o dono e a
// guarda leem, aparece para a sentinela só na chegada e é apagado após o uso.
import { writeBatch, getDoc, query, where, orderBy, limit, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { tratamento } from '../lib/texto';
import { agora, col, ref, novoId, useAoVivo, gravar } from './base';
import { registrarEncomenda } from './encomendas';

const HORAS_VALIDADE_DELIVERY = 6;
const DIAS_VALIDADE_RASTREIO = 60;

export async function avisarEsperando(pessoa, { tipo, rastreio, restaurante, codigo }) {
  const id = novoId('pedidosEsperados');
  const validade = new Date();
  if (tipo === 'delivery') validade.setHours(validade.getHours() + HORAS_VALIDADE_DELIVERY);
  else validade.setDate(validade.getDate() + DIAS_VALIDADE_RASTREIO);

  const batch = writeBatch(db);
  batch.set(ref('pedidosEsperados', id), {
    tipo,
    destinatarioUid: pessoa.id,
    destinatarioNome: tratamento(pessoa),
    destinatarioSetor: pessoa.setor,
    rastreio: tipo === 'rastreio' ? String(rastreio).trim().toUpperCase() : null,
    restaurante: tipo === 'delivery' ? restaurante.trim() : null,
    temCodigo: Boolean(codigo),
    ativo: true,
    criadoEm: agora(),
    validade
  });
  if (tipo === 'delivery' && codigo) {
    batch.set(ref('pedidosEsperados', id, 'segredo', 'codigo'), { codigo: String(codigo).trim() });
  }
  await gravar(batch);
  return id;
}

export function useMeusPedidos(uid) {
  return useAoVivo(
    uid ? query(col('pedidosEsperados'), where('destinatarioUid', '==', uid), where('ativo', '==', true)) : null,
    [uid]
  );
}

export async function cancelarPedido(pedido) {
  const batch = writeBatch(db);
  batch.update(ref('pedidosEsperados', pedido.id), { ativo: false, canceladoEm: agora() });
  if (pedido.temCodigo) batch.delete(ref('pedidosEsperados', pedido.id, 'segredo', 'codigo'));
  return gravar(batch);
}

// Lista da guarda: deliveries esperados ainda válidos.
export function useDeliveriesEsperados() {
  return useAoVivo(
    query(col('pedidosEsperados'), where('tipo', '==', 'delivery'), where('ativo', '==', true), orderBy('criadoEm', 'desc'), limit(30)),
    []
  );
}

// A sentinela toca no pedido quando o entregador chega: só então lê o código.
export async function lerCodigo(pedido) {
  if (!pedido.temCodigo) return null;
  const snap = await getDoc(ref('pedidosEsperados', pedido.id, 'segredo', 'codigo'));
  return snap.exists() ? snap.data().codigo : null;
}

// Registra o delivery recebido, apaga o código e avisa o cadete com prioridade.
export async function receberDelivery(pedido, pessoa, posto, usuario) {
  const resultado = await registrarEncomenda(
    {
      destinatario: pessoa,
      idTipo: 'sem_numero',
      descricao: `Delivery · ${pedido.restaurante || 'pedido de comida'}`,
      entregador: { id: 'delivery', nome: 'Entregador de delivery', empresa: pedido.restaurante || 'Delivery' },
      local: 'Delivery · balcão',
      perecivel: true,
      pedidoEsperadoId: pedido.id
    },
    posto,
    usuario
  );
  if (pedido.temCodigo) {
    const batch = writeBatch(db);
    batch.delete(ref('pedidosEsperados', pedido.id, 'segredo', 'codigo'));
    batch.update(ref('pedidosEsperados', pedido.id), { temCodigo: false, codigoUsadoEm: agora() });
    await gravar(batch);
  }
  return resultado;
}

export async function marcarPedidoExpirado(pedido) {
  await updateDoc(ref('pedidosEsperados', pedido.id), { ativo: false, expiradoEm: agora() });
}
