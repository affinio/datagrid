import { createWorkspaceVitestConfig } from "../../config/vitest.base"

export default createWorkspaceVitestConfig(import.meta.url, {
  test: {
    environment: "jsdom",
    include: ["src/**/__tests__/**/*.spec.ts"],
  },
})
