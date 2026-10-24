import vue from "@vitejs/plugin-vue"
import { resolve } from "node:path"
import { defineConfig } from "vite"

const appSource = resolve(__dirname, "src/app-layer")

export default defineConfig({
  // Library assets (including the XLSX worker) must resolve relative to the
  // published package chunks, not the consuming application's domain root.
  base: "./",
  plugins: [vue()],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: false,
    lib: {
      entry: {
        "app/index": resolve(appSource, "index.ts"),
        gantt: resolve(appSource, "gantt.ts"),
        aggregations: resolve(appSource, "aggregations.ts"),
        "advanced-filter": resolve(appSource, "advanced-filter.ts"),
        "quick-filter": resolve(appSource, "quick-filter.ts"),
        "find-replace": resolve(appSource, "find-replace.ts"),
        internal: resolve(appSource, "internal.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: id => id === "vue"
        || id.startsWith("@affino/datagrid-")
        || id === "@affino/projection-engine"
        || id.startsWith("@affino/menu-vue")
        || id.startsWith("@affino/popover-vue"),
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  worker: {
    format: "es",
  },
})
