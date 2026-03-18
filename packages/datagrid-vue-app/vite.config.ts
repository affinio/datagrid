import vue from "@vitejs/plugin-vue"
import { resolve } from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        gantt: resolve(__dirname, "src/gantt.ts"),
        "advanced-filter": resolve(__dirname, "src/advanced-filter.ts"),
        internal: resolve(__dirname, "src/internal.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: id => id === "vue" || id.startsWith("@affino/"),
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
})