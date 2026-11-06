import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA: o app pode ser instalado na tela inicial do celular (Android e iPhone)
// e continua abrindo sem internet. O service worker fica em src/sw.js e
// também recebe as notificações enviadas pela rotina do GitHub Actions.
// O app é publicado no GitHub Pages, em
// https://encomendasapmg-maker.github.io/encomendas-apmg/ (subpasta = base).
export default defineConfig({
  base: '/encomendas-apmg/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Encomendas – Corpo da Guarda APMG',
        short_name: 'Encomendas',
        description: 'Recebimento, guarda e entrega de encomendas no Corpo da Guarda da APMG',
        lang: 'pt-BR',
        display: 'standalone',
        background_color: '#F3F4F6',
        theme_color: '#14213D',
        icons: [
          { src: 'icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ]
});
