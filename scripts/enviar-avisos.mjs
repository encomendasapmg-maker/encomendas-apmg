// Rotina agendada (GitHub Actions), no lugar das funções pagas do Firebase.
// A cada execução:
//  1. envia ao celular os avisos pendentes (encomenda chegou, lote, função…);
//  2. lembra o cadete e alerta a guarda de delivery parado há mais de 30 min;
//  3. encerra pedidos esperados vencidos e apaga códigos de delivery não usados.
// Usa a chave da conta de serviço guardada no segredo FIREBASE_ADMIN_KEY.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const MINUTOS_ALERTA_DELIVERY = 30;
const URL_APP = process.env.URL_APP || 'https://encomendas-apmg.web.app';

const chave = process.env.FIREBASE_ADMIN_KEY;
if (!chave) {
  console.error('Segredo FIREBASE_ADMIN_KEY não configurado.');
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(chave)) });
const db = getFirestore();
const fcm = getMessaging();

async function tokenDe(uid) {
  const snap = await db.doc(`tokensPush/${uid}`).get();
  return snap.exists ? snap.data().token : null;
}

async function enviarAvisos() {
  const snap = await db.collection('avisos').where('enviado', '==', false).limit(300).get();
  let enviados = 0;
  for (const doc of snap.docs) {
    const a = doc.data();
    const token = await tokenDe(a.paraUid);
    const atualizacao = { enviado: true, enviadoEm: FieldValue.serverTimestamp() };
    if (token) {
      const link = `${URL_APP}${a.url || '/'}`;
      try {
        await fcm.send({
          token,
          data: { title: a.titulo, body: a.texto, url: a.url || '/', tag: a.tipo || 'aviso' },
          webpush: {
            headers: { Urgency: a.prioridade === 'alta' ? 'high' : 'normal', TTL: '86400' },
            notification: { title: a.titulo, body: a.texto, icon: '/icone.svg', tag: a.tipo || 'aviso' },
            fcmOptions: { link }
          }
        });
        enviados += 1;
      } catch (e) {
        atualizacao.erro = String(e.code || e.message).slice(0, 200);
        // Token vencido ou de aparelho que desinstalou o app: descarta.
        if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(atualizacao.erro)) {
          await db.doc(`tokensPush/${a.paraUid}`).delete().catch(() => {});
        }
      }
    } else {
      atualizacao.semToken = true;
    }
    await doc.ref.update(atualizacao);
  }
  console.log(`Avisos: ${snap.size} pendente(s), ${enviados} enviado(s).`);
}

async function alertarDeliveryParado() {
  const limite = Timestamp.fromMillis(Date.now() - MINUTOS_ALERTA_DELIVERY * 60000);
  const snap = await db.collection('encomendas')
    .where('perecivel', '==', true)
    .where('situacao', '==', 'na_guarda')
    .get();
  const parados = snap.docs.filter((d) => {
    const e = d.data();
    return !e.alertaDeliveryEm && e.chegada && e.chegada.toMillis() < limite.toMillis();
  });
  if (!parados.length) return;
  const guardas = await db.collection('pessoas').where('perfil', '==', 'guarda').where('ativo', '==', true).get();
  const lote = db.batch();
  for (const d of parados) {
    const e = d.data();
    if (e.destinatarioUid) {
      lote.create(db.collection('avisos').doc(), {
        paraUid: e.destinatarioUid,
        titulo: 'Seu delivery está esperando',
        texto: `O pedido nº ${e.numeroInterno} está no Corpo da Guarda há mais de ${MINUTOS_ALERTA_DELIVERY} min.`,
        tipo: 'delivery', url: '/', prioridade: 'alta', enviado: false, lido: false,
        criadoEm: FieldValue.serverTimestamp()
      });
    }
    for (const g of guardas.docs) {
      lote.create(db.collection('avisos').doc(), {
        paraUid: g.id,
        titulo: 'Delivery sem retirada',
        texto: `Nº ${e.numeroInterno} · ${e.destinatarioNome}: na guarda há mais de ${MINUTOS_ALERTA_DELIVERY} min.`,
        tipo: 'delivery_guarda', url: '/guarda', prioridade: 'alta', enviado: false, lido: false,
        criadoEm: FieldValue.serverTimestamp()
      });
    }
    lote.update(d.ref, { alertaDeliveryEm: FieldValue.serverTimestamp() });
  }
  await lote.commit();
  console.log(`Delivery parado: ${parados.length} alerta(s) criado(s).`);
}

async function encerrarPedidosVencidos() {
  const snap = await db.collection('pedidosEsperados')
    .where('ativo', '==', true)
    .where('validade', '<', Timestamp.now())
    .limit(200)
    .get();
  if (snap.empty) return;
  const lote = db.batch();
  for (const d of snap.docs) {
    lote.update(d.ref, { ativo: false, expiradoEm: FieldValue.serverTimestamp(), temCodigo: false });
    lote.delete(d.ref.collection('segredo').doc('codigo'));
  }
  await lote.commit();
  console.log(`Pedidos vencidos encerrados: ${snap.size}.`);
}

try {
  await enviarAvisos();
  await alertarDeliveryParado();
  await enviarAvisos();
  await encerrarPedidosVencidos();
} catch (e) {
  console.error(e);
  process.exit(1);
}
