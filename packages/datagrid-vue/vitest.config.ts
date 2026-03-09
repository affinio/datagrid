import { createWorkspaceVitestConfig } from "../../config/vitest.base"
import vue from "@vitejs/plugin-vue"

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
    coverage: {
      reporter: ["text", "lcov"],
      include: [
        "src/adapters/selectionControllerAdapter.ts",
        "src/adapters/selectionHeadlessAdapter.ts",
        "src/composables/selection/selectionGeometry.ts",
        "src/composables/selection/selectionInput.ts",
        "src/composables/selection/selectionStateSync.ts",
        "src/composables/selection/selectionControllerStateScheduler.ts",
        "src/composables/selection/selectionOverlayUpdateScheduler.ts",
      ],
      exclude: ["src/**/*.d.ts"],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 55,
        statements: 75,
      },
    },
  },
})
