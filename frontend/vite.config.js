import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // L'application s'installe depuis le navigateur et s'épingle à la barre des tâches.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'La Maison de la Conservation',
        short_name: 'LMC Rooms',
        description: 'Réservation des salles mutualisées de La Maison de la Conservation.',
        lang: 'fr',
        start_url: '/accueil',
        scope: '/',
        display: 'standalone',
        background_color: '#f5f6f8',
        theme_color: '#0573af',
        // Le lien de connexion arrive par mail. Sans ces deux réglages, le navigateur
        // l'ouvre dans un onglet et l'application se retrouve hors de sa fenêtre
        // installée. « preferred » le fait capter par la PWA, « navigate-existing »
        // réutilise la fenêtre déjà ouverte au lieu d'en créer une seconde.
        handle_links: 'preferred',
        launch_handler: { client_mode: 'navigate-existing' },
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Seule la coquille de l'application est mise en cache. Les réservations ne le
        // sont jamais : un créneau lu hors ligne serait faux dès qu'un autre utilisateur
        // réserve, et on préfère une erreur réseau visible à une disponibilité fausse.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/admin/, /^\/static/],
        runtimeCaching: [
          {
            // Exception : l'écran mural du hall. Personne n'est devant pour recharger,
            // donc une version de moins d'une heure vaut mieux qu'un écran blanc.
            urlPattern: ({ url }) => url.pathname === '/api/affichage/',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'affichage-mural',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // En développement, Vite relaie /api, /admin et /static vers Django.
      // Le navigateur ne voit donc qu'une seule origine (localhost:5173), exactement
      // comme derrière nginx en production : même comportement des cookies, pas de CORS.
      //
      // Les clés sont des préfixes : écrite '/admin', la règle capturerait aussi la route
      // React '/administration' et l'enverrait à Django (404). D'où le slash final, et une
      // expression régulière pour l'admin afin d'accepter aussi '/admin' tout court.
      '/api/': { target: 'http://localhost:8000', changeOrigin: true },
      '^/admin(/|$)': { target: 'http://localhost:8000', changeOrigin: true },
      '/static/': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
