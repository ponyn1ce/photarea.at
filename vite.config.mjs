import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config in ESM to avoid CJS deprecation warning
// https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated
export default defineConfig({
  plugins: [react()],
  base: './', // <- ОБЯЗАТЕЛЬ НО перед сборкой
})
