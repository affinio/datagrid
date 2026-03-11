import vue from "@vitejs/plugin-vue"
import { createWorkspaceVitestConfig } from "../../config/vitest.base"

export default createWorkspaceVitestConfig(import.meta.url, {
  plugins: [vue()],
  resolve: {
    extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
  },
  ssr: {
    noExternal: [/^@affino\//],
  },
  test: {
    environment: "jsdom",
    globals: true,
    reporters: "dot",
    server: {
      deps: {
        inline: [/^@affino\//, /node_modules\/\.pnpm\/@affino\+/],
      },
    },
    deps: {
      inline: [/^@affino\//, /node_modules\/\.pnpm\/@affino\+/],
    },
    include: ["src/**/__tests__/**/*.spec.ts"],
  },
})
