import { createWorkspaceVitestConfig } from "../../config/vitest.base"

export default createWorkspaceVitestConfig(import.meta.url, {
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
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
})
