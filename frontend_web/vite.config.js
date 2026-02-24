import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/events\/\d+\/pre-fetch-qrs/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'scanner-qrs-cache-v1',
            }
          }
        ]
      },
      manifest: {
        name: 'EventoApp Scanner Pro',
        short_name: 'EventoApp',
        theme_color: '#ffffff',
      }
    })
  ],
  server: {
    host: true
  }
})

