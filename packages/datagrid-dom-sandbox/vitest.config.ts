import { createWorkspaceVitestConfig } from "../../config/vitest.base"
import { fileURLToPath } from "node:url"

export default createWorkspaceVitestConfig(import.meta.url, {
  resolve: {
    alias: {
      "@affino/menu-core": fileURLToPath(new URL("./src/test-support/menuCoreMock.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.ts"],
    clearMocks: true,
  },
})
