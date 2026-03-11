import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import { resolve } from "node:path"

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        "vue",
        "@affino/datagrid-core",
        "@affino/datagrid-theme",
        "@affino/datagrid-vue",
        "@affino/datagrid-vue/advanced",
        "@affino/datagrid-vue-app",
        "@affino/datagrid-vue-app/internal",
      ],
    },
  },
})
