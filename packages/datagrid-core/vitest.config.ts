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
        "src/columns/pinning.ts",
        "src/selection/coordinateSpace.ts",
        "src/selection/geometry.ts",
        "src/selection/selectionState.ts",
        "src/selection/selectionOverlay.ts",
        "src/viewport/scrollSync.ts",
        "src/viewport/dataGridViewportHorizontalClamp.ts",
        "src/viewport/dataGridViewportHorizontalUpdate.ts",
      ],
      exclude: ["src/**/*.d.ts"],
      thresholds: {
        lines: 59,
        functions: 51,
        branches: 45,
        statements: 59,
      },
    },
  },
})
