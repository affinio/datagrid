import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { createWorkspaceAliases } from '../../../config/workspace-aliases'

export default defineConfig({
  root: fileURLToPath(new URL('./fixture', import.meta.url)),
  plugins: [vue()],
  resolve: { alias: createWorkspaceAliases(import.meta.url) },
  build: { outDir: '/tmp/affino-browser-fixture', emptyOutDir: true },
  preview: { host: '127.0.0.1', port: 4175, strictPort: true },
})
