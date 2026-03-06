import { createWorkspaceVitestConfig } from "../../config/vitest.base"
import vue from "@vitejs/plugin-vue"

export default createWorkspaceVitestConfig(import.meta.url, {
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: true,
    reporters: "dot",
    include: ["src/**/__tests__/**/*.spec.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      include: [
        "src/components/overlayRenderer.ts",
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
