import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"
import base from "../datagrid-cost-browser/vite.config.mts"

export default defineConfig({
  ...base,
  root: fileURLToPath(new URL("./browser", import.meta.url)),
  build: { ...base.build, outDir: "/tmp/affino-overload-audit/browser-dist", emptyOutDir: true },
  preview: { host: "127.0.0.1", port: 4192 },
})
