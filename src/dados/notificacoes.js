// Notificações no celular (Firebase Cloud Messaging).
// O app só guarda o "endereço" do celular; quem envia é a rotina agendada do
// GitHub Actions (scripts/enviar-avisos.mjs). No iPhone, a notificação só
// funciona com o app adicionado à tela inicial.
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { setDoc } from 'firebase/firestore';
import { app } from '../firebase';
import { agora, ref } from './base';

export async function notificacoesDisponiveis() {
  return typeof window !== 'undefined' && 'Notification' in window && (await isSupported().catch(() => false));
}

export function permissaoAtual() {
  return typeof Notification === 'undefined' ? 'indisponivel' : Notification.permission;
}

export async function ativarNotificacoes(uid) {
  if (!(await notificacoesDisponiveis())) {
    throw new Error('Este aparelho não aceita notificações. No iPhone, adicione o app à tela inicial primeiro.');
  }
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Notificações não autorizadas neste aparelho.');
  const registro = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registro
  });
  await setDoc(ref('tokensPush', uid), { token, atualizadoEm: agora(), plataforma: navigator.userAgent.slice(0, 120) });
  return token;
}
