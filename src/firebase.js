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

// Identificação do app Web "encomendas-web" no projeto encomendas-apmg.
// Estes valores são públicos por natureza (vão para o celular de todo usuário);
// quem protege os dados são as regras do Firestore (firestore.rules).
// Um arquivo .env.local pode sobrescrevê-los para testes.
const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyAHGYLaaP8Ri9HeQ08qPXFElHU5sFspUlA',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'encomendas-apmg.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'encomendas-apmg',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'encomendas-apmg.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '227616181253',
  appId: env.VITE_FIREBASE_APP_ID || '1:227616181253:web:7638d8ce2eb45fc007a06c'
};
export const configurado = true;

export const app = initializeApp(config);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
