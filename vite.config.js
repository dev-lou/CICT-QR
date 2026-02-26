import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      manifest: {
        id: 'com.isufst.cict.qr',
        name: 'IT Week 2026 QR Attendance System',
        short_name: 'IT Week QR',
        description: 'ISUFST CICT IT Week 2026 QR Attendance and Live Scoreboard System',
        theme_color: '#800000',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['education', 'productivity', 'events'],
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        screenshots: [
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Home Screen'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Mobile View'
          }
        ]
      }
    })
  ],
})
