import { createWorkspaceVitestConfig } from "../../../config/vitest.base"

export default createWorkspaceVitestConfig(import.meta.url, {
  test: {
    environment: "node",
    include: ["scripts/audits/datagrid-overload/*.spec.ts"],
    reporters: "dot",
  },
})
