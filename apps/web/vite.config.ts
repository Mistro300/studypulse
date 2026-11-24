import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon-192.svg', 'icons/icon-512.svg'],
      manifest: {
        name: 'StudyPulse — Smart Study & Live Quiz Hub',
        short_name: 'StudyPulse',
        description:
          'Offline-first FSRS-5 spaced repetition study companion with real-time timed quiz rooms.',
        theme_color: '#FAF9F6',
        background_color: '#FAF9F6',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Daily Study Review',
            short_name: 'Study Now',
            url: '/study',
            description: 'Start your due FSRS-5 cards immediately (works offline)',
          },
          {
            name: 'Join Live Room',
            short_name: 'Live Rooms',
            url: '/rooms',
            description: 'Join or host a live timed quiz room',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/socket.io'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/rooms'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'studypulse-rooms-cache',
              networkTimeoutSeconds: 4,
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/decks') || url.pathname.startsWith('/api/profile'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'studypulse-data-cache',
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('socket.io-client') || id.includes('engine.io')) return 'vendor-socket';
          if (id.includes('dexie')) return 'vendor-dexie';
          if (id.includes('i18next')) return 'vendor-i18n';
          if (id.includes('ts-fsrs') || id.includes('zod')) return 'vendor-domain';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (
            id.includes('react-dom') ||
            id.includes('@tanstack') ||
            id.includes('scheduler') ||
            /[\\/]react[\\/]/.test(id)
          ) {
            return 'vendor-framework';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
      },
    },
  },
});
