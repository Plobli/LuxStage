import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [tailwindcss(), vue()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../shared'),
    },
  },
  build: {
    outDir: 'dist', // direkt relativ zum Projektroot, kein Umweg über ../web-app/
    emptyOutDir: true, // alte Artefakte vor jedem Build bereinigen
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router'],
          'vendor-ui': ['radix-vue', 'reka-ui'],
          'vendor-konva': ['konva', 'vue-konva'],
          'vendor-tiptap': ['@tiptap/starter-kit', '@tiptap/vue-3', '@tiptap/extension-placeholder', 'tiptap-markdown'],
          'vendor-pdf': ['jspdf'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_SERVER_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
