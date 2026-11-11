import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    minify: false, // temporary: fixes TDZ error
  },
  plugins: [react(), tailwindcss()],
  server: { host: true },
  resolve: {
    alias: {
      // All `from 'lucide-react'` imports resolve to the Phosphor shim.
      'lucide-react': path.resolve(__dirname, 'src/lib/lucide-shim.jsx'),
    },
  },
})
