import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import { createWorkspaceAliases } from "../../config/workspace-aliases"

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: createWorkspaceAliases(import.meta.url),
  },
  server: {
    host: true,
    port: 5174,
  },
})
