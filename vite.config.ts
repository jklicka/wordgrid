import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      // Levels ARE the game. A cached shell with no content would install
      // fine and then be unplayable in airplane mode, which is worse than not
      // installing at all — so the level JSON is precached too.
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      devOptions: { enabled: false },
      manifest: {
        name: 'WordGrid — vocabulary word game',
        short_name: 'WordGrid',
        description:
          'Solve words from a letter wheel and learn what they mean. Every word you find adds to your vocabulary.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // The board is a fixed vertical stack sized in dvh; landscape leaves
        // no room for both the grid and the wheel.
        orientation: 'portrait',
        background_color: '#141824',
        theme_color: '#141824',
        categories: ['games', 'education'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { port: 5180 },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
})
