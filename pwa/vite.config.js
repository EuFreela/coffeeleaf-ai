import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Em subpath (ex.: GitHub Pages em /CoffeeLeaf-AI/) defina base aqui.
  base: '/',

  build: {
    target: 'es2022',
    // TF.js e grande; o aviso de chunk nao se aplica a uma unica entrada.
    chunkSizeWarningLimit: 1500,
  },

  server: {
    port: 5173,
    // 127.0.0.1 por padrao: `npm run dev:lan` sobrescreve com --host para
    // expor na rede. A camera exige contexto seguro, entao acesso por IP LAN
    // em http:// nao habilita getUserMedia — use `npm run preview:https`
    // ou publique (sdd.md §13).
    host: '127.0.0.1',
  },

  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: null, // o registro e feito em src/main.js (sdd.md P-1)
      // globPatterns abaixo ja cobre .svg e .png, portanto includeAssets
      // duplicaria as entradas do precache.
      manifest: {
        id: '/',
        name: 'CoffeeLeaf AI — Identificação de Condições Foliares',
        short_name: 'CoffeeLeaf',
        description:
          'Fotografe uma folha de café e identifique sua condição fitossanitária em ' +
          'segundos, por inteligência artificial executada no próprio dispositivo.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0f2419',
        theme_color: '#0f2419',
        categories: ['productivity', 'utilities', 'education'],
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,bin}'],
        // O modelo (~2,2 MB) e imutavel: CacheFirst com revision por hash.
        // sdd.md §8.2
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true, // P-2
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/model\//],
        clientsClaim: false,
        skipWaiting: false, // P-1
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'imagens',
              expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
