import { createWorkspaceVitestConfig } from "../../../config/vitest.base"
import vue from "@vitejs/plugin-vue"

export default createWorkspaceVitestConfig(import.meta.url, {
  plugins: [vue()],
  ssr: { noExternal: [/^@affino\//] },
  test: {
    environment: "node", include: ["scripts/audits/datagrid-identity/*.spec.ts"], reporters: "dot",
    server: { deps: { inline: [/^@affino\//, /node_modules\/\.pnpm\/@affino\+/] } },
  },
})
