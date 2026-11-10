import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import { fileURLToPath } from "node:url"
import { createWorkspaceAliases } from "../../../config/workspace-aliases.ts"

export default defineConfig({
  root: fileURLToPath(new URL("./browser", import.meta.url)),
  plugins: [vue()],
  resolve: {
    alias: {
      ...createWorkspaceAliases(import.meta.url),
      "@affino/datagrid-server-adapters": fileURLToPath(new URL("../../../packages/datagrid-server-adapters/src/index.ts", import.meta.url)),
      vue: process.env.VUE_RUNTIME ?? fileURLToPath(new URL("../../../node_modules/vue/dist/vue.esm-bundler.js", import.meta.url)),
    },
  },
  build: { outDir: "/tmp/affino-vnode-scroll/browser-dist", emptyOutDir: true, sourcemap: true },
  server: { host: "127.0.0.1", port: 4194 },
  preview: { host: "127.0.0.1", port: 4194 },
})
