import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Vite 8 automatically handles chunking better than manual objects.
    // We remove manualChunks to prevent the Rolldown crash.
  }
})
