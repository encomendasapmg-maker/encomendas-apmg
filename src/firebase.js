// Conexão com o Firebase (projeto encomendas-apmg, plano Spark).
// O cache local permite registrar encomendas mesmo sem internet: o registro
// fica salvo no aparelho e é enviado quando a conexão volta.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';

const env = import.meta.env;
export const configurado = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_APP_ID);

// Sem configuração, o app abre só a tela de entrada com um aviso (não quebra).
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'nao-configurado',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'encomendas-apmg.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'encomendas-apmg',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

export const app = initializeApp(config);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
